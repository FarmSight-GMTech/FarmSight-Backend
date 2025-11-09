const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stressLevel: {
    type: String,
    enum: ['healthy', 'low', 'moderate', 'high', 'severe'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    required: true
  },
  ndviValue: {
    type: Number,
    required: true
  },
  recommendations: [{
    type: String
  }],
  riskFactors: [{
    type: String
  }],
  aiAnalysis: {
    type: String
  },
  alertType: {
    type: String,
    enum: ['sms', 'in_app', 'email'],
    default: 'in_app'
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  phoneNumber: {
    type: String
  },
  message: {
    type: String
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: {
    type: Date
  },
  actionTaken: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying
alertSchema.index({ farmId: 1, createdAt: -1 });
alertSchema.index({ userId: 1, createdAt: -1 });
alertSchema.index({ status: 1, createdAt: -1 });

// Virtual for formatted date
alertSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static methods
alertSchema.statics.getAlertStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$stressLevel',
        count: { $sum: 1 },
        latest: { $max: '$createdAt' }
      }
    }
  ]);

  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      count: stat.count,
      latest: stat.latest
    };
    return acc;
  }, {});
};

alertSchema.statics.getRecentAlerts = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('farmId', 'name coordinates cropType');
};

const Alert = mongoose.model('Alert', alertSchema);
module.exports = Alert;