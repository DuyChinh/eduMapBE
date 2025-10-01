const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    // Get token from header
    const authHeader = req.header('Authorization');
    console.log('Auth Header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    // Extract token from header (remove "Bearer " prefix)
    const token = authHeader.substring(7);
    console.log('Token extracted, attempting to verify...');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Log the entire decoded token to see its structure
    console.log('Decoded token:', JSON.stringify(decoded, null, 2));
    
    // Check if we have some form of user identifier in the token
    if (!decoded.id && !decoded._id && !decoded.userId && !decoded.sub) {
      console.warn('Token verified but no user ID found in payload');
    } else {
      // Normalize the user ID to always be in req.user.id regardless of original field name
      if (decoded._id) decoded.id = decoded._id;
      if (decoded.userId) decoded.id = decoded.userId;
      if (decoded.sub) decoded.id = decoded.sub;
      
      console.log('User ID extracted:', decoded.id);
    }
    
    // Set user info in request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    // Provide more specific error messages
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format or signature'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    
    res.status(401).json({
      success: false,
      message: 'Authentication failed: ' + error.message
    });
  }
};

module.exports = authMiddleware;
