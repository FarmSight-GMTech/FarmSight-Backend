const mongoose = require('mongoose');

const ndviDataSchema = new mongoose.Schema({
  farm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  ndvi: {
    type: Number,
    required: true,
    min: -1,
    max: 1,
  },
  coordinates: {
    type: String, // "longitude,latitude"
    required: true,
  },
  cloudCover: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  satellite: {
    type: String,
    enum: ['Landsat-8', 'Landsat-9', 'Sentinel-2', 'MODIS'],
    default: 'Landsat-8',
  },
  stressLevel: {
    type: String,
    enum: ['none', 'low', 'moderate', 'high', 'severe'],
    default: 'none',
  },
  aiAnalysis: {
    predictedYield: {
      type: Number,
    },
    irrigationRecommendation: {
      type: String,
    },
    fertilizerRecommendation: {
      type: String,
    },
    diseaseRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create compound index for efficient queries
ndviDataSchema.index({ farm: 1, date: -1 });
ndviDataSchema.index({ date: -1 });

module.exports = mongoose.model('NDVIData', ndviDataSchema);