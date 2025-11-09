const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  videoId: {
    type: String,
    required: true,
  },
  videoTitle: {
    type: String,
    required: true,
  },
  videoUrl: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['drought', 'pests', 'nutrients', 'irrigation', 'harvesting', 'general'],
    default: 'general',
  },
  progress: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  watchTime: {
    type: Number, // in seconds
    default: 0,
  },
  lastWatchedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
videoProgressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Mark as completed if progress is 100%
  if (this.progress >= 100) {
    this.isCompleted = true;
  }

  next();
});

// Create compound index for efficient queries
videoProgressSchema.index({ user: 1, lastWatchedAt: -1 });
videoProgressSchema.index({ user: 1, category: 1 });

module.exports = mongoose.model('VideoProgress', videoProgressSchema);