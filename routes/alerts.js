const express = require('express');
const router = express.Router();
const AlertService = require('../services/alertService');
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');

const alertService = new AlertService();

// Get alert history for a farm
router.get('/farm/:farmId', auth, async (req, res) => {
  try {
    const { farmId } = req.params;
    const { days = 30 } = req.query;

    const alertHistory = await alertService.getAlertHistory(farmId, parseInt(days));

    res.json({
      success: true,
      ...alertHistory
    });
  } catch (error) {
    console.error('Alert history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert history'
    });
  }
});

// Get user's alerts
router.get('/my-alerts', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30, limit = 20 } = req.query;

    const alerts = await Alert.getRecentAlerts(userId, parseInt(limit));

    res.json({
      success: true,
      alerts,
      total: alerts.length
    });
  } catch (error) {
    console.error('User alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user alerts'
    });
  }
});

// Get alert statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const stats = await alertService.getAlertStatistics(parseInt(days), userId);

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Alert statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert statistics'
    });
  }
});

// Get system-wide alert statistics (admin only)
router.get('/admin/statistics', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { days = 30 } = req.query;
    const stats = await alertService.getAlertStatistics(parseInt(days));

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Admin alert statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system alert statistics'
    });
  }
});

// Acknowledge alert
router.put('/:alertId/acknowledge', auth, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { actionTaken } = req.body;

    const alert = await Alert.findOneAndUpdate(
      {
        _id: alertId,
        userId: req.user.id // Ensure user can only acknowledge their own alerts
      },
      {
        acknowledged: true,
        acknowledgedAt: new Date(),
        actionTaken: actionTaken
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      alert,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

// Send custom alert (for testing)
router.post('/send-custom', auth, async (req, res) => {
  try {
    const { farmId, message, urgency = 'normal' } = req.body;

    const result = await alertService.sendCustomAlert(farmId, message, urgency);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Send custom alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send custom alert'
    });
  }
});

// Analyze farm and send alert if needed
router.post('/analyze/:farmId', auth, async (req, res) => {
  try {
    const { farmId } = req.params;
    const { forceAnalysis = false } = req.body;

    const result = await alertService.analyzeFarmAndAlert(farmId, forceAnalysis);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Analyze farm alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze farm for alerts'
    });
  }
});

// Analyze all farms (admin only)
router.post('/analyze-all', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const result = await alertService.analyzeAllFarms();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Analyze all farms error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze all farms'
    });
  }
});

module.exports = router;