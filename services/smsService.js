const axios = require('axios');
const crypto = require('crypto');

class SMSService {
  constructor() {
    this.endpoint = process.env.HUAWEI_SMS_ENDPOINT;
    this.appKey = process.env.HUAWEI_SMS_APP_KEY;
    this.appSecret = process.env.HUAWEI_SMS_APP_SECRET;
    this.sender = 'FarmSight';
  }

  // Generate Huawei SMS signature
  generateSignature(url, method, timestamp, nonce, body = '') {
    const canonicalUri = url.replace(/^https?:\/\/[^\/]+/, '');
    const canonicalQueryString = url.split('?')[1] || '';
    const canonicalHeaders = `host:${new URL(url).hostname}\nx-sdk-date:${timestamp}\n`;
    const signedHeaders = 'host;x-sdk-date';
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${crypto.createHash('sha256').update(body).digest('hex')}`;

    const stringToSign = `SDK-HMAC-SHA256\n${timestamp}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

    return crypto.createHmac('sha256', this.appSecret).update(stringToSign).digest('base64');
  }

  // Send SMS alert to farmer
  async sendAlert(phoneNumber, farmerName, farmName, stressLevel, recommendations) {
    try {
      const templateId = '8a5e0b8a1a0a4e5b8a1a0a1a1a1a1a1'; // Replace with your actual template ID
      const templateParas = [
        farmerName,
        farmName,
        stressLevel,
        recommendations.slice(0, 2).join(', ') // Limit to first 2 recommendations
      ];

      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14) + 'Z';
      const nonce = Math.random().toString(36).substring(2);

      const body = JSON.stringify({
        from: this.sender,
        to: `+${phoneNumber}`,
        templateId: templateId,
        templateParas: templateParas,
        statusCallback: process.env.BASE_URL + '/api/sms/status'
      });

      const signature = this.generateSignature(this.endpoint, 'POST', timestamp, nonce, body);

      const response = await axios.post(this.endpoint, JSON.parse(body), {
        headers: {
          'Authorization': `WSSE realm="sdkservice",sdkdate="${timestamp}",nonce="${nonce}",signature="${signature}"`,
          'Content-Type': 'application/json;charset=utf-8',
          'X-WSSE': `Username ${this.appKey},PasswordDigest="${crypto.createHash('sha256').update(nonce + timestamp + this.appSecret).digest('hex')}",Nonce="${nonce}",Created="${timestamp}"`
        }
      });

      console.log(`✅ SMS alert sent to ${farmerName} for farm: ${farmName}`);
      return {
        success: true,
        messageId: response.data.result?.sid,
        statusCode: response.data.result?.code,
        statusDesc: response.data.result?.desc
      };
    } catch (error) {
      console.error('❌ Failed to send SMS:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send bulk SMS to multiple farmers
  async sendBulkAlerts(farmers, stressData) {
    const results = [];

    for (const farmer of farmers) {
      const farm = stressData.find(f => f.farmId === farmer.farmId);
      if (farm && farmer.phoneNumber && farm.stressLevel !== 'healthy') {
        const result = await this.sendAlert(
          farmer.phoneNumber,
          farmer.fullName,
          farmer.farmName,
          farm.stressLevel,
          farm.recommendations
        );
        results.push({
          farmerId: farmer.farmerId,
          farmId: farmer.farmId,
          result
        });

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      totalSent: results.length,
      successCount: results.filter(r => r.result.success).length,
      failureCount: results.filter(r => !r.result.success).length,
      results
    };
  }

  // Generate alert message based on stress level
  generateAlertMessage(farmerName, farmName, stressLevel, ndviValue, recommendations) {
    const urgency = stressLevel === 'severe' ? 'URGENT' : stressLevel === 'high' ? 'IMPORTANT' : 'INFO';

    return `[${urgency}] FarmSight Alert: ${farmerName}, your farm "${farmName}" shows ${stressLevel} stress (NDVI: ${ndviValue.toFixed(3)}). ${recommendations.slice(0, 2).join('. ')}. Take action immediately!`;
  }

  // Create custom alert for specific events
  async createCustomAlert(phoneNumber, message, urgency = 'normal') {
    try {
      const body = JSON.stringify({
        from: this.sender,
        to: `+${phoneNumber}`,
        body: message,
        urgency: urgency
      });

      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14) + 'Z';
      const nonce = Math.random().toString(36).substring(2);
      const signature = this.generateSignature(this.endpoint, 'POST', timestamp, nonce, body);

      const response = await axios.post(this.endpoint, JSON.parse(body), {
        headers: {
          'Authorization': `WSSE realm="sdkservice",sdkdate="${timestamp}",nonce="${nonce}",signature="${signature}"`,
          'Content-Type': 'application/json;charset=utf-8',
          'X-WSSE': `Username ${this.appKey},PasswordDigest="${crypto.createHash('sha256').update(nonce + timestamp + this.appSecret).digest('hex')}",Nonce="${nonce}",Created="${timestamp}"`
        }
      });

      return {
        success: true,
        messageId: response.data.result?.sid
      };
    } catch (error) {
      console.error('❌ Failed to send custom SMS:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check SMS delivery status
  async checkDeliveryStatus(messageId) {
    try {
      const response = await axios.get(`${this.endpoint}/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${this.appKey}`
        }
      });

      return {
        messageId,
        status: response.data.deliveryStatus,
        statusDescription: response.data.statusDescription,
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error('❌ Failed to check SMS status:', error.message);
      return null;
    }
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // Check if it's a valid mobile number (10-15 digits)
    if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
      return cleanNumber;
    }

    return null;
  }

  // Format phone number for international sending
  formatPhoneNumber(phoneNumber, countryCode = '+62') {
    const cleanNumber = this.validatePhoneNumber(phoneNumber);
    if (!cleanNumber) return null;

    // If already has country code, return as is
    if (cleanNumber.startsWith('+')) {
      return cleanNumber;
    }

    // If starts with 0 (local format), remove it and add country code
    if (cleanNumber.startsWith('0')) {
      return `${countryCode}${cleanNumber.substring(1)}`;
    }

    // Otherwise, add country code
    return `${countryCode}${cleanNumber}`;
  }
}

module.exports = SMSService;