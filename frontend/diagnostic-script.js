#!/usr/bin/env node

/**
 * SongNodes System Diagnostic Script
 *
 * Tests fundamental functionality to identify where the system is failing:
 * 1. Frontend loading at localhost:3006
 * 2. React application mounting
 * 3. API connectivity (localhost:8088 and localhost:8084)
 * 4. Graph data loading
 * 5. PIXI canvas initialization
 * 6. WebGL context creation
 *
 * Usage: node diagnostic-script.js
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// Use Node.js built-in fetch (Node 18+) or polyfill
const fetch = globalThis.fetch;

const TIMEOUTS = {
  PAGE_LOAD: 10000,      // 10 seconds for page load
  API_REQUEST: 5000,     // 5 seconds for API requests
  ELEMENT_WAIT: 3000,    // 3 seconds for element appearance
  NAVIGATION: 15000      // 15 seconds for navigation
};

const URLS = {
  frontend: 'http://localhost:3006',
  apiGateway: 'http://localhost:8088',
  graphApi: 'http://localhost:8088' // Now proxied through API Gateway
};

class DiagnosticResults {
  constructor() {
    this.results = [];
    this.screenshots = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  addResult(test, status, message, details = null) {
    const result = {
      test,
      status, // 'PASS', 'FAIL', 'SKIP', 'WARN'
      message,
      details,
      timestamp: Date.now() - this.startTime
    };

    this.results.push(result);

    // Color output for console
    const colors = {
      'PASS': '\x1b[32m', // Green
      'FAIL': '\x1b[31m', // Red
      'SKIP': '\x1b[33m', // Yellow
      'WARN': '\x1b[93m'  // Bright Yellow
    };

    const reset = '\x1b[0m';
    const color = colors[status] || '';

    console.log(`${color}[${status.padEnd(4)}]${reset} ${test}: ${message}`);

    if (details) {
      console.log(`       Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  addScreenshot(filename, description) {
    this.screenshots.push({ filename, description, timestamp: Date.now() - this.startTime });
  }

  addError(test, error) {
    this.errors.push({ test, error: error.message, stack: error.stack, timestamp: Date.now() - this.startTime });
  }

  getSummary() {
    const counts = this.results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalTests: this.results.length,
      counts,
      duration: Date.now() - this.startTime,
      results: this.results,
      screenshots: this.screenshots,
      errors: this.errors
    };
  }
}

class SystemDiagnostic {
  constructor() {
    this.results = new DiagnosticResults();
    this.browser = null;
    this.page = null;
  }

  async run() {
    console.log('🔧 Starting SongNodes System Diagnostic...\n');

    try {
      // Step 1: Test API connectivity (before browser tests)
      await this.testApiConnectivity();

      // Step 2: Initialize browser
      await this.initializeBrowser();

      // Step 3: Test frontend loading
      await this.testFrontendLoading();

      // Step 4: Test React mounting
      await this.testReactMounting();

      // Step 5: Test API data loading
      await this.testApiDataLoading();

      // Step 6: Test graph component rendering
      await this.testGraphComponentRendering();

      // Step 7: Test PIXI canvas initialization
      await this.testPixiInitialization();

      // Step 8: Test WebGL context
      await this.testWebGLContext();

      // Step 9: Performance check
      await this.testPerformanceMetrics();

    } catch (error) {
      this.results.addResult('SYSTEM', 'FAIL', 'Critical system error', error.message);
      this.results.addError('SYSTEM', error);
    } finally {
      await this.cleanup();
      await this.generateReport();
    }
  }

  async testApiConnectivity() {
    console.log('\n📡 Testing API Connectivity...');

    // Test API Gateway Health
    try {
      const response = await fetch(`${URLS.apiGateway}/health`, {
        timeout: TIMEOUTS.API_REQUEST,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        this.results.addResult('API_GATEWAY_HEALTH', 'PASS', 'API Gateway is responding', data);
      } else {
        this.results.addResult('API_GATEWAY_HEALTH', 'FAIL', `API Gateway returned ${response.status}`);
      }
    } catch (error) {
      this.results.addResult('API_GATEWAY_HEALTH', 'FAIL', 'API Gateway unreachable', error.message);
    }

    // Test Graph API Health
    try {
      const response = await fetch(`${URLS.graphApi}/health`, {
        timeout: TIMEOUTS.API_REQUEST,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        this.results.addResult('GRAPH_API_HEALTH', 'PASS', 'Graph API is responding', data);
      } else {
        this.results.addResult('GRAPH_API_HEALTH', 'FAIL', `Graph API returned ${response.status}`);
      }
    } catch (error) {
      this.results.addResult('GRAPH_API_HEALTH', 'FAIL', 'Graph API unreachable', error.message);
    }

    // Test Graph Data Endpoints (now proxied through API Gateway)
    try {
      const nodesResponse = await fetch(`${URLS.graphApi}/api/graph/nodes`, {
        timeout: TIMEOUTS.API_REQUEST,
        headers: { 'Accept': 'application/json' }
      });

      if (nodesResponse.ok) {
        const data = await nodesResponse.json();
        this.results.addResult('GRAPH_NODES_ENDPOINT', 'PASS', `Graph nodes endpoint working, found ${data.nodes?.length || 0} nodes`, { nodeCount: data.nodes?.length || 0 });
      } else {
        this.results.addResult('GRAPH_NODES_ENDPOINT', 'FAIL', `Graph nodes returned ${nodesResponse.status}`);
      }
    } catch (error) {
      this.results.addResult('GRAPH_NODES_ENDPOINT', 'FAIL', 'Graph nodes endpoint failed', error.message);
    }

    try {
      const edgesResponse = await fetch(`${URLS.graphApi}/api/graph/edges`, {
        timeout: TIMEOUTS.API_REQUEST,
        headers: { 'Accept': 'application/json' }
      });

      if (edgesResponse.ok) {
        const data = await edgesResponse.json();
        this.results.addResult('GRAPH_EDGES_ENDPOINT', 'PASS', `Graph edges endpoint working, found ${data.edges?.length || 0} edges`, { edgeCount: data.edges?.length || 0 });
      } else {
        this.results.addResult('GRAPH_EDGES_ENDPOINT', 'FAIL', `Graph edges returned ${edgesResponse.status}`);
      }
    } catch (error) {
      this.results.addResult('GRAPH_EDGES_ENDPOINT', 'FAIL', 'Graph edges endpoint failed', error.message);
    }
  }

  async initializeBrowser() {
    console.log('\n🌐 Initializing Browser...');

    try {
      this.browser = await chromium.launch({
        headless: false, // Show browser for debugging
        devtools: true,
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      this.page = await this.browser.newPage();

      // Setup console logging
      this.page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
          console.log(`❌ Console Error: ${text}`);
        } else if (type === 'warning') {
          console.log(`⚠️  Console Warning: ${text}`);
        } else {
          console.log(`💬 Console Log: ${text}`);
        }
      });

      // Capture page errors
      this.page.on('pageerror', error => {
        console.log(`💥 Page Error: ${error.message}`);
        this.results.addError('PAGE_ERROR', error);
      });

      this.results.addResult('BROWSER_INIT', 'PASS', 'Browser initialized successfully');

    } catch (error) {
      this.results.addResult('BROWSER_INIT', 'FAIL', 'Failed to initialize browser', error.message);
      throw error;
    }
  }

  async testFrontendLoading() {
    console.log('\n🌍 Testing Frontend Loading...');

    try {
      console.log(`Navigating to ${URLS.frontend}...`);

      const response = await this.page.goto(URLS.frontend, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUTS.PAGE_LOAD
      });

      await this.takeScreenshot('01-frontend-load.png', 'Initial frontend load');

      if (response && response.ok()) {
        this.results.addResult('FRONTEND_LOAD', 'PASS', 'Frontend loaded successfully', {
          url: response.url(),
          status: response.status()
        });
      } else {
        this.results.addResult('FRONTEND_LOAD', 'FAIL', 'Frontend failed to load', {
          status: response?.status() || 'No response'
        });
        return false;
      }

      // Wait a bit for initial rendering
      await this.page.waitForTimeout(2000);
      await this.takeScreenshot('02-after-initial-wait.png', 'After initial wait');

      return true;

    } catch (error) {
      this.results.addResult('FRONTEND_LOAD', 'FAIL', 'Frontend loading failed', error.message);
      await this.takeScreenshot('01-frontend-load-error.png', 'Frontend load error');
      return false;
    }
  }

  async testReactMounting() {
    console.log('\n⚛️ Testing React Application Mounting...');

    try {
      // Check for React root element
      const reactRoot = await this.page.locator('#root').first();
      await reactRoot.waitFor({ timeout: TIMEOUTS.ELEMENT_WAIT });

      this.results.addResult('REACT_ROOT', 'PASS', 'React root element found');

      // Check for App component mounting by looking for the main app container
      try {
        const appContainer = await this.page.locator('.app-container').first();
        await appContainer.waitFor({ timeout: TIMEOUTS.ELEMENT_WAIT });

        this.results.addResult('REACT_APP_MOUNT', 'PASS', 'React App component mounted successfully');

        // Check for header element
        const header = await this.page.locator('.app-header').first();
        if (await header.count() > 0) {
          const headerText = await header.textContent();
          this.results.addResult('REACT_HEADER', 'PASS', 'App header rendered', { text: headerText });
        } else {
          this.results.addResult('REACT_HEADER', 'WARN', 'App header not found');
        }

        await this.takeScreenshot('03-react-mounted.png', 'React app mounted');
        return true;

      } catch (error) {
        this.results.addResult('REACT_APP_MOUNT', 'FAIL', 'App container not found', error.message);
        return false;
      }

    } catch (error) {
      this.results.addResult('REACT_ROOT', 'FAIL', 'React root element not found', error.message);
      return false;
    }
  }

  async testApiDataLoading() {
    console.log('\n📊 Testing API Data Loading...');

    try {
      // Wait for any loading indicators to appear/disappear
      await this.page.waitForTimeout(2000);

      // Check for loading state
      const loadingOverlay = this.page.locator('.loading-overlay');
      if (await loadingOverlay.count() > 0) {
        this.results.addResult('API_LOADING_STATE', 'PASS', 'Loading overlay detected - app is trying to load data');

        // Wait for loading to complete (up to 15 seconds)
        try {
          await loadingOverlay.waitFor({ state: 'hidden', timeout: 15000 });
          this.results.addResult('API_LOADING_COMPLETE', 'PASS', 'Loading completed');
        } catch {
          this.results.addResult('API_LOADING_COMPLETE', 'WARN', 'Loading overlay still visible after 15 seconds');
        }
      } else {
        this.results.addResult('API_LOADING_STATE', 'WARN', 'No loading overlay found');
      }

      // Check for error messages
      const errorMessage = this.page.locator('.error, [class*="error"]').first();
      if (await errorMessage.count() > 0) {
        const errorText = await errorMessage.textContent();
        this.results.addResult('API_ERROR_CHECK', 'FAIL', 'Error message found on page', { error: errorText });
      } else {
        this.results.addResult('API_ERROR_CHECK', 'PASS', 'No error messages visible');
      }

      // Check for data indicators in header (track count, connections)
      const header = this.page.locator('.app-header');
      if (await header.count() > 0) {
        const headerText = await header.textContent();
        if (headerText.includes('tracks') && headerText.includes('connections')) {
          this.results.addResult('API_DATA_INDICATORS', 'PASS', 'Data count indicators found in header', { headerText });
        } else {
          this.results.addResult('API_DATA_INDICATORS', 'WARN', 'No data count indicators in header', { headerText });
        }
      }

      await this.takeScreenshot('04-api-data-loaded.png', 'After API data loading attempt');

    } catch (error) {
      this.results.addResult('API_DATA_LOADING', 'FAIL', 'Error testing API data loading', error.message);
    }
  }

  async testGraphComponentRendering() {
    console.log('\n📈 Testing Graph Component Rendering...');

    try {
      // Check for graph canvas container
      const graphContainer = this.page.locator('.app-content, .graph-canvas, [class*="graph"]').first();
      await graphContainer.waitFor({ timeout: TIMEOUTS.ELEMENT_WAIT });

      this.results.addResult('GRAPH_CONTAINER', 'PASS', 'Graph container element found');

      // Check for canvas element (PIXI creates a canvas)
      const canvas = this.page.locator('canvas').first();
      if (await canvas.count() > 0) {
        this.results.addResult('GRAPH_CANVAS', 'PASS', 'Canvas element found');

        // Get canvas dimensions
        const canvasBox = await canvas.boundingBox();
        if (canvasBox && canvasBox.width > 0 && canvasBox.height > 0) {
          this.results.addResult('GRAPH_CANVAS_SIZE', 'PASS', 'Canvas has valid dimensions', {
            width: canvasBox.width,
            height: canvasBox.height
          });
        } else {
          this.results.addResult('GRAPH_CANVAS_SIZE', 'FAIL', 'Canvas has invalid dimensions', canvasBox);
        }
      } else {
        this.results.addResult('GRAPH_CANVAS', 'FAIL', 'No canvas element found');
      }

      // Check for "No graph data" message
      const noDataMessage = this.page.locator('text="No graph data available"').first();
      if (await noDataMessage.count() > 0) {
        this.results.addResult('GRAPH_DATA_CHECK', 'WARN', 'No graph data message visible - data may not be loading');
      } else {
        this.results.addResult('GRAPH_DATA_CHECK', 'PASS', 'No "no data" message visible');
      }

      await this.takeScreenshot('05-graph-component.png', 'Graph component rendering');

    } catch (error) {
      this.results.addResult('GRAPH_COMPONENT', 'FAIL', 'Graph component not found', error.message);
    }
  }

  async testPixiInitialization() {
    console.log('\n🎮 Testing PIXI Canvas Initialization...');

    try {
      // Test PIXI availability in page context
      const pixiAvailable = await this.page.evaluate(() => {
        return typeof window.PIXI !== 'undefined' || typeof PIXI !== 'undefined';
      });

      if (pixiAvailable) {
        this.results.addResult('PIXI_LIBRARY', 'PASS', 'PIXI library is available');
      } else {
        this.results.addResult('PIXI_LIBRARY', 'WARN', 'PIXI library not found in global scope (may be module-scoped)');
      }

      // Check for canvas with PIXI characteristics
      const canvasInfo = await this.page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        return canvases.map(canvas => ({
          width: canvas.width,
          height: canvas.height,
          context: canvas.getContext ? 'available' : 'missing',
          webgl: canvas.getContext('webgl') ? 'available' : 'not available'
        }));
      });

      if (canvasInfo.length > 0) {
        this.results.addResult('PIXI_CANVAS_INFO', 'PASS', 'Canvas information retrieved', canvasInfo);

        // Check if any canvas has WebGL context
        const hasWebGL = canvasInfo.some(info => info.webgl === 'available');
        if (hasWebGL) {
          this.results.addResult('PIXI_WEBGL_CONTEXT', 'PASS', 'WebGL context available on canvas');
        } else {
          this.results.addResult('PIXI_WEBGL_CONTEXT', 'FAIL', 'No WebGL context found on canvases');
        }
      } else {
        this.results.addResult('PIXI_CANVAS_INFO', 'FAIL', 'No canvas elements found');
      }

    } catch (error) {
      this.results.addResult('PIXI_INIT', 'FAIL', 'Error testing PIXI initialization', error.message);
    }
  }

  async testWebGLContext() {
    console.log('\n🎯 Testing WebGL Context...');

    try {
      const webglTest = await this.page.evaluate(() => {
        // Test WebGL availability
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
          return { available: false, error: 'WebGL context not available' };
        }

        // Get WebGL info
        const vendor = gl.getParameter(gl.VENDOR);
        const renderer = gl.getParameter(gl.RENDERER);
        const version = gl.getParameter(gl.VERSION);
        const extensions = gl.getSupportedExtensions();

        return {
          available: true,
          vendor,
          renderer,
          version,
          extensionCount: extensions ? extensions.length : 0,
          extensions: extensions ? extensions.slice(0, 5) : [] // First 5 extensions
        };
      });

      if (webglTest.available) {
        this.results.addResult('WEBGL_CONTEXT', 'PASS', 'WebGL context is available', webglTest);
      } else {
        this.results.addResult('WEBGL_CONTEXT', 'FAIL', 'WebGL context not available', webglTest);
      }

    } catch (error) {
      this.results.addResult('WEBGL_CONTEXT', 'FAIL', 'Error testing WebGL context', error.message);
    }
  }

  async testPerformanceMetrics() {
    console.log('\n⚡ Testing Performance Metrics...');

    try {
      // Wait a moment for any performance monitoring to initialize
      await this.page.waitForTimeout(1000);

      // Check for performance monitor in the UI
      const perfMonitor = this.page.locator('.performance-monitor').first();
      if (await perfMonitor.count() > 0) {
        const perfText = await perfMonitor.textContent();
        this.results.addResult('PERFORMANCE_MONITOR', 'PASS', 'Performance monitor visible', { text: perfText });
      } else {
        this.results.addResult('PERFORMANCE_MONITOR', 'WARN', 'Performance monitor not visible (may be disabled)');
      }

      // Get browser performance metrics
      const performanceMetrics = await this.page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        return {
          loadTime: perf.loadEventEnd - perf.navigationStart,
          domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
          domInteractive: perf.domInteractive - perf.navigationStart,
          memoryUsed: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 'N/A'
        };
      });

      this.results.addResult('BROWSER_PERFORMANCE', 'PASS', 'Browser performance metrics', performanceMetrics);

      await this.takeScreenshot('06-final-state.png', 'Final application state');

    } catch (error) {
      this.results.addResult('PERFORMANCE_METRICS', 'FAIL', 'Error collecting performance metrics', error.message);
    }
  }

  async takeScreenshot(filename, description) {
    try {
      if (this.page) {
        const screenshotPath = path.join(process.cwd(), 'diagnostic-screenshots', filename);
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        this.results.addScreenshot(filename, description);
        console.log(`📸 Screenshot saved: ${filename}`);
      }
    } catch (error) {
      console.log(`❌ Failed to take screenshot ${filename}: ${error.message}`);
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    if (this.browser) {
      await this.browser.close();
    }
  }

  async generateReport() {
    console.log('\n📋 Generating Diagnostic Report...');

    const summary = this.results.getSummary();

    // Console summary
    console.log('\n' + '='.repeat(60));
    console.log('🔧 SONGNODES SYSTEM DIAGNOSTIC REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Duration: ${Math.round(summary.duration / 1000)}s`);
    console.log('');
    console.log('Results:');
    Object.entries(summary.counts).forEach(([status, count]) => {
      const colors = {
        'PASS': '\x1b[32m', // Green
        'FAIL': '\x1b[31m', // Red
        'SKIP': '\x1b[33m', // Yellow
        'WARN': '\x1b[93m'  // Bright Yellow
      };
      const color = colors[status] || '';
      const reset = '\x1b[0m';
      console.log(`  ${color}${status}${reset}: ${count}`);
    });

    console.log('');
    console.log('Screenshots:', summary.screenshots.length);
    console.log('Errors:', summary.errors.length);

    // Identify likely issues
    console.log('\n🔍 LIKELY ISSUES:');
    const failedTests = summary.results.filter(r => r.status === 'FAIL');
    if (failedTests.length === 0) {
      console.log('✅ No critical failures detected');
    } else {
      failedTests.forEach(test => {
        console.log(`❌ ${test.test}: ${test.message}`);
      });
    }

    const warnings = summary.results.filter(r => r.status === 'WARN');
    if (warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      warnings.forEach(test => {
        console.log(`⚠️  ${test.test}: ${test.message}`);
      });
    }

    // Save detailed JSON report
    const reportPath = path.join(process.cwd(), 'diagnostic-report.json');
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    console.log(`📁 Screenshots saved to: diagnostic-screenshots/`);

    console.log('\n' + '='.repeat(60));

    // Return exit code based on results
    const hasCriticalFailures = failedTests.some(test =>
      ['FRONTEND_LOAD', 'REACT_APP_MOUNT', 'API_GATEWAY_HEALTH', 'GRAPH_API_HEALTH'].includes(test.test)
    );

    if (hasCriticalFailures) {
      console.log('❌ CRITICAL FAILURES DETECTED - System is not functional');
      process.exit(1);
    } else if (failedTests.length > 0) {
      console.log('⚠️  NON-CRITICAL FAILURES DETECTED - System may have issues');
      process.exit(2);
    } else {
      console.log('✅ ALL TESTS PASSED - System appears functional');
      process.exit(0);
    }
  }
}

// Run the diagnostic
const diagnostic = new SystemDiagnostic();
diagnostic.run().catch(error => {
  console.error('💥 Fatal error running diagnostic:', error);
  process.exit(3);
});
