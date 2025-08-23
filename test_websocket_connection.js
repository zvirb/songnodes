#!/usr/bin/env node

/**
 * WebSocket Connection Test for SongNodes Enhanced Visualization Service
 * Tests WebSocket connectivity and authentication
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Test configuration
const WS_URL = 'ws://localhost:8090/ws';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const ISSUER = 'songnodes-enhanced-visualization';

// Generate test JWT token
function generateTestToken() {
  const payload = {
    userId: 'test_user_123',
    username: 'test_user',
    roles: ['user'],
    sessionId: 'test_session_' + Date.now(),
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
    issuer: ISSUER,
    algorithm: 'HS256'
  });
}

// Test WebSocket connection without authentication
function testUnauthenticatedConnection() {
  console.log('\n🔍 Testing unauthenticated WebSocket connection...');
  
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    console.log('❌ SECURITY ISSUE: Unauthenticated connection allowed');
    ws.close();
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('📨 Received message:', message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 Connection closed: ${code} - ${reason || 'No reason'}`);
    if (code === 1008) {
      console.log('✅ SECURITY OK: Unauthenticated connections are properly rejected');
    }
  });
  
  ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
  });
  
  // Set timeout for the test
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }, 5000);
}

// Test WebSocket connection with authentication
function testAuthenticatedConnection() {
  console.log('\n🔍 Testing authenticated WebSocket connection...');
  
  const token = generateTestToken();
  console.log('🎫 Generated test JWT token');
  
  // Test with token in URL parameter
  const wsUrlWithToken = `${WS_URL}?token=${token}`;
  const ws = new WebSocket(wsUrlWithToken);
  
  ws.on('open', () => {
    console.log('✅ Authenticated WebSocket connection established');
    
    // Test sending a ping message
    const pingMessage = {
      type: 'pong',
      timestamp: Date.now()
    };
    
    console.log('📤 Sending pong message...');
    ws.send(JSON.stringify(pingMessage));
    
    // Test sending a subscription message
    setTimeout(() => {
      const subscribeMessage = {
        type: 'subscribe',
        channel: 'graph:updates',
        filters: {}
      };
      
      console.log('📤 Sending subscription message...');
      ws.send(JSON.stringify(subscribeMessage));
    }, 1000);
    
    // Test sending a visualization request
    setTimeout(() => {
      const visualizationRequest = {
        type: 'visualization_request',
        requestId: 'test_request_' + Date.now(),
        params: {
          viewport: {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            scale: 1.0
          },
          filters: {
            nodeType: 'track'
          },
          limit: 100
        }
      };
      
      console.log('📤 Sending visualization request...');
      ws.send(JSON.stringify(visualizationRequest));
    }, 2000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('📨 Received message:', {
        type: message.type,
        timestamp: message.timestamp,
        ...(message.connectionId && { connectionId: message.connectionId }),
        ...(message.status && { status: message.status }),
        ...(message.channel && { channel: message.channel })
      });
    } catch (error) {
      console.log('❌ Failed to parse message:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 Authenticated connection closed: ${code} - ${reason || 'No reason'}`);
  });
  
  ws.on('error', (error) => {
    console.log('❌ Authenticated WebSocket error:', error.message);
  });
  
  // Keep connection open for 10 seconds
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log('🔌 Closing test connection...');
      ws.close(1000, 'Test completed');
    }
  }, 8000);
}

// Test WebSocket connection with Authorization header (for comparison)
function testAuthenticatedConnectionWithHeader() {
  console.log('\n🔍 Testing WebSocket connection with Authorization header...');
  
  const token = generateTestToken();
  
  const ws = new WebSocket(WS_URL, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  ws.on('open', () => {
    console.log('✅ WebSocket connection with auth header established');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('📨 Auth header message:', {
        type: message.type,
        timestamp: message.timestamp
      });
    } catch (error) {
      console.log('❌ Failed to parse header auth message:', data.toString());
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 Auth header connection closed: ${code} - ${reason || 'No reason'}`);
  });
  
  ws.on('error', (error) => {
    console.log('❌ Auth header WebSocket error:', error.message);
  });
  
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Header test completed');
    }
  }, 5000);
}

// Test Redis/RabbitMQ integration by checking for broadcast messages
function testBroadcastIntegration() {
  console.log('\n🔍 Testing broadcast integration (Redis/RabbitMQ)...');
  
  const token = generateTestToken();
  const wsUrlWithToken = `${WS_URL}?token=${token}`;
  const ws = new WebSocket(wsUrlWithToken);
  
  ws.on('open', () => {
    console.log('✅ Broadcast test connection established');
    
    // Subscribe to updates
    const subscribeMessage = {
      type: 'subscribe',
      channel: 'graph:updates'
    };
    
    ws.send(JSON.stringify(subscribeMessage));
    console.log('📤 Subscribed to graph:updates channel');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.channel) {
        console.log('📡 Broadcast message received:', {
          channel: message.channel,
          type: message.type,
          timestamp: message.timestamp
        });
      }
    } catch (error) {
      console.log('❌ Failed to parse broadcast message');
    }
  });
  
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Broadcast test completed');
    }
  }, 6000);
}

// Main test sequence
async function runTests() {
  console.log('🚀 Starting WebSocket connectivity tests for SongNodes...');
  console.log(`📡 Target: ${WS_URL}`);
  
  // Test 1: Unauthenticated connection (should fail)
  testUnauthenticatedConnection();
  
  // Wait before next test
  setTimeout(() => {
    // Test 2: Authenticated connection with token parameter
    testAuthenticatedConnection();
  }, 6000);
  
  // Wait before next test
  setTimeout(() => {
    // Test 3: Authenticated connection with Authorization header
    testAuthenticatedConnectionWithHeader();
  }, 15000);
  
  // Wait before next test
  setTimeout(() => {
    // Test 4: Broadcast integration test
    testBroadcastIntegration();
  }, 21000);
  
  // Final summary
  setTimeout(() => {
    console.log('\n📊 WebSocket connectivity tests completed!');
    console.log('✅ Check the results above for any issues');
    process.exit(0);
  }, 28000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⏹️  Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Test terminated');
  process.exit(0);
});

// Start tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});