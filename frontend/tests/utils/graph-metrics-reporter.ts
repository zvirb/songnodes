import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Custom Playwright Reporter for Graph Visualization Performance Metrics
 *
 * This reporter collects and analyzes performance metrics specifically
 * for WebGL/PIXI.js graph visualization testing.
 */

interface PerformanceData {
  testName: string;
  projectName: string;
  duration: number;
  status: string;
  frameRate?: number;
  renderTime?: number;
  nodeCount?: number;
  edgeCount?: number;
  memoryUsage?: number;
  webglInfo?: any;
}

class GraphMetricsReporter implements Reporter {
  private performanceData: PerformanceData[] = [];
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite) {
    console.log('📊 Graph Performance Metrics Reporter Started');
    this.performanceData = [];
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Extract performance data from test attachments or console logs
    const performanceData: PerformanceData = {
      testName: test.title,
      projectName: test.project()?.name || 'unknown',
      duration: result.duration,
      status: result.status,
    };

    // Look for performance metrics in stdout
    const stdout = result.stdout.map(chunk => chunk.toString()).join('');

    // Parse performance metrics from console output
    const fpsMatch = stdout.match(/FPS:\s*(\d+(?:\.\d+)?)/);
    if (fpsMatch) {
      performanceData.frameRate = parseFloat(fpsMatch[1]);
    }

    const renderTimeMatch = stdout.match(/Render Time:\s*(\d+(?:\.\d+)?)ms/);
    if (renderTimeMatch) {
      performanceData.renderTime = parseFloat(renderTimeMatch[1]);
    }

    const nodeCountMatch = stdout.match(/Node Count:\s*(\d+)/);
    if (nodeCountMatch) {
      performanceData.nodeCount = parseInt(nodeCountMatch[1]);
    }

    const edgeCountMatch = stdout.match(/Edge Count:\s*(\d+)/);
    if (edgeCountMatch) {
      performanceData.edgeCount = parseInt(edgeCountMatch[1]);
    }

    const memoryMatch = stdout.match(/Memory Usage:\s*(\d+(?:\.\d+)?)MB/);
    if (memoryMatch) {
      performanceData.memoryUsage = parseFloat(memoryMatch[1]);
    }

    // Look for WebGL info
    const webglMatch = stdout.match(/WebGL Info:\s*({.*?})/s);
    if (webglMatch) {
      try {
        performanceData.webglInfo = JSON.parse(webglMatch[1]);
      } catch (e) {
        // Ignore parsing errors
      }
    }

    this.performanceData.push(performanceData);
  }

  async onEnd(result: FullResult) {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();

    console.log('\n📊 Graph Visualization Performance Report');
    console.log('=' .repeat(50));

    // Summary statistics
    const totalTests = this.performanceData.length;
    const passedTests = this.performanceData.filter(d => d.status === 'passed').length;
    const failedTests = this.performanceData.filter(d => d.status === 'failed').length;

    console.log(`\n📋 Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(`   Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    // Performance metrics analysis
    const performanceTests = this.performanceData.filter(d => d.frameRate !== undefined);

    if (performanceTests.length > 0) {
      console.log(`\n⚡ Performance Analysis:`);

      const frameRates = performanceTests.map(d => d.frameRate!).filter(r => r > 0);
      const renderTimes = performanceTests.map(d => d.renderTime!).filter(r => r !== undefined && r > 0);

      if (frameRates.length > 0) {
        const avgFPS = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
        const minFPS = Math.min(...frameRates);
        const maxFPS = Math.max(...frameRates);

        console.log(`   Average FPS: ${avgFPS.toFixed(1)}`);
        console.log(`   Min FPS: ${minFPS.toFixed(1)}`);
        console.log(`   Max FPS: ${maxFPS.toFixed(1)}`);

        // Performance thresholds
        const highPerf = frameRates.filter(fps => fps >= 50).length;
        const mediumPerf = frameRates.filter(fps => fps >= 30 && fps < 50).length;
        const lowPerf = frameRates.filter(fps => fps < 30).length;

        console.log(`   High Performance (≥50 FPS): ${highPerf} tests`);
        console.log(`   Medium Performance (30-49 FPS): ${mediumPerf} tests`);
        console.log(`   Low Performance (<30 FPS): ${lowPerf} tests`);
      }

      if (renderTimes.length > 0) {
        const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
        const maxRenderTime = Math.max(...renderTimes);

        console.log(`   Average Render Time: ${avgRenderTime.toFixed(1)}ms`);
        console.log(`   Max Render Time: ${maxRenderTime.toFixed(1)}ms`);
      }

      // Node/Edge analysis
      const nodeCounts = performanceTests.map(d => d.nodeCount!).filter(c => c !== undefined);
      const edgeCounts = performanceTests.map(d => d.edgeCount!).filter(c => c !== undefined);

      if (nodeCounts.length > 0) {
        const maxNodes = Math.max(...nodeCounts);
        const avgNodes = nodeCounts.reduce((a, b) => a + b, 0) / nodeCounts.length;
        console.log(`   Max Nodes Tested: ${maxNodes}`);
        console.log(`   Average Nodes: ${avgNodes.toFixed(0)}`);
      }

      if (edgeCounts.length > 0) {
        const maxEdges = Math.max(...edgeCounts);
        const avgEdges = edgeCounts.reduce((a, b) => a + b, 0) / edgeCounts.length;
        console.log(`   Max Edges Tested: ${maxEdges}`);
        console.log(`   Average Edges: ${avgEdges.toFixed(0)}`);
      }
    }

    // Project breakdown
    const projectStats = new Map<string, { total: number, passed: number, avgFPS: number }>();

    this.performanceData.forEach(data => {
      const project = data.projectName;
      const existing = projectStats.get(project) || { total: 0, passed: 0, avgFPS: 0 };

      existing.total++;
      if (data.status === 'passed') existing.passed++;
      if (data.frameRate) existing.avgFPS += data.frameRate;

      projectStats.set(project, existing);
    });

    console.log(`\n🌐 Project Performance Breakdown:`);
    projectStats.forEach((stats, project) => {
      const passRate = (stats.passed / stats.total * 100).toFixed(1);
      const avgFPS = stats.total > 0 ? (stats.avgFPS / stats.total).toFixed(1) : 'N/A';
      console.log(`   ${project}: ${passRate}% pass rate, ${avgFPS} avg FPS`);
    });

    // Performance recommendations
    console.log(`\n💡 Performance Recommendations:`);

    const lowPerfTests = performanceTests.filter(d => d.frameRate! < 30);
    if (lowPerfTests.length > 0) {
      console.log(`   ⚠️ ${lowPerfTests.length} tests with low performance (<30 FPS)`);
      lowPerfTests.forEach(test => {
        console.log(`      - ${test.testName}: ${test.frameRate?.toFixed(1)} FPS`);
      });
    }

    const highRenderTimeTests = performanceTests.filter(d => d.renderTime! > 33.33);
    if (highRenderTimeTests.length > 0) {
      console.log(`   ⚠️ ${highRenderTimeTests.length} tests with slow render times (>33ms)`);
    }

    // Save detailed report to file
    await this.saveDetailedReport();

    console.log(`\n✅ Graph Performance Analysis Complete`);
    console.log(`📁 Detailed report saved to: test-results/performance-report.json`);
  }

  private async saveDetailedReport() {
    const fs = require('fs');
    const path = require('path');

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTests: this.performanceData.length,
        passedTests: this.performanceData.filter(d => d.status === 'passed').length,
        failedTests: this.performanceData.filter(d => d.status === 'failed').length,
      },
      performanceData: this.performanceData,
      analysis: this.generateAnalysis()
    };

    const reportPath = path.resolve('test-results', 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Also generate a CSV for easy analysis
    const csvPath = path.resolve('test-results', 'performance-data.csv');
    this.generateCSV(csvPath);
  }

  private generateAnalysis() {
    const performanceTests = this.performanceData.filter(d => d.frameRate !== undefined);

    if (performanceTests.length === 0) {
      return { message: 'No performance data available' };
    }

    const frameRates = performanceTests.map(d => d.frameRate!);
    const renderTimes = performanceTests.map(d => d.renderTime!).filter(t => t !== undefined);

    return {
      frameRate: {
        average: frameRates.reduce((a, b) => a + b, 0) / frameRates.length,
        min: Math.min(...frameRates),
        max: Math.max(...frameRates),
        standardDeviation: this.calculateStdDev(frameRates)
      },
      renderTime: renderTimes.length > 0 ? {
        average: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
        min: Math.min(...renderTimes),
        max: Math.max(...renderTimes),
        standardDeviation: this.calculateStdDev(renderTimes)
      } : null,
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const performanceTests = this.performanceData.filter(d => d.frameRate !== undefined);

    if (performanceTests.length === 0) return recommendations;

    const avgFPS = performanceTests.reduce((sum, d) => sum + d.frameRate!, 0) / performanceTests.length;

    if (avgFPS < 30) {
      recommendations.push('Overall performance is below 30 FPS - consider optimizing LOD system');
    } else if (avgFPS < 50) {
      recommendations.push('Performance is moderate - consider GPU profiling for bottlenecks');
    }

    const highNodeTests = performanceTests.filter(d => d.nodeCount && d.nodeCount > 1000);
    if (highNodeTests.some(d => d.frameRate! < 25)) {
      recommendations.push('Large datasets showing performance issues - implement aggressive culling');
    }

    const memoryTests = performanceTests.filter(d => d.memoryUsage && d.memoryUsage > 100);
    if (memoryTests.length > 0) {
      recommendations.push('High memory usage detected - check for memory leaks');
    }

    return recommendations;
  }

  private generateCSV(path: string) {
    const fs = require('fs');

    const headers = ['Test Name', 'Project', 'Status', 'Duration (ms)', 'FPS', 'Render Time (ms)', 'Nodes', 'Edges', 'Memory (MB)'];
    const rows = this.performanceData.map(d => [
      d.testName,
      d.projectName,
      d.status,
      d.duration.toString(),
      d.frameRate?.toString() || '',
      d.renderTime?.toString() || '',
      d.nodeCount?.toString() || '',
      d.edgeCount?.toString() || '',
      d.memoryUsage?.toString() || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    fs.writeFileSync(path, csv);
  }

  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }
}

export default GraphMetricsReporter;