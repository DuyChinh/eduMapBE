const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  value: mongoose.Schema.Types.Mixed,
  isCorrect: Boolean,
  points: Number,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const SubmissionSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
    index: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for guest submissions
    index: true
  },
  guestName: {
    type: String,
    trim: true,
    maxlength: 128
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  },
  questionOrder: [mongoose.Schema.Types.ObjectId],
  answers: [AnswerSchema],
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  startedAt: Date,
  submittedAt: Date,
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'graded', 'late'],
    default: 'in_progress',
    index: true
  },
  autoSavedAt: Date,
  timeSpent: {
    type: Number,
    default: 0 // seconds
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  proctoringData: {
    violations: [String],
    screenshots: [String],
    warnings: [String]
  },
  aiAnalysis: {
    type: String,
    default: ""
  },
  analysisLanguage: {
    type: String,
    default: "vi"
  }
}, {
  timestamps: true
});

// Indexes
SubmissionSchema.index({ orgId: 1, examId: 1, userId: 1 });
SubmissionSchema.index({ orgId: 1, assignmentId: 1 });
SubmissionSchema.index({ orgId: 1, userId: 1, status: 1 });
SubmissionSchema.index({ orgId: 1, submittedAt: 1 });

// Calculate percentage before save
SubmissionSchema.pre('save', function (next) {
  if (this.maxScore > 0) {
    this.percentage = Math.round((this.score / this.maxScore) * 100);
  }
  next();
});

module.exports = mongoose.model('Submission', SubmissionSchema);


