const mongoose = require('mongoose');

const ResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  otp: {
    type: String,
    required: true
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

// Index để tìm OTP chưa sử dụng
ResetTokenSchema.index({ otp: 1, used: 1 });

module.exports = mongoose.model('ResetToken', ResetTokenSchema);
