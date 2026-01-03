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
  language: {
    type: String,
    enum: ['vi', 'en', 'jp'],
    default: 'vi'
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  dob: {
    type: Date
  },
  phone: {
    type: String,
    unique: true,
    sparse: true
  },
  address: {
    type: String
  },
  profile: {
    avatar: String,
    studentId: String
  },
  preferences: {
    language: { type: String, default: 'vi' },
    timezone: { type: String, default: 'Asia/Ho_Chi_Minh' }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'plus', 'pro'],
      default: 'free'
    },
    expiresAt: {
      type: Date
    }
  },
  aiUsage: {
    count: { type: Number, default: 0 },
    lastUsed: { type: Date }
  }
}, {
  timestamps: true
});

// Indexes
UserSchema.index({ orgId: 1, email: 1 }, { unique: true });
UserSchema.index({ orgId: 1, role: 1 });

module.exports = mongoose.model('User', UserSchema);


