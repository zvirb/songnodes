#!/usr/bin/env node
/**
 * WebSocket Stress Testing Suite
 * Progressive load testing for WebSocket connections up to 10,000 concurrent
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

// Increase the default max listeners to handle many connections
EventEmitter.defaultMaxListeners = 20000;

const config = {
  websocket: {
    url: 'ws://localhost:8090/ws',
    maxConnections: 10000,
    testBatches: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
    connectionTimeout: 10000,
    messageTestCount: 100,
  },
  thresholds: {
    successRate: 0.95, // 95% success rate required
    maxConnectionTime: 1000, // 1 second max connection time
    maxMessageLatency: 100, // 100ms max message latency
  }
};

class WebSocketStressTester {
  constructor() {
    this.results = {
      batches: [],
      maxAchieved: 0,
      targetMet: false,
      overallStats: {},
      recommendations: []
    };
    this.activeConnections = new Map();
    this.messageStats = {
      sent: 0,
      received: 0,
      latencies: []
    };
  }

  async run() {
    console.log('🔌 Starting WebSocket Stress Testing...');
    console.log(`   Target: ${config.websocket.maxConnections.toLocaleString()} concurrent connections`);
    console.log('='.repeat(70));

    try {
      for (const batchSize of config.websocket.testBatches) {
        console.log(`\n📊 Testing ${batchSize.toLocaleString()} connections...`);
        
        const batchResult = await this.testBatch(batchSize);
        this.results.batches.push(batchResult);
        
        this.printBatchResult(batchResult);
        
        // Update max achieved
        if (batchResult.successful > this.results.maxAchieved) {
          this.results.maxAchieved = batchResult.successful;
        }
        
        // Check if we should continue
        if (batchResult.successRate < config.thresholds.successRate) {
          console.log(`   ⚠️  Success rate ${(batchResult.successRate * 100).toFixed(1)}% below ${(config.thresholds.successRate * 100)}% threshold`);
          break;
        }
        
        // Check if target is met
        if (batchSize >= config.websocket.maxConnections && batchResult.successRate >= config.thresholds.successRate) {
          this.results.targetMet = true;
          console.log(`   🎯 TARGET ACHIEVED! ${batchSize.toLocaleString()} connections successful`);
          break;
        }
        
        // Wait between batches
        await this.sleep(2000);
      }
      
      // Test message throughput with successful connections
      if (this.results.maxAchieved > 0) {
        await this.testMessageThroughput();
      }
      
      this.generateOverallStats();
      this.generateRecommendations();
      this.printResults();
      
    } catch (error) {
      console.error('❌ WebSocket stress test failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async testBatch(batchSize) {
    const startTime = performance.now();
    const connections = [];
    const connectionPromises = [];
    
    // Create connections with staggered timing
    for (let i = 0; i < batchSize; i++) {
      const connectionPromise = this.createConnection(i, connections);
      connectionPromises.push(connectionPromise);
      
      // Stagger connections to avoid overwhelming the server
      if (i % 25 === 0 && i > 0) {
        await this.sleep(50);
      }
    }
    
    // Wait for all connections to complete
    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    const totalTime = performance.now() - startTime;
    const successRate = successful / batchSize;
    
    // Calculate average connection time
    const connectionTimes = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value.connectionTime);
    
    const avgConnectionTime = connectionTimes.length > 0 
      ? connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length 
      : 0;
    
    // Test a sample for message latency
    if (connections.length > 0) {
      await this.testMessageLatency(connections.slice(0, Math.min(10, connections.length)));
    }
    
    // Clean up connections
    connections.forEach(ws => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    
    return {
      batchSize,
      successful,
      failed,
      successRate,
      avgConnectionTime,
      totalTime,
      maxConnectionTime: Math.max(...connectionTimes, 0),
      minConnectionTime: Math.min(...connectionTimes, Infinity) === Infinity ? 0 : Math.min(...connectionTimes),
    };
  }

  createConnection(index, connections) {
    return new Promise((resolve, reject) => {
      const connectionStart = performance.now();
      const ws = new WebSocket(config.websocket.url);
      
      const timeout = setTimeout(() => {
        reject(new Error(`Connection ${index} timeout`));
      }, config.websocket.connectionTimeout);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        const connectionTime = performance.now() - connectionStart;
        connections.push(ws);
        this.activeConnections.set(index, ws);
        
        resolve({
          index,
          connectionTime,
          timestamp: Date.now()
        });
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Connection ${index} error: ${error.message}`));
      });
      
      ws.on('close', () => {
        this.activeConnections.delete(index);
      });
    });
  }

  async testMessageLatency(connections) {
    if (connections.length === 0) return;
    
    const testMessages = 10;
    const latencies = [];
    
    for (const ws of connections.slice(0, 5)) { // Test only 5 connections
      if (ws.readyState !== WebSocket.OPEN) continue;
      
      for (let i = 0; i < testMessages; i++) {
        const messageStart = performance.now();
        const testMessage = JSON.stringify({
          type: 'ping',
          id: i,
          timestamp: messageStart
        });
        
        try {
          ws.send(testMessage);
          this.messageStats.sent++;
          
          // Listen for response (if echo is implemented)
          const messagePromise = new Promise((resolve) => {
            const onMessage = (data) => {
              try {
                const response = JSON.parse(data.toString());
                if (response.type === 'pong' && response.id === i) {
                  const latency = performance.now() - messageStart;
                  latencies.push(latency);
                  this.messageStats.received++;
                  ws.removeListener('message', onMessage);
                  resolve(latency);
                }
              } catch (e) {
                // Ignore parse errors
              }
            };
            
            ws.on('message', onMessage);
            
            // Timeout after 1 second
            setTimeout(() => {
              ws.removeListener('message', onMessage);
              resolve(null);
            }, 1000);
          });
          
          await messagePromise;
        } catch (error) {
          // Connection might be closed
          break;
        }
      }
    }
    
    if (latencies.length > 0) {
      this.messageStats.latencies.push(...latencies);
    }
  }

  async testMessageThroughput() {
    console.log('\n📨 Testing Message Throughput...');
    
    // Create a smaller set of connections for throughput testing
    const throughputConnections = [];
    const throughputSize = Math.min(100, this.results.maxAchieved);
    
    console.log(`   Creating ${throughputSize} connections for throughput test...`);
    
    try {
      const connectionPromises = Array.from({ length: throughputSize }, (_, i) => 
        this.createConnection(`throughput_${i}`, throughputConnections)
      );
      
      await Promise.allSettled(connectionPromises);
      
      if (throughputConnections.length === 0) {
        console.log('   ❌ No connections available for throughput test');
        return;
      }
      
      console.log(`   Testing with ${throughputConnections.length} connections...`);
      
      // Send burst of messages
      const messagesPerConnection = 10;
      const startTime = performance.now();
      let messagesSent = 0;
      
      const messagePromises = throughputConnections.map(async (ws, connIndex) => {
        if (ws.readyState !== WebSocket.OPEN) return 0;
        
        let sent = 0;
        for (let i = 0; i < messagesPerConnection; i++) {
          try {
            const message = JSON.stringify({
              type: 'throughput_test',
              connectionId: connIndex,
              messageId: i,
              timestamp: Date.now()
            });
            
            ws.send(message);
            sent++;
            
            // Small delay to avoid overwhelming
            if (i % 5 === 0) {
              await this.sleep(1);
            }
          } catch (error) {
            break;
          }
        }
        return sent;
      });
      
      const sentCounts = await Promise.all(messagePromises);
      const totalSent = sentCounts.reduce((sum, count) => sum + count, 0);
      const throughputTime = performance.now() - startTime;
      
      const messagesPerSecond = (totalSent / throughputTime) * 1000;
      
      console.log(`   ✅ Sent ${totalSent.toLocaleString()} messages in ${throughputTime.toFixed(0)}ms`);
      console.log(`   📊 Throughput: ${messagesPerSecond.toFixed(0)} messages/second`);
      
      this.results.throughput = {
        connections: throughputConnections.length,
        messagesSent: totalSent,
        duration: throughputTime,
        messagesPerSecond
      };
      
      // Clean up throughput test connections
      throughputConnections.forEach(ws => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      
    } catch (error) {
      console.log(`   ❌ Throughput test failed: ${error.message}`);
    }
  }

  generateOverallStats() {
    const successfulBatches = this.results.batches.filter(b => b.successRate >= config.thresholds.successRate);
    const allConnectionTimes = this.results.batches.flatMap(b => [b.avgConnectionTime]).filter(t => t > 0);
    
    this.results.overallStats = {
      totalBatchesTested: this.results.batches.length,
      successfulBatches: successfulBatches.length,
      maxConnectionsAchieved: this.results.maxAchieved,
      targetConnectionsAchieved: this.results.targetMet,
      avgConnectionTimeOverall: allConnectionTimes.length > 0 
        ? allConnectionTimes.reduce((sum, time) => sum + time, 0) / allConnectionTimes.length 
        : 0,
      messageLatencyStats: this.messageStats.latencies.length > 0 ? {
        count: this.messageStats.latencies.length,
        avg: this.messageStats.latencies.reduce((sum, lat) => sum + lat, 0) / this.messageStats.latencies.length,
        min: Math.min(...this.messageStats.latencies),
        max: Math.max(...this.messageStats.latencies)
      } : null
    };
  }

  generateRecommendations() {
    const stats = this.results.overallStats;
    
    if (!this.results.targetMet) {
      this.results.recommendations.push(
        `Increase WebSocket server limits - only achieved ${this.results.maxAchieved.toLocaleString()}/${config.websocket.maxConnections.toLocaleString()} connections`
      );
    }
    
    if (stats.avgConnectionTimeOverall > config.thresholds.maxConnectionTime) {
      this.results.recommendations.push(
        'Optimize connection establishment time - consider connection pooling or server tuning'
      );
    }
    
    if (stats.messageLatencyStats && stats.messageLatencyStats.avg > config.thresholds.maxMessageLatency) {
      this.results.recommendations.push(
        'Improve message handling performance - high latency detected'
      );
    }
    
    if (this.results.batches.some(b => b.successRate < 1.0)) {
      this.results.recommendations.push(
        'Investigate connection failures - some connections failed to establish'
      );
    }
    
    // General recommendations
    this.results.recommendations.push(
      'Monitor system resources (file descriptors, memory) during high load',
      'Consider implementing connection heartbeat/keepalive mechanisms',
      'Add WebSocket connection metrics and monitoring',
      'Implement graceful connection handling and error recovery'
    );
  }

  printBatchResult(result) {
    const successColor = result.successRate >= config.thresholds.successRate ? '✅' : '❌';
    console.log(`   ${successColor} Success: ${result.successful}/${result.batchSize} (${(result.successRate * 100).toFixed(1)}%)`);
    console.log(`   ⏱️  Avg Time: ${result.avgConnectionTime.toFixed(2)}ms, Total: ${result.totalTime.toFixed(0)}ms`);
    
    if (result.maxConnectionTime > config.thresholds.maxConnectionTime) {
      console.log(`   ⚠️  Max connection time: ${result.maxConnectionTime.toFixed(2)}ms (exceeds ${config.thresholds.maxConnectionTime}ms threshold)`);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 WEBSOCKET STRESS TEST REPORT');
    console.log('='.repeat(70));
    
    const stats = this.results.overallStats;
    
    console.log('\n📊 OVERALL PERFORMANCE:');
    console.log(`  Maximum Connections: ${this.results.maxAchieved.toLocaleString()}/${config.websocket.maxConnections.toLocaleString()}`);
    console.log(`  Target Achievement: ${this.results.targetMet ? 'YES' : 'NO'}`);
    console.log(`  Success Rate: ${(stats.successfulBatches / stats.totalBatchesTested * 100).toFixed(1)}% of batches`);
    console.log(`  Avg Connection Time: ${stats.avgConnectionTimeOverall.toFixed(2)}ms`);
    
    if (this.results.throughput) {
      console.log('\n📨 MESSAGE THROUGHPUT:');
      console.log(`  Test Connections: ${this.results.throughput.connections}`);
      console.log(`  Messages Sent: ${this.results.throughput.messagesSent.toLocaleString()}`);
      console.log(`  Throughput: ${this.results.throughput.messagesPerSecond.toFixed(0)} msg/sec`);
    }
    
    if (stats.messageLatencyStats) {
      console.log('\n⚡ MESSAGE LATENCY:');
      console.log(`  Average: ${stats.messageLatencyStats.avg.toFixed(2)}ms`);
      console.log(`  Range: ${stats.messageLatencyStats.min.toFixed(2)}ms - ${stats.messageLatencyStats.max.toFixed(2)}ms`);
      console.log(`  Samples: ${stats.messageLatencyStats.count}`);
    }
    
    console.log('\n📈 BATCH RESULTS:');
    this.results.batches.forEach((batch, index) => {
      const status = batch.successRate >= config.thresholds.successRate ? '✅' : '❌';
      console.log(`  ${status} ${batch.batchSize.toString().padStart(5)} conn: ${(batch.successRate * 100).toFixed(1)}% (${batch.avgConnectionTime.toFixed(2)}ms avg)`);
    });
    
    console.log('\n💡 RECOMMENDATIONS:');
    this.results.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    console.log('\n='.repeat(70));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up connections...');
    
    let cleaned = 0;
    for (const [id, ws] of this.activeConnections) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          cleaned++;
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    this.activeConnections.clear();
    console.log(`  ✅ Cleaned up ${cleaned} connections`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the WebSocket stress tests
const tester = new WebSocketStressTester();
tester.run().catch(console.error);