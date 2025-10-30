const { MongoClient } = require('mongodb');

const up = async (db, client) => {
  console.log('Normalizing old exam data structure...');
  
  const examsCollection = db.collection('exams');
  
  try {
    // Find exams with old structure (have 'title' field instead of 'name')
    const oldExams = await examsCollection.find({ title: { $exists: true } }).toArray();
    
    console.log(`Found ${oldExams.length} exams with old structure`);
    
    for (const exam of oldExams) {
      console.log(`Processing exam: ${exam.title}`);
      
      // Create normalized exam document
      const normalizedExam = {
        // Map old fields to new fields
        name: exam.title,
        description: exam.description || '',
        duration: exam.settings?.duration || 60,
        totalMarks: exam.totalPoints || 0,
        
        // Convert items to questions format
        questions: exam.items?.map((item, index) => ({
          questionId: item.questionId,
          order: item.order || index + 1,
          marks: item.points || 1,
          isRequired: true
        })) || [],
        
        // Keep existing fields
        ownerId: exam.ownerId,
        status: exam.status || 'draft',
        isActive: exam.isActive !== false,
        
        // Normalize settings to new structure
        settings: {
          // Basic settings
          allowReview: exam.settings?.allowReview !== false,
          showCorrectAnswer: exam.settings?.showResult || false,
          shuffleQuestions: exam.settings?.shuffle || false,
          shuffleChoices: false,
          timeLimit: true,
          maxAttempts: exam.settings?.attempts || 1,
          
          // Teacher controls
          teacherCanStart: true,
          teacherCanPause: true,
          teacherCanStop: true,
          
          // Student experience
          showProgress: true,
          showTimer: true,
          allowSkip: false,
          allowBack: true,
          
          // Submission settings
          autoSubmit: false,
          confirmSubmit: true,
          allowLateSubmission: false,
          
          // Security settings
          preventCopy: false,
          preventRightClick: false,
          fullscreenMode: exam.settings?.proctoring?.strictMode || false,
          
          // Notification settings
          notifyOnStart: true,
          notifyOnSubmit: true,
          notifyOnTimeWarning: true,
          
          // Advanced settings
          questionPerPage: 1,
          saveProgress: true,
          allowReviewAfterSubmit: false,
          showQuestionNumbers: true,
          allowMarkForReview: true,
          showAnswerExplanation: false,
          allowQuestionFeedback: false,
          randomizeQuestionOrder: false,
          randomizeChoiceOrder: false,
          allowPartialCredit: false,
          showScoreImmediately: false,
          allowRetake: false,
          maxRetakeAttempts: 0,
          retakeDelay: 0,
          
          // Time settings
          timeWarningThreshold: 5,
          gracePeriod: 0,
          lateSubmissionPenalty: 0,
          
          // Display settings
          theme: 'default',
          fontSize: 'medium',
          showNavigation: true,
          showQuestionList: true,
          allowFullscreen: true,
          showInstructions: true,
          instructions: ''
        },
        
        // Add stats if not exists
        stats: exam.stats || {
          totalAttempts: 0,
          averageScore: 0,
          completionRate: 0
        },
        
        // Keep timestamps
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt,
        __v: exam.__v || 0
      };
      
      // Update the exam with normalized structure
      await examsCollection.updateOne(
        { _id: exam._id },
        { 
          $set: normalizedExam,
          $unset: { 
            title: '',
            items: '',
            totalPoints: '',
            version: ''
          }
        }
      );
      
      console.log(`✅ Normalized exam: ${exam.title}`);
    }
    
    console.log('✅ Successfully normalized all old exam data');
    
  } catch (error) {
    console.error('❌ Error normalizing exam data:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('Reverting exam data normalization...');
  
  const examsCollection = db.collection('exams');
  
  try {
    // This is a destructive operation, so we'll just log a warning
    console.log('⚠️  WARNING: This operation cannot be safely reverted');
    console.log('⚠️  Old exam data structure has been permanently changed');
    console.log('⚠️  If you need to revert, restore from backup');
    
  } catch (error) {
    console.error('❌ Error reverting exam data:', error);
    throw error;
  }
};

module.exports = { up, down };
