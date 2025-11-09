const axios = require('axios');

class VideoEducationService {
  constructor() {
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY;
    this.baseURL = 'https://www.googleapis.com/youtube/v3';
  }

  async getVideosByCategory(category, maxResults = 20) {
    try {
      // Define search queries for different categories
      const categoryQueries = {
        'drought': 'crop drought management irrigation',
        'pests': 'crop pest control identification treatment',
        'nutrients': 'crop nutrient deficiency fertilizer management',
        'general': 'agriculture farming best practices',
        'irrigation': 'farm irrigation systems water management',
        'harvesting': 'crop harvesting techniques timing'
      };

      const query = categoryQueries[category] || categoryQueries['general'];

      // Mock implementation - replace with actual YouTube API call
      const videos = this.generateMockVideos(category, maxResults);

      return {
        category,
        query,
        totalResults: videos.length,
        videos
      };
    } catch (error) {
      console.error('Failed to fetch videos by category:', error);
      throw error;
    }
  }

  async getRecommendedVideos(stressType, cropType = 'general') {
    try {
      const recommendations = {
        'drought': [
          {
            videoId: 'drought_101',
            title: 'Drought Stress Identification in Crops',
            description: 'Learn how to identify early signs of drought stress in your crops',
            thumbnail: 'https://img.youtube.com/vi/drought_101/default.jpg',
            duration: '8:45',
            channelName: 'FarmSight Education',
            publishedAt: '2024-01-15',
            tags: ['drought', 'stress', 'identification', 'crops']
          },
          {
            videoId: 'irrigation_101',
            title: 'Efficient Irrigation Techniques',
            description: 'Best practices for water management during drought conditions',
            thumbnail: 'https://img.youtube.com/vi/irrigation_101/default.jpg',
            duration: '12:30',
            channelName: 'Agricultural Tech',
            publishedAt: '2024-02-01',
            tags: ['irrigation', 'water', 'drought', 'efficiency']
          }
        ],
        'pests': [
          {
            videoId: 'pest_id_101',
            title: 'Common Crop Pests Identification',
            description: 'Visual guide to identifying common agricultural pests',
            thumbnail: 'https://img.youtube.com/vi/pest_id_101/default.jpg',
            duration: '15:20',
            channelName: 'Plant Health Clinic',
            publishedAt: '2024-01-20',
            tags: ['pests', 'identification', 'crops', 'agriculture']
          }
        ],
        'nutrients': [
          {
            videoId: 'nutrients_101',
            title: 'Understanding Nutrient Deficiency',
            description: 'Complete guide to identifying and treating nutrient deficiencies',
            thumbnail: 'https://img.youtube.com/vi/nutrients_101/default.jpg',
            duration: '18:45',
            channelName: 'Crop Nutrition',
            publishedAt: '2024-02-10',
            tags: ['nutrients', 'fertilizer', 'deficiency', 'soil']
          }
        ]
      };

      return {
        stressType,
        cropType,
        recommendations: recommendations[stressType] || recommendations['drought'],
        totalResults: (recommendations[stressType] || recommendations['drought']).length
      };
    } catch (error) {
      console.error('Failed to get recommended videos:', error);
      throw error;
    }
  }

  async searchVideos(query, maxResults = 10) {
    try {
      // Mock search results - replace with actual YouTube API call
      const searchResults = this.generateMockVideos('search', maxResults, query);

      return {
        query,
        totalResults: searchResults.length,
        videos: searchResults
      };
    } catch (error) {
      console.error('Video search failed:', error);
      throw error;
    }
  }

  generateMockVideos(category, count, customQuery = '') {
    const videoTemplates = [
      {
        videoId: 'video_001',
        title: 'Understanding Crop Stress Factors',
        description: 'Comprehensive guide to identifying various types of crop stress',
        thumbnail: 'https://img.youtube.com/vi/video_001/default.jpg',
        duration: '10:30',
        channelName: 'FarmSight Education',
        publishedAt: '2024-01-10',
        tags: ['crop stress', 'agriculture', 'farming']
      },
      {
        videoId: 'video_002',
        title: 'Modern Farming Techniques',
        description: 'Learn about the latest technology in agricultural management',
        thumbnail: 'https://img.youtube.com/vi/video_002/default.jpg',
        duration: '14:15',
        channelName: 'AgTech Solutions',
        publishedAt: '2024-01-25',
        tags: ['technology', 'farming', 'modern agriculture']
      },
      {
        videoId: 'video_003',
        title: 'Sustainable Farming Practices',
        description: 'Eco-friendly approaches to crop management',
        thumbnail: 'https://img.youtube.com/vi/video_003/default.jpg',
        duration: '12:00',
        channelName: 'Green Agriculture',
        publishedAt: '2024-02-05',
        tags: ['sustainable', 'eco-friendly', 'organic farming']
      }
    ];

    return videoTemplates.slice(0, count);
  }

  async trackVideoProgress(userId, videoId, progress) {
    try {
      // Mock progress tracking - would typically save to database
      const progressRecord = {
        userId,
        videoId,
        progress,
        completed: progress >= 100,
        lastWatched: new Date().toISOString(),
        watchTime: Math.floor(progress * 1.5) // Estimated watch time in minutes
      };

      return progressRecord;
    } catch (error) {
      console.error('Failed to track video progress:', error);
      throw error;
    }
  }

  async getUserWatchHistory(userId) {
    try {
      // Mock watch history - would typically fetch from database
      return {
        userId,
        totalVideosWatched: 15,
        totalWatchTime: 180, // minutes
        recentlyWatched: [
          {
            videoId: 'video_001',
            title: 'Understanding Crop Stress Factors',
            progress: 100,
            lastWatched: '2024-02-15T10:30:00Z'
          },
          {
            videoId: 'video_002',
            title: 'Modern Farming Techniques',
            progress: 65,
            lastWatched: '2024-02-14T15:45:00Z'
          }
        ],
        achievements: [
          {
            type: 'first_video',
            earnedAt: '2024-01-15T08:00:00Z'
          },
          {
            type: 'week_streak',
            earnedAt: '2024-02-10T20:00:00Z'
          }
        ]
      };
    } catch (error) {
      console.error('Failed to get user watch history:', error);
      throw error;
    }
  }
}

module.exports = new VideoEducationService();