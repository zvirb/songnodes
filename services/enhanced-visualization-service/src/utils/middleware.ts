/**
 * Middleware utilities for the Enhanced Visualization Service
 * Including metrics collection and request instrumentation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { metricsService } from '../services/metrics.js';
import { logger } from './logger.js';

/**
 * Middleware to collect HTTP request metrics
 */
export async function metricsMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = process.hrtime.bigint();
  
  // Extract route pattern (removing query params and dynamic segments)
  const route = request.routerPath || request.url.split('?')[0];
  
  reply.raw.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9; // Convert to seconds
    
    metricsService.recordHttpRequest(
      request.method,
      route || '/unknown',
      reply.statusCode,
      duration
    );
  });
}

/**
 * Middleware to handle and log errors with metrics
 */
export async function errorMiddleware(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Record error metrics
  metricsService.recordError(
    error.name || 'UnknownError',
    reply.statusCode?.toString() || '500',
    'enhanced-visualization-service'
  );

  // Log error details
  logger.error('Request error occurred', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      ip: request.ip,
    },
    statusCode: reply.statusCode,
  });

  // Send appropriate error response
  if (!reply.sent) {
    const statusCode = reply.statusCode || 500;
    const errorResponse = {
      error: true,
      message: error.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Don't expose stack traces in production
    if (process.env.NODE_ENV === 'development') {
      (errorResponse as any).stack = error.stack;
    }

    reply.code(statusCode).send(errorResponse);
  }
}

/**
 * Middleware to track active visualization sessions
 */
export class VisualizationSessionTracker {
  private sessions = new Map<string, { startTime: number; userId?: string }>();

  startSession(sessionId: string, userId?: string): void {
    this.sessions.set(sessionId, {
      startTime: Date.now(),
      ...(userId && { userId }),
    });
    
    metricsService.activeVisualizationSessions.inc();
    logger.info('Visualization session started', { sessionId, userId });
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const duration = (Date.now() - session.startTime) / 1000; // Convert to seconds
      metricsService.recordVisualizationSession(duration);
      metricsService.activeVisualizationSessions.dec();
      
      this.sessions.delete(sessionId);
      
      logger.info('Visualization session ended', { 
        sessionId, 
        duration,
        userId: session.userId 
      });
    }
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  cleanup(): void {
    // Clean up stale sessions (older than 4 hours)
    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    let cleanedSessions = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < fourHoursAgo) {
        this.endSession(sessionId);
        cleanedSessions++;
      }
    }

    if (cleanedSessions > 0) {
      logger.info('Cleaned up stale visualization sessions', { cleanedSessions });
    }
  }
}

export const sessionTracker = new VisualizationSessionTracker();

/**
 * Request context enhancement middleware
 */
export async function contextMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Add request ID for tracing
  const requestId = request.headers['x-request-id'] || 
                   `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add to request context
  const finalRequestId = Array.isArray(requestId) ? requestId[0] : requestId;
  (request as any).requestId = finalRequestId;
  
  // Add to response headers
  reply.header('x-request-id', finalRequestId);
  
  // Log request details
  logger.info('Incoming request', {
    requestId: finalRequestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  });
}

/**
 * Health check response helper
 */
export function createHealthResponse(
  services: Record<string, boolean>,
  additionalInfo?: Record<string, any>
): any {
  const allHealthy = Object.values(services).every(status => status);
  
  // Update service health metrics
  for (const [serviceName, healthy] of Object.entries(services)) {
    metricsService.updateServiceHealth('enhanced-visualization-service', serviceName, healthy);
  }
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    ...additionalInfo,
  };
}

/**
 * Graceful shutdown helper
 */
export async function gracefulShutdown(
  signal: string,
  cleanupFunctions: Array<() => Promise<void> | void>
): Promise<void> {
  logger.info('Graceful shutdown initiated', { signal });
  
  try {
    // Execute cleanup functions
    await Promise.all(cleanupFunctions.map(fn => fn()));
    
    // Clean up session tracker
    sessionTracker.cleanup();
    
    // Clean up metrics service
    metricsService.cleanup();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
}