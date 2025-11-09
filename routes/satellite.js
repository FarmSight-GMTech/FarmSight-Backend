const express = require('express');
const router = express.Router();
const earthEngineService = require('../services/earthEngine');
const huaweiCloudService = require('../services/huaweiCloud');
const AIStressDetector = require('../services/aiStressDetector');
const AlertService = require('../services/alertService');
const NDVIData = require('../models/NDVIData');
const Farm = require('../models/Farm');

router.get('/imagery/:coordinates', async (req, res) => {
  try {
    const { coordinates } = req.params;
    const { startDate, endDate } = req.query;

    const imagery = await earthEngineService.getSatelliteImagery(
      coordinates,
      startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0]
    );

    res.json(imagery);
  } catch (error) {
    console.error('Satellite imagery error:', error);
    res.status(500).json({ error: 'Failed to fetch satellite imagery' });
  }
});

router.get('/ndvi/:coordinates/:date', async (req, res) => {
  try {
    const { coordinates, date } = req.params;

    const ndviData = await earthEngineService.calculateNDVI(coordinates, date);

    // Get AI analysis from Huawei Cloud
    const analysis = await huaweiCloudService.analyzeCropStress(ndviData, coordinates);

    res.json({
      ndvi: ndviData,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('NDVI calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate NDVI' });
  }
});

router.get('/timeseries/:coordinates', async (req, res) => {
  try {
    const { coordinates } = req.params;
    const { startDate, endDate } = req.query;

    const timeSeries = await earthEngineService.getTimeSeriesNDVI(
      coordinates,
      startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0]
    );

    res.json(timeSeries);
  } catch (error) {
    console.error('Time series error:', error);
    res.status(500).json({ error: 'Failed to generate NDVI time series' });
  }
});

router.get('/forecast/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { days } = req.query;

    // Get farm data first
    const farmData = await huaweiCloudService.getFarmData(farmId);

    // Get historical NDVI data
    const historicalData = await earthEngineService.getTimeSeriesNDVI(
      farmData.coordinates,
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );

    // Generate forecast (simplified linear regression)
    const forecastDays = parseInt(days) || 30;
    const forecast = generateNDVIForecast(historicalData, forecastDays);

    res.json({
      farmId,
      farmData,
      historicalData,
      forecast,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('NDVI forecast error:', error);
    res.status(500).json({ error: 'Failed to generate NDVI forecast' });
  }
});

router.get('/analysis/:coordinates', async (req, res) => {
  try {
    const { coordinates } = req.params;
    const { radius } = req.query;

    const analysis = await earthEngineService.getAreaAnalysis(
      coordinates,
      parseFloat(radius) || 100
    );

    res.json(analysis);
  } catch (error) {
    console.error('Area analysis error:', error);
    res.status(500).json({ error: 'Failed to perform area analysis' });
  }
});

// AI-powered stress detection for farm
router.post('/analyze-stress/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { forceAnalysis = false } = req.body;

    const alertService = new AlertService();
    const result = await alertService.analyzeFarmAndAlert(farmId, forceAnalysis);

    res.json(result);
  } catch (error) {
    console.error('Stress analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze crop stress' });
  }
});

// AI-powered NDVI analysis with real-time data
router.post('/ndvi-analysis', async (req, res) => {
  try {
    const { ndviData, coordinates, farmMetadata } = req.body;

    if (!ndviData || !Array.isArray(ndviData) || ndviData.length === 0) {
      return res.status(400).json({ error: 'NDVI data is required' });
    }

    const aiDetector = new AIStressDetector();
    await aiDetector.initializeHuaweiAI();

    const analysis = await aiDetector.detectCropStress(
      ndviData,
      coordinates,
      farmMetadata || {}
    );

    // Generate forecast
    const forecast = aiDetector.generateStressForecast(ndviData, 14);

    res.json({
      analysis,
      forecast,
      ndviDataPoints: ndviData.length,
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('NDVI AI analysis error:', error);
    res.status(500).json({ error: 'Failed to perform AI NDVI analysis' });
  }
});

// Get farm stress forecast
router.get('/stress-forecast/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { days = 14 } = req.query;

    // Get NDVI data for the farm
    const ndviData = await NDVIData.find({ farm: farmId })
      .sort({ date: -1 })
      .limit(30);

    if (ndviData.length < 3) {
      return res.status(400).json({
        error: 'Insufficient NDVI data for forecasting (minimum 3 data points required)'
      });
    }

    const aiDetector = new AIStressDetector();
    const forecast = aiDetector.generateStressForecast(ndviData, parseInt(days));

    // Get current farm status
    const latestNDVI = ndviData[0];
    const currentStressLevel = aiDetector.analyzeWithRules(ndviData, {}).stressLevel;

    res.json({
      farmId,
      currentStatus: {
        ndvi: latestNDVI.ndvi,
        stressLevel: currentStressLevel,
        lastUpdated: latestNDVI.date
      },
      forecast,
      forecastDays: parseInt(days),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stress forecast error:', error);
    res.status(500).json({ error: 'Failed to generate stress forecast' });
  }
});

// Trigger analysis for all farms (admin endpoint)
router.post('/analyze-all-farms', async (req, res) => {
  try {
    const alertService = new AlertService();
    const result = await alertService.analyzeAllFarms();

    res.json(result);
  } catch (error) {
    console.error('Bulk farm analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze all farms' });
  }
});

// Get alert history for a farm
router.get('/alerts/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { days = 30 } = req.query;

    const alertService = new AlertService();
    const history = await alertService.getAlertHistory(farmId, parseInt(days));

    res.json(history);
  } catch (error) {
    console.error('Alert history error:', error);
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});

// Get alert statistics
router.get('/alerts/statistics', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const alertService = new AlertService();
    const stats = await alertService.getAlertStatistics(parseInt(days));

    res.json(stats);
  } catch (error) {
    console.error('Alert statistics error:', error);
    res.status(500).json({ error: 'Failed to get alert statistics' });
  }
});

// Enhanced NDVI route with AI analysis
router.get('/ndvi-ai/:coordinates/:date', async (req, res) => {
  try {
    const { coordinates, date } = req.params;
    const { includeForecast = false } = req.query;

    // Calculate NDVI
    const ndviData = await earthEngineService.calculateNDVI(coordinates, date);

    // Get AI analysis
    const aiDetector = new AIStressDetector();
    await aiDetector.initializeHuaweiAI();

    const analysis = await aiDetector.detectCropStress(
      [{ ndvi: ndviData, date }],
      coordinates,
      {}
    );

    const response = {
      ndvi: ndviData,
      analysis,
      timestamp: new Date().toISOString()
    };

    // Add forecast if requested
    if (includeForecast === 'true') {
      const forecast = aiDetector.generateStressForecast([{ ndvi: ndviData, date }], 7);
      response.forecast = forecast;
    }

    res.json(response);
  } catch (error) {
    console.error('AI NDVI calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate NDVI with AI analysis' });
  }
});

function generateNDVIForecast(historicalData, forecastDays) {
  // Simple linear regression for demonstration
  const recentNDVI = historicalData.slice(-8); // Last 8 measurements
  const avgNDVI = recentNDVI.reduce((sum, d) => sum + d.ndvi, 0) / recentNDVI.length;

  const forecast = [];
  const today = new Date();

  for (let i = 1; i <= forecastDays; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);

    // Add some randomness and trend
    const trend = i * 0.002; // Slight decreasing trend
    const randomVariation = (Math.random() - 0.5) * 0.05;
    const predictedNDVI = Math.max(0, Math.min(1, avgNDVI + trend + randomVariation));

    forecast.push({
      date: futureDate.toISOString().split('T')[0],
      predictedNDVI,
      confidence: Math.max(0.5, 0.9 - (i / forecastDays) * 0.4) // Decreasing confidence
    });
  }

  return forecast;
}

module.exports = router;