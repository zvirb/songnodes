const { createClient } = require('redis');
const logger = require('../utils/logger');

class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 
        `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`;

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 60000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries >= this.maxReconnectAttempts) {
              logger.error('Max Redis reconnection attempts reached');
              return false;
            }
            
            const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
            logger.warn(`Redis reconnection attempt ${retries + 1} in ${delay}ms`);
            return delay;
          }
        },
        // Security configurations
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DB || '0'),
        
        // Performance configurations
        commandsQueueMaxLength: 1000,
        scripts: {
          scriptLoader: {
            // Preload common scripts for better performance
            rateLimitScript: `
              local key = KEYS[1]
              local limit = tonumber(ARGV[1])
              local window = tonumber(ARGV[2])
              
              local current = redis.call('GET', key)
              if current == false then
                redis.call('SET', key, 1)
                redis.call('EXPIRE', key, window)
                return {1, window}
              else
                local count = tonumber(current)
                if count < limit then
                  redis.call('INCR', key)
                  local ttl = redis.call('TTL', key)
                  return {count + 1, ttl}
                else
                  local ttl = redis.call('TTL', key)
                  return {count, ttl, true}
                end
              end
            `
          }
        }
      });

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('error', (error) => {
        logger.error('Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        logger.info(`Redis client reconnecting (attempt ${this.reconnectAttempts})`);
      });

      // Connect to Redis
      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      logger.info('Redis connection established successfully');

      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis client disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting Redis client:', error);
      }
    }
  }

  // Helper methods for common operations
  async safeGet(key, defaultValue = null) {
    try {
      if (!this.isConnected) return defaultValue;
      const result = await this.client.get(key);
      return result !== null ? result : defaultValue;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return defaultValue;
    }
  }

  async safeSet(key, value, options = {}) {
    try {
      if (!this.isConnected) return false;
      
      if (options.EX) {
        await this.client.setEx(key, options.EX, value);
      } else if (options.PX) {
        await this.client.pSetEx(key, options.PX, value);
      } else {
        await this.client.set(key, value);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async safeDel(key) {
    try {
      if (!this.isConnected) return false;
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async safeIncr(key) {
    try {
      if (!this.isConnected) return 0;
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  async safeExpire(key, seconds) {
    try {
      if (!this.isConnected) return false;
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  async safeTtl(key) {
    try {
      if (!this.isConnected) return -1;
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  // Rate limiting helper
  async rateLimit(key, limit, windowSeconds) {
    try {
      if (!this.isConnected) return { allowed: true, remaining: limit, resetTime: null };

      const current = await this.safeIncr(key);
      
      if (current === 1) {
        await this.safeExpire(key, windowSeconds);
      }

      const ttl = await this.safeTtl(key);
      const resetTime = new Date(Date.now() + ttl * 1000);

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime: resetTime,
        total: current
      };
    } catch (error) {
      logger.error('Rate limit error:', error);
      return { allowed: true, remaining: limit, resetTime: null };
    }
  }

  // Session management helpers
  async createSession(sessionId, data, ttlSeconds = 86400) {
    const sessionKey = `session:${sessionId}`;
    return await this.safeSet(sessionKey, JSON.stringify(data), { EX: ttlSeconds });
  }

  async getSession(sessionId) {
    const sessionKey = `session:${sessionId}`;
    const data = await this.safeGet(sessionKey);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(sessionId, data, ttlSeconds = 86400) {
    return await this.createSession(sessionId, data, ttlSeconds);
  }

  async deleteSession(sessionId) {
    const sessionKey = `session:${sessionId}`;
    return await this.safeDel(sessionKey);
  }

  // Health check
  async ping() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected');
    }
    return await this.client.ping();
  }

  // Get client for direct access
  getClient() {
    return this.client;
  }

  // Connection status
  isReady() {
    return this.isConnected && this.client && this.client.isReady;
  }
}

// Create singleton instance
const redisConfig = new RedisConfig();

// Export both the instance and client
module.exports = {
  redisConfig,
  redisClient: redisConfig.client,
  connectRedis: () => redisConfig.connect(),
  disconnectRedis: () => redisConfig.disconnect(),
  
  // Export instance methods for convenience
  safeGet: (key, defaultValue) => redisConfig.safeGet(key, defaultValue),
  safeSet: (key, value, options) => redisConfig.safeSet(key, value, options),
  safeDel: (key) => redisConfig.safeDel(key),
  rateLimit: (key, limit, windowSeconds) => redisConfig.rateLimit(key, limit, windowSeconds)
};

// Auto-connect on module load
redisConfig.connect().catch(error => {
  logger.error('Failed to auto-connect to Redis:', error);
});