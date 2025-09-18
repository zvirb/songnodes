/**
 * Performance Regression Testing Framework
 * Automated detection of performance degradation across code changes
 */

import { PerformanceBenchmarkFramework, BenchmarkConfig, PerformanceBenchmarkResult } from './performanceBenchmark';

export interface RegressionTestConfig {
  name: string;
  description: string;
  scenarios: BenchmarkConfig[];
  tolerances: {
    fps: { degradation: number; improvement: number }; // Percentage
    memory: { degradation: number; improvement: number }; // Percentage
    frameTime: { degradation: number; improvement: number }; // Percentage
    renderTime: { degradation: number; improvement: number }; // Percentage
  };
  baselineStrategy: 'latest' | 'average' | 'best' | 'specific';
  baselineId?: string;
  enabled: boolean;
}

export interface RegressionResult {
  testId: string;
  timestamp: string;
  passed: boolean;
  regressions: RegressionIssue[];
  improvements: PerformanceImprovement[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    regressionCount: number;
    improvementCount: number;
    overallGrade: 'pass' | 'warning' | 'fail';
  };
  baseline: PerformanceBenchmarkResult;
  current: PerformanceBenchmarkResult;
  comparison: PerformanceComparison;
}

export interface RegressionIssue {
  type: 'fps' | 'memory' | 'frameTime' | 'renderTime' | 'overall';
  severity: 'minor' | 'major' | 'critical';
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  threshold: number;
  impact: string;
  recommendations: string[];
}

export interface PerformanceImprovement {
  type: 'fps' | 'memory' | 'frameTime' | 'renderTime' | 'overall';
  metric: string;
  baselineValue: number;
  currentValue: number;
  improvementPercent: number;
  impact: string;
}

export interface PerformanceComparison {
  fps: {
    baseline: number;
    current: number;
    change: number;
    changePercent: number;
    status: 'improved' | 'degraded' | 'stable';
  };
  memory: {
    baseline: number;
    current: number;
    change: number;
    changePercent: number;
    status: 'improved' | 'degraded' | 'stable';
  };
  frameTime: {
    baseline: number;
    current: number;
    change: number;
    changePercent: number;
    status: 'improved' | 'degraded' | 'stable';
  };
  renderTime: {
    baseline: number;
    current: number;
    change: number;
    changePercent: number;
    status: 'improved' | 'degraded' | 'stable';
  };
}

export interface BaselineRecord {
  id: string;
  timestamp: string;
  gitCommit?: string;
  version?: string;
  results: PerformanceBenchmarkResult[];
  metadata: {
    branch: string;
    author: string;
    buildId: string;
    environment: string;
  };
}

/**
 * Baseline storage and management
 */
class BaselineStorage {
  private readonly storageKey = 'performance-baselines';
  private baselines: Map<string, BaselineRecord> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  store(baseline: BaselineRecord): void {
    this.baselines.set(baseline.id, baseline);
    this.saveToStorage();
  }

  get(id: string): BaselineRecord | null {
    return this.baselines.get(id) || null;
  }

  getLatest(): BaselineRecord | null {
    const sorted = Array.from(this.baselines.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return sorted.length > 0 ? sorted[0] : null;
  }

  getAverage(count: number = 5): BaselineRecord | null {
    const recent = Array.from(this.baselines.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, count);

    if (recent.length === 0) return null;

    // Create average baseline
    const avgResults = this.averageResults(recent.map(b => b.results).flat());
    
    return {
      id: `average-${count}`,
      timestamp: new Date().toISOString(),
      results: avgResults,
      metadata: {
        branch: 'multiple',
        author: 'system',
        buildId: 'averaged',
        environment: 'mixed'
      }
    };
  }

  getBest(): BaselineRecord | null {
    const all = Array.from(this.baselines.values());
    if (all.length === 0) return null;

    // Find baseline with best overall performance
    let best = all[0];
    let bestScore = this.calculateOverallScore(best.results);

    for (const baseline of all) {
      const score = this.calculateOverallScore(baseline.results);
      if (score > bestScore) {
        best = baseline;
        bestScore = score;
      }
    }

    return best;
  }

  list(): BaselineRecord[] {
    return Array.from(this.baselines.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  delete(id: string): boolean {
    const deleted = this.baselines.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  clear(): void {
    this.baselines.clear();
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.baselines = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load baselines from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.baselines);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save baselines to storage:', error);
    }
  }

  private averageResults(results: PerformanceBenchmarkResult[]): PerformanceBenchmarkResult[] {
    if (results.length === 0) return [];

    // Group by test config
    const groups = new Map<string, PerformanceBenchmarkResult[]>();
    results.forEach(result => {
      const key = `${result.config.name}-${result.config.nodeCount}-${result.config.edgeCount}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(result);
    });

    // Calculate averages for each group
    const averaged: PerformanceBenchmarkResult[] = [];
    groups.forEach((groupResults, key) => {
      if (groupResults.length > 0) {
        averaged.push(this.averageResultGroup(groupResults));
      }
    });

    return averaged;
  }

  private averageResultGroup(results: PerformanceBenchmarkResult[]): PerformanceBenchmarkResult {
    const count = results.length;
    const first = results[0];

    const avgFrameMetrics = {
      totalFrames: Math.round(results.reduce((sum, r) => sum + r.frameMetrics.totalFrames, 0) / count),
      averageFrameTime: results.reduce((sum, r) => sum + r.frameMetrics.averageFrameTime, 0) / count,
      averageFPS: results.reduce((sum, r) => sum + r.frameMetrics.averageFPS, 0) / count,
      minFPS: results.reduce((sum, r) => sum + r.frameMetrics.minFPS, 0) / count,
      maxFPS: results.reduce((sum, r) => sum + r.frameMetrics.maxFPS, 0) / count,
      fps99thPercentile: results.reduce((sum, r) => sum + r.frameMetrics.fps99thPercentile, 0) / count,
      droppedFrames: Math.round(results.reduce((sum, r) => sum + r.frameMetrics.droppedFrames, 0) / count),
      frameTimeStdDev: results.reduce((sum, r) => sum + r.frameMetrics.frameTimeStdDev, 0) / count,
      performanceGrade: first.frameMetrics.performanceGrade // Use first as representative
    };

    return {
      ...first,
      timestamp: new Date().toISOString(),
      frameMetrics: avgFrameMetrics,
      // Average other metrics similarly...
    };
  }

  private calculateOverallScore(results: PerformanceBenchmarkResult[]): number {
    if (results.length === 0) return 0;

    let totalScore = 0;
    results.forEach(result => {
      const fpsScore = result.frameMetrics.averageFPS / 60 * 100;
      const memoryScore = Math.max(0, 100 - (result.memoryMetrics.peakMemory?.used || 0) / (1024 * 1024 * 500) * 100);
      const frameTimeScore = Math.max(0, 100 - result.frameMetrics.averageFrameTime / 16.67 * 100);
      
      totalScore += (fpsScore + memoryScore + frameTimeScore) / 3;
    });

    return totalScore / results.length;
  }
}

/**
 * Performance comparison engine
 */
class PerformanceComparator {
  compare(baseline: PerformanceBenchmarkResult, current: PerformanceBenchmarkResult): PerformanceComparison {
    return {
      fps: this.compareMetric(
        baseline.frameMetrics.averageFPS,
        current.frameMetrics.averageFPS,
        'higher'
      ),
      memory: this.compareMetric(
        baseline.memoryMetrics.peakMemory?.used || 0,
        current.memoryMetrics.peakMemory?.used || 0,
        'lower'
      ),
      frameTime: this.compareMetric(
        baseline.frameMetrics.averageFrameTime,
        current.frameMetrics.averageFrameTime,
        'lower'
      ),
      renderTime: this.compareMetric(
        baseline.componentMetrics.averageRenderTime,
        current.componentMetrics.averageRenderTime,
        'lower'
      )
    };
  }

  private compareMetric(
    baseline: number,
    current: number,
    betterDirection: 'higher' | 'lower'
  ): PerformanceComparison['fps'] {
    const change = current - baseline;
    const changePercent = baseline !== 0 ? (change / baseline) * 100 : 0;

    let status: 'improved' | 'degraded' | 'stable';
    if (Math.abs(changePercent) < 5) {
      status = 'stable';
    } else if (betterDirection === 'higher') {
      status = changePercent > 0 ? 'improved' : 'degraded';
    } else {
      status = changePercent < 0 ? 'improved' : 'degraded';
    }

    return {
      baseline,
      current,
      change,
      changePercent,
      status
    };
  }

  detectRegressions(
    comparison: PerformanceComparison,
    tolerances: RegressionTestConfig['tolerances']
  ): RegressionIssue[] {
    const regressions: RegressionIssue[] = [];

    // Check FPS regression
    if (comparison.fps.status === 'degraded' && 
        Math.abs(comparison.fps.changePercent) > tolerances.fps.degradation) {
      regressions.push({
        type: 'fps',
        severity: this.calculateSeverity(Math.abs(comparison.fps.changePercent), tolerances.fps.degradation),
        metric: 'Average FPS',
        baselineValue: comparison.fps.baseline,
        currentValue: comparison.fps.current,
        changePercent: comparison.fps.changePercent,
        threshold: tolerances.fps.degradation,
        impact: 'User experience degradation due to reduced frame rate',
        recommendations: [
          'Check for new performance bottlenecks',
          'Run detailed profiling',
          'Review recent code changes',
          'Enable performance optimizations'
        ]
      });
    }

    // Check memory regression
    if (comparison.memory.status === 'degraded' && 
        Math.abs(comparison.memory.changePercent) > tolerances.memory.degradation) {
      regressions.push({
        type: 'memory',
        severity: this.calculateSeverity(Math.abs(comparison.memory.changePercent), tolerances.memory.degradation),
        metric: 'Peak Memory Usage',
        baselineValue: comparison.memory.baseline,
        currentValue: comparison.memory.current,
        changePercent: comparison.memory.changePercent,
        threshold: tolerances.memory.degradation,
        impact: 'Increased memory consumption may cause instability',
        recommendations: [
          'Check for memory leaks',
          'Review object pooling usage',
          'Optimize data structures',
          'Force garbage collection'
        ]
      });
    }

    // Check frame time regression
    if (comparison.frameTime.status === 'degraded' && 
        Math.abs(comparison.frameTime.changePercent) > tolerances.frameTime.degradation) {
      regressions.push({
        type: 'frameTime',
        severity: this.calculateSeverity(Math.abs(comparison.frameTime.changePercent), tolerances.frameTime.degradation),
        metric: 'Average Frame Time',
        baselineValue: comparison.frameTime.baseline,
        currentValue: comparison.frameTime.current,
        changePercent: comparison.frameTime.changePercent,
        threshold: tolerances.frameTime.degradation,
        impact: 'Increased frame processing time affects responsiveness',
        recommendations: [
          'Profile frame processing pipeline',
          'Optimize rendering algorithms',
          'Check simulation performance',
          'Review layout calculations'
        ]
      });
    }

    // Check render time regression
    if (comparison.renderTime.status === 'degraded' && 
        Math.abs(comparison.renderTime.changePercent) > tolerances.renderTime.degradation) {
      regressions.push({
        type: 'renderTime',
        severity: this.calculateSeverity(Math.abs(comparison.renderTime.changePercent), tolerances.renderTime.degradation),
        metric: 'Average Render Time',
        baselineValue: comparison.renderTime.baseline,
        currentValue: comparison.renderTime.current,
        changePercent: comparison.renderTime.changePercent,
        threshold: tolerances.renderTime.degradation,
        impact: 'Increased rendering time affects visual performance',
        recommendations: [
          'Optimize rendering pipeline',
          'Check for GPU bottlenecks',
          'Review shader performance',
          'Implement Level-of-Detail rendering'
        ]
      });
    }

    return regressions;
  }

  detectImprovements(
    comparison: PerformanceComparison,
    tolerances: RegressionTestConfig['tolerances']
  ): PerformanceImprovement[] {
    const improvements: PerformanceImprovement[] = [];

    // Check FPS improvement
    if (comparison.fps.status === 'improved' && 
        Math.abs(comparison.fps.changePercent) > tolerances.fps.improvement) {
      improvements.push({
        type: 'fps',
        metric: 'Average FPS',
        baselineValue: comparison.fps.baseline,
        currentValue: comparison.fps.current,
        improvementPercent: Math.abs(comparison.fps.changePercent),
        impact: 'Better user experience due to improved frame rate'
      });
    }

    // Check memory improvement
    if (comparison.memory.status === 'improved' && 
        Math.abs(comparison.memory.changePercent) > tolerances.memory.improvement) {
      improvements.push({
        type: 'memory',
        metric: 'Peak Memory Usage',
        baselineValue: comparison.memory.baseline,
        currentValue: comparison.memory.current,
        improvementPercent: Math.abs(comparison.memory.changePercent),
        impact: 'Reduced memory consumption improves stability'
      });
    }

    // Check frame time improvement
    if (comparison.frameTime.status === 'improved' && 
        Math.abs(comparison.frameTime.changePercent) > tolerances.frameTime.improvement) {
      improvements.push({
        type: 'frameTime',
        metric: 'Average Frame Time',
        baselineValue: comparison.frameTime.baseline,
        currentValue: comparison.frameTime.current,
        improvementPercent: Math.abs(comparison.frameTime.changePercent),
        impact: 'Faster frame processing improves responsiveness'
      });
    }

    // Check render time improvement
    if (comparison.renderTime.status === 'improved' && 
        Math.abs(comparison.renderTime.changePercent) > tolerances.renderTime.improvement) {
      improvements.push({
        type: 'renderTime',
        metric: 'Average Render Time',
        baselineValue: comparison.renderTime.baseline,
        currentValue: comparison.renderTime.current,
        improvementPercent: Math.abs(comparison.renderTime.changePercent),
        impact: 'Faster rendering improves visual performance'
      });
    }

    return improvements;
  }

  private calculateSeverity(changePercent: number, threshold: number): RegressionIssue['severity'] {
    if (changePercent > threshold * 3) return 'critical';
    if (changePercent > threshold * 2) return 'major';
    return 'minor';
  }
}

/**
 * Main performance regression testing framework
 */
export class PerformanceRegressionTester {
  private baselineStorage: BaselineStorage;
  private comparator: PerformanceComparator;
  private benchmarkFramework: PerformanceBenchmarkFramework;

  constructor() {
    this.baselineStorage = new BaselineStorage();
    this.comparator = new PerformanceComparator();
    this.benchmarkFramework = new PerformanceBenchmarkFramework();
  }

  /**
   * Run regression test suite
   */
  async runRegressionTests(config: RegressionTestConfig): Promise<RegressionResult> {
    if (!config.enabled) {
      throw new Error('Regression testing is disabled');
    }

    console.log(`Running regression tests: ${config.name}`);

    // Get baseline
    const baseline = this.getBaseline(config);
    if (!baseline) {
      throw new Error('No baseline available for regression testing');
    }

    // Run current benchmarks
    const currentResults = await this.benchmarkFramework.runBenchmarkSuite(config.scenarios);
    
    // Compare results
    const testResults = this.compareWithBaseline(config, baseline, currentResults);

    return testResults;
  }

  /**
   * Establish new baseline
   */
  async establishBaseline(
    config: RegressionTestConfig,
    metadata: BaselineRecord['metadata']
  ): Promise<BaselineRecord> {
    console.log(`Establishing baseline: ${config.name}`);

    const results = await this.benchmarkFramework.runBenchmarkSuite(config.scenarios);
    
    const baseline: BaselineRecord = {
      id: `baseline-${Date.now()}`,
      timestamp: new Date().toISOString(),
      results,
      metadata
    };

    this.baselineStorage.store(baseline);
    
    console.log(`Baseline established with ID: ${baseline.id}`);
    return baseline;
  }

  /**
   * Update baseline with new results
   */
  async updateBaseline(
    baselineId: string,
    config: RegressionTestConfig,
    metadata: BaselineRecord['metadata']
  ): Promise<BaselineRecord> {
    const results = await this.benchmarkFramework.runBenchmarkSuite(config.scenarios);
    
    const baseline: BaselineRecord = {
      id: baselineId,
      timestamp: new Date().toISOString(),
      results,
      metadata
    };

    this.baselineStorage.store(baseline);
    return baseline;
  }

  /**
   * Get available baselines
   */
  getBaselines(): BaselineRecord[] {
    return this.baselineStorage.list();
  }

  /**
   * Delete baseline
   */
  deleteBaseline(id: string): boolean {
    return this.baselineStorage.delete(id);
  }

  /**
   * Clear all baselines
   */
  clearBaselines(): void {
    this.baselineStorage.clear();
  }

  /**
   * Private methods
   */
  private getBaseline(config: RegressionTestConfig): BaselineRecord | null {
    switch (config.baselineStrategy) {
      case 'latest':
        return this.baselineStorage.getLatest();
      case 'average':
        return this.baselineStorage.getAverage();
      case 'best':
        return this.baselineStorage.getBest();
      case 'specific':
        return config.baselineId ? this.baselineStorage.get(config.baselineId) : null;
      default:
        return this.baselineStorage.getLatest();
    }
  }

  private compareWithBaseline(
    config: RegressionTestConfig,
    baseline: BaselineRecord,
    currentResults: PerformanceBenchmarkResult[]
  ): RegressionResult {
    const allRegressions: RegressionIssue[] = [];
    const allImprovements: PerformanceImprovement[] = [];
    let passedTests = 0;
    let failedTests = 0;

    // Compare each scenario
    currentResults.forEach(currentResult => {
      const baselineResult = baseline.results.find(br => 
        br.config.name === currentResult.config.name &&
        br.config.nodeCount === currentResult.config.nodeCount &&
        br.config.edgeCount === currentResult.config.edgeCount
      );

      if (baselineResult) {
        const comparison = this.comparator.compare(baselineResult, currentResult);
        const regressions = this.comparator.detectRegressions(comparison, config.tolerances);
        const improvements = this.comparator.detectImprovements(comparison, config.tolerances);

        allRegressions.push(...regressions);
        allImprovements.push(...improvements);

        if (regressions.length === 0) {
          passedTests++;
        } else {
          failedTests++;
        }
      }
    });

    // Calculate overall grade
    const criticalRegressions = allRegressions.filter(r => r.severity === 'critical').length;
    const majorRegressions = allRegressions.filter(r => r.severity === 'major').length;
    
    let overallGrade: 'pass' | 'warning' | 'fail';
    if (criticalRegressions > 0) {
      overallGrade = 'fail';
    } else if (majorRegressions > 0 || failedTests > passedTests) {
      overallGrade = 'warning';
    } else {
      overallGrade = 'pass';
    }

    // Use first results for comparison display
    const baselineResult = baseline.results[0];
    const currentResult = currentResults[0];
    const comparison = baselineResult ? this.comparator.compare(baselineResult, currentResult) : {} as PerformanceComparison;

    return {
      testId: `regression-${Date.now()}`,
      timestamp: new Date().toISOString(),
      passed: overallGrade === 'pass',
      regressions: allRegressions,
      improvements: allImprovements,
      summary: {
        totalTests: currentResults.length,
        passedTests,
        failedTests,
        regressionCount: allRegressions.length,
        improvementCount: allImprovements.length,
        overallGrade
      },
      baseline: baselineResult || currentResult || {} as PerformanceBenchmarkResult,
      current: currentResult || baselineResult || {} as PerformanceBenchmarkResult,
      comparison
    };
  }
}

// Default regression test configurations
export const defaultRegressionConfigs: RegressionTestConfig[] = [
  {
    name: 'Small Graph Performance',
    description: 'Basic performance test with small graph',
    scenarios: [
      {
        name: 'small-graph',
        nodeCount: 100,
        edgeCount: 200,
        duration: 10000,
        graphType: 'musical',
        renderingEnabled: true
      }
    ],
    tolerances: {
      fps: { degradation: 10, improvement: 5 },
      memory: { degradation: 15, improvement: 10 },
      frameTime: { degradation: 15, improvement: 10 },
      renderTime: { degradation: 20, improvement: 15 }
    },
    baselineStrategy: 'latest',
    enabled: true
  },
  {
    name: 'Medium Graph Performance',
    description: 'Performance test with medium-sized graph',
    scenarios: [
      {
        name: 'medium-graph',
        nodeCount: 1000,
        edgeCount: 2000,
        duration: 15000,
        graphType: 'musical',
        renderingEnabled: true
      }
    ],
    tolerances: {
      fps: { degradation: 15, improvement: 10 },
      memory: { degradation: 20, improvement: 15 },
      frameTime: { degradation: 20, improvement: 15 },
      renderTime: { degradation: 25, improvement: 20 }
    },
    baselineStrategy: 'average',
    enabled: true
  },
  {
    name: 'Large Graph Performance',
    description: 'Stress test with large graph',
    scenarios: [
      {
        name: 'large-graph',
        nodeCount: 5000,
        edgeCount: 10000,
        duration: 20000,
        graphType: 'musical',
        renderingEnabled: true
      }
    ],
    tolerances: {
      fps: { degradation: 20, improvement: 15 },
      memory: { degradation: 25, improvement: 20 },
      frameTime: { degradation: 25, improvement: 20 },
      renderTime: { degradation: 30, improvement: 25 }
    },
    baselineStrategy: 'best',
    enabled: true
  }
];

// Global regression tester instance
export const globalRegressionTester = new PerformanceRegressionTester();

// Utility functions
export async function runRegressionTest(configName: string): Promise<RegressionResult> {
  const config = defaultRegressionConfigs.find(c => c.name === configName);
  if (!config) {
    throw new Error(`Regression test config not found: ${configName}`);
  }
  
  return globalRegressionTester.runRegressionTests(config);
}

export async function establishPerformanceBaseline(
  configName: string,
  metadata: BaselineRecord['metadata']
): Promise<BaselineRecord> {
  const config = defaultRegressionConfigs.find(c => c.name === configName);
  if (!config) {
    throw new Error(`Regression test config not found: ${configName}`);
  }
  
  return globalRegressionTester.establishBaseline(config, metadata);
}