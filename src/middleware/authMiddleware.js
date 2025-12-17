const authService = require('../services/authService');
const authCommon = require('../common/authCommon');

const authMiddleware = {
    async authenticate(req, res, next) {
        try {
            // Check if authorization header exists
            if (!req.headers.authorization) {
                return res.status(401).json({
                    message: 'Authorization header is required'
                });
            }

            // Check if token format is correct
            const authParts = req.headers.authorization.split(' ');
            if (authParts.length !== 2 || authParts[0] !== 'Bearer') {
                return res.status(401).json({
                    message: 'Invalid authorization format. Use: Bearer <token>'
                });
            }

            const token = authParts[1];
            const decoded = authCommon.verifyToken(token);

            req.user = {
                userId: decoded.userId || decoded.id,
                email: decoded.email,
                role: decoded.role
            };
            next();
        } catch (error) {
            res.status(401).json({
                message: 'Invalid or expired token'
            });
        }
    },

    isAdmin(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Admin access required'
            });
        }

        next();
    },

    isTeacherOrAdmin(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Teacher or admin access required'
            });
        }

        next();
    }

}

module.exports = authMiddleware;