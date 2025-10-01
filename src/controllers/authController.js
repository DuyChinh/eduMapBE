const authService = require('../services/authService');
const jwt = require('jsonwebtoken');

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
            res.status(500).json({ message: error.message });
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
    }
}

module.exports = authController;