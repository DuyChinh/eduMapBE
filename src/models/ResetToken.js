const mongoose = require('mongoose');

const ResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // Tự động xóa document sau khi hết hạn
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index để tìm token chưa sử dụng
ResetTokenSchema.index({ token: 1, used: 1 });

module.exports = mongoose.model('ResetToken', ResetTokenSchema);
