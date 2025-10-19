const mongoose = require('mongoose');
const config = require('../config');

async function up() {
  console.log('Adding name field to questions collection...');
  
  try {
    const mongoUri = config.DATABASE_MG_URL || config.MIGRATE_MG_URL || 'mongodb://localhost:27017/EduMap';
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const questionsCollection = db.collection('questions');
    
    // Add name field to all existing questions
    const result = await questionsCollection.updateMany(
      { name: { $exists: false } },
      { $set: { name: "" } }
    );
    
    console.log(`Updated ${result.modifiedCount} questions with name field`);
    
    // Create index for name field for text search if needed
    // await questionsCollection.createIndex({ name: "text" });
    
  } catch (error) {
    console.error('Error adding name field:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

async function down() {
  console.log('Removing name field from questions collection...');
  
  try {
    const mongoUri = config.DATABASE_MG_URL || config.MIGRATE_MG_URL || 'mongodb://localhost:27017/EduMap';
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const questionsCollection = db.collection('questions');
    
    // Remove name field from all questions
    const result = await questionsCollection.updateMany(
      { name: { $exists: true } },
      { $unset: { name: "" } }
    );
    
    console.log(`Removed name field from ${result.modifiedCount} questions`);
    
  } catch (error) {
    console.error('Error removing name field:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { up, down };
