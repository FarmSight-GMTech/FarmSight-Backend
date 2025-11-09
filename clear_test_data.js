const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Farm = require('./models/Farm');

const clearAndCreateTestData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find test user
    let user = await User.findOne({ email: 'demo@farmsight.com' });

    if (user) {
      // Delete all farms belonging to test user
      const deleteResult = await Farm.deleteMany({ owner: user._id });
      console.log(`✅ Deleted ${deleteResult.deletedCount} existing test farms`);

      // Create new test farms with English names
      const farms = [
        {
          name: 'Java Rice Fields',
          description: 'Fertile rice paddies in Central Java',
          coordinates: { latitude: -7.2504, longitude: 110.1755 },
          area: 250.5,
          cropType: 'rice',
          owner: user._id,
          plantingDate: new Date('2024-03-15'),
          expectedHarvestDate: new Date('2024-08-30'),
          lastNDVI: 0.82,
          stressLevel: 'healthy',
          lastStressLevel: 'healthy',
          lastNDVIValue: 0.82,
          lastAnalysis: new Date(),
          isActive: true
        },
        {
          name: 'Prosperous Corn Plantation',
          description: 'Modern corn plantation with irrigation system in East Java',
          coordinates: { latitude: -7.5360, longitude: 112.2384 },
          area: 180.0,
          cropType: 'corn',
          owner: user._id,
          plantingDate: new Date('2024-04-01'),
          expectedHarvestDate: new Date('2024-09-15'),
          lastNDVI: 0.38,
          stressLevel: 'high',
          lastStressLevel: 'high',
          lastNDVIValue: 0.38,
          lastAnalysis: new Date(),
          isActive: true
        },
        {
          name: 'Sumatra Palm Oil Estate',
          description: 'Palm oil plantation in South Sumatra',
          coordinates: { latitude: -3.3194, longitude: 104.9147 },
          area: 450.0,
          cropType: 'other',
          owner: user._id,
          plantingDate: new Date('2024-02-20'),
          expectedHarvestDate: new Date('2024-07-25'),
          lastNDVI: 0.12,
          stressLevel: 'severe',
          lastStressLevel: 'severe',
          lastNDVIValue: 0.12,
          lastAnalysis: new Date(),
          isActive: true
        },
        {
          name: 'Bogor Tea Garden',
          description: 'Mountain tea plantation in West Java',
          coordinates: { latitude: -6.7044, longitude: 106.8285 },
          area: 120.0,
          cropType: 'vegetables',
          owner: user._id,
          plantingDate: new Date('2024-01-10'),
          expectedHarvestDate: new Date('2024-06-20'),
          lastNDVI: 0.65,
          stressLevel: 'moderate',
          lastStressLevel: 'moderate',
          lastNDVIValue: 0.65,
          lastAnalysis: new Date(),
          isActive: true
        },
        {
          name: 'Beautiful Bali Rice Fields',
          description: 'Beautiful rice field terraces in Bali',
          coordinates: { latitude: -8.3405, longitude: 115.0920 },
          area: 85.0,
          cropType: 'rice',
          owner: user._id,
          plantingDate: new Date('2024-03-20'),
          expectedHarvestDate: new Date('2024-08-25'),
          lastNDVI: 0.91,
          stressLevel: 'healthy',
          lastStressLevel: 'healthy',
          lastNDVIValue: 0.91,
          lastAnalysis: new Date(),
          isActive: true
        }
      ];

      await Farm.insertMany(farms);
      console.log('✅ 5 English-named test farms created with different stress levels');

      console.log('\n🎉 Test data update complete!');
      console.log('📱 Login in mobile app with:');
      console.log('   Email: demo@farmsight.com');
      console.log('   Password: demo123');
      console.log('\n🗺️  After login, go to Map tab to see farm locations');

    } else {
      console.log('❌ Test user not found');
    }

  } catch (error) {
    console.error('❌ Error updating test data:', error);
  } finally {
    await mongoose.disconnect();
  }
};

clearAndCreateTestData();