/**
 * Fastify type declarations for Enhanced Visualization Service
 */

import { DatabaseService } from '../services/database.js';
import { RedisService } from '../services/redis.js';
import { WebSocketService } from '../services/websocket.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseService;
    redis: RedisService;
    websocket: WebSocketService;
  }
}