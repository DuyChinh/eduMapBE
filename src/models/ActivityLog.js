const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    index: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'start',           // Started exam
      'answer',          // Answered a question
      'change',          // Changed an answer
      'submit',          // Submitted exam
      'tab_switch',      // Switched browser tab
      'window_blur',     // Lost window focus
      'copy_attempt',    // Attempted to copy
      'paste_attempt',   // Attempted to paste
      'right_click',     // Right-clicked
      'fullscreen_exit', // Exited fullscreen
      'screenshot',      // Screenshot detected
      'auto_save'        // Auto-saved progress
    ],
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isSuspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  }
}, {
  timestamps: true
});

// Indexes for performance
ActivityLogSchema.index({ submissionId: 1, timestamp: 1 });
ActivityLogSchema.index({ examId: 1, userId: 1 });
ActivityLogSchema.index({ userId: 1, isSuspicious: 1 });
ActivityLogSchema.index({ type: 1, timestamp: -1 });

// Static method to log activity
ActivityLogSchema.statics.logActivity = async function(data) {
  const { submissionId, examId, userId, type, action, details, isSuspicious, severity } = data;
  
  return await this.create({
    submissionId,
    examId,
    userId,
    type,
    action,
    details: details || {},
    isSuspicious: isSuspicious || false,
    severity: severity || 'low'
  });
};

// Static method to get suspicious activities for a submission
ActivityLogSchema.statics.getSuspiciousActivities = async function(submissionId) {
  return await this.find({ 
    submissionId, 
    isSuspicious: true 
  }).sort({ timestamp: 1 });
};

// Static method to get activity summary
ActivityLogSchema.statics.getActivitySummary = async function(submissionId) {
  const activities = await this.aggregate([
    { $match: { submissionId: new mongoose.Types.ObjectId(submissionId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        isSuspicious: { $max: '$isSuspicious' }
      }
    }
  ]);
  
  const summary = {};
  activities.forEach(activity => {
    summary[activity._id] = {
      count: activity.count,
      isSuspicious: activity.isSuspicious
    };
  });
  
  return summary;
};

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);

