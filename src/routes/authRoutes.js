const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
const {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  getMe,
  updateProfile,
  getAllUsers
} = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Register a new user and send OTP
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and activate account
// @access  Public
router.post('/verify-otp', verifyOTP);

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post('/resend-otp', resendOTP);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset OTP
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /api/auth/verify-reset-otp
// @desc    Verify reset password OTP
// @access  Public
router.post('/verify-reset-otp', verifyResetOTP);

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post('/reset-password', resetPassword);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, getMe);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, updateProfile);

// @route   GET /api/auth/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/users', protect, isAdmin, getAllUsers);

module.exports = router;
