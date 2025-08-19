/**
 * Performance Regression Testing Framework
 * Automated performance monitoring and regression detection
 */

export interface PerformanceBaseline {
  testName: string;
  timestamp: string;
  metrics: {
    renderTime: number;
    memoryUsage: number;
    fps: number;
    interactionTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    totalBlockingTime: number;
  };
  environment: {
    userAgent: string;
    hardwareConcurrency: number;
    deviceMemory?: number;
    connectionType?: string;
  };
  datasetSize: {
    nodeCount: number;
    edgeCount: number;
  };
}

export interface RegressionThresholds {
  renderTime: number;
  memoryUsage: number;
  fps: number;
  interactionTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  totalBlockingTime: number;
}

export interface RegressionResult {
  testName: string;
  passed: boolean;
  regressions: Array<{
    metric: string;
    baseline: number;
    current: number;
    threshold: number;
    regressionPercentage: number;
  }>;
  improvements: Array<{
    metric: string;
    baseline: number;
    current: number;
    improvementPercentage: number;
  }>;
  summary: {
    totalMetrics: number;
    regressionCount: number;
    improvementCount: number;
    overallScore: number;
  };
}

export class PerformanceRegressionTester {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private thresholds: RegressionThresholds;
  private storageKey = 'performance-baselines';

  constructor(thresholds: Partial<RegressionThresholds> = {}) {
    this.thresholds = {
      renderTime: 20, // 20% regression threshold
      memoryUsage: 25, // 25% regression threshold
      fps: 15, // 15% FPS drop threshold
      interactionTime: 30, // 30% interaction delay threshold
      firstContentfulPaint: 20,
      largestContentfulPaint: 25,
      cumulativeLayoutShift: 50, // CLS is very sensitive
      totalBlockingTime: 30,
      ...thresholds,
    };

    this.loadBaselines();
  }

  /**
   * Record a new performance baseline
   */
  async recordBaseline(
    testName: string,
    nodeCount: number,
    edgeCount: number
  ): Promise<PerformanceBaseline> {
    const metrics = await this.measurePerformanceMetrics();
    const environment = this.getEnvironmentInfo();

    const baseline: PerformanceBaseline = {
      testName,
      timestamp: new Date().toISOString(),
      metrics,
      environment,
      datasetSize: { nodeCount, edgeCount },
    };

    this.baselines.set(testName, baseline);
    this.saveBaselines();

    return baseline;
  }

  /**
   * Test for performance regressions against baseline
   */
  async testRegression(
    testName: string,
    nodeCount: number,
    edgeCount: number
  ): Promise<RegressionResult> {
    const baseline = this.baselines.get(testName);
    if (!baseline) {
      throw new Error(`No baseline found for test: ${testName}`);
    }

    const currentMetrics = await this.measurePerformanceMetrics();
    
    return this.compareMetrics(testName, baseline.metrics, currentMetrics);
  }

  /**
   * Measure comprehensive performance metrics
   */
  private async measurePerformanceMetrics(): Promise<PerformanceBaseline['metrics']> {
    const metrics = {
      renderTime: 0,
      memoryUsage: 0,
      fps: 0,
      interactionTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      totalBlockingTime: 0,
    };

    // Measure render time
    metrics.renderTime = await this.measureRenderTime();

    // Measure memory usage
    metrics.memoryUsage = this.measureMemoryUsage();

    // Measure FPS
    metrics.fps = await this.measureFPS();

    // Measure interaction time
    metrics.interactionTime = await this.measureInteractionTime();

    // Measure Core Web Vitals
    const webVitals = await this.measureCoreWebVitals();
    metrics.firstContentfulPaint = webVitals.fcp;
    metrics.largestContentfulPaint = webVitals.lcp;
    metrics.cumulativeLayoutShift = webVitals.cls;
    metrics.totalBlockingTime = webVitals.tbt;

    return metrics;
  }

  /**
   * Measure render time for current graph
   */
  private async measureRenderTime(): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      // Use requestAnimationFrame to ensure render completion
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const endTime = performance.now();
          resolve(endTime - startTime);
        });
      });
    });
  }

  /**
   * Measure memory usage
   */
  private measureMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Measure frames per second
   */
  private async measureFPS(duration = 1000): Promise<number> {
    return new Promise((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();

      function countFrames() {
        frameCount++;
        const elapsed = performance.now() - startTime;

        if (elapsed < duration) {
          requestAnimationFrame(countFrames);
        } else {
          const fps = (frameCount / elapsed) * 1000;
          resolve(fps);
        }
      }

      requestAnimationFrame(countFrames);
    });
  }

  /**
   * Measure interaction response time
   */
  private async measureInteractionTime(): Promise<number> {
    return new Promise((resolve) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        resolve(0);
        return;
      }

      const startTime = performance.now();

      // Simulate click interaction
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: canvas.width / 2,
        clientY: canvas.height / 2,
      });

      canvas.dispatchEvent(event);

      // Measure time until next frame
      requestAnimationFrame(() => {
        const endTime = performance.now();
        resolve(endTime - startTime);
      });
    });
  }

  /**
   * Measure Core Web Vitals
   */
  private async measureCoreWebVitals(): Promise<{
    fcp: number;
    lcp: number;
    cls: number;
    tbt: number;
  }> {
    const vitals = { fcp: 0, lcp: 0, cls: 0, tbt: 0 };

    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        // Measure FCP
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        // Measure LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Measure CLS
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          vitals.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Measure TBT (approximation)
        const tbtObserver = new PerformanceObserver((list) => {
          let tbtValue = 0;
          list.getEntries().forEach((entry: any) => {
            if (entry.duration > 50) {
              tbtValue += entry.duration - 50;
            }
          });
          vitals.tbt = tbtValue;
        });
        tbtObserver.observe({ entryTypes: ['longtask'] });

        // Disconnect observers after 3 seconds
        setTimeout(() => {
          fcpObserver.disconnect();
          lcpObserver.disconnect();
          clsObserver.disconnect();
          tbtObserver.disconnect();
          resolve(vitals);
        }, 3000);
      } else {
        resolve(vitals);
      }
    });
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): PerformanceBaseline['environment'] {
    return {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      deviceMemory: (navigator as any).deviceMemory,
      connectionType: (navigator as any).connection?.effectiveType,
    };
  }

  /**
   * Compare metrics and detect regressions
   */
  private compareMetrics(
    testName: string,
    baseline: PerformanceBaseline['metrics'],
    current: PerformanceBaseline['metrics']
  ): RegressionResult {
    const regressions: RegressionResult['regressions'] = [];
    const improvements: RegressionResult['improvements'] = [];

    Object.keys(baseline).forEach((metricKey) => {
      const key = metricKey as keyof PerformanceBaseline['metrics'];
      const baselineValue = baseline[key];
      const currentValue = current[key];
      const threshold = this.thresholds[key];

      if (baselineValue > 0) {
        const changePercentage = ((currentValue - baselineValue) / baselineValue) * 100;

        if (changePercentage > threshold) {
          // Performance regression
          regressions.push({
            metric: key,
            baseline: baselineValue,
            current: currentValue,
            threshold,
            regressionPercentage: changePercentage,
          });
        } else if (changePercentage < -5) {
          // Significant improvement (>5% better)
          improvements.push({
            metric: key,
            baseline: baselineValue,
            current: currentValue,
            improvementPercentage: Math.abs(changePercentage),
          });
        }
      }
    });

    const totalMetrics = Object.keys(baseline).length;
    const overallScore = Math.max(0, 100 - (regressions.length / totalMetrics) * 100);

    return {
      testName,
      passed: regressions.length === 0,
      regressions,
      improvements,
      summary: {
        totalMetrics,
        regressionCount: regressions.length,
        improvementCount: improvements.length,
        overallScore,
      },
    };
  }

  /**
   * Generate performance report
   */
  generateReport(results: RegressionResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    let report = `# Performance Regression Test Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Tests:** ${totalTests}\n`;
    report += `**Passed:** ${passedTests}\n`;
    report += `**Failed:** ${failedTests}\n`;
    report += `**Success Rate:** ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    results.forEach((result) => {
      report += `## ${result.testName}\n`;
      report += `**Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Overall Score:** ${result.summary.overallScore.toFixed(1)}%\n\n`;

      if (result.regressions.length > 0) {
        report += `### Regressions:\n`;
        result.regressions.forEach((regression) => {
          report += `- **${regression.metric}:** ${regression.regressionPercentage.toFixed(1)}% regression `;
          report += `(${regression.baseline.toFixed(2)} → ${regression.current.toFixed(2)})\n`;
        });
        report += '\n';
      }

      if (result.improvements.length > 0) {
        report += `### Improvements:\n`;
        result.improvements.forEach((improvement) => {
          report += `- **${improvement.metric}:** ${improvement.improvementPercentage.toFixed(1)}% improvement `;
          report += `(${improvement.baseline.toFixed(2)} → ${improvement.current.toFixed(2)})\n`;
        });
        report += '\n';
      }
    });

    return report;
  }

  /**
   * Load baselines from storage
   */
  private loadBaselines(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.baselines = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load performance baselines:', error);
    }
  }

  /**
   * Save baselines to storage
   */
  private saveBaselines(): void {
    try {
      const data = Object.fromEntries(this.baselines);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save performance baselines:', error);
    }
  }

  /**
   * Export baselines for CI/CD
   */
  exportBaselines(): string {
    const data = Object.fromEntries(this.baselines);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import baselines from CI/CD
   */
  importBaselines(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.baselines = new Map(Object.entries(parsed));
      this.saveBaselines();
    } catch (error) {
      throw new Error('Invalid baseline data format');
    }
  }

  /**
   * Clear all baselines
   */
  clearBaselines(): void {
    this.baselines.clear();
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Get all baseline names
   */
  getBaselineNames(): string[] {
    return Array.from(this.baselines.keys());
  }

  /**
   * Get baseline by name
   */
  getBaseline(testName: string): PerformanceBaseline | undefined {
    return this.baselines.get(testName);
  }
}

// Singleton instance for global use
export const performanceRegressionTester = new PerformanceRegressionTester();

// Helper functions for common use cases
export async function runPerformanceTest(
  testName: string,
  nodeCount: number,
  edgeCount: number,
  createBaseline = false
): Promise<RegressionResult | PerformanceBaseline> {
  if (createBaseline) {
    return await performanceRegressionTester.recordBaseline(testName, nodeCount, edgeCount);
  } else {
    return await performanceRegressionTester.testRegression(testName, nodeCount, edgeCount);
  }
}

export async function runPerformanceSuite(
  tests: Array<{ name: string; nodeCount: number; edgeCount: number }>
): Promise<RegressionResult[]> {
  const results: RegressionResult[] = [];

  for (const test of tests) {
    try {
      const result = await performanceRegressionTester.testRegression(
        test.name,
        test.nodeCount,
        test.edgeCount
      );
      results.push(result);
    } catch (error) {
      console.warn(`Failed to run performance test ${test.name}:`, error);
    }
  }

  return results;
}