// WebSocket connection test script
import WebSocket from 'ws';

console.log('Testing WebSocket connections...');

// Test WebSocket API directly
const wsApi = new WebSocket('ws://localhost:8083');

wsApi.on('open', function open() {
  console.log('✓ Direct WebSocket API connection successful');
  wsApi.close();
});

wsApi.on('error', function error(err) {
  console.log('✗ Direct WebSocket API connection failed:', err.message);
});

// Test API Gateway WebSocket
setTimeout(() => {
  const wsGateway = new WebSocket('ws://localhost:8080');
  
  wsGateway.on('open', function open() {
    console.log('✓ API Gateway WebSocket connection successful');
    wsGateway.close();
  });
  
  wsGateway.on('error', function error(err) {
    console.log('✗ API Gateway WebSocket connection failed:', err.message);
  });
}, 1000);

// Test Enhanced Visualization Service WebSocket
setTimeout(() => {
  const wsEnhanced = new WebSocket('ws://localhost:8090');
  
  wsEnhanced.on('open', function open() {
    console.log('✓ Enhanced Visualization Service WebSocket connection successful');
    wsEnhanced.close();
  });
  
  wsEnhanced.on('error', function error(err) {
    console.log('✗ Enhanced Visualization Service WebSocket connection failed:', err.message);
  });
}, 2000);

// Exit after tests
setTimeout(() => {
  console.log('WebSocket tests completed');
  process.exit(0);
}, 5000);