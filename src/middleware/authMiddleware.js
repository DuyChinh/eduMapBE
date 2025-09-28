const authService = require('../services/authService');
const authCommon = require('../common/authCommon');

const authMiddleware = {
    async authenticate(req, res, next) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = authCommon.verifyToken(token);
            req.user =  {
                userId: decoded.id,
                email: decoded.email,
                role: decoded.role
             };
            next();
        } catch (error) {
            res.status(401).json({ message: 'Unauthorized' });
        }
    },

    isAdmin(req, res, next) {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        next();
    },

    isTeacherOrAdmin(req, res, next) {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Teacher or admin access required' });
        }
        
        next();
    }

}

module.exports = authMiddleware;