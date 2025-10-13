const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  domain: {
    type: String,
    lowercase: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  settings: {
    maxStudents: { type: Number, default: 100 },
    maxExams: { type: Number, default: 10 },
    features: [String]
  }
}, {
  timestamps: true
});

// Indexes
OrganizationSchema.index({ domain: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Organization', OrganizationSchema);


