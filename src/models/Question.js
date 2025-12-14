const mongoose = require('mongoose');

const ChoiceSchema = new mongoose.Schema({
  key: { type: String, required: true },
  text: { type: String }, // Made optional to support image-only options
  image: { type: String }
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    index: true,
    required: true
  },
  subjectCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['mcq', 'tf', 'short', 'essay'],
    default: 'mcq'
  },
  name: {
    type: String,
    trim: true,
    required: true,
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
  explanation: {
    type: String,
    trim: true
  },
  images: [{
    type: String
  }],
  tags: [{
    type: String
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
QuestionSchema.index({ orgId: 1, subjectId: 1, level: 1, type: 1 });

module.exports = mongoose.model('Question', QuestionSchema);