#!/usr/bin/env node

const WebSocket = require('ws');

console.log('Testing WebSocket connection to enhanced-visualization-service...');

const ws = new WebSocket('ws://localhost:8091/ws');

ws.on('open', function open() {
  console.log('✅ WebSocket connection opened successfully');
  
  // Send a test message
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'graph_updates'
  }));
  
  console.log('📤 Sent subscription message');
});

ws.on('message', function message(data) {
  console.log('📥 Received message:', data.toString());
  
  // Send a ping
  ws.send(JSON.stringify({
    type: 'pong'
  }));
  
  console.log('📤 Sent pong response');
  
  // Close after successful test
  setTimeout(() => {
    ws.close();
  }, 1000);
});

ws.on('close', function close() {
  console.log('✅ WebSocket connection closed');
  process.exit(0);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ WebSocket connection timeout');
  ws.close();
  process.exit(1);
}, 5000);