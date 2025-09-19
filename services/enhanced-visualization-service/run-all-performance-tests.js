#!/usr/bin/env node
/**
 * Comprehensive Performance Testing Coordinator
 * Runs all performance tests and generates a unified report
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const config = {
  tests: [
    {
      name: 'WebSocket Stress Test',
      script: 'websocket-stress-test.js',
      description: 'WebSocket connection capacity testing',
      required: false
    }
  ],
  reporting: {
    outputDir: './performance-reports',
    unifiedReport: 'UNIFIED_PERFORMANCE_REPORT.md'
  }
};

class PerformanceTestCoordinator {
  constructor() {
    this.results = {
      testRuns: [],
      summary: {},
      recommendations: [],
      timestamp: new Date().toISOString()
    };
  }

  async run() {
    console.log('🚀 Starting Comprehensive Performance Testing Suite');
    console.log('='.repeat(80));
    console.log('📊 Test Configuration:');
    config.tests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name}: ${test.description}`);
    });
    console.log('='.repeat(80));

    try {
      // Create output directory
      await this.ensureOutputDirectory();

      // Check system prerequisites
      await this.checkPrerequisites();

      // Run all performance tests
      for (const test of config.tests) {
        await this.runTest(test);
      }

      // Generate unified report
      await this.generateUnifiedReport();

      console.log('\n🎉 All performance tests completed!');
      console.log(`📄 Unified report: ${path.join(config.reporting.outputDir, config.reporting.unifiedReport)}`);

    } catch (error) {
      console.error('❌ Performance testing failed:', error);
    }
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(config.reporting.outputDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async checkPrerequisites() {
    console.log('\n🔍 Checking Prerequisites...');

    const checks = [
      {
        name: 'Node.js',
        command: 'node --version',
        required: true
      },
      {
        name: 'curl',
        command: 'curl --version',
        required: false
      }
    ];

    for (const check of checks) {
      try {
        const result = await execAsync(check.command);
        const version = result.stdout.trim().split('\n')[0];
        console.log(`  ✅ ${check.name}: ${version}`);
      } catch (error) {
        const status = check.required ? '❌' : '⚠️';
        console.log(`  ${status} ${check.name}: Not available`);
        if (check.required) {
          throw new Error(`Required prerequisite missing: ${check.name}`);
        }
      }
    }
  }

  async runTest(test) {
    console.log(`\n🧪 Running ${test.name}...`);
    console.log('─'.repeat(60));

    const startTime = Date.now();
    let success = false;
    let output = '';
    let error = null;

    try {
      const result = await execAsync(`node ${test.script}`, {
        cwd: process.cwd(),
        timeout: 300000, // 5 minute timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      output = result.stdout;
      success = true;
      console.log(output);

    } catch (err) {
      error = err.message;
      output = err.stdout || '';
      console.error(`❌ Test failed: ${error}`);
      if (err.stdout) {
        console.log('Partial output:', err.stdout);
      }
    }

    const duration = Date.now() - startTime;
    const testResult = {
      name: test.name,
      script: test.script,
      success,
      duration,
      output,
      error,
      timestamp: new Date().toISOString()
    };

    this.results.testRuns.push(testResult);

    console.log(`\n${success ? '✅' : '❌'} ${test.name} completed in ${(duration / 1000).toFixed(1)}s`);

    // Try to copy generated reports
    await this.collectTestArtifacts(test, testResult);
  }

  async collectTestArtifacts(test, testResult) {
    const artifacts = [
      'COMPREHENSIVE_PERFORMANCE_REPORT.md',
      'performance-test-results.json',
      'performance-monitoring-report.json'
    ];

    for (const artifact of artifacts) {
      try {
        const source = path.join(process.cwd(), artifact);
        const destination = path.join(config.reporting.outputDir, `${test.script.replace('.js', '')}_${artifact}`);
        
        await fs.copyFile(source, destination);
        console.log(`  📄 Collected: ${artifact}`);
      } catch (error) {
        // Artifact doesn't exist or can't be copied - not critical
      }
    }
  }

  async generateUnifiedReport() {
    console.log('\n📊 Generating Unified Performance Report...');

    // Calculate summary statistics
    this.calculateSummary();

    // Generate recommendations
    this.generateRecommendations();

    // Create unified markdown report
    const report = this.createMarkdownReport();

    // Write report
    const reportPath = path.join(config.reporting.outputDir, config.reporting.unifiedReport);
    await fs.writeFile(reportPath, report);

    // Write JSON data
    const jsonPath = path.join(config.reporting.outputDir, 'unified-performance-results.json');
    await fs.writeFile(jsonPath, JSON.stringify(this.results, null, 2));

    console.log('  ✅ Unified report generated');
  }

  calculateSummary() {
    const totalTests = this.results.testRuns.length;
    const successfulTests = this.results.testRuns.filter(t => t.success).length;
    const totalDuration = this.results.testRuns.reduce((sum, t) => sum + t.duration, 0);

    this.results.summary = {
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      successRate: (successfulTests / totalTests) * 100,
      totalDuration,
      averageDuration: totalDuration / totalTests
    };
  }

  generateRecommendations() {
    const failedTests = this.results.testRuns.filter(t => !t.success);
    
    if (failedTests.length > 0) {
      this.results.recommendations.push(
        '🔴 CRITICAL: Some performance tests failed - review test outputs for specific issues'
      );
    }

    // Parse outputs for specific recommendations
    this.results.testRuns.forEach(test => {
      if (test.output.includes('Database connection') && test.output.includes('failed')) {
        this.results.recommendations.push(
          '🗄️ DATABASE: Verify database service is running and credentials are correct'
        );
      }

      if (test.output.includes('WebSocket') && test.output.includes('connections')) {
        this.results.recommendations.push(
          '🔌 WEBSOCKET: Review WebSocket service configuration and capacity limits'
        );
      }

      if (test.output.includes('Memory') && test.output.includes('exceeds')) {
        this.results.recommendations.push(
          '💾 MEMORY: Monitor memory usage and implement optimization strategies'
        );
      }
    });

    // General recommendations
    this.results.recommendations.push(
      '📊 MONITORING: Implement continuous performance monitoring',
      '🔄 AUTOMATION: Add performance regression testing to CI/CD pipeline',
      '📈 OPTIMIZATION: Regular performance reviews and optimization cycles',
      '🚀 SCALING: Plan for horizontal scaling based on performance requirements'
    );
  }

  createMarkdownReport() {
    return `# Enhanced Visualization Service - Unified Performance Report

## Executive Summary

**Report Generated:** ${this.results.timestamp}
**Total Tests:** ${this.results.summary.totalTests}
**Success Rate:** ${this.results.summary.successRate.toFixed(1)}%
**Total Duration:** ${(this.results.summary.totalDuration / 1000).toFixed(1)}s

## Test Results Overview

| Test Name | Status | Duration | Description |
|-----------|--------|----------|-------------|
${this.results.testRuns.map(test => 
  `| ${test.name} | ${test.success ? '✅ PASS' : '❌ FAIL'} | ${(test.duration / 1000).toFixed(1)}s | ${config.tests.find(t => t.script === test.script)?.description || 'N/A'} |`
).join('\n')}

## Detailed Test Results

${this.results.testRuns.map(test => `
### ${test.name}

**Status:** ${test.success ? '✅ PASSED' : '❌ FAILED'}
**Duration:** ${(test.duration / 1000).toFixed(1)}s
**Timestamp:** ${test.timestamp}

${test.error ? `**Error:** ${test.error}\n` : ''}

**Output:**
\`\`\`
${test.output.substring(0, 2000)}${test.output.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`).join('\n')}

## Performance Recommendations

${this.results.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

## Summary Statistics

- **Tests Executed:** ${this.results.summary.totalTests}
- **Successful Tests:** ${this.results.summary.successfulTests}
- **Failed Tests:** ${this.results.summary.failedTests}
- **Average Test Duration:** ${(this.results.summary.averageDuration / 1000).toFixed(1)}s

## Next Steps

1. **Address Failed Tests:** Review and fix any failed test scenarios
2. **Performance Optimization:** Implement recommendations from individual test reports
3. **Monitoring Setup:** Deploy continuous performance monitoring
4. **Regression Testing:** Add performance tests to CI/CD pipeline
5. **Capacity Planning:** Use results for infrastructure sizing and scaling decisions

---

*Report generated by Enhanced Visualization Service Performance Test Coordinator*
*Generated at: ${this.results.timestamp}*
`;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received interrupt signal, stopping tests...');
  process.exit(1);
});

// Run the coordinator
const coordinator = new PerformanceTestCoordinator();
coordinator.run().catch(console.error);
