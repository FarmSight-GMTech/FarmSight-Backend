const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Import database connection
const connectDB = require('./config/database');

// Import models to register them with mongoose
require('./models/User');
require('./models/Farm');
require('./models/NDVIData');
require('./models/VideoProgress');
require('./models/Alert');

// Import alert service for AI/ML features
const AlertService = require('./services/alertService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'FarmSight API is running' });
});

// Import routes
const userRoutes = require('./routes/users');
const farmRoutes = require('./routes/farms');
const satelliteRoutes = require('./routes/satellite');
const educationRoutes = require('./routes/education');
const alertRoutes = require('./routes/alerts');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/satellite', satelliteRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/alerts', alertRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: 'FarmSight backend is working!' });
});

const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Initialize AI/ML services
    const alertService = new AlertService();
    await alertService.initialize();

    app.listen(PORT, () => {
      console.log(`🚀 FarmSight AI Crop Stress Detection API server running on port ${PORT}`);
      console.log(`🌱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🤖 AI Services: Initialized`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;