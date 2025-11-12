const User = require('../models/User');
const { generateToken } = require('../config/jwt');

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, passwordConfirm } = req.body;

    // Validate
    if (!name || !email || !password || !passwordConfirm) {
      return res.status(400).json({
        status: 'error',
        message: 'Semua field wajib diisi'
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: 'error',
        message: 'Password dan konfirmasi password tidak cocok'
      });
    }

    // Check if email already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        status: 'error',
        message: 'Email sudah terdaftar'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      status: 'success',
      message: 'Registrasi berhasil',
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email dan password wajib diisi'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Email atau password salah'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Email atau password salah'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login berhasil',
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          totalGamesPlayed: user.totalGamesPlayed,
          totalScore: user.totalScore
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
