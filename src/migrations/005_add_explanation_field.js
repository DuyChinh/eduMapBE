const mongoose = require('mongoose');
const config = require('../config');

async function up() {
  console.log('Adding explanation field to questions collection...');
  
  try {
    const mongoUri = config.DATABASE_MG_URL || config.MIGRATE_MG_URL || 'mongodb://localhost:27017/EduMap';
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const questionsCollection = db.collection('questions');
    
    // Add explanation field to all existing questions
    const result = await questionsCollection.updateMany(
      { explanation: { $exists: false } },
      { $set: { explanation: "" } }
    );
    
    console.log(`Updated ${result.modifiedCount} questions with explanation field`);
    
    // Create index for explanation field if needed for text search
    // await questionsCollection.createIndex({ explanation: "text" });
    
  } catch (error) {
    console.error('Error adding explanation field:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

async function down() {
  console.log('Removing explanation field from questions collection...');
  
  try {
    const mongoUri = config.DATABASE_MG_URL || config.MIGRATE_MG_URL || 'mongodb://localhost:27017/EduMap';
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const questionsCollection = db.collection('questions');
    
    // Remove explanation field from all questions
    const result = await questionsCollection.updateMany(
      { explanation: { $exists: true } },
      { $unset: { explanation: "" } }
    );
    
    console.log(`Removed explanation field from ${result.modifiedCount} questions`);
    
  } catch (error) {
    console.error('Error removing explanation field:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { up, down };
