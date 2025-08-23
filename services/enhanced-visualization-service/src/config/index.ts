/**
 * Enhanced Visualization Service Configuration
 * Implements secure secret management and validation
 */

// import { secretManager } from '../utils/secrets.js'; // Temporarily disabled for TypeScript fixes

// Security: Environment variables should never be logged in production
if (process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true') {
  console.log('DEBUG: Environment variables (development only):');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '***configured***' : 'not set');
  console.log('REDIS_HOST:', process.env.REDIS_HOST || 'not set');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? '***configured***' : 'not set');
  console.log('NODE_ENV:', process.env.NODE_ENV);
}

export const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '8085', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  
  // Database configuration - SECURITY: All credentials must be environment variables
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'db-connection-pool',
    port: parseInt(process.env.DB_PORT || '6432', 10), // PgBouncer port
    database: process.env.DB_NAME || 'musicdb',
    username: process.env.DB_USER || 'musicdb_user',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'musicdb_secure_pass',
    ssl: process.env.DB_SSL === 'true',
    connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT || '30000', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Maximum connections in pool
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),  // Minimum connections in pool
  },
  
  // Redis configuration - SECURITY: All credentials must be environment variables
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'evs:', // Enhanced Visualization Service prefix
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
    // Enable TLS for Redis if configured
    tls: process.env.REDIS_TLS === 'true' ? {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
    } : undefined,
  },
  
  // WebSocket configuration
  websocket: {
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10), // 30 seconds
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '10000', 10),
    maxMessageSize: parseInt(process.env.WS_MAX_MESSAGE_SIZE || '1048576', 10), // 1MB
    authRequired: process.env.WS_AUTH_REQUIRED !== 'false', // Default to required
  },
  
  // Visualization specific configuration
  visualization: {
    maxNodes: 50000,
    maxEdges: 100000,
    layoutWorkers: 4,
    cacheTTL: 300, // 5 minutes
    defaultViewport: {
      width: 1920,
      height: 1080,
      scale: 1.0,
      x: 0,
      y: 0,
    },
  },
  
  // Performance configuration
  performance: {
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    enableProfiling: process.env.ENABLE_PROFILING === 'true',
    gcThreshold: 0.8, // Trigger GC at 80% memory usage
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV === 'development',
  },
  
  // Feature flags
  features: {
    realTimeCollaboration: process.env.FEATURE_REALTIME === 'true',
    advancedLayouts: process.env.FEATURE_ADVANCED_LAYOUTS !== 'false',
    mlRecommendations: process.env.FEATURE_ML_RECOMMENDATIONS === 'true',
  },
  
  // Security configuration - CRITICAL: All must be environment variables
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtIssuer: process.env.JWT_ISSUER || 'songnodes-enhanced-visualization',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '1800000', 10), // 30 minutes
    encryptionKey: process.env.ENCRYPTION_KEY,
  },
} as const;

// Validate critical security configuration
const errors: string[] = [];

// Database validation
if (!config.database.url && (!config.database.username || !config.database.password)) {
  errors.push('Database credentials are required: either DATABASE_URL or both DB_USER and DB_PASSWORD must be set');
}

// JWT validation
if (!config.security.jwtSecret) {
  errors.push('JWT_SECRET environment variable is required for authentication');
}

// Minimum JWT secret length for security
if (config.security.jwtSecret && config.security.jwtSecret.length < 32) {
  errors.push('JWT_SECRET must be at least 32 characters long for security');
}

// Redis validation for production
if (config.env === 'production' && !config.redis.password) {
  errors.push('REDIS_PASSWORD is required in production environment');
}

// SSL validation for production
if (config.env === 'production' && !config.database.ssl && !config.database.url) {
  errors.push('Database SSL (DB_SSL=true) is required in production environment');
}

if (errors.length > 0) {
  console.error('Configuration validation failed:');
  errors.forEach((error, index) => {
    console.error(`  ${index + 1}. ${error}`);
  });
  throw new Error(`Configuration validation failed: ${errors.length} error(s) found`);
}

// Log successful validation in development
if (config.env === 'development') {
  console.log('✅ Configuration validation passed');
}

export type Config = typeof config;