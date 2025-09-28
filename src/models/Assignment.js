const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  window: {
    openAt: Date,
    closeAt: Date
  },
  settings: {
    allowLateSubmission: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: 1 },
    timeLimit: Number, // override exam duration
    instructions: String
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  statistics: {
    totalStudents: { type: Number, default: 0 },
    submittedCount: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
AssignmentSchema.index({ orgId: 1, classId: 1 });
AssignmentSchema.index({ orgId: 1, examId: 1 });
AssignmentSchema.index({ orgId: 1, status: 1 });
AssignmentSchema.index({ 'window.openAt': 1, 'window.closeAt': 1 });

module.exports = mongoose.model('Assignment', AssignmentSchema);