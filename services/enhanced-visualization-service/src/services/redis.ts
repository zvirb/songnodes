/**
 * Redis Service for Enhanced Visualization
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetriesPerRequest: number;
  connectTimeout: number;
  commandTimeout: number;
}

export class RedisService {
  private client: Redis | null = null;
  private config: RedisConfig;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        ...(this.config.password && { password: this.config.password }),
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        lazyConnect: true,
      });

      // Test connection
      await this.client.ping();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis disconnected');
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // Cache operations
  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error:', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error('Redis set error:', { key, error });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis del error:', { key, error });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', { key, error });
      return false;
    }
  }

  // Hash operations for complex data
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      
      const value = await this.client.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis hget error:', { key, field, error });
      return null;
    }
  }

  async hset(key: string, field: string, value: any): Promise<void> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      
      const serialized = JSON.stringify(value);
      await this.client.hset(key, field, serialized);
    } catch (error) {
      logger.error('Redis hset error:', { key, field, error });
      throw error;
    }
  }

  async hgetall<T = any>(key: string): Promise<Record<string, T>> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      
      const hash = await this.client.hgetall(key);
      const result: Record<string, T> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      logger.error('Redis hgetall error:', { key, error });
      return {};
    }
  }

  // Pub/Sub for real-time updates
  async publish(channel: string, message: any): Promise<void> {
    try {
      if (!this.client) throw new Error('Redis not connected');
      
      const serialized = JSON.stringify(message);
      await this.client.publish(channel, serialized);
    } catch (error) {
      logger.error('Redis publish error:', { channel, error });
      throw error;
    }
  }

  createSubscriber(): Redis {
    if (!this.client) throw new Error('Redis not connected');
    
    return new Redis({
      host: this.config.host,
      port: this.config.port,
      ...(this.config.password && { password: this.config.password }),
      db: this.config.db,
    });
  }

  // Visualization specific cache keys
  cacheGraphData(filters: any, data: any, ttl: number = 300): Promise<void> {
    const key = `graph:${this.hashFilters(filters)}`;
    return this.set(key, data, ttl);
  }

  getCachedGraphData(filters: any): Promise<any> {
    const key = `graph:${this.hashFilters(filters)}`;
    return this.get(key);
  }

  cacheLayoutResult(layoutId: string, result: any, ttl: number = 600): Promise<void> {
    const key = `layout:${layoutId}`;
    return this.set(key, result, ttl);
  }

  getCachedLayoutResult(layoutId: string): Promise<any> {
    const key = `layout:${layoutId}`;
    return this.get(key);
  }

  private hashFilters(filters: any): string {
    return Buffer.from(JSON.stringify(filters)).toString('base64');
  }
}