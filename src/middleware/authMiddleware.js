const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Also set req.userId for controllers
      req.userId = req.user._id.toString();

      next();
    } catch (error) {
      console.error('❌ Auth middleware error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Optional auth middleware - allows both guest and authenticated users
const optionalAuth = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (req.user) {
        // Set req.userId for controllers
        req.userId = req.user._id.toString();
      }
    } catch (error) {
      console.error('❌ Optional auth error:', error.message);
      // Don't block the request, just continue without user
    }
  }

  // Continue regardless of whether token was valid or not
  next();
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      return res.status(403).json({ 
        status: 'error',
        message: 'Access denied. Admin only.' 
      });
    }
  } catch (error) {
    console.error('❌ Admin check error:', error.message);
    return res.status(500).json({ 
      status: 'error',
      message: 'Server error' 
    });
  }
};

module.exports = { protect, optionalAuth, isAdmin };
