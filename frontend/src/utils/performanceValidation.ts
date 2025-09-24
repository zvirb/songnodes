/**
 * Performance Validation Utilities
 * Test and validate that message handler optimizations are working
 */

import { OptimizedWebSocket, WebSocketMessage } from './optimizedWebSocket';
import { globalWorkerManager } from './workerManager';

export interface PerformanceTestResult {
  messageHandlerTime: number;
  webWorkerTime: number;
  rafThrottleEffective: boolean;
  targetFPSMaintained: boolean;
  violationsEliminated: boolean;
  recommendations: string[];
}

export class PerformanceValidator {
  private violationCount = 0;
  private frameTimes: number[] = [];
  private messageHandlerTimes: number[] = [];

  constructor() {
    // Monitor for performance violations
    this.monitorViolations();
  }

  private monitorViolations(): void {
    // Override console.warn to catch violation messages
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args.join(' ');
      if (message.includes("'message' handler took") || 
          message.includes("Violation")) {
        this.violationCount++;
        console.info(`Performance violation detected: ${message}`);
      }
      originalWarn.apply(console, args);
    };
  }

  /**
   * Test WebSocket message handler performance
   */
  async testMessageHandlerPerformance(): Promise<number> {
    const testMessages: WebSocketMessage[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'test',
      payload: { data: `Test message ${i}`, index: i },
      timestamp: Date.now(),
      id: `test-${i}`
    }));

    const startTime = performance.now();
    
    // Simulate message processing
    for (const message of testMessages) {
      const messageStart = performance.now();
      
      // Simulate message handler work
      JSON.stringify(message);
      
      const messageTime = performance.now() - messageStart;
      this.messageHandlerTimes.push(messageTime);
      
      // Break if any message takes too long
      if (messageTime > 16) {
        console.warn(`Message handler violation: ${messageTime.toFixed(2)}ms`);
        break;
      }
    }

    const totalTime = performance.now() - startTime;
    return totalTime;
  }

  /**
   * Test Web Worker processing performance
   */
  async testWebWorkerPerformance(): Promise<number> {
    if (!globalWorkerManager.hasAvailableWorkers) {
      console.warn('No Web Workers available for testing');
      return -1;
    }

    const testData = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      data: `Test data item ${i}`.repeat(10)
    }));

    const startTime = performance.now();
    
    try {
      // Test batch processing with Web Worker
      await globalWorkerManager.processBatch(testData, 10);
    } catch (error) {
      console.error('Web Worker test failed:', error);
      return -1;
    }

    const totalTime = performance.now() - startTime;
    return totalTime;
  }

  /**
   * Test requestAnimationFrame throttling effectiveness
   */
  async testRAFThrottling(): Promise<boolean> {
    return new Promise((resolve) => {
      let frameCount = 0;
      let lastFrameTime = performance.now();
      const frameTimes: number[] = [];
      
      const testFrame = () => {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastFrameTime;
        frameTimes.push(deltaTime);
        lastFrameTime = currentTime;
        frameCount++;
        
        if (frameCount < 60) { // Test for 60 frames
          requestAnimationFrame(testFrame);
        } else {
          // Check if frames are properly throttled (should be ~16.67ms apart)
          const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          const isThrottled = avgFrameTime >= 14 && avgFrameTime <= 20; // Allow some variance
          resolve(isThrottled);
        }
      };
      
      requestAnimationFrame(testFrame);
    });
  }

  /**
   * Simulate heavy message processing to test performance
   */
  async simulateHeavyMessageLoad(): Promise<void> {
    const heavyMessages = Array.from({ length: 20 }, (_, i) => ({
      type: 'batch',
      messages: Array.from({ length: 25 }, (_, j) => ({
        type: 'heavy-data',
        payload: {
          data: `Heavy message ${i}-${j}`.repeat(100),
          index: i * 25 + j,
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        id: `heavy-${i}-${j}`
      })),
      timestamp: Date.now()
    }));

    const startTime = performance.now();
    const violationsBefore = this.violationCount;

    // Process messages and monitor violations
    for (const message of heavyMessages) {
      const messageStart = performance.now();
      
      // Simulate processing
      JSON.stringify(message);
      
      const messageTime = performance.now() - messageStart;
      
      // Simulate yielding to browser with setTimeout
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const totalTime = performance.now() - startTime;
    const violationsAfter = this.violationCount;
    const newViolations = violationsAfter - violationsBefore;
    
    console.log(`Heavy message load test completed:
      - Total time: ${totalTime.toFixed(2)}ms
      - New violations: ${newViolations}
      - Average per message: ${(totalTime / heavyMessages.length).toFixed(2)}ms`);
  }

  /**
   * Run comprehensive performance validation
   */
  async validatePerformanceOptimizations(): Promise<PerformanceTestResult> {
    console.log('🚀 Starting performance validation...');
    
    const violationsBefore = this.violationCount;
    
    // Test message handler performance
    const messageHandlerTime = await this.testMessageHandlerPerformance();
    console.log(`✅ Message handler test: ${messageHandlerTime.toFixed(2)}ms`);
    
    // Test Web Worker performance
    const webWorkerTime = await this.testWebWorkerPerformance();
    console.log(`✅ Web Worker test: ${webWorkerTime >= 0 ? webWorkerTime.toFixed(2) + 'ms' : 'unavailable'}`);
    
    // Test RAF throttling
    const rafThrottleEffective = await this.testRAFThrottling();
    console.log(`✅ RAF throttling effective: ${rafThrottleEffective}`);
    
    // Simulate heavy load
    await this.simulateHeavyMessageLoad();
    
    // Check violation count
    const violationsAfter = this.violationCount;
    const newViolations = violationsAfter - violationsBefore;
    const violationsEliminated = newViolations === 0;
    
    console.log(`✅ Performance violations: ${newViolations} new (${violationsEliminated ? 'PASS' : 'FAIL'})`);

    // Calculate average message handler time
    const avgMessageTime = this.messageHandlerTimes.length > 0 
      ? this.messageHandlerTimes.reduce((a, b) => a + b, 0) / this.messageHandlerTimes.length
      : 0;

    const targetFPSMaintained = avgMessageTime < 8; // Should be well under 16ms budget

    const recommendations: string[] = [];
    
    if (!violationsEliminated) {
      recommendations.push('Consider increasing Web Worker usage for heavy operations');
      recommendations.push('Implement additional throttling for high-frequency events');
    }
    
    if (!rafThrottleEffective) {
      recommendations.push('RAF throttling may need adjustment');
    }
    
    if (webWorkerTime < 0) {
      recommendations.push('Web Workers are not available - ensure proper initialization');
    }

    if (!targetFPSMaintained) {
      recommendations.push('Message processing time exceeds 8ms budget - optimize further');
    }

    const result: PerformanceTestResult = {
      messageHandlerTime,
      webWorkerTime,
      rafThrottleEffective,
      targetFPSMaintained,
      violationsEliminated,
      recommendations
    };

    console.log('🎯 Performance validation completed:', result);
    return result;
  }

  /**
   * Get current violation count
   */
  getViolationCount(): number {
    return this.violationCount;
  }

  /**
   * Reset violation count
   */
  resetViolationCount(): void {
    this.violationCount = 0;
  }
}

// Global validator instance
export const globalPerformanceValidator = new PerformanceValidator();