const mongoose = require('mongoose');

const ProctorLogSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event: {
    type: String,
    enum: ['visibility', 'fullscreen', 'beforeunload', 'warning', 'tab_switch', 'copy_paste', 'right_click'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  ts: {
    type: Date,
    default: Date.now,
    //index: true
  },
  meta: {
    visible: Boolean,
    reason: String,
    url: String,
    userAgent: String,
    ip: String,
    coordinates: {
      x: Number,
      y: Number
    }
  }
}, {
  timestamps: true
});

// Indexes
ProctorLogSchema.index({ orgId: 1, submissionId: 1, ts: 1 });
ProctorLogSchema.index({ orgId: 1, userId: 1, event: 1 });
ProctorLogSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // TTL 90 days

module.exports = mongoose.model('ProctorLog', ProctorLogSchema);


