const mongoose = require('mongoose');

const GradeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  name_en: {
    type: String,
    required: false,
    trim: true
  },
  name_jp: {
    type: String,
    required: false,
    trim: true
  },
  level: {
    type: Number,
    required: true,
    unique: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
GradeSchema.index({ level: 1 });

module.exports = mongoose.model('Grade', GradeSchema);

