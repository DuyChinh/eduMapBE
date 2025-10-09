const { User } = require('../models/index');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/passwordValidator');

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
        return user;
    },


    async login(email, password) {
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('User not found');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES });
        return { user, token };
    }
}

module.exports = authService;