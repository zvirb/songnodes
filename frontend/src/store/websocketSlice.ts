/**
 * WebSocket Redux Slice - Real-time Connection Management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WebSocketState {
  // Connection status
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastConnected: string | null;

  // Connection stats
  messagesSent: number;
  messagesReceived: number;
  queuedMessages: number;

  // Subscriptions
  subscriptions: string[];

  // Real-time status
  isReceivingUpdates: boolean;
  lastUpdateReceived: string | null;

  // Latency and performance
  averageLatency: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

const initialState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  lastConnected: null,

  messagesSent: 0,
  messagesReceived: 0,
  queuedMessages: 0,

  subscriptions: [],

  isReceivingUpdates: false,
  lastUpdateReceived: null,

  averageLatency: 0,
  connectionQuality: 'unknown',
};

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    // Connection lifecycle
    connectionStarted: (state) => {
      state.isConnecting = true;
      state.connectionError = null;
    },

    connectionEstablished: (state) => {
      state.isConnected = true;
      state.isConnecting = false;
      state.connectionError = null;
      state.reconnectAttempts = 0;
      state.lastConnected = new Date().toISOString();
      console.log('🔌 WebSocket connection established');
    },

    connectionLost: (state, action: PayloadAction<{ code?: number; reason?: string }>) => {
      state.isConnected = false;
      state.isConnecting = false;
      state.connectionError = action.payload.reason || 'Connection lost';
      state.isReceivingUpdates = false;
      console.log('❌ WebSocket connection lost:', action.payload);
    },

    connectionFailed: (state, action: PayloadAction<string>) => {
      state.isConnected = false;
      state.isConnecting = false;
      state.connectionError = action.payload;
      state.reconnectAttempts += 1;
      console.log('🚫 WebSocket connection failed:', action.payload);
    },

    reconnectAttempt: (state, action: PayloadAction<number>) => {
      state.reconnectAttempts = action.payload;
      state.isConnecting = true;
      console.log(`🔄 WebSocket reconnect attempt ${action.payload}/${state.maxReconnectAttempts}`);
    },

    // Message tracking
    messageSent: (state, action: PayloadAction<{ type: string; timestamp: string }>) => {
      state.messagesSent += 1;
      console.log('📤 WebSocket message sent:', action.payload.type);
    },

    messageReceived: (state, action: PayloadAction<{ type: string; timestamp: string }>) => {
      state.messagesReceived += 1;
      state.lastUpdateReceived = action.payload.timestamp;
      state.isReceivingUpdates = true;
      console.log('📨 WebSocket message received:', action.payload.type);
    },

    updateQueuedMessages: (state, action: PayloadAction<number>) => {
      state.queuedMessages = action.payload;
    },

    // Subscriptions
    subscriptionAdded: (state, action: PayloadAction<string>) => {
      if (!state.subscriptions.includes(action.payload)) {
        state.subscriptions.push(action.payload);
        console.log('✅ Subscribed to:', action.payload);
      }
    },

    subscriptionRemoved: (state, action: PayloadAction<string>) => {
      state.subscriptions = state.subscriptions.filter(sub => sub !== action.payload);
      console.log('❌ Unsubscribed from:', action.payload);
    },

    subscriptionsCleared: (state) => {
      state.subscriptions = [];
      console.log('🧹 All subscriptions cleared');
    },

    // Performance metrics
    updateLatency: (state, action: PayloadAction<number>) => {
      const newLatency = action.payload;

      // Calculate rolling average
      if (state.averageLatency === 0) {
        state.averageLatency = newLatency;
      } else {
        state.averageLatency = (state.averageLatency * 0.8) + (newLatency * 0.2);
      }

      // Determine connection quality
      if (state.averageLatency < 50) {
        state.connectionQuality = 'excellent';
      } else if (state.averageLatency < 150) {
        state.connectionQuality = 'good';
      } else {
        state.connectionQuality = 'poor';
      }
    },

    resetMetrics: (state) => {
      state.messagesSent = 0;
      state.messagesReceived = 0;
      state.queuedMessages = 0;
      state.averageLatency = 0;
      state.connectionQuality = 'unknown';
      state.reconnectAttempts = 0;
    },

    // Real-time update status
    setReceivingUpdates: (state, action: PayloadAction<boolean>) => {
      state.isReceivingUpdates = action.payload;
    },
  },
});

export const {
  connectionStarted,
  connectionEstablished,
  connectionLost,
  connectionFailed,
  reconnectAttempt,
  messageSent,
  messageReceived,
  updateQueuedMessages,
  subscriptionAdded,
  subscriptionRemoved,
  subscriptionsCleared,
  updateLatency,
  resetMetrics,
  setReceivingUpdates,
} = websocketSlice.actions;

export default websocketSlice.reducer;