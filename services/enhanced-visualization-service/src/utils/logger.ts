/**
 * Enhanced Visualization Service Logger with Elasticsearch Integration
 */

import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Enhanced logging configuration with multiple transports
 */
class EnhancedLogger {
  private winston: winston.Logger;
  private elasticsearchTransport?: ElasticsearchTransport;

  constructor() {
    this.winston = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport with pretty printing for development
    if (config.logging.prettyPrint || config.env === 'development') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 2)}` : '';
              return `[${timestamp}] ${level}: ${message}${metaStr}`;
            })
          ),
        })
      );
    } else {
      // Structured JSON logging for production
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf((info) => {
              // Add service metadata
              const enriched = {
                ...info,
                service: 'enhanced-visualization-service',
                environment: config.env,
                version: process.env.npm_package_version || '1.0.0',
                hostname: process.env.HOSTNAME || 'unknown',
                pid: process.pid,
              };
              return JSON.stringify(enriched);
            })
          ),
        })
      );
    }

    // Add Elasticsearch transport if configured
    if (process.env.ELASTICSEARCH_URL) {
      try {
        this.elasticsearchTransport = new ElasticsearchTransport({
          level: config.logging.level,
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
            ...(process.env.ELASTICSEARCH_AUTH && {
              auth: {
                username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
                password: process.env.ELASTICSEARCH_PASSWORD || '',
              }
            }),
            tls: {
              rejectUnauthorized: process.env.ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED !== 'false',
            },
          },
          index: `enhanced-visualization-service-${config.env}`,
          transformer: (logData: any) => {
            // Transform log data for Elasticsearch
            const baseTransformed: any = {
              '@timestamp': new Date().toISOString(),
              level: logData.level,
              message: logData.message,
              service: 'enhanced-visualization-service',
              environment: config.env,
              version: process.env.npm_package_version || '1.0.0',
              hostname: process.env.HOSTNAME || 'unknown',
              pid: process.pid,
              ...logData.meta,
            };
            
            // Add request context if available
            if (logData.meta?.requestId) {
              baseTransformed.requestId = logData.meta.requestId;
            }
            
            // Add user context if available
            if (logData.meta?.userId) {
              baseTransformed.userId = logData.meta.userId;
            }
            
            // Add performance metrics if available
            if (logData.meta?.duration) {
              baseTransformed.duration = logData.meta.duration;
            }
            
            return baseTransformed;
          },
        });
        
        transports.push(this.elasticsearchTransport);
      } catch (error) {
        console.error('Failed to initialize Elasticsearch transport:', error);
      }
    }

    return winston.createLogger({
      level: config.logging.level,
      transports,
      exitOnError: false,
      handleExceptions: true,
      handleRejections: true,
    });
  }

  /**
   * Debug level logging
   */
  debug(message: string, meta?: any) {
    this.winston.debug(message, this.enrichMeta(meta));
  }

  /**
   * Info level logging
   */
  info(message: string, meta?: any) {
    this.winston.info(message, this.enrichMeta(meta));
  }

  /**
   * Warning level logging
   */
  warn(message: string, meta?: any) {
    this.winston.warn(message, this.enrichMeta(meta));
  }

  /**
   * Error level logging
   */
  error(message: string, meta?: any) {
    this.winston.error(message, this.enrichMeta(meta));
  }

  /**
   * Fatal level logging (maps to error)
   */
  fatal(message: string, meta?: any) {
    this.winston.error(message, { ...this.enrichMeta(meta), fatal: true });
  }

  /**
   * Log HTTP request details
   */
  logRequest(req: any, res: any, duration?: number) {
    const meta = {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      userAgent: req.headers?.['user-agent'],
      ip: req.ip,
      duration,
      responseSize: res.get?.('content-length'),
    };

    if (res.statusCode >= 400) {
      this.warn(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, meta);
    } else {
      this.info(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, meta);
    }
  }

  /**
   * Log WebSocket events
   */
  logWebSocket(event: string, connectionId: string, meta?: any) {
    this.info(`WebSocket ${event}`, {
      connectionId,
      event,
      ...meta,
    });
  }

  /**
   * Log database operations
   */
  logDatabase(operation: string, table: string, duration?: number, success: boolean = true, meta?: any) {
    const logMeta = {
      operation,
      table,
      duration,
      success,
      ...meta,
    };

    if (success) {
      this.debug(`Database ${operation} on ${table}`, logMeta);
    } else {
      this.error(`Database ${operation} failed on ${table}`, logMeta);
    }
  }

  /**
   * Log cache operations
   */
  logCache(operation: string, key: string, hit: boolean, duration?: number) {
    this.debug(`Cache ${operation}`, {
      operation,
      key,
      hit,
      duration,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(metric: string, value: number, unit: string, meta?: any) {
    this.info(`Performance: ${metric}`, {
      metric,
      value,
      unit,
      ...meta,
    });
  }

  /**
   * Log security events
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta?: any) {
    const logMeta = {
      securityEvent: event,
      severity,
      ...meta,
    };

    if (severity === 'critical' || severity === 'high') {
      this.error(`Security: ${event}`, logMeta);
    } else {
      this.warn(`Security: ${event}`, logMeta);
    }
  }

  /**
   * Enrich metadata with common fields
   */
  private enrichMeta(meta?: any): any {
    return {
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }

  /**
   * Get Winston logger instance for advanced usage
   */
  getWinstonLogger(): winston.Logger {
    return this.winston;
  }

  /**
   * Cleanup logger resources
   */
  cleanup() {
    this.winston.end();
  }
}

// Export singleton instance
export const logger = new EnhancedLogger();

/**
 * Create Pino-compatible logger for Fastify
 */
export function createPinoLogger() {
  const level = config.logging.level;
  const isDevelopment = config.env === 'development';
  
  const baseOptions = {
    level,
    msgPrefix: '[enhanced-visualization-service] ',
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
  };
  
  if (isDevelopment) {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    });
  }
  
  return pino({
    ...baseOptions,
    formatters: {
      log: (object: any) => {
        return {
          ...object,
          service: 'enhanced-visualization-service',
          environment: config.env,
          version: process.env.npm_package_version || '1.0.0',
          hostname: process.env.HOSTNAME || 'unknown',
          pid: process.pid,
        };
      }
    }
  });
}

// Export logger interface for type safety
export interface LoggerInterface {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  fatal(message: string, meta?: any): void;
  logRequest(req: any, res: any, duration?: number): void;
  logWebSocket(event: string, connectionId: string, meta?: any): void;
  logDatabase(operation: string, table: string, duration?: number, success?: boolean, meta?: any): void;
  logCache(operation: string, key: string, hit: boolean, duration?: number): void;
  logPerformance(metric: string, value: number, unit: string, meta?: any): void;
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta?: any): void;
}