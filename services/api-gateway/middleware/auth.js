const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

class AuthMiddleware {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_here';
    this.JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
    this.JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  // Generate access token
  generateAccessToken(payload) {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRY,
      issuer: 'musicdb-api',
      audience: 'musicdb-client'
    });
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRY,
      issuer: 'musicdb-api',
      audience: 'musicdb-client'
    });
  }

  // Generate token pair
  generateTokenPair(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      permissions: user.permissions || []
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({ id: user.id });

    return { accessToken, refreshToken };
  }

  // Verify access token
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Access token is required'
        });
      }

      const token = authHeader.substring(7);

      // Check if token is blacklisted
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has been revoked'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_here', {
        issuer: 'musicdb-api',
        audience: 'musicdb-client'
      });

      // Check if user session exists in Redis
      const sessionKey = `session:${decoded.id}`;
      const session = await redisClient.get(sessionKey);
      
      if (!session) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Session expired or invalid'
        });
      }

      // Attach user info to request
      req.user = decoded;
      req.sessionId = sessionKey;

      // Log access for audit
      logger.info(`API access: ${decoded.email} -> ${req.method} ${req.path}`);

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Access token has expired'
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid access token'
        });
      }

      logger.error('Token verification error:', error);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token verification failed'
      });
    }
  }

  // Verify refresh token
  async verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET, {
        issuer: 'musicdb-api',
        audience: 'musicdb-client'
      });

      // Check if refresh token exists in Redis
      const refreshKey = `refresh:${decoded.id}`;
      const storedToken = await redisClient.get(refreshKey);
      
      if (!storedToken || storedToken !== token) {
        throw new Error('Invalid refresh token');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Role-based access control
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  // Permission-based access control
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const userPermissions = req.user.permissions || [];
      
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Permission '${permission}' required`
        });
      }

      next();
    };
  }

  // Blacklist token (for logout)
  async blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redisClient.setEx(`blacklist:${token}`, ttl, 'true');
        }
      }
    } catch (error) {
      logger.error('Error blacklisting token:', error);
    }
  }

  // Create user session
  async createSession(user, refreshToken) {
    const sessionKey = `session:${user.id}`;
    const refreshKey = `refresh:${user.id}`;
    
    const sessionData = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    // Store session (expires in 24 hours)
    await redisClient.setEx(sessionKey, 24 * 60 * 60, JSON.stringify(sessionData));
    
    // Store refresh token (expires in 7 days)
    await redisClient.setEx(refreshKey, 7 * 24 * 60 * 60, refreshToken);
  }

  // Update session activity
  async updateSessionActivity(userId) {
    const sessionKey = `session:${userId}`;
    const session = await redisClient.get(sessionKey);
    
    if (session) {
      const sessionData = JSON.parse(session);
      sessionData.lastActivity = new Date().toISOString();
      await redisClient.setEx(sessionKey, 24 * 60 * 60, JSON.stringify(sessionData));
    }
  }

  // Delete session (logout)
  async deleteSession(userId) {
    const sessionKey = `session:${userId}`;
    const refreshKey = `refresh:${userId}`;
    
    await redisClient.del(sessionKey);
    await redisClient.del(refreshKey);
  }

  // Optional: API Key authentication for service-to-service communication
  async verifyApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required'
      });
    }

    // Verify API key against Redis store
    const keyData = await redisClient.get(`apikey:${apiKey}`);
    
    if (!keyData) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    const { service, permissions } = JSON.parse(keyData);
    req.service = { name: service, permissions };
    
    next();
  }
}

module.exports = new AuthMiddleware();