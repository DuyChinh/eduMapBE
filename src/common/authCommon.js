const jwt = require('jsonwebtoken');
const { response } = require('../app');

const authCommon = {
    generateToken(user) {
        const payload = {
            id: user._id,
            email: user.email,
            role: user.role,
        };
        return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    },


    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        }                   
        catch (err) {
            throw new Error('Invalid token');
        }
    }
};

module.exports = authCommon;