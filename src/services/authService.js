const { User } = require('../models/index');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/passwordValidator');
const { sanitizeUser } = require('../utils/userUtils');

const authService = {
    async register(UserData) {
        const { name, email, password, role } = UserData;

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('User already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            orgId: null,
            name,
            email,
            password: hashedPassword,
            role,
            status: 'active',
        });
        return sanitizeUser(user);
    },


    async login(email, password, isAdmin = false) {
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('User not found');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Email or password is incorrect');
        }
        
        // Tạo Access Token
        // Admin: 24h để đồng bộ với cookie, User thường: 1h
        const tokenExpiresIn = isAdmin 
            ? (process.env.JWT_ADMIN_EXPIRES || '24h')
            : (process.env.JWT_ACCESS_EXPIRES || '1h');
        
        const accessToken = jwt.sign(
            { id: user.id || user._id, email: user.email, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: tokenExpiresIn }
        );
        
        // Tạo Refresh Token (dài hạn - 7d)
        const refreshToken = jwt.sign(
            { id: user.id || user._id, type: 'refresh' }, 
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, 
            { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
        );
        
        return { 
            user: sanitizeUser(user), 
            accessToken,
            refreshToken 
        };
    }
}

module.exports = authService;