const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('Adding scheduling fields and unique constraints to exams collection...');
  
  const examsCollection = db.collection('exams');
  
  try {
    // Add new fields to existing exams
    await examsCollection.updateMany(
      {},
      {
        $set: {
          startTime: null,
          endTime: null,
          scheduleDate: null,
          timezone: 'Asia/Ho_Chi_Minh'
        }
      }
    );
    console.log('✅ Added scheduling fields to existing exams');
    
    // Handle duplicate names before creating unique index
    console.log('🔍 Checking for duplicate exam names...');
    const duplicates = await examsCollection.aggregate([
      {
        $group: {
          _id: { name: '$name', ownerId: '$ownerId' },
          count: { $sum: 1 },
          docs: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate exam names, fixing...`);
      
      for (const duplicate of duplicates) {
        const docs = duplicate.docs;
        // Keep the first one, rename others
        for (let i = 1; i < docs.length; i++) {
          const newName = `${duplicate._id.name} (${i})`;
          await examsCollection.updateOne(
            { _id: docs[i] },
            { $set: { name: newName } }
          );
          console.log(`   Renamed exam ${docs[i]} to "${newName}"`);
        }
      }
    }
    
    // Create new indexes
    await examsCollection.createIndex({ name: 1, ownerId: 1 }, { unique: true });
    console.log('✅ Created unique index on name + ownerId');
    
    await examsCollection.createIndex({ startTime: 1 });
    console.log('✅ Created index on startTime');
    
    await examsCollection.createIndex({ endTime: 1 });
    console.log('✅ Created index on endTime');
    
    await examsCollection.createIndex({ scheduleDate: 1 });
    console.log('✅ Created index on scheduleDate');
    
    console.log('✅ Successfully updated exams collection with scheduling and constraints');
    
  } catch (error) {
    console.error('❌ Error updating exams collection:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('Reverting scheduling fields and unique constraints...');
  
  const examsCollection = db.collection('exams');
  
  try {
    // Remove new fields
    await examsCollection.updateMany(
      {},
      {
        $unset: {
          startTime: '',
          endTime: '',
          scheduleDate: '',
          timezone: ''
        }
      }
    );
    console.log('✅ Removed scheduling fields from exams');
    
    // Drop indexes
    try {
      await examsCollection.dropIndex({ name: 1, ownerId: 1 });
      console.log('✅ Dropped unique index on name + ownerId');
    } catch (e) {
      console.log('⚠️  Index might not exist:', e.message);
    }
    
    try {
      await examsCollection.dropIndex({ startTime: 1 });
      console.log('✅ Dropped index on startTime');
    } catch (e) {
      console.log('⚠️  Index might not exist:', e.message);
    }
    
    try {
      await examsCollection.dropIndex({ endTime: 1 });
      console.log('✅ Dropped index on endTime');
    } catch (e) {
      console.log('⚠️  Index might not exist:', e.message);
    }
    
    try {
      await examsCollection.dropIndex({ scheduleDate: 1 });
      console.log('✅ Dropped index on scheduleDate');
    } catch (e) {
      console.log('⚠️  Index might not exist:', e.message);
    }
    
    console.log('✅ Successfully reverted exams collection changes');
    
  } catch (error) {
    console.error('❌ Error reverting exams collection:', error);
    throw error;
  }
};

module.exports = { up, down };
