const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  coordinates: {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
  },
  area: {
    type: Number, // in hectares
    required: true,
  },
  cropType: {
    type: String,
    required: true,
    enum: ['rice', 'corn', 'wheat', 'soybean', 'vegetables', 'fruits', 'other'],
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  plantingDate: {
    type: Date,
    required: true,
  },
  expectedHarvestDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
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
farmSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create index for geospatial queries
farmSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

module.exports = mongoose.model('Farm', farmSchema);