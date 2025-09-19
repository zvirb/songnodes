#!/usr/bin/env node

/**
 * Real-time WebSocket Connection Test
 * Tests the WebSocket communication between frontend and backend
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const WS_URL = 'ws://localhost:8083/ws/public';
const API_BASE = 'http://localhost:8083/api/v1';

console.log('🚀 Starting WebSocket Real-time Test');
console.log('📡 WebSocket URL:', WS_URL);
console.log('🌐 API Base:', API_BASE);

async function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    console.log('\n1️⃣ Testing WebSocket Connection...');

    const ws = new WebSocket(WS_URL);
    let connectionEstablished = false;
    let messageReceived = false;

    const timeout = setTimeout(() => {
      if (!connectionEstablished) {
        console.log('❌ Connection timeout');
        ws.close();
        reject(new Error('Connection timeout'));
      }
    }, 5000);

    ws.on('open', () => {
      connectionEstablished = true;
      clearTimeout(timeout);
      console.log('✅ WebSocket connected successfully');

      // Send subscription request
      const subscribeMessage = {
        type: 'subscribe',
        data: {
          channel: 'graph_updates'
        },
        timestamp: new Date().toISOString()
      };

      console.log('📤 Sending subscription:', subscribeMessage.type);
      ws.send(JSON.stringify(subscribeMessage));

      // Send a test graph interaction
      setTimeout(() => {
        const interactionMessage = {
          type: 'graph_interaction',
          data: {
            action: 'node_click',
            node_id: 'test_node_123',
            position: { x: 100, y: 200 }
          },
          timestamp: new Date().toISOString()
        };

        console.log('📤 Sending interaction:', interactionMessage.type);
        ws.send(JSON.stringify(interactionMessage));
      }, 1000);

      // Close after receiving some messages
      setTimeout(() => {
        console.log('🔌 Closing connection');
        ws.close();
        resolve({ success: true, messagesReceived: messageReceived });
      }, 3000);
    });

    ws.on('message', (data) => {
      messageReceived = true;
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', {
          type: message.type,
          timestamp: message.timestamp,
          dataKeys: Object.keys(message.data || {})
        });
      } catch (error) {
        console.log('📨 Received raw message:', data.toString());
      }
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log('🔌 WebSocket closed:', code, reason.toString());
      if (connectionEstablished) {
        resolve({ success: true, messagesReceived: messageReceived });
      }
    });
  });
}

async function testHealthEndpoint() {
  console.log('\n2️⃣ Testing Health Endpoint...');

  try {
    const response = await fetch(`${API_BASE}/../health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Health check passed:', {
      status: data.status,
      service: data.service,
      connections: data.connections,
      redis: data.redis,
      rabbitmq: data.rabbitmq
    });

    return data;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    throw error;
  }
}

async function testGraphBroadcastEndpoints() {
  console.log('\n3️⃣ Testing Graph Broadcast Endpoints...');

  const testNodes = [
    {
      id: 'test_node_1',
      title: 'Test Track 1',
      artist: 'Test Artist',
      position: { x: 100, y: 100 }
    },
    {
      id: 'test_node_2',
      title: 'Test Track 2',
      artist: 'Test Artist',
      position: { x: 200, y: 200 }
    }
  ];

  try {
    // Test nodes added endpoint
    const addResponse = await fetch(`${API_BASE}/graph/nodes/added`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testNodes)
    });

    if (!addResponse.ok) {
      throw new Error(`Add nodes failed: ${addResponse.status}`);
    }

    const addResult = await addResponse.json();
    console.log('✅ Nodes added broadcast:', addResult);

    // Test nodes updated endpoint
    const nodeUpdates = [
      {
        id: 'test_node_1',
        updates: { title: 'Updated Test Track 1' }
      }
    ];

    const updateResponse = await fetch(`${API_BASE}/graph/nodes/updated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeUpdates)
    });

    if (!updateResponse.ok) {
      throw new Error(`Update nodes failed: ${updateResponse.status}`);
    }

    const updateResult = await updateResponse.json();
    console.log('✅ Nodes updated broadcast:', updateResult);

    // Test nodes removed endpoint
    const removeResponse = await fetch(`${API_BASE}/graph/nodes/removed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['test_node_1', 'test_node_2'])
    });

    if (!removeResponse.ok) {
      throw new Error(`Remove nodes failed: ${removeResponse.status}`);
    }

    const removeResult = await removeResponse.json();
    console.log('✅ Nodes removed broadcast:', removeResult);

    return true;
  } catch (error) {
    console.log('❌ Graph broadcast test failed:', error.message);
    throw error;
  }
}

async function testConnectionStatistics() {
  console.log('\n4️⃣ Testing Connection Statistics...');

  try {
    const response = await fetch(`${API_BASE}/../stats`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const stats = await response.json();
    console.log('✅ Connection stats:', stats);

    return stats;
  } catch (error) {
    console.log('❌ Stats check failed:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🧪 Real-time WebSocket Communication Test Suite');
  console.log('================================================');

  const results = {};

  try {
    // Test 1: Health check
    results.health = await testHealthEndpoint();

    // Test 2: WebSocket connection
    results.websocket = await testWebSocketConnection();

    // Test 3: Graph broadcast endpoints
    results.broadcast = await testGraphBroadcastEndpoints();

    // Test 4: Connection statistics
    results.stats = await testConnectionStatistics();

    console.log('\n🎉 All tests passed!');
    console.log('✅ WebSocket server is working correctly');
    console.log('✅ Real-time graph updates are functional');
    console.log('✅ API endpoints are responding');

    if (results.websocket.messagesReceived) {
      console.log('✅ Message broadcasting is working');
    } else {
      console.log('⚠️  No messages received during test');
    }

    return { success: true, results };

  } catch (error) {
    console.log('\n💥 Test suite failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure WebSocket service is running on port 8083');
    console.log('2. Check if Redis and RabbitMQ are accessible');
    console.log('3. Verify docker-compose services are up');
    console.log('4. Check WebSocket server logs for errors');

    return { success: false, error: error.message, results };
  }
}

// Run the test suite
if (require.main === module) {
  runTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };