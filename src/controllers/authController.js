const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ResetToken = require('../models/ResetToken');
const emailService = require('../services/emailService');
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
                    message: 'Password validation failed',
                    errors: errors
                });
            }
            
            // Handle user already exists error
            if (error.message === 'User already exists') {
                return res.status(409).json({
                    message: 'User already exists'
                });
            }
            
            // Other errors
            res.status(500).json({ 
                message: 'Server error: ' + error.message 
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
            // Handle specific login errors
            if (error.message === 'User not found' || error.message === 'Email or password is incorrect') {
                return res.status(401).json({
                    message: 'Email or password is incorrect'
                });
            }
            
            // Other errors
            res.status(500).json({
                message: 'Server error: ' + error.message
            });
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
        
        // Tạo Access Token (ngắn hạn - 1h)
        const accessToken = jwt.sign(
            payload, 
            process.env.JWT_SECRET, 
            { expiresIn: process.env.JWT_ACCESS_EXPIRES || '1h' }
        );
        
        // Tạo Refresh Token (dài hạn - 7d)
        const refreshToken = jwt.sign(
            { id: req.user.id, type: 'refresh' }, 
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, 
            { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
        );
        
        const redirectUrl = process.env.FE_REDIRECT_URL || 'http://localhost:5173/auth/callback';
        res.redirect(redirectUrl + '?accessToken=' + accessToken + '&refreshToken=' + refreshToken);
    },

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
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

            // Tạo OTP 6 chữ số
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

            // Lưu OTP vào database
            await ResetToken.create({
                userId: user._id,
                otp: otp,
                expiresAt: expiresAt
            });

            // Gửi email reset password với OTP
            await emailService.sendResetPasswordEmail(user.email, otp, user.name);

            res.status(200).json({
                success: true,
                message: 'If the email exists, an OTP has been sent'
            });
        } catch (error) {
            console.error('Error in forgotPassword:', error);
            res.status(500).json({
                message: 'Server error: ' + error.message
            });
        }
    },

    async verifyOtp(req, res) {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return res.status(400).json({
                    message: 'Email and OTP are required'
                });
            }

            // Tìm OTP hợp lệ
            const resetToken = await ResetToken.findOne({
                otp: otp,
                used: false,
                expiresAt: { $gt: new Date() }
            }).populate('userId');

            if (!resetToken) {
                return res.status(400).json({
                    message: 'Invalid or expired OTP'
                });
            }

            // Kiểm tra email có khớp không
            if (resetToken.userId.email !== email) {
                return res.status(400).json({
                    message: 'Invalid OTP for this email'
                });
            }

            // Đánh dấu OTP đã sử dụng
            await ResetToken.findByIdAndUpdate(resetToken._id, { used: true });

            res.status(200).json({
                success: true,
                message: 'OTP verified successfully',
                data: {
                    userId: resetToken.userId._id,
                    email: resetToken.userId.email
                }
            });
        } catch (error) {
            console.error('Error in verifyOtp:', error);
            res.status(500).json({
                message: 'Server error: ' + error.message
            });
        }
    },

    async resetPassword(req, res) {
        try {
            const { email, newPassword } = req.body;

            if (!email || !newPassword) {
                return res.status(400).json({
                    message: 'Email and new password are required'
                });
            }

            // Validate password strength
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    message: 'Password validation failed',
                    errors: passwordValidation.errors
                });
            }

            // Tìm user
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            // Kiểm tra có OTP đã verify chưa (trong vòng 15 phút)
            const verifiedOtp = await ResetToken.findOne({
                userId: user._id,
                used: true,
                expiresAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) } // Trong vòng 15 phút
            });

            if (!verifiedOtp) {
                return res.status(400).json({
                    message: 'Please verify OTP first'
                });
            }

            // Hash password mới
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Cập nhật password
            await User.findByIdAndUpdate(user._id, { password: hashedPassword });

            // Xóa tất cả OTP của user này
            await ResetToken.deleteMany({ userId: user._id });

            res.status(200).json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error) {
            console.error('Error in resetPassword:', error);
            res.status(500).json({
                message: 'Server error: ' + error.message
            });
        }
    },

    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Refresh token is required' 
                });
            }
            
            // Verify refresh token
            const decoded = jwt.verify(
                refreshToken, 
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
            );
            
            if (decoded.type !== 'refresh') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid refresh token' 
                });
            }
            
            // Lấy user từ database
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    message: 'User not found' 
                });
            }
            
            // Tạo access token mới
            const accessToken = jwt.sign(
                { id: user.id || user._id, email: user.email, role: user.role }, 
                process.env.JWT_SECRET, 
                { expiresIn: process.env.JWT_ACCESS_EXPIRES || '1h' }
            );
            
            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    accessToken
                    // Giữ nguyên refreshToken (không rotation) hoặc tạo mới nếu muốn rotation
                }
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Refresh token has expired' 
                });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid refresh token' 
                });
            }
            console.error('Error in refreshToken:', error);
            return res.status(500).json({ 
                success: false,
                message: 'Server error: ' + error.message 
            });
        }
    },

    async logout(req, res) {
        try {
            // Logout is stateless with JWT, so we just return success
            // Client should clear the token from storage
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            console.error('Error in logout:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    }
}

module.exports = authController;