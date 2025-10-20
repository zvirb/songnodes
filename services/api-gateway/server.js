const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
require('dotenv').config();

const healthRoutes = require('./routes/health');
const logger = require('./utils/logger');
const { metricsMiddleware, metricsEndpoint } = require('./metrics');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Basic security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
// ✅ FIX: Allow both localhost and 127.0.0.1 origins for browser compatibility
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3006',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3006'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Health check (simple, no authentication)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// Prometheus metrics endpoint
app.get('/metrics', metricsEndpoint);

// Apply metrics middleware to track all requests
app.use(metricsMiddleware);

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'MusicDB API Gateway',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      health: '/health',
      api_v1: '/api/v1'
    }
  });
});

// Proxy configurations for microservices
const serviceProxies = {
  '/api/v1/tracks': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/tracks': '/api/v1/tracks' },
    timeout: 120000  // 2 minutes for large tracklist imports
  },
  '/api/v1/artists': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/artists': '/api/v1/artists' }
  },
  '/api/v1/search': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/search': '/api/v1/search' }
  },
  '/api/v1/target-tracks': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/target-tracks': '/api/v1/target-tracks' }
  },
  '/api/v1/observability': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/observability': '/api/v1/observability' }
  },
  '/api/v1/visualization': {
    target: 'http://graph-visualization-api:8084',
    pathRewrite: { '^/api/v1/visualization': '/api/v1/visualization' }
  },
  '/api/graph': {
    target: 'http://graph-visualization-api:8084',
    pathRewrite: { '^/api/graph': '/api/graph' }
  },
  '/api/v1/scrapers': {
    target: 'http://scraper-orchestrator:8001',
    pathRewrite: { '^/api/v1/scrapers': '' },
    timeout: 120000  // 2 minutes for background task initiation
  },
  '/api/v1/scraping': {
    target: 'http://scraper-orchestrator:8001',
    pathRewrite: { '^/api/v1/scraping': '' }
  },
  '/api/v1/enhanced-viz': {
    target: 'http://enhanced-visualization-service:8085',
    pathRewrite: { '^/api/v1/enhanced-viz': '/api/v1' }
  }
};

// Setup proxy middleware for each service
Object.entries(serviceProxies).forEach(([path, config]) => {
  app.use(path, createProxyMiddleware({
    ...config,
    changeOrigin: true,
    secure: false,
    timeout: 30000,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${path}:`, err.message);
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        message: 'The requested service is currently offline'
      });
    }
  }));
});

// Database backup/restore routes
const backupRoutes = require('./backup');
app.use('/api/v1/backup', backupRoutes);

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
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Initialize Socket.io for real-time updates
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3006',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3006'
    ],
    credentials: true
  }
});

// Redis adapter for Socket.io clustering
const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD;

const redisClient = createClient({
  url: `redis://${redisHost}:${redisPort}`,
  password: redisPassword,
  socket: {
    connectTimeout: 60000,
    reconnectStrategy: (retries) => {
      if (retries >= 5) {
        logger.error('Max Redis reconnection attempts reached for Socket.io adapter');
        return false;
      }
      const delay = Math.min(1000 * Math.pow(2, retries), 30000);
      logger.warn(`Socket.io Redis adapter reconnection attempt ${retries + 1} in ${delay}ms`);
      return delay;
    }
  }
});

const subClient = redisClient.duplicate();

Promise.all([redisClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(redisClient, subClient));
  logger.info('Socket.io Redis adapter initialized');
}).catch(err => {
  logger.error('Failed to connect to Redis for Socket.io:', err);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Join scraper monitoring room
  socket.on('join-scraper-monitoring', () => {
    socket.join('scraper-monitoring');
    logger.info(`Client ${socket.id} joined scraper monitoring`);
  });
  
  // Leave scraper monitoring room
  socket.on('leave-scraper-monitoring', () => {
    socket.leave('scraper-monitoring');
    logger.info(`Client ${socket.id} left scraper monitoring`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Middleware to attach io to requests for broadcasting
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`API Gateway with WebSocket running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };