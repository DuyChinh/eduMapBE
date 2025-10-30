const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('Creating grades collection and adding gradeId, fee fields to exams...');
  
  try {
    // Create grades collection
    const gradesCollection = db.collection('grades');
    await gradesCollection.createIndex({ level: 1 });
    console.log('✅ Created grades collection with index on level');
    
    // Insert default grades (simplified structure)
    const defaultGrades = [
      { name: 'Lớp 1', level: 1 },
      { name: 'Lớp 2', level: 2 },
      { name: 'Lớp 3', level: 3 },
      { name: 'Lớp 4', level: 4 },
      { name: 'Lớp 5', level: 5 },
      { name: 'Lớp 6', level: 6 },
      { name: 'Lớp 7', level: 7 },
      { name: 'Lớp 8', level: 8 },
      { name: 'Lớp 9', level: 9 },
      { name: 'Lớp 10', level: 10 },
      { name: 'Lớp 11', level: 11 },
      { name: 'Lớp 12', level: 12 }
    ];
    
    await gradesCollection.insertMany(defaultGrades);
    console.log('✅ Inserted default grades');
    
    // Add gradeId and fee fields to existing exams
    const examsCollection = db.collection('exams');
    await examsCollection.updateMany(
      {},
      { 
        $set: { 
          gradeId: null,
          fee: 0
        } 
      }
    );
    console.log('✅ Added gradeId and fee fields to existing exams');
    
    // Create indexes for new fields
    await examsCollection.createIndex({ gradeId: 1 });
    console.log('✅ Created index on gradeId');
    
    console.log('✅ Successfully completed migration for grades and exam fields');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('Rolling back grades collection and exam fields...');
  
  try {
    // Remove gradeId and fee fields from exams
    const examsCollection = db.collection('exams');
    await examsCollection.updateMany(
      {},
      { 
        $unset: { 
          gradeId: "",
          fee: ""
        } 
      }
    );
    console.log('✅ Removed gradeId and fee fields from exams');
    
    // Drop grades collection
    await db.collection('grades').drop();
    console.log('✅ Dropped grades collection');
    
    console.log('✅ Successfully rolled back migration');
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
};

module.exports = { up, down };
