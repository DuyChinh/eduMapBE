const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('Creating exams collection with indexes...');
  
  const examsCollection = db.collection('exams');
  
  try {
    // Create indexes for better performance
    await examsCollection.createIndex({ ownerId: 1 });
    console.log('Created index on ownerId');
    
    await examsCollection.createIndex({ status: 1 });
    console.log('Created index on status');
    
    await examsCollection.createIndex({ isActive: 1 });
    console.log('Created index on isActive');
    
    await examsCollection.createIndex({ 'questions.questionId': 1 });
    console.log('Created index on questions.questionId');
    
    await examsCollection.createIndex({ name: 1 });
    console.log('Created index on name');
    
    await examsCollection.createIndex({ createdAt: -1 });
    console.log('Created index on createdAt');
    
    console.log('✅ Successfully created exams collection with indexes');
    
  } catch (error) {
    console.error('❌ Error creating exams collection:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('Dropping exams collection...');
  
  const examsCollection = db.collection('exams');
  
  try {
    await examsCollection.drop();
    console.log('✅ Successfully dropped exams collection');
    
  } catch (error) {
    console.error('❌ Error dropping exams collection:', error);
    throw error;
  }
};

module.exports = { up, down };
