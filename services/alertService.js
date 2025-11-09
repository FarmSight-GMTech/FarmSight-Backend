const AIStressDetector = require('./aiStressDetector');
const SMSService = require('./smsService');
const User = require('../models/User');
const Farm = require('../models/Farm');
const NDVIData = require('../models/NDVIData');
const Alert = require('../models/Alert');

class AlertService {
  constructor() {
    this.aiDetector = new AIStressDetector();
    this.smsService = new SMSService();
    this.stressCache = new Map(); // Cache to avoid duplicate alerts
    this.alertCooldown = 24 * 60 * 60 * 1000; // 24 hours cooldown
  }

  // Initialize alert system
  async initialize() {
    await this.aiDetector.initializeHuaweiAI();
    console.log('✅ Alert system initialized');
  }

  // Analyze farm and send alerts if needed
  async analyzeFarmAndAlert(farmId, forceAnalysis = false) {
    try {
      const farm = await Farm.findById(farmId);
      if (!farm || !farm.isActive) {
        return { success: false, error: 'Farm not found or inactive' };
      }

      const farmOwner = await User.findById(farm.owner);
      if (!farmOwner || !farmOwner.isActive) {
        return { success: false, error: 'Farm owner not found or inactive' };
      }

      // Get recent NDVI data
      const ndviData = await NDVIData.find({ farm: farmId })
        .sort({ date: -1 })
        .limit(30);

      if (ndviData.length < 3) {
        return { success: false, error: 'Insufficient NDVI data for analysis' };
      }

      // Perform AI stress analysis
      const analysis = await this.aiDetector.detectCropStress(
        ndviData,
        `${farm.coordinates.latitude},${farm.coordinates.longitude}`,
        {
          area: farm.area,
          cropType: farm.cropType,
          plantingDate: farm.plantingDate
        }
      );

      // Generate forecast
      const forecast = this.aiDetector.generateStressForecast(ndviData, 14);

      // Store analysis results
      await this.storeAnalysisResults(farmId, analysis, forecast);

      // Check if alert should be sent
      const shouldAlert = await this.shouldSendAlert(farmId, analysis);

      if (shouldAlert) {
        const alertResult = await this.sendAlert(farmOwner, farm, analysis);

        // Store alert record
        await this.storeAlertRecord(farmId, analysis, alertResult);

        return {
          success: true,
          analysis,
          forecast,
          alertSent: alertResult.success,
          alertId: alertResult.messageId
        };
      }

      return {
        success: true,
        analysis,
        forecast,
        alertSent: false,
        reason: analysis.stressLevel === 'healthy' || 'Recently alerted'
      };

    } catch (error) {
      console.error(`❌ Failed to analyze farm ${farmId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Analyze all farms (scheduled task)
  async analyzeAllFarms() {
    try {
      console.log('🔍 Starting analysis of all farms...');

      const farms = await Farm.find({ isActive: true });
      const results = [];

      for (const farm of farms) {
        const result = await this.analyzeFarmAndAlert(farm._id);
        results.push({
          farmId: farm._id,
          farmName: farm.name,
          result
        });

        // Add delay to avoid API rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const summary = {
        totalFarms: farms.length,
        analyzed: results.length,
        alertsSent: results.filter(r => r.result.alertSent).length,
        healthy: results.filter(r => r.result.analysis?.stressLevel === 'healthy').length,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Farm analysis completed:', summary);
      return summary;

    } catch (error) {
      console.error('❌ Failed to analyze all farms:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Check if alert should be sent
  async shouldSendAlert(farmId, analysis) {
    // Don't send alerts for healthy farms
    if (analysis.stressLevel === 'healthy' || analysis.stressLevel === 'low') {
      return false;
    }

    // Check cooldown
    const lastAlert = this.stressCache.get(farmId);
    const now = Date.now();

    if (lastAlert && (now - lastAlert.timestamp) < this.alertCooldown) {
      return false;
    }

    // Check confidence threshold
    if (analysis.confidence < 0.7) {
      return false;
    }

    return true;
  }

  // Send alert to farmer
  async sendAlert(farmer, farm, analysis) {
    try {
      const phoneNumber = this.smsService.formatPhoneNumber(farmer.phoneNumber);

      if (!phoneNumber) {
        console.warn(`⚠️ Invalid phone number for farmer: ${farmer.fullName}`);
        return { success: false, error: 'Invalid phone number' };
      }

      const message = this.generateAlertMessage(farmer.fullName, farm.name, analysis);
      const result = await this.smsService.createCustomAlert(
        phoneNumber,
        message,
        this.getUrgencyLevel(analysis.stressLevel)
      );

      if (result.success) {
        // Update cache
        this.stressCache.set(farm._id, {
          timestamp: Date.now(),
          stressLevel: analysis.stressLevel,
          messageId: result.messageId
        });

        console.log(`📱 Alert sent to ${farmer.fullName} for farm: ${farm.name}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Failed to send alert for farm ${farm.name}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Generate alert message
  generateAlertMessage(farmerName, farmName, analysis) {
    const urgency = this.getUrgencyPrefix(analysis.stressLevel);

    let message = `${urgency} FarmSight Alert\n\n`;
    message += `Hi ${farmerName},\n`;
    message += `Your farm "${farmName}" shows ${analysis.stressLevel} crop stress.\n\n`;

    if (analysis.ndviAnalysis) {
      message += `Current NDVI: ${analysis.ndviAnalysis.current.toFixed(3)}\n`;
      message += `Confidence: ${(analysis.confidence * 100).toFixed(0)}%\n\n`;
    }

    message += `Recommendations:\n`;
    analysis.recommendations.forEach(rec => {
      message += `• ${rec}\n`;
    });

    message += `\nCheck your FarmSight app for detailed analysis.`;

    return message;
  }

  // Get urgency level
  getUrgencyLevel(stressLevel) {
    switch (stressLevel) {
      case 'severe': return 'urgent';
      case 'high': return 'high';
      case 'moderate': return 'normal';
      case 'low': return 'low';
      default: return 'normal';
    }
  }

  // Get urgency prefix
  getUrgencyPrefix(stressLevel) {
    switch (stressLevel) {
      case 'severe': return '🚨 URGENT';
      case 'high': return '⚠️ IMPORTANT';
      case 'moderate': return 'ℹ️ INFO';
      default: return 'ℹ️ INFO';
    }
  }

  // Store analysis results
  async storeAnalysisResults(farmId, analysis, forecast) {
    try {
      // Store latest NDVI analysis in farm record (if needed)
      await Farm.findByIdAndUpdate(farmId, {
        lastNDVIAnalysis: {
          stressLevel: analysis.stressLevel,
          confidence: analysis.confidence,
          ndviValue: analysis.ndviAnalysis?.current,
          analyzedAt: new Date()
        }
      });

      // Store forecast data if available
      if (forecast && forecast.forecast) {
        // Store in NDVIData collection with special flag for forecast
        for (const forecastDay of forecast.forecast) {
          await NDVIData.findOneAndUpdate(
            {
              farm: farmId,
              date: new Date(forecastDay.date),
              forecast: true
            },
            {
              farm: farmId,
              date: new Date(forecastDay.date),
              ndvi: forecastDay.predictedNDVI,
              stressLevel: forecastDay.stressLevel,
              confidence: forecastDay.confidence,
              forecast: true,
              aiAnalysis: {
                ...analysis,
                forecastDate: forecastDay.date
              },
              createdAt: new Date()
            },
            { upsert: true, new: true }
          );
        }
      }

    } catch (error) {
      console.error('❌ Failed to store analysis results:', error.message);
    }
  }

  // Store alert record
  async storeAlertRecord(farmId, analysis, alertResult, farm, farmer) {
    try {
      const alert = new Alert({
        farmId: farmId,
        userId: farmer._id,
        stressLevel: analysis.stressLevel,
        confidence: analysis.confidence,
        ndviValue: analysis.ndviAnalysis?.current || 0,
        recommendations: analysis.recommendations || [],
        riskFactors: analysis.riskFactors || [],
        aiAnalysis: analysis.analysis,
        alertType: alertResult.success ? 'sms' : 'in_app',
        status: alertResult.success ? 'sent' : 'failed',
        sentAt: alertResult.success ? new Date() : null,
        phoneNumber: farmer.phoneNumber,
        message: this.generateAlertMessage(farmer.fullName, farm.name, analysis),
        urgency: this.getUrgencyLevel(analysis.stressLevel)
      });

      await alert.save();
      console.log(`📝 Alert record stored for farm ${farmId}: ${alert._id}`);
      return alert;
    } catch (error) {
      console.error('❌ Failed to store alert record:', error.message);
      return null;
    }
  }

  // Get alert history for a farm
  async getAlertHistory(farmId, days = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const alerts = await Alert.find({
        farmId: farmId,
        createdAt: { $gte: since }
      })
      .sort({ createdAt: -1 })
      .populate('farmId', 'name coordinates cropType')
      .populate('userId', 'fullName email');

      return {
        farmId,
        alerts: alerts.map(alert => ({
          id: alert._id,
          date: alert.createdAt,
          stressLevel: alert.stressLevel,
          ndviValue: alert.ndviValue,
          confidence: alert.confidence,
          recommendations: alert.recommendations,
          riskFactors: alert.riskFactors,
          aiAnalysis: alert.aiAnalysis,
          alertType: alert.alertType,
          status: alert.status,
          urgency: alert.urgency,
          acknowledged: alert.acknowledged,
          actionTaken: alert.actionTaken,
          formattedDate: alert.formattedDate
        })),
        totalAlerts: alerts.length
      };

    } catch (error) {
      console.error('❌ Failed to get alert history:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get alert statistics
  async getAlertStatistics(days = 30, userId = null) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const query = {
        createdAt: { $gte: since }
      };

      if (userId) {
        query.userId = userId;
      }

      const alerts = await Alert.find(query);

      const stats = {
        totalAlerts: alerts.length,
        byStressLevel: {},
        byDay: {},
        averageConfidence: 0,
        alertTypes: { sms: 0, in_app: 0, email: 0 },
        urgency: { low: 0, medium: 0, high: 0, critical: 0 },
        acknowledged: 0,
        unacknowledged: 0
      };

      let totalConfidence = 0;
      alerts.forEach(alert => {
        // Count by stress level
        stats.byStressLevel[alert.stressLevel] = (stats.byStressLevel[alert.stressLevel] || 0) + 1;

        // Count by day
        const day = alert.createdAt.toISOString().split('T')[0];
        stats.byDay[day] = (stats.byDay[day] || 0) + 1;

        // Count by alert type
        stats.alertTypes[alert.alertType] = (stats.alertTypes[alert.alertType] || 0) + 1;

        // Count by urgency
        stats.urgency[alert.urgency] = (stats.urgency[alert.urgency] || 0) + 1;

        // Count acknowledged vs unacknowledged
        if (alert.acknowledged) {
          stats.acknowledged++;
        } else {
          stats.unacknowledged++;
        }

        // Average confidence
        totalConfidence += alert.confidence || 0;
      });

      stats.averageConfidence = alerts.length > 0 ? totalConfidence / alerts.length : 0;

      return stats;

    } catch (error) {
      console.error('❌ Failed to get alert statistics:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = AlertService;