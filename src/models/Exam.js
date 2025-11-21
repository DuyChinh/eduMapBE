const mongoose = require('mongoose');

const ExamQuestionSchema = new mongoose.Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Question',
    required: true 
  },
  order: { 
    type: Number, 
    required: true,
    min: 1
  },
  marks: { 
    type: Number, 
    default: 1,
    min: 0
  },
  isRequired: { 
    type: Boolean, 
    default: true 
  }
}, { _id: false });

const ExamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  duration: {
    type: Number, // minutes
    required: true,
    min: 1
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  questions: [ExamQuestionSchema],
  
  // Scheduling
  startTime: {
    type: Date,
    required: false,
    default: Date.now
  },
  endTime: {
    type: Date,
    required: false,
    default: function() {
      const now = new Date();
      now.setDate(now.getDate() + 3); // +3 days
      return now;
    }
  },
  timezone: {
    type: String,
    default: 'Asia/Ho_Chi_Minh'
  },
  
  // Subject
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: false,
    index: true
  },
  subjectCode: {
    type: String,
    trim: true,
    uppercase: true,
    required: false
  },
  
  // Grade
  gradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade',
    required: false,
    index: true
  },
  
  // Exam Purpose
  examPurpose: {
    type: String,
    enum: ['exam', 'practice', 'quiz', 'assignment'],
    default: 'exam',
    required: false
  },
  
  // Access Control
  isAllowUser: {
    type: String,
    enum: ['everyone', 'class', 'student'],
    required: true,
    default: 'everyone'
  },
  
  // Allowed Class IDs (when isAllowUser is 'class')
  allowedClassIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: false
  }],
  
  // Availability Window
  availableFrom: {
    type: Date,
    required: false,
    default: null
  },
  availableUntil: {
    type: Date,
    required: false,
    default: null
  },
  
  // Fee
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Exam Password
  examPassword: {
    type: String,
    trim: true,
    required: true,
    default: ''
  },
  
  // Max Attempts
  maxAttempts: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  
  // View Mark (when to show score)
  viewMark: {
    type: Number,
    enum: [0, 1, 2],
    required: true,
    default: 1
  },
  
  // View Exam and Answer (when to show exam and answers)
  viewExamAndAnswer: {
    type: Number,
    enum: [0, 1, 2],
    required: true,
    default: 1
  },
  
  // Security & Monitoring
  autoMonitoring: {
    type: String,
    enum: ['off', 'screenExit', 'fullMonitoring'],
    default: 'off'
  },
  studentVerification: {
    type: Boolean,
    default: false
  },
  eduMapOnly: {
    type: Boolean,
    default: false
  },
  
  // Display Settings
  hideGroupTitles: {
    type: Boolean,
    default: false
  },
  sectionsStartFromQ1: {
    type: Boolean,
    default: false
  },
  // Note: showScore and showExamAndAnswers replaced by viewMark and viewExamAndAnswer
  hideLeaderboard: {
    type: Boolean,
    default: false
  },
  addTitleInfo: {
    type: Boolean,
    default: false
  },
  preExamNotification: {
    type: Boolean,
    default: false
  },
  preExamNotificationText: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Ownership
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Basic exam settings
  settings: {
    // Basic settings
    allowReview: { type: Boolean, default: true },
    showCorrectAnswer: { type: Boolean, default: false },
    timeLimit: { type: Boolean, default: true },
    
    // Shuffle settings (moved to main level for easier access)
    shuffleQuestions: { type: Boolean, default: false },
    shuffleChoices: { type: Boolean, default: false },

    // Teacher controls
    teacherCanStart: { type: Boolean, default: true },
    teacherCanPause: { type: Boolean, default: true },
    teacherCanStop: { type: Boolean, default: true },

    // Student experience
    showProgress: { type: Boolean, default: true },
    showTimer: { type: Boolean, default: true },
    allowSkip: { type: Boolean, default: false },
    allowBack: { type: Boolean, default: true },

    // Submission settings
    autoSubmit: { type: Boolean, default: false },
    confirmSubmit: { type: Boolean, default: true },
    allowLateSubmission: { type: Boolean, default: false },

    // Security settings
    preventCopy: { type: Boolean, default: false },
    preventRightClick: { type: Boolean, default: false },
    fullscreenMode: { type: Boolean, default: false },

    // Notification settings
    notifyOnStart: { type: Boolean, default: true },
    notifyOnSubmit: { type: Boolean, default: true },
    notifyOnTimeWarning: { type: Boolean, default: true },

    // Advanced settings
    questionPerPage: { type: Number, default: 1 },
    saveProgress: { type: Boolean, default: true },
    allowReviewAfterSubmit: { type: Boolean, default: false },
    showQuestionNumbers: { type: Boolean, default: true },
    allowMarkForReview: { type: Boolean, default: true },
    showAnswerExplanation: { type: Boolean, default: false },
    allowQuestionFeedback: { type: Boolean, default: false },
    randomizeQuestionOrder: { type: Boolean, default: false },
    randomizeChoiceOrder: { type: Boolean, default: false },
    allowPartialCredit: { type: Boolean, default: false },
    showScoreImmediately: { type: Boolean, default: false },
    allowRetake: { type: Boolean, default: false },
    maxRetakeAttempts: { type: Number, default: 0 },
    retakeDelay: { type: Number, default: 0 },

    // Time settings
    timeWarningThreshold: { type: Number, default: 5 },
    gracePeriod: { type: Number, default: 0 },
    lateSubmissionPenalty: { type: Number, default: 0 },

    // Display settings
    theme: { type: String, default: 'default', enum: ['default', 'dark', 'light'] },
    fontSize: { type: String, default: 'medium', enum: ['small', 'medium', 'large'] },
    showNavigation: { type: Boolean, default: true },
    showQuestionList: { type: Boolean, default: true },
    allowFullscreen: { type: Boolean, default: true },
    showInstructions: { type: Boolean, default: true },
    instructions: { type: String, default: '' }
  },

  // Status and metadata
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Statistics
  stats: {
    totalAttempts: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
ExamSchema.index({ ownerId: 1 });
ExamSchema.index({ status: 1 });
ExamSchema.index({ isActive: 1 });
ExamSchema.index({ 'questions.questionId': 1 });
ExamSchema.index({ name: 1, ownerId: 1 }, { unique: true }); // Unique name per owner
ExamSchema.index({ startTime: 1 });
ExamSchema.index({ endTime: 1 });
ExamSchema.index({ isAllowUser: 1 }); // New field
ExamSchema.index({ examPurpose: 1 });
ExamSchema.index({ availableFrom: 1 });
ExamSchema.index({ availableUntil: 1 });
ExamSchema.index({ viewMark: 1 });
ExamSchema.index({ viewExamAndAnswer: 1 });
ExamSchema.index({ maxAttempts: 1 });

// Virtual for question count
ExamSchema.virtual('questionCount').get(function() {
  return this.questions.length;
});

// Pre-save validation
ExamSchema.pre('save', function(next) {
  // Validate scheduling
  if (this.startTime && this.endTime) {
    if (this.startTime >= this.endTime) {
      return next(new Error('Start time must be before end time'));
    }
    
    // Check if duration matches the time range
    const timeDiffMinutes = (this.endTime - this.startTime) / (1000 * 60);
    if (timeDiffMinutes < this.duration) {
      return next(new Error('Exam duration cannot exceed the time range'));
    }
  }
  
  // Validate availability window
  if (this.availableFrom && this.availableUntil) {
    if (this.availableFrom >= this.availableUntil) {
      return next(new Error('Available from time must be before available until time'));
    }
  }
  
  // Validate name is not empty after trim
  if (!this.name || this.name.trim().length === 0) {
    return next(new Error('Exam name cannot be empty'));
  }
  
  next();
});

// Instance methods
ExamSchema.methods.addQuestion = function(questionId, options = {}) {
  const maxOrder = Math.max(...this.questions.map(q => q.order), 0);
  this.questions.push({
    questionId,
    order: maxOrder + 1,
    marks: options.marks || 1,
    isRequired: options.isRequired !== false
  });
  return this.save();
};

ExamSchema.methods.removeQuestion = function(questionId) {
  this.questions = this.questions.filter(q => !q.questionId.equals(questionId));
  return this.save();
};

ExamSchema.methods.reorderQuestions = function() {
  this.questions.forEach((question, index) => {
    question.order = index + 1;
  });
  return this.save();
};

module.exports = mongoose.model('Exam', ExamSchema);