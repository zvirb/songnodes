const express = require('express');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { authLimiter, blockSuspiciousIPs } = require('../middleware/rateLimit');
const UserModel = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  body('name')
    .isLength({ min: 2, max: 50 })
    .trim()
    .escape()
    .withMessage('Name must be between 2 and 50 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Apply rate limiting and IP blocking to all auth routes
router.use(blockSuspiciousIPs);
router.use(authLimiter);

// Register endpoint
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User Already Exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password with Argon2 (more secure than bcrypt)
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });

    // Create user
    const userData = {
      email,
      password: hashedPassword,
      name,
      role: 'user',
      permissions: ['read'],
      isActive: true,
      emailVerified: false,
      createdAt: new Date().toISOString()
    };

    const user = await UserModel.create(userData);

    // Generate tokens
    const { accessToken, refreshToken } = authMiddleware.generateTokenPair(user);

    // Create session
    await authMiddleware.createSession(user, refreshToken);

    // Log registration
    logger.info(`User registered: ${email} from ${req.ip}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRY || '15m'
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user'
    });
  }
});

// Login endpoint
router.post('/login', loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { email, password, rememberMe } = req.body;

    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account Disabled',
        message: 'Your account has been disabled'
      });
    }

    // Verify password
    const isValidPassword = await argon2.verify(user.password, password);
    if (!isValidPassword) {
      // Log failed login attempt
      logger.warn(`Failed login attempt for ${email} from ${req.ip}`);
      
      await UserModel.incrementFailedLogins(user.id);
      
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Check for account lockout
    if (user.failedLoginAttempts >= 5) {
      const lockoutExpiry = new Date(user.lastFailedLogin.getTime() + 30 * 60 * 1000); // 30 minutes
      if (new Date() < lockoutExpiry) {
        return res.status(423).json({
          error: 'Account Locked',
          message: 'Account temporarily locked due to too many failed login attempts',
          retryAfter: Math.ceil((lockoutExpiry - new Date()) / 1000)
        });
      }
    }

    // Reset failed login attempts on successful login
    await UserModel.resetFailedLogins(user.id);

    // Update last login
    await UserModel.updateLastLogin(user.id);

    // Generate tokens
    const tokenExpiry = rememberMe ? '30d' : (process.env.JWT_EXPIRY || '15m');
    const { accessToken, refreshToken } = authMiddleware.generateTokenPair(user);

    // Create session
    await authMiddleware.createSession(user, refreshToken);

    // Log successful login
    logger.info(`User logged in: ${email} from ${req.ip}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: tokenExpiry
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate user'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = await authMiddleware.verifyRefreshToken(refreshToken);

    // Get user data
    const user = await UserModel.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = authMiddleware.generateTokenPair(user);

    // Update session
    await authMiddleware.createSession(user, newRefreshToken);

    res.json({
      message: 'Tokens refreshed successfully',
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRY || '15m'
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token'
    });
  }
});

// Logout endpoint
router.post('/logout', authMiddleware.verifyToken, async (req, res) => {
  try {
    const token = req.headers.authorization.substring(7);

    // Blacklist the current token
    await authMiddleware.blacklistToken(token);

    // Delete user session
    await authMiddleware.deleteSession(req.user.id);

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to logout user'
    });
  }
});

// Get current user profile
router.get('/profile', authMiddleware.verifyToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User profile not found'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user profile'
    });
  }
});

// Change password
router.put('/change-password', 
  authMiddleware.verifyToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await UserModel.findById(req.user.id);

      // Verify current password
      const isValidPassword = await argon2.verify(user.password, currentPassword);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedPassword = await argon2.hash(newPassword, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });

      // Update password
      await UserModel.updatePassword(req.user.id, hashedPassword);

      logger.info(`Password changed for user: ${req.user.email}`);

      res.json({
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Password change error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to change password'
      });
    }
  }
);

// Verify token endpoint (for other services)
router.get('/verify', authMiddleware.verifyToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      permissions: req.user.permissions
    }
  });
});

module.exports = router;