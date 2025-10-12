const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    // required: true,
    index: true
  },
  name: {
    type: String,
    required: true,  
    trim: true
  },
  code: {
    type: String,
    required: true,
    uppercase: true
  },
  'teacherId': {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  studentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  settings: {
    allowLateSubmission: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: 1 },
    proctoringEnabled: { type: Boolean, default: false }
  },
  metadata: {
    subject: String,
    semester: String,
    academicYear: String
  }
}, {
  timestamps: true
});

// Indexes
ClassSchema.index({ orgId: 1, code: 1 }, { unique: true });
ClassSchema.index({ orgId: 1, teacherId: 1 });
ClassSchema.index({ orgId: 1, 'studentIds': 1 });

module.exports = mongoose.model('Class', ClassSchema);


