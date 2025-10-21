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
  },
  // Exam-specific overrides (optional)
  customText: String,
  customChoices: [{
    key: { type: String, required: true },
    text: { type: String, required: true }
  }],
  customAnswer: mongoose.Schema.Types.Mixed,
  customExplanation: String
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
    shuffleQuestions: { type: Boolean, default: false },
    shuffleChoices: { type: Boolean, default: false },
    timeLimit: { type: Boolean, default: true },
    maxAttempts: { type: Number, default: 1 },

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

// Virtual for question count
ExamSchema.virtual('questionCount').get(function() {
  return this.questions.length;
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