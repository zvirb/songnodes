/**
 * WebSocket Integration Hook
 * Connects WebSocket service to Redux store for real-time graph updates
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { getWebSocketService } from '../services/websocketService';
import {
  connectionStarted,
  connectionEstablished,
  connectionLost,
  connectionFailed,
  reconnectAttempt,
  messageSent,
  messageReceived,
  updateQueuedMessages,
  subscriptionAdded,
  updateLatency,
  setReceivingUpdates,
} from '../store/websocketSlice';
import {
  addNodesRealtime,
  updateNodesRealtime,
  removeNodesRealtime,
  addEdgesRealtime,
  updateEdgesRealtime,
  removeEdgesRealtime,
  handleGraphSnapshot,
} from '../store/graphSlice';
import type { NodeVisual, EdgeVisual } from '../types/graph';

export interface UseWebSocketIntegrationOptions {
  autoConnect?: boolean;
  autoSubscribeToGraphUpdates?: boolean;
  enableHeartbeat?: boolean;
}

export interface WebSocketIntegrationReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribeToGraphUpdates: (nodeIds?: string[]) => void;
  sendGraphInteraction: (action: string, nodeId?: string, position?: { x: number; y: number }) => void;
  isConnected: boolean;
  connectionError: string | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

export function useWebSocketIntegration(
  options: UseWebSocketIntegrationOptions = {}
): WebSocketIntegrationReturn {
  const {
    autoConnect = true,
    autoSubscribeToGraphUpdates = true,
    enableHeartbeat = true,
  } = options;

  const dispatch = useAppDispatch();
  const websocketState = useAppSelector(state => state.websocket);
  const wsServiceRef = useRef(getWebSocketService());
  const latencyTimerRef = useRef<number | null>(null);

  // Setup WebSocket event handlers
  const setupEventHandlers = useCallback(() => {
    const wsService = wsServiceRef.current;

    // Connection events
    wsService.on('connect', () => {
      dispatch(connectionEstablished());

      if (autoSubscribeToGraphUpdates) {
        wsService.subscribeToGraphUpdates();
        dispatch(subscriptionAdded('graph_updates'));
      }
    });

    wsService.on('disconnect', (data: any) => {
      dispatch(connectionLost({ code: data?.code, reason: data?.reason }));
      dispatch(setReceivingUpdates(false));
    });

    wsService.on('error', (error: any) => {
      dispatch(connectionFailed(error?.message || 'Connection error'));
    });

    wsService.on('reconnect', () => {
      dispatch(connectionEstablished());
    });

    // Real-time graph update handlers
    wsService.onMessage('nodes_added', (message: any) => {
      const nodes: NodeVisual[] = message.data?.nodes || [];
      if (nodes.length > 0) {
        dispatch(addNodesRealtime(nodes));
        dispatch(messageReceived({ type: 'nodes_added', timestamp: message.timestamp }));
      }
    });

    wsService.onMessage('nodes_updated', (message: any) => {
      const updates = message.data?.updates || [];
      if (updates.length > 0) {
        dispatch(updateNodesRealtime(updates));
        dispatch(messageReceived({ type: 'nodes_updated', timestamp: message.timestamp }));
      }
    });

    wsService.onMessage('nodes_removed', (message: any) => {
      const nodeIds: string[] = message.data?.node_ids || [];
      if (nodeIds.length > 0) {
        dispatch(removeNodesRealtime(nodeIds));
        dispatch(messageReceived({ type: 'nodes_removed', timestamp: message.timestamp }));
      }
    });

    wsService.onMessage('edges_added', (message: any) => {
      const edges: EdgeVisual[] = message.data?.edges || [];
      if (edges.length > 0) {
        dispatch(addEdgesRealtime(edges));
        dispatch(messageReceived({ type: 'edges_added', timestamp: message.timestamp }));
      }
    });

    wsService.onMessage('edges_updated', (message: any) => {
      const updates = message.data?.updates || [];
      if (updates.length > 0) {
        dispatch(updateEdgesRealtime(updates));
        dispatch(messageReceived({ type: 'edges_updated', timestamp: message.timestamp }));
      }
    });

    wsService.onMessage('edges_removed', (message: any) => {
      const edgeIds: string[] = message.data?.edge_ids || [];
      if (edgeIds.length > 0) {
        dispatch(removeEdgesRealtime(edgeIds));
        dispatch(messageReceived({ type: 'edges_removed', timestamp: message.timestamp }));
      }
    });

    wsService.onMessage('graph_snapshot', (message: any) => {
      const { nodes, edges, metadata } = message.data || {};
      if (nodes && edges) {
        dispatch(handleGraphSnapshot({ nodes, edges, metadata }));
        dispatch(messageReceived({ type: 'graph_snapshot', timestamp: message.timestamp }));
      }
    });

    // Handle interactive graph updates from other users
    wsService.onMessage('graph_interaction', (message: any) => {
      dispatch(messageReceived({ type: 'graph_interaction', timestamp: message.timestamp }));
      // Could trigger visual feedback for collaborative editing
    });

    wsService.onMessage('graph_node_update', (message: any) => {
      const { node_id, updates, position } = message.data || {};
      if (node_id && (updates || position)) {
        const nodeUpdates = [{
          id: node_id,
          updates: {
            ...updates,
            ...(position && { x: position.x, y: position.y })
          }
        }];
        dispatch(updateNodesRealtime(nodeUpdates));
        dispatch(messageReceived({ type: 'graph_node_update', timestamp: message.timestamp }));
      }
    });

    wsService.onMessage('graph_edge_update', (message: any) => {
      const { edge_id, updates } = message.data || {};
      if (edge_id && updates) {
        dispatch(updateEdgesRealtime([{ id: edge_id, updates }]));
        dispatch(messageReceived({ type: 'graph_edge_update', timestamp: message.timestamp }));
      }
    });

    // Heartbeat and latency tracking
    wsService.onMessage('pong', (message: any) => {
      if (latencyTimerRef.current) {
        const latency = Date.now() - latencyTimerRef.current;
        dispatch(updateLatency(latency));
        latencyTimerRef.current = null;
      }
    });

    wsService.onMessage('subscription_confirmed', (message: any) => {
      const channel = message.data?.channel;
      if (channel) {
        dispatch(subscriptionAdded(channel));
        dispatch(messageReceived({ type: 'subscription_confirmed', timestamp: message.timestamp }));
      }
    });

  }, [dispatch, autoSubscribeToGraphUpdates]);

  // Connect function
  const connect = useCallback(async () => {
    dispatch(connectionStarted());
    try {
      await wsServiceRef.current.connect();
    } catch (error) {
      dispatch(connectionFailed(error instanceof Error ? error.message : 'Connection failed'));
      throw error;
    }
  }, [dispatch]);

  // Disconnect function
  const disconnect = useCallback(() => {
    wsServiceRef.current.disconnect();
  }, []);

  // Subscribe to graph updates
  const subscribeToGraphUpdates = useCallback((nodeIds?: string[]) => {
    wsServiceRef.current.subscribeToGraphUpdates(nodeIds);
    dispatch(subscriptionAdded('graph_updates'));
  }, [dispatch]);

  // Send graph interaction
  const sendGraphInteraction = useCallback((
    action: string,
    nodeId?: string,
    position?: { x: number; y: number }
  ) => {
    const message = {
      type: 'graph_interaction',
      data: { action, node_id: nodeId, position },
      timestamp: new Date().toISOString()
    };

    wsServiceRef.current.send(message);
    dispatch(messageSent({ type: 'graph_interaction', timestamp: message.timestamp }));

    // Start latency timer for heartbeat
    if (action === 'ping') {
      latencyTimerRef.current = Date.now();
    }
  }, [dispatch]);

  // Initialize WebSocket service and event handlers
  useEffect(() => {
    setupEventHandlers();

    if (autoConnect) {
      connect().catch(error => {
        console.error('Auto-connect failed:', error);
      });
    }

    // Setup periodic connection quality checks
    const qualityCheckInterval = setInterval(() => {
      const stats = wsServiceRef.current.getConnectionStats();
      dispatch(updateQueuedMessages(stats.queuedMessages));

      // Send periodic ping for latency measurement
      if (enableHeartbeat && websocketState.isConnected) {
        sendGraphInteraction('ping');
      }
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(qualityCheckInterval);
      if (latencyTimerRef.current) {
        latencyTimerRef.current = null;
      }
    };
  }, [connect, setupEventHandlers, autoConnect, enableHeartbeat, websocketState.isConnected, sendGraphInteraction, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    subscribeToGraphUpdates,
    sendGraphInteraction,
    isConnected: websocketState.isConnected,
    connectionError: websocketState.connectionError,
    connectionQuality: websocketState.connectionQuality,
  };
}

export default useWebSocketIntegration;