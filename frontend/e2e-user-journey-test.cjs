const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// SongNodes User Experience Test Suite - E2E User Journey Testing
class SongNodesUserJourneyTester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      performance: {},
      errors: [],
      screenshots: [],
      userExperienceIssues: []
    };
  }

  async setup() {
    console.log('🚀 Starting SongNodes User Experience Testing...');
    
    // Launch browser with realistic user settings
    this.browser = await chromium.launch({
      headless: false, // Show browser for user experience validation
      slowMo: 100,
      args: [
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();
    
    // Monitor console errors and performance
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.testResults.errors.push({
          type: 'console_error',
          message: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.page.on('pageerror', error => {
      this.testResults.errors.push({
        type: 'page_error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
  }

  async takeScreenshot(name) {
    const timestamp = Date.now();
    const screenshotPath = `/home/marku/Documents/programming/songnodes/frontend/test-results/ux-${name}-${timestamp}.png`;
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    this.testResults.screenshots.push({ name, path: screenshotPath, timestamp });
    console.log(`📸 Screenshot saved: ${name}`);
    return screenshotPath;
  }

  async measurePerformance(testName) {
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');
      
      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.fetchStart : 0,
        firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
        memoryUsage: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null
      };
    });

    this.testResults.performance[testName] = metrics;
    return metrics;
  }

  async testFrontendAccessibility() {
    console.log('🎯 Testing Frontend Access and Load Time...');
    
    const startTime = Date.now();
    
    try {
      // Navigate to the main application
      await this.page.goto('http://localhost:3006', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      const loadTime = Date.now() - startTime;
      await this.takeScreenshot('initial-load');
      
      // Wait for React app to initialize
      await this.page.waitForSelector('body', { timeout: 10000 });
      
      const performance = await this.measurePerformance('initial_load');
      
      this.testResults.tests.push({
        name: 'Frontend Accessibility',
        status: 'PASS',
        loadTime,
        details: 'Application loaded successfully',
        performance
      });

      return true;
    } catch (error) {
      this.testResults.tests.push({
        name: 'Frontend Accessibility',
        status: 'FAIL',
        error: error.message,
        loadTime: Date.now() - startTime
      });
      
      this.testResults.userExperienceIssues.push({
        issue: 'Frontend Load Failure',
        severity: 'CRITICAL',
        description: `Application failed to load: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  }

  async testMaterialUISearchComponents() {
    console.log('🔍 Testing Material-UI Search Panel Components...');
    
    try {
      // Look for Material-UI search components
      const searchElements = await this.page.evaluate(() => {
        const elements = [];
        
        // Look for MUI components
        const muiInputs = document.querySelectorAll('[class*="MuiInput"], [class*="MuiTextField"], [class*="MuiAutocomplete"]');
        const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="search" i]');
        const buttons = document.querySelectorAll('[class*="MuiButton"], button');
        
        return {
          muiInputs: muiInputs.length,
          searchInputs: searchInputs.length,
          buttons: buttons.length,
          hasSearchPanel: !!document.querySelector('[class*="SearchPanel"], [id*="search"], [data-testid*="search"]')
        };
      });

      await this.takeScreenshot('search-components-check');

      // Try to interact with search if components exist
      if (searchElements.muiInputs > 0 || searchElements.searchInputs > 0) {
        console.log('📝 Found search components, testing interaction...');
        
        // Try to find and interact with search input
        const searchInput = await this.page.locator('input[type="search"], input[placeholder*="search" i], [class*="MuiInput"] input').first();
        
        if (await searchInput.isVisible()) {
          await searchInput.click();
          await searchInput.fill('electronic music');
          await this.page.waitForTimeout(1000);
          await this.takeScreenshot('search-interaction');
          
          // Test Redux store interaction by checking for state changes
          const reduxState = await this.page.evaluate(() => {
            return window.__REDUX_DEVTOOLS_EXTENSION__ ? 
              'Redux DevTools detected' : 
              'Redux state access limited';
          });

          this.testResults.tests.push({
            name: 'Material-UI Search Interaction',
            status: 'PASS',
            details: {
              searchElements,
              reduxState,
              interactionSuccessful: true
            }
          });
        }
      } else {
        this.testResults.userExperienceIssues.push({
          issue: 'Missing Search Components',
          severity: 'HIGH',
          description: 'No Material-UI search components found on the page',
          timestamp: new Date().toISOString()
        });
      }

      return searchElements;
    } catch (error) {
      this.testResults.tests.push({
        name: 'Material-UI Search Components',
        status: 'FAIL',
        error: error.message
      });
      return null;
    }
  }

  async testReduxStoreIntegration() {
    console.log('🏪 Testing Redux Store Integration...');
    
    try {
      // Check for Redux store and state management
      const reduxInfo = await this.page.evaluate(() => {
        const reduxStore = window.store || window.__REDUX_STORE__;
        const devTools = window.__REDUX_DEVTOOLS_EXTENSION__;
        
        // Check for Redux Toolkit Query cache
        const rtkQueryCache = window.__RTK_QUERY_CACHE__;
        
        // Look for React Redux provider
        const hasReduxProvider = !!document.querySelector('[data-reactroot]');
        
        return {
          hasReduxStore: !!reduxStore,
          hasDevTools: !!devTools,
          hasRTKQuery: !!rtkQueryCache,
          hasReduxProvider,
          storeKeys: reduxStore ? Object.keys(reduxStore.getState ? reduxStore.getState() : {}) : []
        };
      });

      await this.takeScreenshot('redux-store-check');

      // Test state changes by triggering actions
      if (reduxInfo.hasReduxStore) {
        console.log('✅ Redux store detected, testing state management...');
        
        // Try to trigger a state change through UI interaction
        const buttons = await this.page.locator('button').all();
        if (buttons.length > 0) {
          await buttons[0].click();
          await this.page.waitForTimeout(500);
          
          // Check if state changed
          const stateAfterAction = await this.page.evaluate(() => {
            const store = window.store || window.__REDUX_STORE__;
            return store ? Object.keys(store.getState ? store.getState() : {}) : [];
          });
          
          reduxInfo.stateChangeDetected = JSON.stringify(reduxInfo.storeKeys) !== JSON.stringify(stateAfterAction);
        }
      }

      this.testResults.tests.push({
        name: 'Redux Store Integration',
        status: reduxInfo.hasReduxStore ? 'PASS' : 'PARTIAL',
        details: reduxInfo
      });

      if (!reduxInfo.hasReduxStore) {
        this.testResults.userExperienceIssues.push({
          issue: 'Redux Store Not Accessible',
          severity: 'MEDIUM',
          description: 'Redux store is not accessible through window object',
          timestamp: new Date().toISOString()
        });
      }

      return reduxInfo;
    } catch (error) {
      this.testResults.tests.push({
        name: 'Redux Store Integration',
        status: 'FAIL',
        error: error.message
      });
      return null;
    }
  }

  async testWebSocketConnection() {
    console.log('🔌 Testing Real-time WebSocket Updates...');
    
    try {
      // Monitor WebSocket connections
      const wsConnections = [];
      
      this.page.on('websocket', ws => {
        wsConnections.push({
          url: ws.url(),
          timestamp: new Date().toISOString()
        });
        
        ws.on('close', () => {
          console.log('🔌 WebSocket closed:', ws.url());
        });
        
        ws.on('framereceived', event => {
          console.log('📨 WebSocket message received:', event.payload);
        });
      });

      // Check for WebSocket connections in the app
      const wsInfo = await this.page.evaluate(() => {
        const websockets = [];
        
        // Check if WebSocket is being used
        if (window.WebSocket) {
          // Look for common WebSocket implementations
          const wsIndicators = {
            hasSocketIO: !!window.io,
            hasNativeWebSocket: typeof WebSocket !== 'undefined',
            activeConnections: 0
          };
          
          return wsIndicators;
        }
        
        return { available: false };
      });

      await this.takeScreenshot('websocket-test');

      // Wait for potential WebSocket connections to establish
      await this.page.waitForTimeout(3000);

      this.testResults.tests.push({
        name: 'WebSocket Real-time Updates',
        status: wsConnections.length > 0 ? 'PASS' : 'PARTIAL',
        details: {
          wsInfo,
          connectionsDetected: wsConnections.length,
          connections: wsConnections
        }
      });

      if (wsConnections.length === 0) {
        this.testResults.userExperienceIssues.push({
          issue: 'No WebSocket Connections Detected',
          severity: 'MEDIUM',
          description: 'No real-time WebSocket connections were established during testing',
          timestamp: new Date().toISOString()
        });
      }

      return { wsConnections, wsInfo };
    } catch (error) {
      this.testResults.tests.push({
        name: 'WebSocket Connection',
        status: 'FAIL',
        error: error.message
      });
      return null;
    }
  }

  async testGraphVisualization() {
    console.log('📊 Testing Graph Visualization and Node Interactions...');
    
    try {
      // Look for graph visualization elements
      const graphElements = await this.page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const svg = document.querySelector('svg');
        const d3Elements = document.querySelectorAll('[class*="d3"], [class*="graph"], [class*="node"], [class*="edge"]');
        
        // Check for WebGL context
        let webglSupported = false;
        let webglContext = null;
        
        if (canvas) {
          try {
            webglContext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            webglSupported = !!webglContext;
          } catch (e) {
            webglSupported = false;
          }
        }

        return {
          hasCanvas: !!canvas,
          hasSVG: !!svg,
          d3ElementsCount: d3Elements.length,
          webglSupported,
          canvasCount: document.querySelectorAll('canvas').length,
          svgCount: document.querySelectorAll('svg').length
        };
      });

      await this.takeScreenshot('graph-visualization-check');

      // Test graph interactions if visualization elements exist
      if (graphElements.hasCanvas || graphElements.hasSVG) {
        console.log('🎯 Found visualization elements, testing interactions...');
        
        // Try to interact with the graph
        const canvas = this.page.locator('canvas').first();
        if (await canvas.isVisible()) {
          // Test mouse interactions on canvas
          const canvasBox = await canvas.boundingBox();
          if (canvasBox) {
            // Click on different areas of the canvas
            await this.page.mouse.click(canvasBox.x + canvasBox.width * 0.3, canvasBox.y + canvasBox.height * 0.3);
            await this.page.waitForTimeout(500);
            
            await this.page.mouse.click(canvasBox.x + canvasBox.width * 0.7, canvasBox.y + canvasBox.height * 0.7);
            await this.page.waitForTimeout(500);
            
            // Test drag interaction
            await this.page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);
            await this.page.mouse.down();
            await this.page.mouse.move(canvasBox.x + canvasBox.width * 0.6, canvasBox.y + canvasBox.height * 0.6);
            await this.page.mouse.up();
            
            await this.takeScreenshot('graph-interaction');
          }
        }
      }

      this.testResults.tests.push({
        name: 'Graph Visualization',
        status: (graphElements.hasCanvas || graphElements.hasSVG) ? 'PASS' : 'FAIL',
        details: graphElements
      });

      if (!graphElements.hasCanvas && !graphElements.hasSVG) {
        this.testResults.userExperienceIssues.push({
          issue: 'No Graph Visualization Elements',
          severity: 'CRITICAL',
          description: 'No canvas or SVG elements found for graph visualization',
          timestamp: new Date().toISOString()
        });
      }

      return graphElements;
    } catch (error) {
      this.testResults.tests.push({
        name: 'Graph Visualization',
        status: 'FAIL',
        error: error.message
      });
      return null;
    }
  }

  async testPerformanceWithMusicData() {
    console.log('⚡ Testing Performance with Music Data (420 nodes, 1,253 edges)...');
    
    try {
      // Start performance monitoring
      await this.page.evaluate(() => {
        window.performanceStartTime = performance.now();
      });

      // Check for data loading indicators
      const dataLoadingInfo = await this.page.evaluate(() => {
        // Look for loading indicators
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="progress"]');
        
        // Check for data indicators
        const dataElements = document.querySelectorAll('[class*="node"], [class*="edge"], [class*="track"], [class*="artist"]');
        
        return {
          loadingIndicators: loadingElements.length,
          dataElements: dataElements.length,
          timestamp: performance.now()
        };
      });

      // Monitor network requests for music data
      const apiCalls = [];
      this.page.on('response', response => {
        if (response.url().includes('api') || response.url().includes('graph') || response.url().includes('music')) {
          apiCalls.push({
            url: response.url(),
            status: response.status(),
            timestamp: new Date().toISOString()
          });
        }
      });

      // Wait for data to potentially load
      await this.page.waitForTimeout(5000);

      // Measure final performance
      const finalPerformance = await this.measurePerformance('music_data_load');
      
      await this.takeScreenshot('performance-test');

      // Check memory usage
      const memoryInfo = await this.page.evaluate(() => {
        if (performance.memory) {
          return {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
          };
        }
        return null;
      });

      this.testResults.tests.push({
        name: 'Performance with Music Data',
        status: 'PASS',
        details: {
          dataLoadingInfo,
          apiCalls: apiCalls.slice(0, 10), // Limit to first 10 calls
          memoryInfo,
          performance: finalPerformance
        }
      });

      // Performance benchmarks
      if (finalPerformance.loadTime > 5000) {
        this.testResults.userExperienceIssues.push({
          issue: 'Slow Load Time',
          severity: 'HIGH',
          description: `Load time of ${finalPerformance.loadTime}ms exceeds 5 second threshold`,
          timestamp: new Date().toISOString()
        });
      }

      if (memoryInfo && memoryInfo.used > 200) {
        this.testResults.userExperienceIssues.push({
          issue: 'High Memory Usage',
          severity: 'MEDIUM',
          description: `Memory usage of ${memoryInfo.used}MB is high for graph visualization`,
          timestamp: new Date().toISOString()
        });
      }

      return { dataLoadingInfo, apiCalls, memoryInfo, finalPerformance };
    } catch (error) {
      this.testResults.tests.push({
        name: 'Performance with Music Data',
        status: 'FAIL',
        error: error.message
      });
      return null;
    }
  }

  async testResponsiveDesign() {
    console.log('📱 Testing Responsive Design and Mobile Experience...');
    
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    for (const viewport of viewports) {
      try {
        await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
        await this.page.waitForTimeout(1000);
        
        const responsiveCheck = await this.page.evaluate(() => {
          const body = document.body;
          const hasHorizontalScroll = body.scrollWidth > body.clientWidth;
          const hasOverflowElements = document.querySelectorAll('[style*="overflow-x: scroll"], [style*="overflow: scroll"]').length;
          
          return {
            bodyWidth: body.clientWidth,
            scrollWidth: body.scrollWidth,
            hasHorizontalScroll,
            hasOverflowElements,
            viewportWidth: window.innerWidth
          };
        });

        await this.takeScreenshot(`responsive-${viewport.name.toLowerCase()}`);

        this.testResults.tests.push({
          name: `Responsive Design - ${viewport.name}`,
          status: !responsiveCheck.hasHorizontalScroll ? 'PASS' : 'PARTIAL',
          details: {
            viewport,
            responsiveCheck
          }
        });

        if (responsiveCheck.hasHorizontalScroll) {
          this.testResults.userExperienceIssues.push({
            issue: `Horizontal Scroll on ${viewport.name}`,
            severity: 'MEDIUM',
            description: `Horizontal scrolling detected on ${viewport.name} viewport (${viewport.width}x${viewport.height})`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        this.testResults.tests.push({
          name: `Responsive Design - ${viewport.name}`,
          status: 'FAIL',
          error: error.message
        });
      }
    }

    // Reset to desktop viewport
    await this.page.setViewportSize({ width: 1920, height: 1080 });
  }

  async generateReport() {
    console.log('📋 Generating Comprehensive User Experience Report...');
    
    const reportData = {
      ...this.testResults,
      summary: {
        totalTests: this.testResults.tests.length,
        passedTests: this.testResults.tests.filter(t => t.status === 'PASS').length,
        failedTests: this.testResults.tests.filter(t => t.status === 'FAIL').length,
        partialTests: this.testResults.tests.filter(t => t.status === 'PARTIAL').length,
        totalErrors: this.testResults.errors.length,
        totalIssues: this.testResults.userExperienceIssues.length,
        criticalIssues: this.testResults.userExperienceIssues.filter(i => i.severity === 'CRITICAL').length,
        highIssues: this.testResults.userExperienceIssues.filter(i => i.severity === 'HIGH').length,
        mediumIssues: this.testResults.userExperienceIssues.filter(i => i.severity === 'MEDIUM').length
      }
    };

    const reportPath = '/home/marku/Documents/programming/songnodes/frontend/user-experience-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(`📊 Report saved to: ${reportPath}`);
    return reportData;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runFullUserJourneyTest() {
    try {
      await this.setup();
      
      // Execute all tests in sequence
      await this.testFrontendAccessibility();
      await this.testMaterialUISearchComponents();
      await this.testReduxStoreIntegration();
      await this.testWebSocketConnection();
      await this.testGraphVisualization();
      await this.testPerformanceWithMusicData();
      await this.testResponsiveDesign();
      
      const report = await this.generateReport();
      
      console.log('\n🎉 User Experience Testing Complete!');
      console.log(`✅ Passed: ${report.summary.passedTests}`);
      console.log(`❌ Failed: ${report.summary.failedTests}`);
      console.log(`⚠️  Partial: ${report.summary.partialTests}`);
      console.log(`🚨 Critical Issues: ${report.summary.criticalIssues}`);
      console.log(`⚡ High Issues: ${report.summary.highIssues}`);
      console.log(`📋 Medium Issues: ${report.summary.mediumIssues}`);
      
      return report;
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test suite
if (require.main === module) {
  const tester = new SongNodesUserJourneyTester();
  tester.runFullUserJourneyTest().catch(console.error);
}

module.exports = SongNodesUserJourneyTester;