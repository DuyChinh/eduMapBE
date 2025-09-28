const mongoose = require('mongoose');

const ChoiceSchema = new mongoose.Schema({
  key: { type: String, required: true },
  text: { type: String, required: true }
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['mcq', 'tf', 'short', 'essay'],
    default: 'mcq'
  },
  text: {
    type: String,
    required: true
  },
  choices: [ChoiceSchema],
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  tags: [{
    type: String,
    index: true
  }],
  level: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  metadata: {
    chapter: String,
    source: String,
    difficulty: String,
    estimatedTime: Number // seconds
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
QuestionSchema.index({ orgId: 1, ownerId: 1, tags: 1 });
QuestionSchema.index({ orgId: 1, text: 'text' });
QuestionSchema.index({ orgId: 1, tags: 1 });
QuestionSchema.index({ orgId: 1, type: 1, level: 1 });

module.exports = mongoose.model('Question', QuestionSchema);