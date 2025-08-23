/**
 * Secure WebSocket Service for Real-time Visualization Updates
 * Implements JWT authentication and input validation
 */

import { WebSocket } from 'ws';
import { RedisService } from './redis.js';
import { metricsService } from './metrics.js';
import { logger } from '../utils/logger.js';
import { sessionTracker } from '../utils/middleware.js';
import { authService, AuthenticatedUser } from './auth.js';
import { z } from 'zod';

interface AuthenticatedConnection {
  ws: WebSocket;
  user: AuthenticatedUser;
  connectedAt: Date;
  lastActivity: Date;
}

export class WebSocketService {
  private connections: Map<string, AuthenticatedConnection> = new Map();
  private redis: RedisService;
  private heartbeatInterval?: NodeJS.Timeout;
  private sessionCleanupInterval?: NodeJS.Timeout;
  public authService = authService; // Expose authService for route access

  constructor(redis: RedisService) {
    this.redis = redis;
  }

  start(): void {
    this.startHeartbeat();
    this.setupRedisSubscriptions();
    this.startSessionCleanup();
  }

  /**
   * Add authenticated WebSocket connection
   */
  addConnection(id: string, ws: WebSocket, token?: string): void {
    // Authenticate user via JWT token
    if (!token) {
      logger.warn(`WebSocket connection ${id} rejected: No authentication token provided`);
      ws.close(1008, 'Authentication required');
      metricsService.recordError('AuthenticationError', '401', 'websocket');
      return;
    }

    const user = authService.verifyToken(token);
    if (!user) {
      logger.warn(`WebSocket connection ${id} rejected: Invalid or expired token`);
      ws.close(1008, 'Invalid authentication token');
      metricsService.recordError('AuthenticationError', '401', 'websocket');
      return;
    }

    // Check if user has permission to access visualization
    if (!authService.canAccessVisualization(user)) {
      logger.warn(`WebSocket connection ${id} rejected: Insufficient permissions for user ${user.userId}`);
      ws.close(1008, 'Insufficient permissions');
      metricsService.recordError('AuthorizationError', '403', 'websocket');
      return;
    }

    const now = new Date();
    this.connections.set(id, {
      ws,
      user,
      connectedAt: now,
      lastActivity: now
    });
    
    // Record connection metrics
    metricsService.recordWebSocketConnection();
    sessionTracker.startSession(id, user.userId);
    
    logger.info(`Authenticated WebSocket connection established for user ${user.username} (${user.userId})`);

    ws.on('message', (data) => {
      try {
        const connection = this.connections.get(id);
        if (!connection) return;

        // Update last activity
        connection.lastActivity = new Date();

        const message = JSON.parse(data.toString());
        const messageSize = Buffer.byteLength(data.toString(), 'utf8');
        
        // Check message size limit (prevent DoS)
        if (messageSize > 1024 * 1024) { // 1MB limit
          logger.warn(`Message too large from connection ${id}: ${messageSize} bytes`);
          ws.close(1009, 'Message too large');
          return;
        }
        
        metricsService.recordWebSocketMessage('received', message.type || 'unknown', messageSize);
        
        // Handle different message types with authentication context
        this.handleIncomingMessage(id, message, connection.user);
        
      } catch (error) {
        logger.error(`Failed to parse message from connection ${id}:`, error);
        metricsService.recordError('ParseError', '400', 'websocket');
      }
    });
    
    ws.on('close', (code, reason) => {
      this.connections.delete(id);
      const reasonStr = reason?.toString() || 'unknown';
      
      metricsService.recordWebSocketDisconnection(reasonStr);
      sessionTracker.endSession(id);
      
      logger.debug(`WebSocket connection ${id} closed: ${code} - ${reasonStr}`);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket connection ${id} error:`, error);
      this.connections.delete(id);
      
      metricsService.recordWebSocketDisconnection('error');
      metricsService.recordError('WebSocketError', '500', 'websocket');
      sessionTracker.endSession(id);
    });

    logger.debug(`WebSocket connection ${id} added`);
  }

  /**
   * Broadcast message to all authenticated connections
   */
  broadcast(message: any): void {
    const serialized = JSON.stringify(message);
    const messageSize = Buffer.byteLength(serialized, 'utf8');
    let successfulSends = 0;
    let failedSends = 0;
    
    for (const [id, connection] of this.connections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(serialized);
          metricsService.recordWebSocketMessage('sent', message.type || 'broadcast', messageSize);
          successfulSends++;
        } catch (error) {
          logger.error(`Failed to send to connection ${id}:`, error);
          this.connections.delete(id);
          metricsService.recordError('SendError', '500', 'websocket');
          failedSends++;
        }
      } else {
        this.connections.delete(id);
        failedSends++;
      }
    }
    
    if (failedSends > 0) {
      logger.warn(`Broadcast completed: ${successfulSends} successful, ${failedSends} failed`);
    }
  }

  /**
   * Send message to specific authenticated connection
   */
  sendToConnection(connectionId: string, message: any): boolean {
    const connection = this.connections.get(connectionId);
    
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        const serialized = JSON.stringify(message);
        const messageSize = Buffer.byteLength(serialized, 'utf8');
        
        connection.ws.send(serialized);
        metricsService.recordWebSocketMessage('sent', message.type || 'direct', messageSize);
        return true;
      } catch (error) {
        logger.error(`Failed to send to connection ${connectionId}:`, error);
        this.connections.delete(connectionId);
        metricsService.recordError('SendError', '500', 'websocket');
      }
    }
    
    return false;
  }

  /**
   * Send message to all connections for a specific user
   */
  sendToUser(userId: string, message: any): number {
    let sentCount = 0;
    for (const [id, connection] of this.connections) {
      if (connection.user.userId === userId) {
        if (this.sendToConnection(id, message)) {
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const pingMessage = JSON.stringify({ type: 'ping', timestamp: Date.now() });
      const messageSize = Buffer.byteLength(pingMessage, 'utf8');
      
      for (const [id, connection] of this.connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          try {
            connection.ws.send(pingMessage);
            metricsService.recordWebSocketMessage('sent', 'ping', messageSize);
          } catch (error) {
            logger.error(`Heartbeat failed for connection ${id}:`, error);
            this.connections.delete(id);
            metricsService.recordError('HeartbeatError', '500', 'websocket');
          }
        } else {
          this.connections.delete(id);
        }
      }
      
      // Update active connections metric
      metricsService.websocketConnections.set(this.connections.size);
    }, 30000); // 30 seconds
  }

  private setupRedisSubscriptions(): void {
    const subscriber = this.redis.createSubscriber();
    
    subscriber.subscribe('graph:updates', 'layout:updates', 'user:actions');
    
    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.broadcast({ channel, data, timestamp: Date.now() });
      } catch (error) {
        logger.error('Failed to process Redis message:', error);
      }
    });
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    
    // Close all connections
    for (const [id, connection] of this.connections) {
      try {
        connection.ws.close(1000, 'Server shutdown');
        sessionTracker.endSession(id);
      } catch (error) {
        logger.error(`Error closing connection ${id}:`, error);
      }
    }
    
    this.connections.clear();
    metricsService.websocketConnections.set(0);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Handle incoming WebSocket messages with authentication context and validation
   */
  private handleIncomingMessage(connectionId: string, message: any, user: AuthenticatedUser): void {
    // Rate limiting per user (basic implementation)
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Check if message is too frequent (prevent spam)
    const timeSinceLastActivity = Date.now() - connection.lastActivity.getTime();
    if (timeSinceLastActivity < 10) { // 10ms minimum between messages
      logger.warn(`Rate limit exceeded for connection ${connectionId}`);
      return;
    }

    switch (message.type) {
      case 'pong':
        // Handle pong response - connection is alive
        break;
        
      case 'subscribe':
        // Handle room/channel subscriptions
        this.handleSubscription(connectionId, message, user);
        break;
        
      case 'visualization_request':
        // Handle visualization data requests
        this.handleVisualizationRequest(connectionId, message, user);
        break;
        
      case 'user_interaction':
        // Handle user interactions (zoom, pan, etc.)
        this.handleUserInteraction(connectionId, message, user);
        break;
        
      default:
        logger.warn(`Unknown message type: ${message.type} from connection ${connectionId}`);
    }
  }

  /**
   * Handle channel subscriptions with validation
   */
  private handleSubscription(connectionId: string, message: any, user: AuthenticatedUser): void {
    try {
      const subscriptionSchema = z.object({
        type: z.literal('subscribe'),
        channel: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
        filters: z.object({}).optional()
      });

      const validatedMessage = subscriptionSchema.parse(message);
      
      // Check if user can subscribe to this channel
      const allowedChannels = ['graph:updates', 'layout:updates'];
      if (user.roles.includes('admin')) {
        allowedChannels.push('admin:updates');
      }
      
      if (!allowedChannels.includes(validatedMessage.channel)) {
        logger.warn(`Subscription denied for user ${user.userId} to channel ${validatedMessage.channel}`);
        return;
      }

      logger.debug(`Connection ${connectionId} subscribed to channel: ${validatedMessage.channel}`);
      
      // TODO: Implement actual subscription logic
      
    } catch (error) {
      logger.error(`Invalid subscription request from ${connectionId}:`, error);
      this.sendToConnection(connectionId, {
        type: 'error',
        message: 'Invalid subscription format',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle visualization requests with input validation
   */
  private handleVisualizationRequest(connectionId: string, message: any, user: AuthenticatedUser): void {
    try {
      // Validate message structure
      const requestSchema = z.object({
        type: z.literal('visualization_request'),
        requestId: z.string().max(50).optional(),
        params: z.object({
          viewport: z.object({
            x: z.number().min(-100000).max(100000),
            y: z.number().min(-100000).max(100000),
            width: z.number().min(1).max(10000),
            height: z.number().min(1).max(10000),
            scale: z.number().min(0.01).max(100)
          }).optional(),
          filters: z.object({
            genre: z.string().max(50).optional(),
            artist: z.string().max(100).optional(),
            year: z.number().min(1900).max(2100).optional(),
            nodeType: z.enum(['track', 'artist', 'album', 'mix']).optional()
          }).optional(),
          limit: z.number().min(1).max(10000).optional()
        })
      });

      const validatedMessage = requestSchema.parse(message);
      
      // Check permissions
      if (!authService.canAccessVisualization(user)) {
        logger.warn(`Visualization request denied for user ${user.userId}: insufficient permissions`);
        this.sendToConnection(connectionId, {
          type: 'error',
          requestId: validatedMessage.requestId,
          message: 'Insufficient permissions',
          timestamp: Date.now()
        });
        return;
      }

      logger.debug(`Validated visualization request from user ${user.username} (${connectionId}):`, validatedMessage.params);
      
      // Send acknowledgment
      this.sendToConnection(connectionId, {
        type: 'visualization_response',
        requestId: validatedMessage.requestId,
        status: 'processing',
        timestamp: Date.now()
      });
      
      // TODO: Implement actual visualization data retrieval
      
    } catch (error) {
      logger.error(`Invalid visualization request from ${connectionId}:`, error);
      this.sendToConnection(connectionId, {
        type: 'error',
        message: 'Invalid request format',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle user interactions with input validation
   */
  private handleUserInteraction(connectionId: string, message: any, user: AuthenticatedUser): void {
    try {
      // Validate message structure
      const interactionSchema = z.object({
        type: z.literal('user_interaction'),
        interaction: z.object({
          action: z.enum(['zoom', 'pan', 'click', 'hover', 'select', 'drag']),
          nodeId: z.string().max(100).optional(),
          position: z.object({
            x: z.number(),
            y: z.number()
          }).optional(),
          scale: z.number().min(0.01).max(100).optional(),
          timestamp: z.number().min(Date.now() - 60000).max(Date.now() + 1000) // Allow 1 minute past to 1 second future
        })
      });

      const validatedMessage = interactionSchema.parse(message);
      
      // Check if user can modify visualization (for actions that change state)
      const modifyingActions = ['select', 'drag'];
      if (modifyingActions.includes(validatedMessage.interaction.action) && 
          !authService.canModifyVisualization(user)) {
        logger.warn(`Interaction denied for user ${user.userId}: insufficient permissions for ${validatedMessage.interaction.action}`);
        this.sendToConnection(connectionId, {
          type: 'error',
          message: 'Insufficient permissions for this action',
          timestamp: Date.now()
        });
        return;
      }

      logger.debug(`Validated user interaction from user ${user.username} (${connectionId}):`, validatedMessage.interaction);
      
      // Broadcast interaction to other users (excluding sender)
      const broadcastMessage = {
        type: 'user_interaction_broadcast',
        user: {
          id: user.userId,
          username: user.username
        },
        interaction: validatedMessage.interaction,
        timestamp: Date.now()
      };

      for (const [id, connection] of this.connections) {
        if (id !== connectionId && connection.ws.readyState === WebSocket.OPEN) {
          this.sendToConnection(id, broadcastMessage);
        }
      }
      
    } catch (error) {
      logger.error(`Invalid user interaction from ${connectionId}:`, error);
      this.sendToConnection(connectionId, {
        type: 'error',
        message: 'Invalid interaction format',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start periodic session cleanup
   */
  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(() => {
      const now = Date.now();
      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

      for (const [id, connection] of this.connections) {
        const inactiveTime = now - connection.lastActivity.getTime();
        if (inactiveTime > inactiveThreshold) {
          logger.info(`Closing inactive connection ${id} (${connection.user.username})`);
          connection.ws.close(1000, 'Session timeout');
          this.connections.delete(id);
          sessionTracker.endSession(id);
        }
      }

      sessionTracker.cleanup();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  /**
   * Get connection statistics
   */
  getStats(): any {
    const userStats = new Map<string, number>();
    for (const connection of this.connections.values()) {
      const count = userStats.get(connection.user.userId) || 0;
      userStats.set(connection.user.userId, count + 1);
    }

    return {
      totalConnections: this.connections.size,
      uniqueUsers: userStats.size,
      activeVisualizationSessions: sessionTracker.getActiveSessionCount(),
      userConnections: Object.fromEntries(userStats)
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup(): void {
    this.stop();
  }

  /**
   * Get user information for a connection
   */
  getConnectionUser(connectionId: string): AuthenticatedUser | null {
    const connection = this.connections.get(connectionId);
    return connection ? connection.user : null;
  }

  /**
   * Disconnect all sessions for a specific user
   */
  disconnectUser(userId: string, reason: string = 'User disconnected'): number {
    let disconnectedCount = 0;
    for (const [id, connection] of this.connections) {
      if (connection.user.userId === userId) {
        connection.ws.close(1000, reason);
        this.connections.delete(id);
        sessionTracker.endSession(id);
        disconnectedCount++;
      }
    }
    logger.info(`Disconnected ${disconnectedCount} connections for user ${userId}`);
    return disconnectedCount;
  }
}