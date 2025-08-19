const express = require('express');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(healthStatus);
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const checks = {
    api_gateway: { status: 'healthy', responseTime: 0 },
    redis: { status: 'unknown', responseTime: 0 },
    downstream_services: {}
  };

  const startTime = Date.now();

  try {
    // Check Redis connection
    const redisStart = Date.now();
    await redisClient.ping();
    checks.redis = {
      status: 'healthy',
      responseTime: Date.now() - redisStart
    };
  } catch (error) {
    checks.redis = {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - redisStart
    };
  }

  // Check downstream services
  const services = [
    { name: 'rest-api', url: 'http://rest-api:8082/health' },
    { name: 'graphql-api', url: 'http://graphql-api:8081/health' },
    { name: 'websocket-api', url: 'http://websocket-api:8083/health' }
  ];

  await Promise.allSettled(
    services.map(async (service) => {
      const serviceStart = Date.now();
      try {
        const response = await fetch(service.url, { 
          timeout: 5000,
          signal: AbortSignal.timeout(5000)
        });
        
        checks.downstream_services[service.name] = {
          status: response.ok ? 'healthy' : 'unhealthy',
          statusCode: response.status,
          responseTime: Date.now() - serviceStart
        };
      } catch (error) {
        checks.downstream_services[service.name] = {
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - serviceStart
        };
      }
    })
  );

  checks.api_gateway.responseTime = Date.now() - startTime;

  // Determine overall status
  const overallStatus = Object.values(checks).every(check => 
    typeof check.status === 'string' ? check.status === 'healthy' : 
    Object.values(check).every(subCheck => subCheck.status === 'healthy')
  ) ? 'healthy' : 'degraded';

  const healthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthResponse);
});

// Readiness check (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    // Check if Redis is available
    await redisClient.ping();
    
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness check (for Kubernetes)
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoop: {
        delay: await new Promise(resolve => {
          const start = Date.now();
          setImmediate(() => resolve(Date.now() - start));
        })
      },
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch
    };

    // Add Redis metrics if available
    try {
      const redisInfo = await redisClient.info();
      metrics.redis = {
        connected: true,
        info: redisInfo
      };
    } catch (error) {
      metrics.redis = {
        connected: false,
        error: error.message
      };
    }

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics collection error:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;