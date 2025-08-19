const rateLimit = require('express-rate-limit');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

// Redis store for rate limiting
class RedisStore {
  constructor(options = {}) {
    this.client = redisClient;
    this.prefix = options.prefix || 'rl:';
    this.expiry = options.expiry || 60;
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      const current = await this.client.incr(redisKey);
      
      if (current === 1) {
        await this.client.expire(redisKey, this.expiry);
      }
      
      const ttl = await this.client.ttl(redisKey);
      
      return {
        totalHits: current,
        resetTime: new Date(Date.now() + ttl * 1000)
      };
    } catch (error) {
      logger.error('Redis rate limit error:', error);
      throw error;
    }
  }

  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      const current = await this.client.decr(redisKey);
      return Math.max(0, current);
    } catch (error) {
      logger.error('Redis rate limit decrement error:', error);
      return 0;
    }
  }

  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      await this.client.del(redisKey);
    } catch (error) {
      logger.error('Redis rate limit reset error:', error);
    }
  }
}

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 60) * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_REQUESTS || 100), // 100 requests per minute
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: parseInt(process.env.RATE_LIMIT_WINDOW || 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    prefix: 'rl:general:',
    expiry: parseInt(process.env.RATE_LIMIT_WINDOW || 60)
  }),
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.includes('/health');
  },
  onLimitReached: (req, res, options) => {
    const identifier = req.user ? req.user.email : req.ip;
    logger.warn(`Rate limit exceeded for ${identifier} on ${req.path}`);
  }
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: {
    error: 'Too Many Authentication Attempts',
    message: 'Too many authentication attempts, please try again in 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    prefix: 'rl:auth:',
    expiry: 15 * 60
  }),
  keyGenerator: (req) => {
    // Use email from request body if available, otherwise IP
    return req.body?.email ? `email:${req.body.email}` : `ip:${req.ip}`;
  },
  onLimitReached: (req, res, options) => {
    const identifier = req.body?.email || req.ip;
    logger.warn(`Authentication rate limit exceeded for ${identifier}`);
    
    // Additional security: temporarily block IP after repeated auth failures
    if (req.body?.email) {
      redisClient.setEx(`block:auth:${req.ip}`, 15 * 60, 'blocked');
    }
  }
});

// API key rate limiting (higher limits for service-to-service)
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute for API keys
  message: {
    error: 'API Key Rate Limit Exceeded',
    message: 'API key rate limit exceeded, please reduce request frequency.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    prefix: 'rl:apikey:',
    expiry: 60
  }),
  keyGenerator: (req) => {
    return `apikey:${req.headers['x-api-key']}`;
  },
  skip: (req) => {
    return !req.headers['x-api-key'];
  }
});

// Progressive rate limiting based on user tier
const createTieredLimiter = (tier) => {
  const limits = {
    free: { requests: 100, window: 60 * 1000 },
    premium: { requests: 500, window: 60 * 1000 },
    enterprise: { requests: 2000, window: 60 * 1000 }
  };

  const config = limits[tier] || limits.free;

  return rateLimit({
    windowMs: config.window,
    max: config.requests,
    message: {
      error: 'Rate Limit Exceeded',
      message: `${tier} tier rate limit exceeded. Upgrade for higher limits.`,
      tier: tier,
      limit: config.requests,
      window: config.window / 1000
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      prefix: `rl:${tier}:`,
      expiry: config.window / 1000
    }),
    keyGenerator: (req) => {
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    }
  });
};

// Middleware to apply appropriate rate limiter based on user
const dynamicRateLimiter = async (req, res, next) => {
  if (req.headers['x-api-key']) {
    return apiKeyLimiter(req, res, next);
  }

  if (req.path.includes('/auth/')) {
    return authLimiter(req, res, next);
  }

  if (req.user && req.user.tier) {
    const tieredLimiter = createTieredLimiter(req.user.tier);
    return tieredLimiter(req, res, next);
  }

  return generalLimiter(req, res, next);
};

// Burst protection - temporary higher limits followed by cooldown
const burstProtection = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 requests in 5 minutes burst
  message: {
    error: 'Burst Limit Exceeded',
    message: 'Request burst limit exceeded, please slow down.',
    retryAfter: 5 * 60
  },
  store: new RedisStore({
    prefix: 'rl:burst:',
    expiry: 5 * 60
  }),
  skip: (req) => {
    return req.path.includes('/health') || req.headers['x-api-key'];
  }
});

// Security: Block suspicious IPs
const blockSuspiciousIPs = async (req, res, next) => {
  const blocked = await redisClient.get(`block:auth:${req.ip}`);
  
  if (blocked) {
    return res.status(429).json({
      error: 'IP Temporarily Blocked',
      message: 'This IP has been temporarily blocked due to suspicious activity.',
      retryAfter: 15 * 60
    });
  }
  
  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  apiKeyLimiter,
  dynamicRateLimiter,
  burstProtection,
  blockSuspiciousIPs,
  createTieredLimiter,
  RedisStore
};