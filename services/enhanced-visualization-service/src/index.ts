/**
 * Enhanced Visualization Service
 * Main entry point for the SongNodes music graph visualization backend
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config/index.js';
import { setupRoutes } from './routes/index.js';
import { DatabaseService } from './services/database.js';
import { RedisService } from './services/redis.js';
import { WebSocketService } from './services/websocket.js';
import { metricsService } from './services/metrics.js';
import { logger, createPinoLogger } from './utils/logger.js';
import { 
  metricsMiddleware, 
  errorMiddleware, 
  contextMiddleware, 
  createHealthResponse,
  gracefulShutdown 
} from './utils/middleware.js';

/**
 * Create and configure Fastify server
 */
async function createServer() {
  const fastify = Fastify({
    logger: createPinoLogger() as any, // Type assertion to bypass strict typing
    trustProxy: true,
    keepAliveTimeout: 30000,
    bodyLimit: 10485760, // 10MB
  });

  // Register security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for WebGL/Workers
  });

  // Configure CORS
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Allow localhost and development domains
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      // Add production domains here
      const allowedOrigins = ['https://songnodes.com', 'https://app.songnodes.com'];
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Register rate limiting
  await fastify.register(rateLimit, {
    max: 1000, // requests
    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => ({
      code: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds`,
      date: Date.now(),
      expiresIn: Math.round(context.ttl / 1000),
    }),
  });

  // Register WebSocket support
  await fastify.register(websocket);

  // Register middleware
  fastify.addHook('preHandler', contextMiddleware as any);
  fastify.addHook('preHandler', metricsMiddleware as any);
  fastify.setErrorHandler(async (error, request, reply) => {
    await errorMiddleware(error, request as any, reply);
  });

  return fastify;
}

/**
 * Initialize services and start server
 */
async function start() {
  try {
    // Create server instance
    const fastify = await createServer();

    // Initialize core services
    // Force use of environment variables to ensure Docker Compose config is used
    const databaseConfig = {
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'db-connection-pool',
      port: parseInt(process.env.DB_PORT || '6432', 10),
      database: process.env.DB_NAME || 'musicdb',
      username: process.env.DB_USER || 'musicdb_user',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'musicdb_secure_pass',
      ssl: process.env.DB_SSL === 'true',
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 20,
      min: 5,
    };
    
    const redisConfig = {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: 'evs:',
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
    
    logger.info('Database config:', {
      url: databaseConfig.url ? 'SET' : 'NOT_SET',
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      username: databaseConfig.username
    });
    
    const databaseService = new DatabaseService(databaseConfig);
    const redisService = new RedisService(redisConfig);
    const websocketService = new WebSocketService(redisService);

    // Add services to Fastify context
    fastify.decorate('db', databaseService);
    fastify.decorate('redis', redisService);
    fastify.decorate('websocket', websocketService);

    // Connect to services
    await databaseService.connect();
    await redisService.connect();
    
    // Start WebSocket service
    websocketService.start();

    logger.info('Services connected successfully');

    // Setup routes
    setupRoutes(fastify as any);

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      const services = {
        database: await databaseService.isHealthy(),
        redis: await redisService.isHealthy(),
      };
      
      const health = createHealthResponse(services, {
        websocketConnections: websocketService.getConnectionCount(),
        activeVisualizationSessions: metricsService.activeVisualizationSessions.get(),
      });

      const statusCode = health.status === 'healthy' ? 200 : 503;
      reply.code(statusCode).send(health);
    });

    // Metrics endpoint for Prometheus
    fastify.get('/metrics', async (request, reply) => {
      try {
        const metrics = await metricsService.getMetrics();
        reply.type('text/plain; version=0.0.4; charset=utf-8').send(metrics);
      } catch (error) {
        logger.error('Failed to generate metrics', { error });
        reply.code(500).send({ error: 'Failed to generate metrics' });
      }
    });

    // Graceful shutdown handling
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, () => {
        gracefulShutdown(signal, [
          () => fastify.close(),
          () => databaseService.disconnect(),
          () => redisService.disconnect(),
          () => websocketService.cleanup(),
        ]);
      });
    });

    // Start server
    const address = await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`Enhanced Visualization Service started on ${address}`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`WebSocket endpoint: ws://${config.server.host}:${config.server.port}/ws`);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { createServer, start };