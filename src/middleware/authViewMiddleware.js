const authCommon = require('../common/authCommon');
const User = require('../models/User');

/**
 * Middleware for EJS views - checks token from cookie or query param
 */
const authViewMiddleware = {
    async authenticate(req, res, next) {
        try {
            let token = null;

            // Try to get token from cookie
            if (req.cookies && req.cookies.admin_token) {
                token = req.cookies.admin_token;
                console.log('Token found in cookie');
            }
            // Try to get token from query parameter (for testing)
            else if (req.query.token) {
                token = req.query.token;
                console.log('Token found in query param');
            }
            // Try to get token from Authorization header
            else if (req.headers.authorization) {
                const authParts = req.headers.authorization.split(' ');
                if (authParts.length === 2 && authParts[0] === 'Bearer') {
                    token = authParts[1];
                    console.log('Token found in header');
                }
            }

            if (!token) {
                console.log('No token found, redirecting to login');
                return res.redirect('/admin/login');
            }

            try {
                const decoded = authCommon.verifyToken(token);
                console.log('Token decoded:', decoded);
                
                // Get full user data from database
                const user = await User.findById(decoded.id).select('-password').lean();
                
                if (!user) {
                    console.log('User not found in database');
                    return res.redirect('/admin/login');
                }

                console.log('User found:', user.email, user.role);

                req.user = {
                    id: user._id.toString(),
                    userId: user._id.toString(),
                    email: user.email,
                    name: user.name,
                    role: user.role
                };
                
                next();
            } catch (error) {
                console.error('Token verification error:', error.message);
                return res.redirect('/admin/login');
            }
        } catch (error) {
            console.error('Authentication middleware error:', error);
            return res.redirect('/admin/login');
        }
    },

    isAdmin(req, res, next) {
        if (!req.user) {
            return res.redirect('/admin/login');
        }
        
        if (req.user.role !== 'admin') {
            return res.redirect('/admin/login?error=access_denied');
        }
        
        next();
    }
};

module.exports = authViewMiddleware;

