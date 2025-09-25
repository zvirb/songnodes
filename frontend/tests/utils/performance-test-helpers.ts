import { Page, BrowserContext } from '@playwright/test';

/**
 * Performance Testing Utilities for WebGL Graph Visualization
 *
 * Specialized tools for measuring and analyzing performance of PIXI.js/WebGL
 * graph rendering in various scenarios and load conditions.
 */

export interface PerformanceBenchmark {
  testName: string;
  nodeCount: number;
  edgeCount: number;
  duration: number;
  metrics: PerformanceMetrics;
  webglInfo: WebGLInfo;
  memoryUsage: MemoryUsage;
}

export interface PerformanceMetrics {
  averageFrameRate: number;
  minFrameRate: number;
  maxFrameRate: number;
  frameRateVariation: number;
  averageRenderTime: number;
  maxRenderTime: number;
  droppedFrames: number;
  totalFrames: number;
  jankFrames: number; // Frames > 16.67ms
  smoothness: number; // Percentage of smooth frames
}

export interface WebGLInfo {
  renderer: string;
  vendor: string;
  version: string;
  maxTextureSize: number;
  maxVertexAttributes: number;
  supported: boolean;
  extensions: string[];
}

export interface MemoryUsage {
  usedJSSize: number;
  totalJSSize: number;
  jsMemoryPercentage: number;
  webglMemoryMB?: number;
}

export interface StressTestConfig {
  maxNodes: number;
  stepSize: number;
  testDuration: number;
  interactionFrequency: number;
  zoomLevels: number[];
  panDistance: number;
}

export class PerformanceTestHelpers {
  constructor(private page: Page, private context?: BrowserContext) {}

  /**
   * Initialize performance monitoring
   */
  async initializePerformanceMonitoring(): Promise<void> {
    await this.page.addInitScript(() => {
      // Enhanced performance monitoring setup
      window.performanceMonitor = {
        frames: [],
        startTime: 0,
        isMonitoring: false,
        memorySnapshots: [],
        webglInfo: null,

        start() {
          this.frames = [];
          this.memorySnapshots = [];
          this.startTime = performance.now();
          this.isMonitoring = true;
          this.collectFrame();
          this.collectMemorySnapshot();
        },

        stop() {
          this.isMonitoring = false;
          return this.getMetrics();
        },

        collectFrame() {
          if (!this.isMonitoring) return;

          const now = performance.now();
          const frame = {
            timestamp: now,
            deltaTime: this.frames.length > 0 ? now - this.frames[this.frames.length - 1].timestamp : 0
          };

          this.frames.push(frame);

          // Continue monitoring
          requestAnimationFrame(() => this.collectFrame());
        },

        collectMemorySnapshot() {
          if (!this.isMonitoring) return;

          if (performance.memory) {
            this.memorySnapshots.push({
              timestamp: performance.now(),
              usedJSSize: performance.memory.usedJSHeapSize,
              totalJSSize: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit
            });
          }

          // Collect every 500ms
          setTimeout(() => this.collectMemorySnapshot(), 500);
        },

        getWebGLInfo() {
          if (this.webglInfo) return this.webglInfo;

          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

          if (!gl) {
            this.webglInfo = { supported: false };
            return this.webglInfo;
          }

          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          const supportedExtensions = gl.getSupportedExtensions() || [];

          this.webglInfo = {
            supported: true,
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown',
            version: gl.getParameter(gl.VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            extensions: supportedExtensions
          };

          return this.webglInfo;
        },

        getMetrics() {
          const frameTimes = this.frames.slice(1).map(f => f.deltaTime);
          const frameRates = frameTimes.map(t => 1000 / t).filter(r => r > 0 && r < 1000);

          const averageFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
          const minFrameRate = Math.min(...frameRates);
          const maxFrameRate = Math.max(...frameRates);
          const frameRateVariation = maxFrameRate - minFrameRate;

          const maxRenderTime = Math.max(...frameTimes.filter(t => t > 0));
          const averageRenderTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

          const droppedFrames = frameRates.filter(r => r < 30).length;
          const jankFrames = frameTimes.filter(t => t > 16.67).length;
          const smoothness = ((frameRates.length - jankFrames) / frameRates.length) * 100;

          return {
            averageFrameRate: Math.round(averageFrameRate * 100) / 100,
            minFrameRate: Math.round(minFrameRate * 100) / 100,
            maxFrameRate: Math.round(maxFrameRate * 100) / 100,
            frameRateVariation: Math.round(frameRateVariation * 100) / 100,
            averageRenderTime: Math.round(averageRenderTime * 100) / 100,
            maxRenderTime: Math.round(maxRenderTime * 100) / 100,
            droppedFrames,
            totalFrames: frameRates.length,
            jankFrames,
            smoothness: Math.round(smoothness * 100) / 100
          };
        },

        getMemoryUsage() {
          const snapshots = this.memorySnapshots;
          if (snapshots.length === 0) return null;

          const latest = snapshots[snapshots.length - 1];
          return {
            usedJSSize: latest.usedJSSize,
            totalJSSize: latest.totalJSSize,
            jsMemoryPercentage: Math.round((latest.usedJSSize / latest.totalJSSize) * 100 * 100) / 100
          };
        }
      };
    });
  }

  /**
   * Run a comprehensive performance benchmark
   */
  async runPerformanceBenchmark(
    testName: string,
    nodeCount: number,
    duration: number = 5000
  ): Promise<PerformanceBenchmark> {
    // Start monitoring
    await this.page.evaluate(() => {
      window.performanceMonitor.start();
    });

    // Wait for test duration
    await this.page.waitForTimeout(duration);

    // Stop monitoring and collect results
    const [metrics, webglInfo, memoryUsage] = await this.page.evaluate(() => {
      const metrics = window.performanceMonitor.stop();
      const webglInfo = window.performanceMonitor.getWebGLInfo();
      const memoryUsage = window.performanceMonitor.getMemoryUsage();

      return [metrics, webglInfo, memoryUsage];
    });

    // Get edge count from graph
    const edgeCount = await this.getGraphEdgeCount();

    return {
      testName,
      nodeCount,
      edgeCount,
      duration,
      metrics,
      webglInfo,
      memoryUsage: memoryUsage || { usedJSSize: 0, totalJSSize: 0, jsMemoryPercentage: 0 }
    };
  }

  /**
   * Run stress test with increasing load
   */
  async runStressTest(config: StressTestConfig): Promise<PerformanceBenchmark[]> {
    const results: PerformanceBenchmark[] = [];

    for (let nodeCount = config.stepSize; nodeCount <= config.maxNodes; nodeCount += config.stepSize) {
      // Load graph with specific node count
      await this.loadGraphWithNodeCount(nodeCount);

      // Run benchmark
      const benchmark = await this.runPerformanceBenchmark(
        `Stress Test - ${nodeCount} nodes`,
        nodeCount,
        config.testDuration
      );

      results.push(benchmark);

      // Perform interactions during test
      await this.performStressInteractions(config);

      // Brief pause between tests
      await this.page.waitForTimeout(1000);
    }

    return results;
  }

  /**
   * Test memory usage over time
   */
  async testMemoryUsage(duration: number = 30000): Promise<{
    initialMemory: number;
    peakMemory: number;
    finalMemory: number;
    memoryGrowth: number;
    leakDetected: boolean;
  }> {
    await this.page.evaluate((duration) => {
      window.memoryTest = {
        snapshots: [],
        startTime: performance.now(),
        duration,

        start() {
          this.collectSnapshot();
        },

        collectSnapshot() {
          if (performance.memory) {
            this.snapshots.push({
              timestamp: performance.now() - this.startTime,
              memory: performance.memory.usedJSHeapSize
            });
          }

          if (performance.now() - this.startTime < this.duration) {
            setTimeout(() => this.collectSnapshot(), 1000);
          }
        }
      };

      window.memoryTest.start();
    }, duration);

    // Wait for test to complete
    await this.page.waitForTimeout(duration + 1000);

    return await this.page.evaluate(() => {
      const snapshots = window.memoryTest.snapshots;
      if (snapshots.length === 0) {
        return {
          initialMemory: 0,
          peakMemory: 0,
          finalMemory: 0,
          memoryGrowth: 0,
          leakDetected: false
        };
      }

      const memories = snapshots.map(s => s.memory);
      const initialMemory = memories[0];
      const finalMemory = memories[memories.length - 1];
      const peakMemory = Math.max(...memories);
      const memoryGrowth = finalMemory - initialMemory;
      const leakDetected = memoryGrowth > initialMemory * 0.1; // 10% growth threshold

      return {
        initialMemory,
        peakMemory,
        finalMemory,
        memoryGrowth,
        leakDetected
      };
    });
  }

  /**
   * Benchmark different zoom levels
   */
  async benchmarkZoomLevels(zoomLevels: number[]): Promise<Map<number, PerformanceMetrics>> {
    const results = new Map<number, PerformanceMetrics>();

    for (const zoomLevel of zoomLevels) {
      // Set zoom level
      await this.setZoomLevel(zoomLevel);
      await this.page.waitForTimeout(1000);

      // Run benchmark
      const benchmark = await this.runPerformanceBenchmark(
        `Zoom ${zoomLevel}x`,
        await this.getGraphNodeCount(),
        3000
      );

      results.set(zoomLevel, benchmark.metrics);
    }

    return results;
  }

  /**
   * Test rendering with different viewport sizes
   */
  async benchmarkViewportSizes(sizes: Array<{ width: number; height: number }>): Promise<Map<string, PerformanceMetrics>> {
    const results = new Map<string, PerformanceMetrics>();

    for (const size of sizes) {
      // Set viewport size
      await this.page.setViewportSize(size);
      await this.page.waitForTimeout(1000);

      // Run benchmark
      const benchmark = await this.runPerformanceBenchmark(
        `Viewport ${size.width}x${size.height}`,
        await this.getGraphNodeCount(),
        3000
      );

      results.set(`${size.width}x${size.height}`, benchmark.metrics);
    }

    return results;
  }

  /**
   * Profile GPU performance
   */
  async profileGPUPerformance(): Promise<{
    gpuMemoryUsage: number;
    drawCalls: number;
    textureMemory: number;
    bufferMemory: number;
  }> {
    return await this.page.evaluate(() => {
      // @ts-ignore
      const app = window.pixiApp;
      if (!app || !app.renderer) {
        return {
          gpuMemoryUsage: 0,
          drawCalls: 0,
          textureMemory: 0,
          bufferMemory: 0
        };
      }

      const renderer = app.renderer;
      const gl = renderer.gl;

      // Get WebGL stats if available
      const ext = gl.getExtension('WEBGL_debug_renderer_info');

      return {
        gpuMemoryUsage: 0, // Would need WebGL extension for actual GPU memory
        drawCalls: renderer.batch ? renderer.batch.drawCalls : 0,
        textureMemory: 0, // Estimated from texture manager
        bufferMemory: 0   // Estimated from geometry manager
      };
    });
  }

  // Helper methods

  private async getGraphNodeCount(): Promise<number> {
    return await this.page.evaluate(() => {
      const metrics = window.graphPerformance || {};
      return metrics.nodeCount || 0;
    });
  }

  private async getGraphEdgeCount(): Promise<number> {
    return await this.page.evaluate(() => {
      const metrics = window.graphPerformance || {};
      return metrics.edgeCount || 0;
    });
  }

  private async loadGraphWithNodeCount(nodeCount: number): Promise<void> {
    // This would need to be implemented based on your graph loading mechanism
    await this.page.evaluate((nodeCount) => {
      // Mock implementation - would need to be adapted to your actual API
      if (window.loadGraphData) {
        window.loadGraphData({ nodeLimit: nodeCount });
      }
    }, nodeCount);

    // Wait for graph to load
    await this.page.waitForTimeout(2000);
  }

  private async setZoomLevel(zoomLevel: number): Promise<void> {
    await this.page.evaluate((zoom) => {
      // @ts-ignore
      if (window.d3Zoom) {
        const svg = document.querySelector('svg') || document.querySelector('canvas');
        if (svg) {
          window.d3Zoom.scaleTo(d3.select(svg), zoom);
        }
      }
    }, zoomLevel);
  }

  private async performStressInteractions(config: StressTestConfig): Promise<void> {
    const canvas = this.page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    for (let i = 0; i < config.interactionFrequency; i++) {
      // Random zoom
      const zoomLevel = config.zoomLevels[Math.floor(Math.random() * config.zoomLevels.length)];
      await this.setZoomLevel(zoomLevel);

      // Random pan
      const deltaX = (Math.random() - 0.5) * config.panDistance;
      const deltaY = (Math.random() - 0.5) * config.panDistance;

      await this.page.mouse.move(centerX, centerY);
      await this.page.mouse.down();
      await this.page.mouse.move(centerX + deltaX, centerY + deltaY, { steps: 5 });
      await this.page.mouse.up();

      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(benchmarks: PerformanceBenchmark[]): string {
    let report = 'WebGL Graph Visualization Performance Report\n';
    report += '===========================================\n\n';

    benchmarks.forEach(benchmark => {
      report += `Test: ${benchmark.testName}\n`;
      report += `Nodes: ${benchmark.nodeCount}, Edges: ${benchmark.edgeCount}\n`;
      report += `Duration: ${benchmark.duration}ms\n\n`;

      report += 'Performance Metrics:\n';
      report += `  Average FPS: ${benchmark.metrics.averageFrameRate}\n`;
      report += `  Min FPS: ${benchmark.metrics.minFrameRate}\n`;
      report += `  Max FPS: ${benchmark.metrics.maxFrameRate}\n`;
      report += `  Frame Rate Variation: ${benchmark.metrics.frameRateVariation}\n`;
      report += `  Average Render Time: ${benchmark.metrics.averageRenderTime}ms\n`;
      report += `  Max Render Time: ${benchmark.metrics.maxRenderTime}ms\n`;
      report += `  Dropped Frames: ${benchmark.metrics.droppedFrames}\n`;
      report += `  Jank Frames: ${benchmark.metrics.jankFrames}\n`;
      report += `  Smoothness: ${benchmark.metrics.smoothness}%\n\n`;

      if (benchmark.webglInfo.supported) {
        report += 'WebGL Info:\n';
        report += `  Renderer: ${benchmark.webglInfo.renderer}\n`;
        report += `  Vendor: ${benchmark.webglInfo.vendor}\n`;
        report += `  Version: ${benchmark.webglInfo.version}\n`;
        report += `  Max Texture Size: ${benchmark.webglInfo.maxTextureSize}\n`;
      }

      report += '\nMemory Usage:\n';
      report += `  JS Memory: ${Math.round(benchmark.memoryUsage.usedJSSize / 1024 / 1024)}MB\n`;
      report += `  Memory Percentage: ${benchmark.memoryUsage.jsMemoryPercentage}%\n\n`;

      report += '---\n\n';
    });

    return report;
  }
}