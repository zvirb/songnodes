const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const healthRoutes = require('./routes/health');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Basic security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3006'],
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
    pathRewrite: { '^/api/v1/tracks': '/api/v1/tracks' }
  },
  '/api/v1/artists': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/artists': '/api/v1/artists' }
  },
  '/api/v1/search': {
    target: 'http://rest-api:8082',
    pathRewrite: { '^/api/v1/search': '/api/v1/search' }
  },
  '/api/v1/visualization': {
    target: 'http://graph-visualization-api:8084',
    pathRewrite: { '^/api/v1/visualization': '/api/v1/visualization' }
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;