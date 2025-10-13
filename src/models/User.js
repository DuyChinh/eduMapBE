const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
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
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['teacher', 'student', 'admin'],
    default: 'student',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  profile: {
    avatar: String,
    phone: String,
    studentId: String,
    department: String
  },
  preferences: {
    language: { type: String, default: 'vi' },
    timezone: { type: String, default: 'Asia/Ho_Chi_Minh' }
  }
}, {
  timestamps: true
});

// Indexes
UserSchema.index({ orgId: 1, email: 1 }, { unique: true });
UserSchema.index({ orgId: 1, role: 1 });

module.exports = mongoose.model('User', UserSchema);


