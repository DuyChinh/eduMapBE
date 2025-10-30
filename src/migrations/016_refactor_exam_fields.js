const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('🔄 Refactoring exam fields...');
  
  try {
    const examsCollection = db.collection('exams');
    
    // Get all exams
    const exams = await examsCollection.find({}).toArray();
    console.log(`📦 Found ${exams.length} exams to update`);
    
    let updatedCount = 0;
    
    for (const exam of exams) {
      const updates = {};
      
      // 1. Convert accessType + allowGuest to isAllowUser
      if (exam.accessType || exam.allowGuest) {
        let isAllowUser = 'everyone'; // default
        
        if (exam.accessType === 'public' && exam.allowGuest === true) {
          isAllowUser = 'everyone';
        } else if (exam.accessType === 'class') {
          isAllowUser = 'class';
        } else if (exam.accessType === 'student') {
          isAllowUser = 'student';
        } else if (exam.allowGuest === false) {
          isAllowUser = 'student';
        }
        
        updates.isAllowUser = isAllowUser;
      }
      
      // 2. Convert showScore to viewMark
      if (exam.showScore !== undefined) {
        let viewMark = 1; // default: afterCompletion
        
        if (exam.showScore === 'never') {
          viewMark = 0;
        } else if (exam.showScore === 'afterCompletion') {
          viewMark = 1;
        } else if (exam.showScore === 'afterAllFinish') {
          viewMark = 2;
        }
        
        updates.viewMark = viewMark;
      }
      
      // 3. Convert showExamAndAnswers to viewExamAndAnswer
      if (exam.showExamAndAnswers !== undefined) {
        let viewExamAndAnswer = 1; // default: afterCompletion
        
        if (exam.showExamAndAnswers === 'never') {
          viewExamAndAnswer = 0;
        } else if (exam.showExamAndAnswers === 'afterCompletion') {
          viewExamAndAnswer = 1;
        } else if (exam.showExamAndAnswers === 'afterAllFinish') {
          viewExamAndAnswer = 2;
        }
        
        updates.viewExamAndAnswer = viewExamAndAnswer;
      }
      
      // 4. Move maxAttempts from settings to root level
      if (exam.settings && exam.settings.maxAttempts !== undefined) {
        updates.maxAttempts = exam.settings.maxAttempts;
      }
      
      // 5. Add default values for new required fields if not exist
      if (!exam.isAllowUser) {
        updates.isAllowUser = 'everyone';
      }
      if (!exam.viewMark && exam.viewMark !== 0) {
        updates.viewMark = 1;
      }
      if (!exam.viewExamAndAnswer && exam.viewExamAndAnswer !== 0) {
        updates.viewExamAndAnswer = 1;
      }
      if (!exam.maxAttempts) {
        updates.maxAttempts = 1;
      }
      if (!exam.examPassword) {
        updates.examPassword = '';
      }
      
      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await examsCollection.updateOne(
          { _id: exam._id },
          { $set: updates }
        );
        updatedCount++;
      }
    }
    
    console.log(`✅ Updated ${updatedCount} exams`);
    
    // Create indexes for new fields
    await examsCollection.createIndex({ isAllowUser: 1 });
    await examsCollection.createIndex({ viewMark: 1 });
    await examsCollection.createIndex({ viewExamAndAnswer: 1 });
    await examsCollection.createIndex({ maxAttempts: 1 });
    console.log('✅ Created indexes for new fields');
    
    console.log('✅ Successfully completed refactoring migration');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('🔄 Rolling back exam fields refactoring...');
  
  try {
    const examsCollection = db.collection('exams');
    
    const exams = await examsCollection.find({}).toArray();
    console.log(`📦 Found ${exams.length} exams to rollback`);
    
    let rolledBackCount = 0;
    
    for (const exam of exams) {
      const updates = {};
      
      // 1. Convert isAllowUser back to accessType + allowGuest
      if (exam.isAllowUser) {
        if (exam.isAllowUser === 'everyone') {
          updates.accessType = 'public';
          updates.allowGuest = true;
        } else if (exam.isAllowUser === 'class') {
          updates.accessType = 'class';
          updates.allowGuest = false;
        } else if (exam.isAllowUser === 'student') {
          updates.accessType = 'student';
          updates.allowGuest = false;
        }
      }
      
      // 2. Convert viewMark back to showScore
      if (exam.viewMark !== undefined) {
        let showScore = 'afterCompletion';
        
        if (exam.viewMark === 0) {
          showScore = 'never';
        } else if (exam.viewMark === 1) {
          showScore = 'afterCompletion';
        } else if (exam.viewMark === 2) {
          showScore = 'afterAllFinish';
        }
        
        updates.showScore = showScore;
      }
      
      // 3. Convert viewExamAndAnswer back to showExamAndAnswers
      if (exam.viewExamAndAnswer !== undefined) {
        let showExamAndAnswers = 'afterCompletion';
        
        if (exam.viewExamAndAnswer === 0) {
          showExamAndAnswers = 'never';
        } else if (exam.viewExamAndAnswer === 1) {
          showExamAndAnswers = 'afterCompletion';
        } else if (exam.viewExamAndAnswer === 2) {
          showExamAndAnswers = 'afterAllFinish';
        }
        
        updates.showExamAndAnswers = showExamAndAnswers;
      }
      
      // 4. Move maxAttempts back to settings
      if (exam.maxAttempts) {
        updates['settings.maxAttempts'] = exam.maxAttempts;
      }
      
      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await examsCollection.updateOne(
          { _id: exam._id },
          { $set: updates }
        );
        rolledBackCount++;
      }
    }
    
    console.log(`✅ Rolled back ${rolledBackCount} exams`);
    
    // Drop indexes
    try {
      await examsCollection.dropIndex('isAllowUser_1');
      await examsCollection.dropIndex('viewMark_1');
      await examsCollection.dropIndex('viewExamAndAnswer_1');
      await examsCollection.dropIndex('maxAttempts_1');
      console.log('✅ Dropped indexes');
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

