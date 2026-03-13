const crypto = require('crypto');
const User = require('../models/User');
const ParentalConsent = require('../models/ParentalConsent');
const ConsentRecord = require('../models/ConsentRecord');
const School = require('../models/School');
const qrCodeService = require('../services/qrCodeService');
const { logAuthEvent, logAuditEvent } = require('../utils/auditLogger');
const { recordFailedAttempt, clearFailedAttempts } = require('../middleware/accountLockout');
const { redisClient } = require('../services/cacheService');
const { sendSms } = require('../services/smsService');

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;

const normalizePhone = (phone = '') => phone.toString().replace(/\D/g, '').replace(/^91/, '');
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const parseDurationToMs = (value, fallbackMs) => {
  if (!value || typeof value !== 'string') return fallbackMs;

  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
  return fallbackMs;
};

// Helper to get token, create cookie and send response
const sendTokenResponse = async (user, statusCode, res) => {
  const accessTokenTtl = process.env.ACCESS_TOKEN_EXPIRE || '15m';
  const refreshTokenTtl = process.env.REFRESH_TOKEN_EXPIRE || '30d';

  const accessTokenTtlMs = parseDurationToMs(accessTokenTtl, 15 * 60 * 1000);
  const refreshTokenTtlMs = parseDurationToMs(refreshTokenTtl, 30 * 24 * 60 * 60 * 1000);

  // 15 minute access token
  const accessToken = user.getSignedJwtToken(accessTokenTtl);

  // 30-day refresh token (cryptographically random)
  const rawRefreshToken = require('crypto').randomBytes(40).toString('hex');
  const hashedRefreshToken = require('crypto')
    .createHash('sha256')
    .update(rawRefreshToken)
    .digest('hex');

  user.hashedRefreshToken = hashedRefreshToken;
  user.refreshTokenExpire = new Date(Date.now() + refreshTokenTtlMs);
  await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  user.password = undefined;

  res
    .status(statusCode)
    .cookie('refreshToken', rawRefreshToken, {
      ...cookieOptions,
      expires: user.refreshTokenExpire,
      path: '/api/v1/auth/refresh'
    })
    .cookie('token', accessToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + accessTokenTtlMs)
    })
    .json({
      success: true,
      message: 'Authentication successful',
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.profile,
        gamification: user.gamification,
        ecoCoins: user.ecoCoins,
        lastLogin: user.lastLogin
      }
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, profile } = req.body;

    // Debug logging
    console.log('Registration data:', { name, email, password: password ? 'PROVIDED' : 'MISSING', role });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Log failed registration attempt
      await logAuthEvent(
        null,
        role || 'student',
        'USER_REGISTRATION_FAILED',
        req,
        { email, reason: 'DUPLICATE_EMAIL' }
      ).catch(err => console.error('Audit log error:', err));

      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user - FORCE role to 'student' (prevent role escalation)
    const user = await User.create({
      name,
      email,
      password,
      role: 'student',
      profile,
      lastLogin: new Date()
    });

    // Auto-create consent record for students (RTE Act 2009 compliance)
    if (user.role === 'student') {
      try {
        const consent = await ParentalConsent.create({
          studentId: user._id,
          parentName: 'PENDING',
          parentPhone: '9999999999', // Placeholder - must be updated during consent request
          consentStatus: 'pending',
          consentMethod: 'otp'
        });

        // Log consent record creation
        await logAuditEvent({
          actorId: user._id.toString(),
          actorRole: user.role,
          action: 'CONSENT_RECORD_CREATED',
          targetType: 'CONSENT',
          targetId: consent._id.toString(),
          metadata: {
            autoCreated: true,
            registrationFlow: true
          },
          req,
          status: 'success',
          complianceFlags: ['RTE_ACT_2009', 'POCSO_ACT_2012']
        }).catch(err => console.error('Audit log error:', err));
      } catch (consentError) {
        console.error('Failed to create consent record:', consentError.message);
        // Don't fail registration if consent creation fails
        // This ensures user registration always succeeds
      }
    }

    // Log successful registration
    await logAuthEvent(
      user._id.toString(),
      user.role,
      'USER_REGISTERED',
      req,
      { email, name }
    ).catch(err => console.error('Audit log error:', err));

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      // Log failed login attempt
      await logAuthEvent(
        null,
        'student',
        'USER_LOGIN_FAILED',
        req,
        { email, reason: 'INVALID_CREDENTIALS' }
      ).catch(err => console.error('Audit log error:', err));

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      // Record failed attempt for lockout
      const lockoutResult = await recordFailedAttempt(email, req);

      // Log failed login attempt
      await logAuthEvent(
        user._id.toString(),
        user.role,
        'USER_LOGIN_FAILED',
        req,
        { email, reason: 'INVALID_PASSWORD', attemptsRemaining: lockoutResult.remaining }
      ).catch(err => console.error('Audit log error:', err));

      return res.status(401).json({
        success: false,
        message: lockoutResult.locked
          ? 'Account locked due to too many failed attempts. Try again in 1 hour.'
          : 'Invalid credentials',
        ...(lockoutResult.locked ? {} : { attemptsRemaining: lockoutResult.remaining })
      });
    }

    // Check if user is active
    if (!user.isActive) {
      // Log inactive account login attempt
      await logAuthEvent(
        user._id.toString(),
        user.role,
        'USER_LOGIN_FAILED',
        req,
        { email, reason: 'ACCOUNT_DEACTIVATED' }
      ).catch(err => console.error('Audit log error:', err));

      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Clear lockout on successful login
    await clearFailedAttempts(email);

    // Update last login and streak
    user.lastLogin = new Date();
    await user.updateStreak();

    // Log successful login
    await logAuthEvent(
      user._id.toString(),
      user.role,
      'USER_LOGIN',
      req,
      { email }
    ).catch(err => console.error('Audit log error:', err));

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Log user out / clear cookie
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    const user = await User.findById(req.user.id)
      .populate('progress.topicsCompleted.topicId', 'title category')
      .populate('progress.gamesPlayed.gameId', 'title category')
      .populate('progress.experimentsCompleted.experimentId', 'title category');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      'profile.dateOfBirth': req.body.profile?.dateOfBirth,
      'profile.grade': req.body.profile?.grade,
      'profile.school': req.body.profile?.school,
      'profile.city': req.body.profile?.city,
      'profile.state': req.body.profile?.state,
      'profile.language': req.body.profile?.language,
      'profile.bio': req.body.profile?.bio,
      'settings.notifications': req.body.settings?.notifications,
      'settings.privacy': req.body.settings?.privacy
    };

    // Remove undefined values
    Object.keys(fieldsToUpdate).forEach(key => {
      if (fieldsToUpdate[key] === undefined) {
        delete fieldsToUpdate[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'There is no user with that email'
      });
    }

    // Get reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      // Here you would send email with reset link
      // For now, we'll just return the reset token in development
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({
          success: true,
          message: 'Reset token sent',
          resetToken // Remove this in production
        });
      }

      res.status(200).json({
        success: true,
        message: 'Email sent with reset instructions'
      });
    } catch (err) {
      console.log(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/auth/account
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    // Verify password
    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.matchPassword(req.body.password))) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Instead of deleting, deactivate the account
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Rotate refresh token → issue new access + refresh token pair
// @route   POST /api/v1/auth/refresh
// @access  Public (uses refreshToken cookie)
exports.refreshToken = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    const hashedIncoming = require('crypto')
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const user = await User.findOne({
      hashedRefreshToken: hashedIncoming,
      refreshTokenExpire: { $gt: Date.now() }
    }).select('+hashedRefreshToken');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Rotate: invalidate old token, issue brand new pair
    await sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke refresh token on logout
// @route   POST /api/v1/auth/revoke
// @access  Private
exports.revokeRefreshToken = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { hashedRefreshToken: 1, refreshTokenExpire: 1 }
    });

    res
      .clearCookie('token')
      .clearCookie('refreshToken', { path: '/api/v1/auth/refresh' })
      .status(200)
      .json({ success: true, message: 'Logged out and refresh token revoked' });
  } catch (error) {
    next(error);
  }
};

// @desc    Send OTP for phone login
// @route   POST /api/v1/auth/send-otp
// @access  Public
exports.sendOtp = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!/^([6-9]\d{9})$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid Indian mobile number' });
    }

    const user = await User.findOne({
      $or: [
        { phone },
        { phone: `+91${phone}` },
        { parentPhone: phone },
        { parentPhone: `+91${phone}` },
        { 'profile.phone': phone },
        { 'profile.phone': `+91${phone}` }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found. Ask your school to register you.' });
    }

    const otp = generateOtp();

    if (process.env.NODE_ENV !== 'production') {
      console.log(`DEV OTP for ${phone}: ${otp}`);
    }

    await redisClient.set(`otp:${phone}`, otp, 'PX', OTP_EXPIRY_MS);
    await redisClient.set(`otp_attempts:${phone}`, 0, 'PX', OTP_EXPIRY_MS);

    await sendSms({
      phone,
      otp,
      message: `Your EcoKids login OTP is ${otp}. Valid for 5 minutes. Do not share. - EcoKids India`
    });

    const maskedPhone = `${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}`;

    res.status(200).json({
      success: true,
      maskedPhone
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and login
// @route   POST /api/v1/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || '').trim();

    const storedOtp = await redisClient.get(`otp:${phone}`);
    if (!storedOtp) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    const attemptsRaw = await redisClient.get(`otp_attempts:${phone}`);
    const attempts = Number(attemptsRaw || 0);

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await redisClient.del(`otp:${phone}`);
      await redisClient.del(`otp_attempts:${phone}`);
      return res.status(429).json({ success: false, message: 'OTP expired' });
    }

    if (storedOtp !== otp) {
      const nextAttempts = attempts + 1;
      await redisClient.set(`otp_attempts:${phone}`, nextAttempts, 'PX', OTP_EXPIRY_MS);
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
      return res.status(401).json({ success: false, message: `Incorrect OTP. ${remaining} attempts remaining` });
    }

    const user = await User.findOne({
      $or: [
        { phone },
        { phone: `+91${phone}` },
        { parentPhone: phone },
        { parentPhone: `+91${phone}` },
        { 'profile.phone': phone },
        { 'profile.phone': `+91${phone}` }
      ]
    }).select('+password');

    if (!user || !user.isActive) {
      await redisClient.del(`otp:${phone}`);
      await redisClient.del(`otp_attempts:${phone}`);
      return res.status(401).json({ success: false, message: 'Account not available' });
    }

    await redisClient.del(`otp:${phone}`);
    await redisClient.del(`otp_attempts:${phone}`);
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await logAuthEvent(
      user._id.toString(),
      user.role,
      'USER_LOGIN_OTP',
      req,
      { phone }
    ).catch(() => {});

    return sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Student self registration with school code
// @route   POST /api/v1/auth/register-student
// @access  Public
exports.registerStudent = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      grade,
      section,
      rollNumber,
      schoolCode,
      parentPhone
    } = req.body;

    const school = await School.findOne({ $or: [{ schoolCode }, { code: schoolCode }] });
    if (!school) {
      return res.status(400).json({ success: false, message: 'Invalid school code' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'student',
      schoolCode,
      rollNumber,
      section,
      parentPhone,
      firstLogin: true,
      profile: {
        grade: String(grade),
        section,
        school: school.name,
        schoolId: school._id
      },
      gamification: {
        badges: [{ badgeId: 'eco-starter', name: 'EcoStarter', earnedAt: new Date() }]
      }
    });

    await sendSms({
      phone: normalizePhone(parentPhone),
      message: `Welcome to EcoKids! Your child ${name} is registered. Login: ${email} Password: ${password} - EcoKids India`
    });

    return sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    QR login via token in query string
// @route   GET /api/v1/auth/qr-login
// @access  Public
exports.qrLoginByToken = async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const qrVerification = await qrCodeService.verifyQRToken(token);
    if (!qrVerification.valid) {
      return res.status(401).json({ success: false, message: 'This QR code has expired. Ask your teacher for a new one.' });
    }

    const student = await User.findById(qrVerification.userId).select('+password');
    if (!student || !student.isActive) {
      return res.status(401).json({ success: false, message: 'Student account not available' });
    }

    student.lastLogin = new Date();
    await student.save({ validateBeforeSave: false });
    return sendTokenResponse(student, 200, res);
  } catch (error) {
    next(error);
  }
};