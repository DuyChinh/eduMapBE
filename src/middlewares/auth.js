const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured in environment variables');
      return res.status(500).json({
        message: 'Server configuration error'
      });
    }

    // Get token from header
    const authHeader = req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id && !decoded._id && !decoded.userId && !decoded.sub) {
      console.warn('Token verified but no user ID found in payload');
    } else {
      const userId = decoded._id || decoded.id || decoded.userId || decoded.sub;
      decoded.id = userId;
      decoded._id = userId;
    }

    // Set user info in request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);

    // Provide more specific error messages
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token format or signature'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token has expired'
      });
    }

    res.status(401).json({
      message: 'Authentication failed: ' + error.message
    });
  }
};

module.exports = authMiddleware;
