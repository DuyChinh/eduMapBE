const mongoose = require('mongoose');

const ExamItemSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

const ExamSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  settings: {
    openAt: Date,
    closeAt: Date,
    duration: {
      type: Number,
      default: 60 // minutes
    },
    attempts: {
      type: Number,
      default: 1,
      min: 1
    },
    shuffle: {
      type: Boolean,
      default: true
    },
    showResult: {
      type: Boolean,
      default: true
    },
    allowReview: {
      type: Boolean,
      default: false
    },
    proctoring: {
      enabled: { type: Boolean, default: false },
      strictMode: { type: Boolean, default: false }
    }
  },
  items: [ExamItemSchema],
  version: {
    type: Number,
    default: 1
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Indexes
ExamSchema.index({ orgId: 1, ownerId: 1 });
ExamSchema.index({ orgId: 1, status: 1 });
ExamSchema.index({ 'settings.openAt': 1, 'settings.closeAt': 1 });

// Calculate total points before save
ExamSchema.pre('save', function(next) {
  this.totalPoints = this.items.reduce((sum, item) => sum + item.points, 0);
  next();
});

module.exports = mongoose.model('Exam', ExamSchema);


