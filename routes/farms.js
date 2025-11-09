const express = require('express');
const router = express.Router();
const Farm = require('../models/Farm');
const NDVIData = require('../models/NDVIData');
const earthEngineService = require('../services/earthEngine');
const huaweiCloudService = require('../services/huaweiCloud');

// Get all farms for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const farms = await Farm.find({ owner: userId, isActive: true })
      .sort({ createdAt: -1 });

    res.json(farms);
  } catch (error) {
    console.error('Get farms error:', error);
    res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// Register a new farm
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      description,
      coordinates,
      area,
      cropType,
      owner,
      plantingDate,
      expectedHarvestDate
    } = req.body;

    // Validate required fields
    if (!name || !coordinates || !area || !cropType || !owner || !plantingDate) {
      return res.status(400).json({
        error: 'Name, coordinates, area, crop type, owner, and planting date are required'
      });
    }

    // Parse coordinates if they're in string format
    let coords = coordinates;
    if (typeof coordinates === 'string') {
      const [lat, lng] = coordinates.split(',').map(coord => parseFloat(coord.trim()));
      coords = { latitude: lat, longitude: lng };
    }

    const farm = new Farm({
      name,
      description,
      coordinates: coords,
      area,
      cropType,
      owner,
      plantingDate: new Date(plantingDate),
      expectedHarvestDate: expectedHarvestDate ? new Date(expectedHarvestDate) : undefined
    });

    const savedFarm = await farm.save();
    res.status(201).json(savedFarm);
  } catch (error) {
    console.error('Register farm error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Farm with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to register farm' });
    }
  }
});

// Get a specific farm
router.get('/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;

    const farm = await Farm.findById(farmId).populate('owner', 'username fullName');

    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    if (!farm.isActive) {
      return res.status(404).json({ error: 'Farm is not active' });
    }

    res.json(farm);
  } catch (error) {
    console.error('Get farm error:', error);
    res.status(500).json({ error: 'Failed to fetch farm' });
  }
});

// Get NDVI data for a farm
router.get('/:farmId/ndvi', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { startDate, endDate, limit = 30 } = req.query;

    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // Get NDVI data from database
    const ndviData = await NDVIData.find({
      farm: farmId,
      ...(startDate && { date: { $gte: new Date(startDate) } }),
      ...(endDate && { date: { $lte: new Date(endDate) } })
    })
    .sort({ date: -1 })
    .limit(parseInt(limit));

    res.json({
      farm: farm.name,
      coordinates: `${farm.coordinates.latitude},${farm.coordinates.longitude}`,
      ndviData,
      count: ndviData.length
    });
  } catch (error) {
    console.error('Get NDVI data error:', error);
    res.status(500).json({ error: 'Failed to fetch NDVI data' });
  }
});

// Get current stress level for a farm
router.get('/:farmId/stress-level', async (req, res) => {
  try {
    const { farmId } = req.params;

    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // Get latest NDVI data
    const latestNDVI = await NDVIData.findOne({ farm: farmId })
      .sort({ date: -1 });

    if (!latestNDVI) {
      return res.status(404).json({
        error: 'No NDVI data available for this farm'
      });
    }

    // Calculate stress level based on NDVI value
    let stressLevel = 'none';
    if (latestNDVI.ndvi < 0.2) stressLevel = 'severe';
    else if (latestNDVI.ndvi < 0.3) stressLevel = 'high';
    else if (latestNDVI.ndvi < 0.4) stressLevel = 'moderate';
    else if (latestNDVI.ndvi < 0.5) stressLevel = 'low';

    res.json({
      farmId,
      farmName: farm.name,
      cropType: farm.cropType,
      latestNDVI: latestNDVI.ndvi,
      stressLevel,
      lastUpdated: latestNDVI.date,
      recommendations: latestNDVI.aiAnalysis || {}
    });
  } catch (error) {
    console.error('Get stress level error:', error);
    res.status(500).json({ error: 'Failed to get stress level' });
  }
});

// Update farm information
router.put('/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;
    const updates = req.body;

    const farm = await Farm.findByIdAndUpdate(
      farmId,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json(farm);
  } catch (error) {
    console.error('Update farm error:', error);
    res.status(500).json({ error: 'Failed to update farm' });
  }
});

// Delete (deactivate) a farm
router.delete('/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;

    const farm = await Farm.findByIdAndUpdate(
      farmId,
      { isActive: false },
      { new: true }
    );

    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json({ message: 'Farm deactivated successfully' });
  } catch (error) {
    console.error('Delete farm error:', error);
    res.status(500).json({ error: 'Failed to delete farm' });
  }
});

module.exports = router;