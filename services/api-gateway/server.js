const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const rateLimitMiddleware = require('./middleware/rateLimit');
const securityMiddleware = require('./middleware/security');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const { redisClient } = require('./config/redis');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset']
}));

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Apply security middleware
app.use(securityMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// Health check (before auth)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// Authentication routes
app.use('/api/auth', authRoutes);

// Protected routes - require authentication
app.use('/api/v1', authMiddleware.verifyToken);

// Proxy configurations for microservices
const serviceProxies = {
  '/api/v1/tracks': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/tracks': '/api/v1/tracks' }
  },
  '/api/v1/artists': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/artists': '/api/v1/artists' }
  },
  '/api/v1/playlists': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/playlists': '/api/v1/playlists' }
  },
  '/api/v1/search': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/search': '/api/v1/search' }
  },
  '/api/v1/graphql': {
    target: 'http://graphql-api:8081',
    pathRewrite: { '^/api/v1/graphql': '/graphql' }
  },
  '/api/v1/ws': {
    target: 'http://websocket-api:8083',
    ws: true,
    pathRewrite: { '^/api/v1/ws': '/' }
  },
  '/api/v1/admin': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/admin': '/api/v1/admin' }
  }
};

// Setup proxy middleware for each service
Object.entries(serviceProxies).forEach(([path, config]) => {
  app.use(path, createProxyMiddleware({
    ...config,
    changeOrigin: true,
    secure: process.env.NODE_ENV === 'production',
    timeout: 30000,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${path}:`, err.message);
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        message: 'The requested service is currently offline'
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add user info to headers for downstream services
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
      
      // Add correlation ID for tracing
      const correlationId = req.headers['x-correlation-id'] || require('uuid').v4();
      proxyReq.setHeader('X-Correlation-ID', correlationId);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add security headers to all responses
      proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
      proxyRes.headers['X-Frame-Options'] = 'DENY';
      proxyRes.headers['X-XSS-Protection'] = '1; mode=block';
    }
  }));
});

// API documentation redirect
app.get('/api', (req, res) => {
  res.json({
    name: 'MusicDB API Gateway',
    version: '1.0.0',
    endpoints: {
      authentication: '/api/auth',
      health: '/health',
      api_v1: '/api/v1',
      documentation: '/api/docs'
    },
    security: {
      authentication: 'JWT Bearer Token',
      rateLimit: '100 requests per minute',
      cors: 'Configured for allowed origins'
    }
  });
});

// Catch-all for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal. Gracefully shutting down...');
  
  if (redisClient) {
    redisClient.quit();
  }
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Rate limiting: ${process.env.RATE_LIMIT_ENABLED || 'true'}`);
});

module.exports = app;