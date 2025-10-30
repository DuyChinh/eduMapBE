const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('🔄 Removing scheduleDate field from exams...');
  
  try {
    const examsCollection = db.collection('exams');
    
    // Remove scheduleDate field from all exams
    const result = await examsCollection.updateMany(
      { scheduleDate: { $exists: true } },
      { $unset: { scheduleDate: "" } }
    );
    
    console.log(`✅ Removed scheduleDate from ${result.modifiedCount} exams`);
    
    // Drop index on scheduleDate if exists
    try {
      await examsCollection.dropIndex('scheduleDate_1');
      console.log('✅ Dropped index on scheduleDate');
    } catch (indexError) {
      console.log('ℹ️ Index scheduleDate_1 does not exist, skipping');
    }
    
    console.log('✅ Successfully removed scheduleDate field');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('🔄 Rolling back scheduleDate removal...');
  
  try {
    const examsCollection = db.collection('exams');
    
    // Add scheduleDate back (set to null for now)
    await examsCollection.updateMany(
      {},
      { $set: { scheduleDate: null } }
    );
    
    console.log('✅ Added scheduleDate field back');
    
    // Recreate index
    try {
      await examsCollection.createIndex({ scheduleDate: 1 });
      console.log('✅ Recreated index on scheduleDate');
    } catch (indexError) {
      console.log('ℹ️ Could not recreate index');
    }
    
    console.log('✅ Successfully rolled back scheduleDate removal');
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
};

module.exports = { up, down };

