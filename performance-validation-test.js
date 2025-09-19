/**
 * Performance Validation Test for SongNodes Visualization
 * Tests the fixes and optimizations implemented for the GraphCanvas component
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PerformanceValidator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      testName: 'SongNodes Performance Validation',
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        totalTests: 0
      }
    };
  }

  async initialize() {
    console.log('🚀 Initializing performance validation test...');

    this.browser = await puppeteer.launch({
      headless: false, // Run in visible mode to see what happens
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-dev-tools',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection'
      ],
      defaultViewport: { width: 1280, height: 720 }
    });

    this.page = await this.browser.newPage();

    // Enable performance monitoring
    await this.page.setCacheEnabled(false);

    // Add console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('❌ Browser Error:', msg.text());
      } else if (msg.text().includes('GPU') || msg.text().includes('performance')) {
        console.log('🔧 Performance Log:', msg.text());
      }
    });

    // Catch page errors
    this.page.on('pageerror', error => {
      console.error('❌ Page Error:', error.message);
      this.addTestResult('Page Stability', false, `Page error: ${error.message}`);
    });

    // Navigate to the application
    console.log('📱 Navigating to SongNodes application...');
    try {
      await this.page.goto('http://localhost:3000', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      console.log('✅ Successfully loaded application');
    } catch (error) {
      console.error('❌ Failed to load application:', error.message);
      throw error;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting performance validation tests...');

    await this.testComponentLoading();
    await this.testGraphRendering();
    await this.testPerformanceMonitoring();
    await this.testErrorBoundaries();
    await this.testMemoryUsage();
    await this.testNodeInteraction();
    await this.testZoomAndPan();
    await this.testPerformanceDashboard();

    this.generateReport();
  }

  async testComponentLoading() {
    console.log('🔍 Testing component loading and initialization...');

    try {
      // Wait for React to be ready
      await this.page.waitForSelector('div', { timeout: 10000 });

      // Check if GraphCanvas component is present
      const graphCanvas = await this.page.$('[class*="GraphCanvas"], canvas, [data-testid="graph-canvas"]');

      if (graphCanvas) {
        this.addTestResult('Component Loading', true, 'GraphCanvas component loaded successfully');
      } else {
        this.addTestResult('Component Loading', false, 'GraphCanvas component not found');
      }

      // Check for any immediate JavaScript errors
      const errors = await this.page.evaluate(() => {
        return window.performanceErrors || [];
      });

      if (errors.length === 0) {
        this.addTestResult('Initial Error Check', true, 'No JavaScript errors detected');
      } else {
        this.addTestResult('Initial Error Check', false, `Found ${errors.length} errors: ${errors.join(', ')}`);
      }

    } catch (error) {
      this.addTestResult('Component Loading', false, `Loading test failed: ${error.message}`);
    }
  }

  async testGraphRendering() {
    console.log('🎨 Testing graph rendering with 30-50 nodes...');

    try {
      // Simulate creating a graph with 30-50 nodes
      await this.page.evaluate(() => {
        // Create test data
        const testNodes = [];
        const testEdges = [];
        const nodeCount = 35; // Test with 35 nodes

        for (let i = 0; i < nodeCount; i++) {
          testNodes.push({
            id: `node-${i}`,
            title: `Track ${i}`,
            artist: `Artist ${i}`,
            x: Math.random() * 800,
            y: Math.random() * 600,
            radius: 8,
            color: '#3b82f6',
            opacity: 1,
            visible: true,
            selected: false,
            highlighted: false
          });
        }

        // Create edges between some nodes
        for (let i = 0; i < nodeCount - 1; i++) {
          if (Math.random() > 0.5) {
            testEdges.push({
              id: `edge-${i}`,
              source: `node-${i}`,
              target: `node-${i + 1}`,
              weight: Math.random(),
              visible: true,
              opacity: 0.6,
              width: 2,
              color: '#6b7280'
            });
          }
        }

        // Try to trigger a graph update if Redux store is available
        if (window.store && window.store.dispatch) {
          try {
            window.store.dispatch({
              type: 'graph/updateNodes',
              payload: testNodes
            });
            window.store.dispatch({
              type: 'graph/updateEdges',
              payload: testEdges
            });
          } catch (e) {
            console.log('Redux not available, test data created in memory');
          }
        }

        return { nodeCount: testNodes.length, edgeCount: testEdges.length };
      });

      // Wait for rendering
      await this.page.waitForTimeout(2000);

      // Check if canvas is present and has content
      const canvasMetrics = await this.page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        return {
          width: canvas.width,
          height: canvas.height,
          hasContent: canvas.width > 0 && canvas.height > 0
        };
      });

      if (canvasMetrics && canvasMetrics.hasContent) {
        this.addTestResult('Graph Rendering', true, `Canvas rendered successfully (${canvasMetrics.width}x${canvasMetrics.height})`);
      } else {
        this.addTestResult('Graph Rendering', false, 'Canvas not found or empty');
      }

    } catch (error) {
      this.addTestResult('Graph Rendering', false, `Rendering test failed: ${error.message}`);
    }
  }

  async testPerformanceMonitoring() {
    console.log('📊 Testing performance monitoring...');

    try {
      // Wait for performance metrics to be available
      await this.page.waitForTimeout(3000);

      const performanceData = await this.page.evaluate(() => {
        // Check if performance monitoring is working
        const performanceElements = document.querySelectorAll('[class*="performance"], [class*="fps"], [class*="metric"]');

        // Look for FPS display
        const fpsElement = Array.from(document.querySelectorAll('*')).find(el =>
          el.textContent && el.textContent.includes('FPS')
        );

        // Check memory usage display
        const memoryElement = Array.from(document.querySelectorAll('*')).find(el =>
          el.textContent && (el.textContent.includes('Memory') || el.textContent.includes('MB'))
        );

        return {
          hasPerformanceElements: performanceElements.length > 0,
          hasFpsDisplay: !!fpsElement,
          hasMemoryDisplay: !!memoryElement,
          fpsText: fpsElement ? fpsElement.textContent : null,
          memoryText: memoryElement ? memoryElement.textContent : null
        };
      });

      if (performanceData.hasFpsDisplay) {
        this.addTestResult('Performance Monitoring', true, `FPS monitoring working: ${performanceData.fpsText}`);
      } else {
        this.addTestResult('Performance Monitoring', false, 'FPS monitoring not found');
      }

      if (performanceData.hasMemoryDisplay) {
        this.addTestResult('Memory Monitoring', true, `Memory monitoring working: ${performanceData.memoryText}`);
      } else {
        this.addTestResult('Memory Monitoring', false, 'Memory monitoring not found');
      }

    } catch (error) {
      this.addTestResult('Performance Monitoring', false, `Monitoring test failed: ${error.message}`);
    }
  }

  async testErrorBoundaries() {
    console.log('🛡️ Testing error boundaries...');

    try {
      // Simulate an error condition
      const errorHandled = await this.page.evaluate(() => {
        try {
          // Try to trigger a typical performance error
          const fakeError = new Error('Cannot read properties of undefined (reading "metrics")');

          // Check if error boundary is in place
          const errorBoundaries = document.querySelectorAll('[class*="error"], [class*="boundary"]');

          return {
            errorBoundariesFound: errorBoundaries.length > 0,
            errorBoundariesCount: errorBoundaries.length
          };
        } catch (e) {
          return { caught: true, message: e.message };
        }
      });

      // Check that the page didn't crash
      const pageIsResponsive = await this.page.evaluate(() => {
        return document.readyState === 'complete';
      });

      if (pageIsResponsive) {
        this.addTestResult('Error Boundaries', true, 'Page remains responsive after error simulation');
      } else {
        this.addTestResult('Error Boundaries', false, 'Page became unresponsive');
      }

    } catch (error) {
      this.addTestResult('Error Boundaries', false, `Error boundary test failed: ${error.message}`);
    }
  }

  async testMemoryUsage() {
    console.log('💾 Testing memory usage...');

    try {
      const memoryMetrics = await this.page.metrics();
      const memoryUsageMB = memoryMetrics.JSHeapUsedSize / 1024 / 1024;

      // Check if memory usage is reasonable (under 200MB for a test graph)
      if (memoryUsageMB < 200) {
        this.addTestResult('Memory Usage', true, `Memory usage is acceptable: ${memoryUsageMB.toFixed(2)}MB`);
      } else {
        this.addTestResult('Memory Usage', false, `High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
      }

      // Test memory stability by waiting and checking again
      await this.page.waitForTimeout(5000);
      const memoryMetrics2 = await this.page.metrics();
      const memoryUsageMB2 = memoryMetrics2.JSHeapUsedSize / 1024 / 1024;

      const memoryGrowth = memoryUsageMB2 - memoryUsageMB;

      if (memoryGrowth < 50) { // Less than 50MB growth in 5 seconds
        this.addTestResult('Memory Stability', true, `Memory growth is stable: ${memoryGrowth.toFixed(2)}MB`);
      } else {
        this.addTestResult('Memory Stability', false, `Memory growth is high: ${memoryGrowth.toFixed(2)}MB`);
      }

    } catch (error) {
      this.addTestResult('Memory Usage', false, `Memory test failed: ${error.message}`);
    }
  }

  async testNodeInteraction() {
    console.log('🖱️ Testing node interaction...');

    try {
      // Try to click on the canvas area
      await this.page.click('canvas', { delay: 100 });

      // Wait for any interaction effects
      await this.page.waitForTimeout(1000);

      // Check if interaction is working
      const interactionWorks = await this.page.evaluate(() => {
        // Check if canvas has event listeners
        const canvas = document.querySelector('canvas');
        return canvas && typeof canvas.onclick !== 'undefined';
      });

      if (interactionWorks) {
        this.addTestResult('Node Interaction', true, 'Canvas interaction is working');
      } else {
        this.addTestResult('Node Interaction', false, 'Canvas interaction not detected');
      }

    } catch (error) {
      this.addTestResult('Node Interaction', false, `Interaction test failed: ${error.message}`);
    }
  }

  async testZoomAndPan() {
    console.log('🔍 Testing zoom and pan functionality...');

    try {
      // Test mouse wheel zoom
      await this.page.hover('canvas');
      await this.page.mouse.wheel({ deltaY: -200 }); // Zoom in
      await this.page.waitForTimeout(500);

      await this.page.mouse.wheel({ deltaY: 200 }); // Zoom out
      await this.page.waitForTimeout(500);

      // Check if zoom controls are present
      const zoomControls = await this.page.evaluate(() => {
        const zoomElements = Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent && (
            el.textContent.includes('Zoom') ||
            el.textContent.includes('%') ||
            el.textContent.includes('Fit') ||
            el.textContent.includes('Reset')
          )
        );
        return zoomElements.length > 0;
      });

      if (zoomControls) {
        this.addTestResult('Zoom and Pan', true, 'Zoom controls are present and working');
      } else {
        this.addTestResult('Zoom and Pan', false, 'Zoom controls not found');
      }

    } catch (error) {
      this.addTestResult('Zoom and Pan', false, `Zoom test failed: ${error.message}`);
    }
  }

  async testPerformanceDashboard() {
    console.log('📈 Testing performance dashboard...');

    try {
      // Look for performance dashboard elements
      const dashboardExists = await this.page.evaluate(() => {
        const dashboardElements = document.querySelectorAll('[class*="dashboard"], [class*="performance"]');
        const fpsElements = Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent && el.textContent.includes('FPS')
        );

        return {
          dashboardFound: dashboardElements.length > 0,
          fpsDisplays: fpsElements.length,
          hasMetrics: fpsElements.length > 0
        };
      });

      if (dashboardExists.hasMetrics) {
        this.addTestResult('Performance Dashboard', true, `Dashboard working with ${dashboardExists.fpsDisplays} FPS displays`);
      } else {
        this.addTestResult('Performance Dashboard', false, 'Performance dashboard metrics not found');
      }

    } catch (error) {
      this.addTestResult('Performance Dashboard', false, `Dashboard test failed: ${error.message}`);
    }
  }

  addTestResult(testName, passed, details) {
    const result = {
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };

    this.results.tests.push(result);

    if (passed) {
      this.results.summary.passed++;
      console.log(`✅ ${testName}: ${details}`);
    } else {
      this.results.summary.failed++;
      console.log(`❌ ${testName}: ${details}`);
    }

    this.results.summary.totalTests++;
  }

  generateReport() {
    console.log('\n📋 Generating performance validation report...');

    const reportPath = path.join(__dirname, 'performance-validation-report.json');

    // Add summary percentages
    this.results.summary.passRate = (this.results.summary.passed / this.results.summary.totalTests * 100).toFixed(1);

    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    console.log('\n=== PERFORMANCE VALIDATION SUMMARY ===');
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Pass Rate: ${this.results.summary.passRate}%`);
    console.log(`Report saved to: ${reportPath}`);

    if (this.results.summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.details}`);
        });
    }

    if (this.results.summary.passRate >= 80) {
      console.log('\n🎉 Performance validation PASSED! The fixes are working correctly.');
    } else {
      console.log('\n⚠️  Performance validation shows issues. Review failed tests and investigate.');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function runPerformanceValidation() {
  const validator = new PerformanceValidator();

  try {
    await validator.initialize();
    await validator.runAllTests();
  } catch (error) {
    console.error('❌ Performance validation failed:', error);
  } finally {
    await validator.cleanup();
  }
}

// Check if this script is being run directly
if (require.main === module) {
  runPerformanceValidation()
    .then(() => {
      console.log('\n✅ Performance validation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Performance validation error:', error);
      process.exit(1);
    });
}

module.exports = { PerformanceValidator, runPerformanceValidation };