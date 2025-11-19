const User = require('../models/User');
const { generateToken } = require('../config/jwt');
const { sendMail } = require('../utils/mailer');
const generateOTP = require('../utils/generateOTP');

// @route   GET /api/auth/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    console.log('🔍 Fetching all users...');
    console.log('👤 Requested by:', req.user.email, '| Role:', req.user.role);
    
    const users = await User.find().select('-password -otp -otpExpire -resetPasswordToken -resetPasswordExpire').sort({ createdAt: -1 });
    
    console.log(`✅ Found ${users.length} users`);
    
    res.status(200).json({
      status: 'success',
      data: {
        users
      }
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    next(error);
  }
};

// @route   POST /api/auth/register
// @desc    Register a user and send OTP
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

    // Generate OTP
    const otp = generateOTP();
    const otpExpire = Date.now() + 10 * 60 * 1000; // 10 menit

    // Create user (unverified)
    const user = await User.create({
      name,
      email,
      password,
      otp,
      otpExpire,
      isVerified: false
    });

    res.status(201).json({
      status: 'success',
      message: 'Registrasi berhasil! Silakan cek email untuk kode OTP verifikasi.',
      data: {
        userId: user._id,
        email: user.email
      }
    });

    // Send OTP email in background
    sendMail({
      to: user.email,
      subject: 'Kode OTP Verifikasi - Brain Rush',
      text: `Halo ${user.name},\n\nKode OTP verifikasi akun Anda adalah:\n\n${otp}\n\nKode ini berlaku selama 10 menit.\n\nJika Anda tidak melakukan registrasi, abaikan email ini.`,
      html: `
        <h2>Verifikasi Akun Brain Rush</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Terima kasih sudah mendaftar di Brain Rush! Untuk melanjutkan, silakan verifikasi email Anda dengan kode OTP berikut:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>Kode ini berlaku selama <strong>10 menit</strong>.</p>
        <p>Jika Anda tidak melakukan registrasi, abaikan email ini.</p>
      `
    }).then(info => {
      console.log('OTP email sent to', user.email);
    }).catch(err => {
      console.warn('Failed to send OTP email to', user.email, err.message);
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and activate account
// @access  Public
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Email dan OTP wajib diisi'
      });
    }

    // Find user with OTP
    const user = await User.findOne({ 
      email,
      otp,
      otpExpire: { $gt: Date.now() }
    }).select('+otp +otpExpire');

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Kode OTP tidak valid atau sudah expired'
      });
    }

    // Verify user account
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Email berhasil diverifikasi! Akun Anda sudah aktif.',
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isVerified: user.isVerified
        }
      }
    });

    // Send welcome email
    sendMail({
      to: user.email,
      subject: 'Selamat Datang di Brain Rush! 🎉',
      text: `Halo ${user.name},\n\nSelamat! Akun Anda telah berhasil diverifikasi.\n\nSelamat bermain quiz dan semoga menyenangkan!`,
      html: `
        <h2>Selamat Datang di Brain Rush! 🎉</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Akun Anda telah <strong>berhasil diverifikasi</strong>!</p>
        <p>Sekarang Anda bisa menikmati semua fitur Brain Rush.</p>
        <p>Selamat bermain dan semoga menyenangkan!</p>
      `
    }).catch(err => console.warn('Failed to send welcome email:', err.message));
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email wajib diisi'
      });
    }

    const user = await User.findOne({ email, isVerified: false });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User tidak ditemukan atau sudah diverifikasi'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Kode OTP baru telah dikirim ke email Anda'
    });

    // Send new OTP
    sendMail({
      to: user.email,
      subject: 'Kode OTP Baru - Brain Rush',
      text: `Halo ${user.name},\n\nKode OTP baru Anda adalah:\n\n${otp}\n\nKode ini berlaku selama 10 menit.`,
      html: `
        <h2>Kode OTP Baru</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Berikut adalah kode OTP baru Anda:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>Kode ini berlaku selama <strong>10 menit</strong>.</p>
      `
    }).catch(err => console.warn('Failed to resend OTP:', err.message));
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

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        status: 'error',
        message: 'Email belum diverifikasi. Silakan cek email Anda untuk kode OTP.'
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
          role: user.role,
          totalGamesPlayed: user.totalGamesPlayed,
          totalScore: user.totalScore,
          isVerified: user.isVerified
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

// @route   POST /api/auth/forgot-password
// @desc    Request password reset with OTP
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email wajib diisi'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Email tidak terdaftar'
      });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 menit
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Kode OTP untuk reset password telah dikirim ke email Anda'
    });

    // Send OTP email
    sendMail({
      to: user.email,
      subject: 'Kode OTP Reset Password - Brain Rush',
      text: `Halo ${user.name},\n\nKode OTP untuk reset password Anda adalah:\n\n${otp}\n\nKode ini berlaku selama 10 menit.\n\nJika Anda tidak melakukan permintaan ini, abaikan email ini.`,
      html: `
        <h2>Reset Password - Brain Rush</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Anda melakukan permintaan reset password. Gunakan kode OTP berikut:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>Kode ini berlaku selama <strong>10 menit</strong>.</p>
        <p>Jika Anda tidak melakukan permintaan ini, abaikan email ini dan password Anda tetap aman.</p>
      `
    }).catch(err => console.warn('Failed to send reset OTP:', err.message));
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/auth/verify-reset-otp
// @desc    Verify OTP for password reset
// @access  Public
exports.verifyResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Email dan OTP wajib diisi'
      });
    }

    // Find user with valid OTP
    const user = await User.findOne({ 
      email,
      otp,
      otpExpire: { $gt: Date.now() }
    }).select('+otp +otpExpire');

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Kode OTP tidak valid atau sudah expired'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Kode OTP valid. Silakan masukkan password baru Anda.',
      data: {
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, OTP, dan password baru wajib diisi'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password minimal 6 karakter'
      });
    }

    // Find user with valid OTP
    const user = await User.findOne({ 
      email,
      otp,
      otpExpire: { $gt: Date.now() }
    }).select('+otp +otpExpire');

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Kode OTP tidak valid atau sudah expired'
      });
    }

    // Set password baru (akan di-hash otomatis)
    user.password = password;
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password berhasil direset! Silakan login dengan password baru.'
    });

    // Send confirmation email
    sendMail({
      to: user.email,
      subject: 'Password Berhasil Direset - Brain Rush',
      text: `Halo ${user.name},\n\nPassword Anda telah berhasil direset.\n\nJika Anda tidak melakukan ini, segera hubungi kami.`,
      html: `
        <h2>Password Berhasil Direset</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Password Anda telah <strong>berhasil direset</strong>.</p>
        <p>Sekarang Anda bisa login dengan password baru Anda.</p>
        <p>Jika Anda tidak melakukan ini, segera hubungi kami.</p>
      `
    }).catch(err => console.warn('Failed to send confirmation email:', err.message));
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User tidak ditemukan'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Profile berhasil diupdate',
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
