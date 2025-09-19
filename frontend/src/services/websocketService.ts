/**
 * WebSocket Service for Real-time Graph Updates
 * Handles real-time communication with the backend for graph data updates
 */

import {
  WebSocketMessage,
  GraphUpdateMessage,
  PathProgressMessage,
  SessionUpdateMessage
} from '../types/api';

export type WebSocketEventType =
  | 'connect'
  | 'disconnect'
  | 'reconnect'
  | 'error'
  | 'graph_update'
  | 'path_progress'
  | 'session_update'
  | 'node_update'
  | 'edge_update';

export interface WebSocketServiceOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  enableAutoReconnect?: boolean;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private heartbeatInterval: number;
  private enableAutoReconnect: boolean;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private messageQueue: WebSocketMessage[] = [];

  // Event listeners
  private eventListeners = new Map<WebSocketEventType, Set<Function>>();
  private messageHandlers = new Map<string, Function>();

  constructor(options: WebSocketServiceOptions = {}) {
    this.url = options.url || this.getWebSocketUrl();
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.enableAutoReconnect = options.enableAutoReconnect ?? true;
  }

  /**
   * Get WebSocket URL based on environment
   */
  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;

    // Development vs production URL handling
    if (import.meta.env.DEV) {
      return `${protocol}//${host}:8083/ws/public`; // Development WebSocket server (port 8083)
    } else {
      return `${protocol}//${host}/ws/public`; // Production WebSocket endpoint
    }
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }

        console.log('🔌 Connecting to WebSocket:', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.emit('connect');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnect', event);

          if (this.enableAutoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.enableAutoReconnect = false;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Send message to server
   */
  public send(message: WebSocketMessage): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message for later sending
      this.messageQueue.push(message);
      console.warn('WebSocket not connected, queuing message:', message.type);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.messageQueue.push(message); // Re-queue failed message
    }
  }

  /**
   * Subscribe to graph updates for specific nodes
   */
  public subscribeToGraphUpdates(nodeIds?: string[], depth?: number): void {
    this.send({
      type: 'subscribe',
      channel: 'graph_updates',
      data: {
        nodeIds,
        depth,
        includeRelationships: true
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Subscribe to path finding progress
   */
  public subscribeToPathProgress(requestId: string): void {
    this.send({
      type: 'subscribe',
      channel: 'path_progress',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Subscribe to session updates
   */
  public subscribeToSessionUpdates(sessionId: string): void {
    this.send({
      type: 'subscribe',
      channel: 'session_updates',
      data: { sessionId },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add event listener
   */
  public on(event: WebSocketEventType, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  public off(event: WebSocketEventType, callback?: Function): void {
    if (!callback) {
      this.eventListeners.delete(event);
      return;
    }

    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Add message handler for specific message types
   */
  public onMessage(messageType: string, handler: Function): void {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Get connection status
   */
  public isConnectedToServer(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      url: this.url,
      readyState: this.ws?.readyState,
      protocol: this.ws?.protocol
    };
  }

  // Private methods

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Handle heartbeat/ping messages
      if (message.type === 'ping') {
        this.send({ type: 'pong', timestamp: new Date().toISOString() });
        return;
      }

      // Call specific message handler if available
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      }

      // Emit generic event
      this.emit(message.type as WebSocketEventType, message);

      // Handle specific message types
      switch (message.type) {
        case 'graph_update':
          this.handleGraphUpdate(message as GraphUpdateMessage);
          break;
        case 'path_progress':
          this.handlePathProgress(message as PathProgressMessage);
          break;
        case 'session_update':
          this.handleSessionUpdate(message as SessionUpdateMessage);
          break;
        default:
          console.log('📨 Received WebSocket message:', message.type, message.data);
      }

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error, event.data);
    }
  }

  /**
   * Handle graph update messages
   */
  private handleGraphUpdate(message: GraphUpdateMessage): void {
    console.log('📊 Graph update received:', {
      added: message.data.added.length,
      modified: message.data.modified.length,
      removed: message.data.removed.length
    });
  }

  /**
   * Handle path progress messages
   */
  private handlePathProgress(message: PathProgressMessage): void {
    console.log('🗺️ Path progress update:', {
      status: message.data.status,
      progress: message.data.progress,
      nodesExplored: message.data.nodesExplored
    });
  }

  /**
   * Handle session update messages
   */
  private handleSessionUpdate(message: SessionUpdateMessage): void {
    console.log('👥 Session update:', {
      event: message.data.event,
      userId: message.data.userId,
      action: message.data.action
    });
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: WebSocketEventType, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'ping',
          timestamp: new Date().toISOString()
        });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * this.reconnectAttempts, 30000);

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect()
        .then(() => this.emit('reconnect'))
        .catch(error => {
          console.error('Reconnect failed:', error);
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            console.error('Max reconnect attempts reached, giving up');
          }
        });
    }, delay);
  }

  /**
   * Send all queued messages
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`📤 Sending ${this.messageQueue.length} queued messages`);
      const messages = [...this.messageQueue];
      this.messageQueue = [];

      messages.forEach(message => {
        this.send(message);
      });
    }
  }
}

// Create singleton instance
let wsService: WebSocketService | null = null;

export const getWebSocketService = (options?: WebSocketServiceOptions): WebSocketService => {
  if (!wsService) {
    wsService = new WebSocketService(options);
  }
  return wsService;
};

export default WebSocketService;