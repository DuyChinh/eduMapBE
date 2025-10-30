const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('🔐 Setting default exam password for existing exams...');
  
  try {
    const examsCollection = db.collection('exams');
    
    // Find exams with empty or null examPassword
    const examsWithoutPassword = await examsCollection.find({
      $or: [
        { examPassword: '' },
        { examPassword: { $exists: false } },
        { examPassword: null }
      ]
    }).toArray();
    
    console.log(`📦 Found ${examsWithoutPassword.length} exams without password`);
    
    let updatedCount = 0;
    
    for (const exam of examsWithoutPassword) {
      // Generate a default password based on exam name or use a pattern
      let defaultPassword = `exam_${exam._id.toString().substring(18)}`;
      
      // Or use exam name (sanitized)
      if (exam.name) {
        const namePart = exam.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 8);
        defaultPassword = `${namePart}_2024`;
      }
      
      await examsCollection.updateOne(
        { _id: exam._id },
        { $set: { examPassword: defaultPassword } }
      );
      
      updatedCount++;
      console.log(`✅ Set password for exam: ${exam.name} (${exam._id})`);
    }
    
    console.log(`✅ Updated ${updatedCount} exams with default passwords`);
    console.log('✅ Successfully set default passwords');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('🔄 Rolling back default password setting...');
  
  try {
    const examsCollection = db.collection('exams');
    
    // Set examPassword back to empty string
    await examsCollection.updateMany(
      { examPassword: { $exists: true } },
      { $set: { examPassword: '' } }
    );
    
    console.log('✅ Rolled back to empty passwords');
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
};

module.exports = { up, down };

