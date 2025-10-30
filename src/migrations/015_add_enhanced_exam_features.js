const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('Adding enhanced exam features...');
  
  try {
    const examsCollection = db.collection('exams');
    
    // Add new fields to existing exams
    await examsCollection.updateMany(
      {},
      { 
        $set: { 
          examPurpose: 'exam',
          accessType: 'public',
          allowGuest: true,
          availableFrom: null,
          availableUntil: null,
          preExamNotificationText: '',
          'settings.shuffleQuestions': false,
          'settings.shuffleChoices': false
        } 
      }
    );
    console.log('✅ Added enhanced exam features to existing exams');
    
    // Create indexes for new fields
    await examsCollection.createIndex({ examPurpose: 1 });
    await examsCollection.createIndex({ accessType: 1 });
    await examsCollection.createIndex({ availableFrom: 1 });
    await examsCollection.createIndex({ availableUntil: 1 });
    console.log('✅ Created indexes for enhanced exam features');
    
    console.log('✅ Successfully completed migration for enhanced exam features');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('Rolling back enhanced exam features...');
  
  try {
    const examsCollection = db.collection('exams');
    
    // Remove new fields from exams
    await examsCollection.updateMany(
      {},
      { 
        $unset: { 
          examPurpose: "",
          accessType: "",
          allowGuest: "",
          availableFrom: "",
          availableUntil: "",
          preExamNotificationText: "",
          'settings.shuffleQuestions': "",
          'settings.shuffleChoices': ""
        } 
      }
    );
    console.log('✅ Removed enhanced exam features from exams');
    
    // Drop indexes
    try {
      await examsCollection.dropIndex({ examPurpose: 1 });
      await examsCollection.dropIndex({ accessType: 1 });
      await examsCollection.dropIndex({ availableFrom: 1 });
      await examsCollection.dropIndex({ availableUntil: 1 });
      console.log('✅ Dropped indexes for enhanced exam features');
    } catch (indexError) {
      console.log('ℹ️ Some indexes may not exist, continuing...');
    }
    
    console.log('✅ Successfully rolled back migration');
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
};

module.exports = { up, down };
