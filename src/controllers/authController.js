const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ResetToken = require('../models/ResetToken');
const { validatePassword } = require('../utils/passwordValidator');

const authController = {
    async register(req, res) {        
        try {
            const result = await authService.register(req.body);
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: result
            });
        } catch (error) {
            // Check if it's a password validation error
            if (error.message.includes('Password validation failed')) {
                const errors = error.message.replace('Password validation failed: ', '').split(', ');
                return res.status(400).json({
                    success: false,
                    message: 'Password validation failed',
                    errors: errors
                });
            }
            
            // Other errors
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);
            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: result
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    handleLoginGoogle(req, res, next) { 
        next();
    },

    handleLoginGoogleCallback(req, res) { 
        const payload = {
            userId: req.user.id,
            email: req.user.email,
            role: req.user.role
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES });
        
        const redirectUrl = process.env.FE_REDIRECT_URL || 'http://localhost:5173/auth/callback';
        res.redirect(redirectUrl + '?token=' + token);
    },

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required'
                });
            }

            // Tìm user theo email
            const user = await User.findOne({ email });
            if (!user) {
                // Trả về success để tránh email enumeration attack
                return res.status(200).json({
                    success: true,
                    message: 'If the email exists, a reset link has been sent'
                });
            }

            // Xóa các token reset cũ của user này
            await ResetToken.deleteMany({ userId: user._id });

            // Tạo token reset mới
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

            // Lưu token vào database
            await ResetToken.create({
                userId: user._id,
                token: resetToken,
                expiresAt: expiresAt
            });

            // Gửi email reset password
            await emailService.sendResetPasswordEmail(user.email, resetToken, user.name);

            res.status(200).json({
                success: true,
                message: 'If the email exists, a reset link has been sent'
            });
        } catch (error) {
            console.error('Error in forgotPassword:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Token and new password are required'
                });
            }

            // Validate password strength
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Password validation failed',
                    errors: passwordValidation.errors
                });
            }

            // Tìm token reset hợp lệ
            const resetToken = await ResetToken.findOne({
                token: token,
                used: false,
                expiresAt: { $gt: new Date() }
            });

            if (!resetToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired reset token'
                });
            }

            // Tìm user
            const user = await User.findById(resetToken.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Hash password mới
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Cập nhật password
            await User.findByIdAndUpdate(user._id, { password: hashedPassword });

            // Đánh dấu token đã sử dụng
            await ResetToken.findByIdAndUpdate(resetToken._id, { used: true });

            res.status(200).json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error) {
            console.error('Error in resetPassword:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    }
}

module.exports = authController;