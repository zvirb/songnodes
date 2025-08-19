/**
 * Real-time Performance Monitoring and Alerting System
 * Comprehensive monitoring with automated performance analysis and alerts
 */

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  category: 'fps' | 'memory' | 'network' | 'rendering' | 'simulation';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  suggestions: string[];
}

export interface PerformanceThreshold {
  fps: {
    warning: number;
    critical: number;
  };
  memory: {
    warningMB: number;
    criticalMB: number;
    leakGrowthRate: number;
  };
  frameTime: {
    warningMs: number;
    criticalMs: number;
  };
  renderTime: {
    warningMs: number;
    criticalMs: number;
  };
  networkLatency: {
    warningMs: number;
    criticalMs: number;
  };
  nodeCount: {
    warningCount: number;
    criticalCount: number;
  };
}

export interface RealTimeMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  simulationTime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  networkLatency: number;
  nodeCount: number;
  edgeCount: number;
  gpuMemoryUsage?: number;
  cpuUsage?: number;
  timestamp: number;
}

export interface PerformanceReport {
  summary: {
    overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    performanceScore: number;
    criticalIssues: number;
    warnings: number;
    suggestions: string[];
  };
  metrics: {
    current: RealTimeMetrics;
    average: RealTimeMetrics;
    peak: RealTimeMetrics;
    trends: {
      fps: 'improving' | 'stable' | 'degrading';
      memory: 'improving' | 'stable' | 'degrading';
      performance: 'improving' | 'stable' | 'degrading';
    };
  };
  alerts: PerformanceAlert[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

/**
 * Performance data collector with circular buffer
 */
class PerformanceDataCollector {
  private buffer: RealTimeMetrics[] = [];
  private readonly bufferSize: number;
  private index: number = 0;
  private isFull: boolean = false;

  constructor(bufferSize: number = 300) { // 5 minutes at 60 FPS
    this.bufferSize = bufferSize;
  }

  add(metrics: RealTimeMetrics): void {
    this.buffer[this.index] = metrics;
    this.index = (this.index + 1) % this.bufferSize;
    
    if (this.index === 0) {
      this.isFull = true;
    }
  }

  getRecent(count: number = 60): RealTimeMetrics[] {
    const result: RealTimeMetrics[] = [];
    const actualCount = Math.min(count, this.getSize());
    
    for (let i = 0; i < actualCount; i++) {
      const idx = (this.index - 1 - i + this.bufferSize) % this.bufferSize;
      if (this.buffer[idx]) {
        result.unshift(this.buffer[idx]);
      }
    }
    
    return result;
  }

  getAverage(samples: number = 60): RealTimeMetrics | null {
    const recent = this.getRecent(samples);
    if (recent.length === 0) return null;

    const avg = recent.reduce((acc, metrics) => ({
      fps: acc.fps + metrics.fps,
      frameTime: acc.frameTime + metrics.frameTime,
      renderTime: acc.renderTime + metrics.renderTime,
      simulationTime: acc.simulationTime + metrics.simulationTime,
      memoryUsage: {
        used: acc.memoryUsage.used + metrics.memoryUsage.used,
        total: acc.memoryUsage.total + metrics.memoryUsage.total,
        percentage: acc.memoryUsage.percentage + metrics.memoryUsage.percentage
      },
      networkLatency: acc.networkLatency + metrics.networkLatency,
      nodeCount: acc.nodeCount + metrics.nodeCount,
      edgeCount: acc.edgeCount + metrics.edgeCount,
      timestamp: metrics.timestamp
    }), {
      fps: 0, frameTime: 0, renderTime: 0, simulationTime: 0,
      memoryUsage: { used: 0, total: 0, percentage: 0 },
      networkLatency: 0, nodeCount: 0, edgeCount: 0, timestamp: 0
    });

    const count = recent.length;
    return {
      fps: avg.fps / count,
      frameTime: avg.frameTime / count,
      renderTime: avg.renderTime / count,
      simulationTime: avg.simulationTime / count,
      memoryUsage: {
        used: avg.memoryUsage.used / count,
        total: avg.memoryUsage.total / count,
        percentage: avg.memoryUsage.percentage / count
      },
      networkLatency: avg.networkLatency / count,
      nodeCount: avg.nodeCount / count,
      edgeCount: avg.edgeCount / count,
      timestamp: Date.now()
    };
  }

  getPeak(): RealTimeMetrics | null {
    const all = this.getRecent(this.getSize());
    if (all.length === 0) return null;

    return all.reduce((peak, current) => ({
      fps: Math.max(peak.fps, current.fps),
      frameTime: Math.max(peak.frameTime, current.frameTime),
      renderTime: Math.max(peak.renderTime, current.renderTime),
      simulationTime: Math.max(peak.simulationTime, current.simulationTime),
      memoryUsage: {
        used: Math.max(peak.memoryUsage.used, current.memoryUsage.used),
        total: Math.max(peak.memoryUsage.total, current.memoryUsage.total),
        percentage: Math.max(peak.memoryUsage.percentage, current.memoryUsage.percentage)
      },
      networkLatency: Math.max(peak.networkLatency, current.networkLatency),
      nodeCount: Math.max(peak.nodeCount, current.nodeCount),
      edgeCount: Math.max(peak.edgeCount, current.edgeCount),
      timestamp: current.timestamp
    }));
  }

  getTrend(metric: keyof RealTimeMetrics, samples: number = 30): 'improving' | 'stable' | 'degrading' {
    const recent = this.getRecent(samples);
    if (recent.length < 10) return 'stable';

    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const getMetricValue = (metrics: RealTimeMetrics): number => {
      if (metric === 'memoryUsage') {
        return metrics.memoryUsage.percentage;
      }
      return metrics[metric] as number;
    };

    const firstAvg = firstHalf.reduce((sum, m) => sum + getMetricValue(m), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + getMetricValue(m), 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    // For FPS, higher is better
    if (metric === 'fps') {
      return changePercent > 5 ? 'improving' : changePercent < -5 ? 'degrading' : 'stable';
    }
    
    // For other metrics, lower is generally better
    return changePercent < -5 ? 'improving' : changePercent > 5 ? 'degrading' : 'stable';
  }

  getSize(): number {
    return this.isFull ? this.bufferSize : this.index;
  }

  clear(): void {
    this.buffer = [];
    this.index = 0;
    this.isFull = false;
  }
}

/**
 * Alert manager for performance issues
 */
class AlertManager {
  private alerts: Map<string, PerformanceAlert> = new Map();
  private thresholds: PerformanceThreshold;
  private alertHandlers: ((alert: PerformanceAlert) => void)[] = [];

  constructor(thresholds: PerformanceThreshold) {
    this.thresholds = thresholds;
  }

  checkMetrics(metrics: RealTimeMetrics): PerformanceAlert[] {
    const newAlerts: PerformanceAlert[] = [];

    // FPS checks
    if (metrics.fps < this.thresholds.fps.critical) {
      newAlerts.push(this.createAlert('fps-critical', 'critical', 'fps', 
        `Critical FPS drop: ${metrics.fps.toFixed(1)} FPS`, 
        metrics.fps, this.thresholds.fps.critical,
        [
          'Reduce node count or edge count',
          'Enable Level-of-Detail rendering',
          'Disable visual effects',
          'Check for memory leaks'
        ]
      ));
    } else if (metrics.fps < this.thresholds.fps.warning) {
      newAlerts.push(this.createAlert('fps-warning', 'warning', 'fps',
        `Low FPS: ${metrics.fps.toFixed(1)} FPS`,
        metrics.fps, this.thresholds.fps.warning,
        [
          'Consider reducing visual quality',
          'Enable viewport culling',
          'Optimize force simulation parameters'
        ]
      ));
    }

    // Memory checks
    const memoryMB = metrics.memoryUsage.used / (1024 * 1024);
    if (memoryMB > this.thresholds.memory.criticalMB) {
      newAlerts.push(this.createAlert('memory-critical', 'critical', 'memory',
        `Critical memory usage: ${memoryMB.toFixed(1)} MB`,
        memoryMB, this.thresholds.memory.criticalMB,
        [
          'Force garbage collection',
          'Clear unused graph data',
          'Reduce object pooling sizes',
          'Check for memory leaks'
        ]
      ));
    } else if (memoryMB > this.thresholds.memory.warningMB) {
      newAlerts.push(this.createAlert('memory-warning', 'warning', 'memory',
        `High memory usage: ${memoryMB.toFixed(1)} MB`,
        memoryMB, this.thresholds.memory.warningMB,
        [
          'Enable object pooling',
          'Optimize memory usage',
          'Consider reducing graph size'
        ]
      ));
    }

    // Frame time checks
    if (metrics.frameTime > this.thresholds.frameTime.criticalMs) {
      newAlerts.push(this.createAlert('frame-time-critical', 'critical', 'rendering',
        `Critical frame time: ${metrics.frameTime.toFixed(1)} ms`,
        metrics.frameTime, this.thresholds.frameTime.criticalMs,
        [
          'Enable Barnes-Hut optimization',
          'Reduce rendering quality',
          'Implement frame skipping'
        ]
      ));
    }

    // Network latency checks
    if (metrics.networkLatency > this.thresholds.networkLatency.criticalMs) {
      newAlerts.push(this.createAlert('network-critical', 'critical', 'network',
        `High network latency: ${metrics.networkLatency.toFixed(1)} ms`,
        metrics.networkLatency, this.thresholds.networkLatency.criticalMs,
        [
          'Check network connection',
          'Enable WebSocket compression',
          'Implement connection pooling'
        ]
      ));
    }

    // Node count checks
    if (metrics.nodeCount > this.thresholds.nodeCount.criticalCount) {
      newAlerts.push(this.createAlert('nodes-critical', 'critical', 'rendering',
        `Too many nodes: ${metrics.nodeCount}`,
        metrics.nodeCount, this.thresholds.nodeCount.criticalCount,
        [
          'Implement virtual rendering',
          'Add node filtering',
          'Use Level-of-Detail optimization'
        ]
      ));
    }

    // Add new alerts and trigger handlers
    newAlerts.forEach(alert => {
      this.alerts.set(alert.id, alert);
      this.alertHandlers.forEach(handler => handler(alert));
    });

    return newAlerts;
  }

  private createAlert(
    id: string,
    type: PerformanceAlert['type'],
    category: PerformanceAlert['category'],
    message: string,
    value: number,
    threshold: number,
    suggestions: string[]
  ): PerformanceAlert {
    return {
      id,
      type,
      category,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      resolved: false,
      suggestions
    };
  }

  resolveAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.resolved = true;
    }
  }

  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getAllAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values());
  }

  onAlert(handler: (alert: PerformanceAlert) => void): void {
    this.alertHandlers.push(handler);
  }

  clearAlerts(): void {
    this.alerts.clear();
  }
}

/**
 * Main real-time performance monitor
 */
export class RealTimePerformanceMonitor {
  private collector: PerformanceDataCollector;
  private alertManager: AlertManager;
  private isRunning: boolean = false;
  private monitoringInterval: number | null = null;
  private reportHandlers: ((report: PerformanceReport) => void)[] = [];
  private lastGCTime: number = 0;
  private gcEventCount: number = 0;

  constructor(
    bufferSize: number = 300,
    thresholds: Partial<PerformanceThreshold> = {}
  ) {
    this.collector = new PerformanceDataCollector(bufferSize);
    
    const defaultThresholds: PerformanceThreshold = {
      fps: { warning: 30, critical: 15 },
      memory: { warningMB: 500, criticalMB: 1000, leakGrowthRate: 50 },
      frameTime: { warningMs: 33, criticalMs: 67 }, // 30 FPS and 15 FPS
      renderTime: { warningMs: 16, criticalMs: 33 },
      networkLatency: { warningMs: 200, criticalMs: 500 },
      nodeCount: { warningCount: 5000, criticalCount: 10000 }
    };

    this.alertManager = new AlertManager({ ...defaultThresholds, ...thresholds });
    this.setupGCMonitoring();
  }

  /**
   * Start real-time monitoring
   */
  start(updateInterval: number = 1000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
    }, updateInterval);

    console.log('Performance monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Performance monitoring stopped');
  }

  /**
   * Record frame performance data
   */
  recordFrame(data: {
    frameTime: number;
    renderTime: number;
    simulationTime: number;
    nodeCount: number;
    edgeCount: number;
    networkLatency?: number;
  }): void {
    const metrics: RealTimeMetrics = {
      fps: data.frameTime > 0 ? 1000 / data.frameTime : 0,
      frameTime: data.frameTime,
      renderTime: data.renderTime,
      simulationTime: data.simulationTime,
      memoryUsage: this.getMemoryUsage(),
      networkLatency: data.networkLatency || 0,
      nodeCount: data.nodeCount,
      edgeCount: data.edgeCount,
      timestamp: Date.now()
    };

    this.collector.add(metrics);
    
    // Check for alerts
    const alerts = this.alertManager.checkMetrics(metrics);
    
    // Generate report if there are critical alerts
    if (alerts.some(alert => alert.type === 'critical')) {
      this.generateReport();
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): PerformanceReport {
    const current = this.collector.getRecent(1)[0];
    const average = this.collector.getAverage(60);
    const peak = this.collector.getPeak();
    const alerts = this.alertManager.getActiveAlerts();

    if (!current || !average || !peak) {
      throw new Error('Insufficient data for report generation');
    }

    const overallGrade = this.calculateOverallGrade(current, alerts);
    const performanceScore = this.calculatePerformanceScore(current);
    
    const report: PerformanceReport = {
      summary: {
        overallGrade,
        performanceScore,
        criticalIssues: alerts.filter(a => a.type === 'critical').length,
        warnings: alerts.filter(a => a.type === 'warning').length,
        suggestions: this.generateSuggestions(current, alerts)
      },
      metrics: {
        current,
        average,
        peak,
        trends: {
          fps: this.collector.getTrend('fps'),
          memory: this.collector.getTrend('memoryUsage'),
          performance: this.calculatePerformanceTrend()
        }
      },
      alerts,
      recommendations: this.generateRecommendations(current, alerts)
    };

    // Notify report handlers
    this.reportHandlers.forEach(handler => handler(report));

    return report;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): RealTimeMetrics | null {
    const recent = this.collector.getRecent(1);
    return recent.length > 0 ? recent[0] : null;
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    averageMetrics: RealTimeMetrics | null;
    peakMetrics: RealTimeMetrics | null;
    activeAlerts: number;
    totalSamples: number;
  } {
    return {
      averageMetrics: this.collector.getAverage(),
      peakMetrics: this.collector.getPeak(),
      activeAlerts: this.alertManager.getActiveAlerts().length,
      totalSamples: this.collector.getSize()
    };
  }

  /**
   * Register report handler
   */
  onReport(handler: (report: PerformanceReport) => void): void {
    this.reportHandlers.push(handler);
  }

  /**
   * Register alert handler
   */
  onAlert(handler: (alert: PerformanceAlert) => void): void {
    this.alertManager.onAlert(handler);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.collector.clear();
    this.alertManager.clearAlerts();
    this.gcEventCount = 0;
    this.lastGCTime = 0;
  }

  /**
   * Private methods
   */
  private collectMetrics(): void {
    // This would be called periodically to collect system metrics
    // For now, we rely on manual recording via recordFrame
  }

  private getMemoryUsage(): RealTimeMetrics['memoryUsage'] {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize;
      const total = memory.totalJSHeapSize;
      
      return {
        used,
        total,
        percentage: total > 0 ? (used / total) * 100 : 0
      };
    }

    return { used: 0, total: 0, percentage: 0 };
  }

  private calculateOverallGrade(
    metrics: RealTimeMetrics, 
    alerts: PerformanceAlert[]
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    const criticalCount = alerts.filter(a => a.type === 'critical').length;
    const warningCount = alerts.filter(a => a.type === 'warning').length;

    if (criticalCount > 0) return 'F';
    if (warningCount > 2) return 'D';
    if (warningCount > 1) return 'C';
    if (warningCount > 0) return 'B';
    
    // Check performance metrics
    if (metrics.fps >= 55 && metrics.memoryUsage.percentage < 70) return 'A';
    if (metrics.fps >= 40 && metrics.memoryUsage.percentage < 80) return 'B';
    if (metrics.fps >= 25) return 'C';
    if (metrics.fps >= 15) return 'D';
    
    return 'F';
  }

  private calculatePerformanceScore(metrics: RealTimeMetrics): number {
    let score = 100;

    // FPS component (40% weight)
    const fpsScore = Math.min(100, (metrics.fps / 60) * 100);
    score = score * 0.4 + fpsScore * 0.4;

    // Memory component (30% weight)
    const memoryScore = Math.max(0, 100 - metrics.memoryUsage.percentage);
    score = score * 0.7 + memoryScore * 0.3;

    // Frame time component (20% weight)
    const frameTimeScore = Math.max(0, 100 - (metrics.frameTime / 33) * 100);
    score = score * 0.8 + frameTimeScore * 0.2;

    // Network component (10% weight)
    const networkScore = Math.max(0, 100 - (metrics.networkLatency / 200) * 100);
    score = score * 0.9 + networkScore * 0.1;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private calculatePerformanceTrend(): 'improving' | 'stable' | 'degrading' {
    const fpsTrend = this.collector.getTrend('fps');
    const memoryTrend = this.collector.getTrend('memoryUsage');
    
    if (fpsTrend === 'improving' && memoryTrend !== 'degrading') return 'improving';
    if (fpsTrend === 'degrading' || memoryTrend === 'degrading') return 'degrading';
    return 'stable';
  }

  private generateSuggestions(
    metrics: RealTimeMetrics, 
    alerts: PerformanceAlert[]
  ): string[] {
    const suggestions = new Set<string>();

    alerts.forEach(alert => {
      alert.suggestions.forEach(suggestion => suggestions.add(suggestion));
    });

    // Add general suggestions based on metrics
    if (metrics.fps < 30) {
      suggestions.add('Enable performance optimizations');
    }
    
    if (metrics.memoryUsage.percentage > 80) {
      suggestions.add('Optimize memory usage');
    }

    return Array.from(suggestions);
  }

  private generateRecommendations(
    metrics: RealTimeMetrics,
    alerts: PerformanceAlert[]
  ): PerformanceReport['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions for critical issues
    const criticalAlerts = alerts.filter(a => a.type === 'critical');
    criticalAlerts.forEach(alert => {
      immediate.push(...alert.suggestions.slice(0, 2));
    });

    // Short-term improvements
    if (metrics.fps < 45) {
      shortTerm.push('Implement Barnes-Hut optimization');
      shortTerm.push('Enable Level-of-Detail rendering');
    }

    if (metrics.memoryUsage.percentage > 70) {
      shortTerm.push('Implement object pooling');
      shortTerm.push('Add memory leak detection');
    }

    // Long-term optimizations
    longTerm.push('Implement Web Workers for simulation');
    longTerm.push('Add WebGL GPU acceleration');
    longTerm.push('Implement incremental rendering');

    return { immediate, shortTerm, longTerm };
  }

  private setupGCMonitoring(): void {
    // Monitor for garbage collection events
    if ('memory' in performance) {
      let lastMemory = (performance as any).memory.usedJSHeapSize;
      
      setInterval(() => {
        const currentMemory = (performance as any).memory.usedJSHeapSize;
        
        // Detect GC (significant memory drop)
        if (lastMemory > currentMemory + 5 * 1024 * 1024) { // 5MB drop
          this.gcEventCount++;
          this.lastGCTime = Date.now();
        }
        
        lastMemory = currentMemory;
      }, 1000);
    }
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new RealTimePerformanceMonitor();

// Utility functions
export function startPerformanceMonitoring(updateInterval?: number): void {
  globalPerformanceMonitor.start(updateInterval);
}

export function stopPerformanceMonitoring(): void {
  globalPerformanceMonitor.stop();
}

export function recordFramePerformance(data: {
  frameTime: number;
  renderTime: number;
  simulationTime: number;
  nodeCount: number;
  edgeCount: number;
  networkLatency?: number;
}): void {
  globalPerformanceMonitor.recordFrame(data);
}

export function generatePerformanceReport(): PerformanceReport {
  return globalPerformanceMonitor.generateReport();
}

export function getCurrentPerformanceMetrics(): RealTimeMetrics | null {
  return globalPerformanceMonitor.getCurrentMetrics();
}