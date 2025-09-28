const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const authService = {
    async register(UserData) {
        const { name, email, password, role } = UserData;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('User already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ 
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
    }
}

module.exports = authService;