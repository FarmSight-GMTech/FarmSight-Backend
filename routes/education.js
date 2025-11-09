const express = require('express');
const router = express.Router();
const videoEducationService = require('../services/videoEducation');

router.get('/videos', async (req, res) => {
  try {
    const { category, maxResults } = req.query;

    if (category) {
      const videos = await videoEducationService.getVideosByCategory(
        category,
        parseInt(maxResults) || 20
      );
      return res.json(videos);
    }

    // Get general videos if no category specified
    const videos = await videoEducationService.getVideosByCategory('general', 20);
    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch educational videos' });
  }
});

router.get('/videos/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { maxResults } = req.query;

    const videos = await videoEducationService.getVideosByCategory(
      category,
      parseInt(maxResults) || 20
    );

    res.json(videos);
  } catch (error) {
    console.error('Get videos by category error:', error);
    res.status(500).json({ error: 'Failed to fetch videos for category' });
  }
});

router.get('/videos/recommended/:stressType', async (req, res) => {
  try {
    const { stressType } = req.params;
    const { cropType } = req.query;

    const recommendations = await videoEducationService.getRecommendedVideos(
      stressType,
      cropType || 'general'
    );

    res.json(recommendations);
  } catch (error) {
    console.error('Get recommended videos error:', error);
    res.status(500).json({ error: 'Failed to get recommended videos' });
  }
});

router.get('/videos/search', async (req, res) => {
  try {
    const { q, maxResults } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResults = await videoEducationService.searchVideos(
      q,
      parseInt(maxResults) || 10
    );

    res.json(searchResults);
  } catch (error) {
    console.error('Video search error:', error);
    res.status(500).json({ error: 'Failed to search videos' });
  }
});

router.post('/videos/progress', async (req, res) => {
  try {
    const { userId, videoId, progress, videoTitle, videoUrl, category } = req.body;

    if (!userId || !videoId || progress === undefined) {
      return res.status(400).json({
        error: 'userId, videoId, and progress are required'
      });
    }

    const VideoProgress = require('../models/VideoProgress');

    // Find existing progress record or create new one
    const progressRecord = await VideoProgress.findOneAndUpdate(
      { user: userId, videoId },
      {
        user: userId,
        videoId,
        videoTitle: videoTitle || 'Unknown Video',
        videoUrl: videoUrl || '',
        category: category || 'general',
        progress,
        lastWatchedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json(progressRecord);
  } catch (error) {
    console.error('Track progress error:', error);
    res.status(500).json({ error: 'Failed to track video progress' });
  }
});

router.get('/users/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, category } = req.query;

    const VideoProgress = require('../models/VideoProgress');

    const query = { user: userId };
    if (category) {
      query.category = category;
    }

    const watchHistory = await VideoProgress.find(query)
      .sort({ lastWatchedAt: -1 })
      .limit(parseInt(limit))
      .populate('user', 'username fullName');

    res.json({
      userId,
      history: watchHistory,
      count: watchHistory.length
    });
  } catch (error) {
    console.error('Get watch history error:', error);
    res.status(500).json({ error: 'Failed to get user watch history' });
  }
});

router.get('/categories', (req, res) => {
  try {
    const categories = [
      {
        id: 'drought',
        name: 'Drought Management',
        description: 'Videos about drought identification and irrigation techniques',
        icon: '💧'
      },
      {
        id: 'pests',
        name: 'Pest Control',
        description: 'Pest identification and treatment methods',
        icon: '🐛'
      },
      {
        id: 'nutrients',
        name: 'Nutrient Management',
        description: 'Soil health and fertilizer applications',
        icon: '🌱'
      },
      {
        id: 'irrigation',
        name: 'Irrigation Systems',
        description: 'Water management and irrigation technology',
        icon: '💦'
      },
      {
        id: 'harvesting',
        name: 'Harvesting Techniques',
        description: 'Best practices for crop harvesting',
        icon: '🌾'
      },
      {
        id: 'general',
        name: 'General Farming',
        description: 'General agricultural best practices',
        icon: '🚜'
      }
    ];

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get video categories' });
  }
});

module.exports = router;