const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FRONTENDS = [
  { name: 'docker-frontend', port: 3006, description: 'Docker Container Frontend' },
  { name: 'local-vite', port: 3007, description: 'Local Vite Dev Server' }
];

async function diagnoseFrontend(frontend) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Testing ${frontend.description} on port ${frontend.port}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Create screenshots directory
    const screenshotDir = path.join(__dirname, 'diagnostic-screenshots', frontend.name);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Enable console logging
    const consoleLogs = [];
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      if (msg.type() === 'error') {
        console.log(`  ❌ Console error: ${text}`);
      }
    });

    // Monitor network
    const apiCalls = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/')) {
        const call = {
          url,
          status: response.status(),
          ok: response.ok()
        };

        try {
          if (response.ok() && response.headers()['content-type']?.includes('application/json')) {
            const body = await response.json();
            call.nodes = body.nodes?.length || 0;
            call.edges = body.edges?.length || 0;
            if (call.nodes > 0) {
              console.log(`  ✅ API returned ${call.nodes} nodes`);
            }
            if (call.edges > 0) {
              console.log(`  ✅ API returned ${call.edges} edges`);
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }

        apiCalls.push(call);

        if (!call.ok) {
          console.log(`  ❌ API error ${call.status}: ${url}`);
        }
      }
    });

    // Navigate to the frontend
    console.log('\n📍 Step 1: Navigating to application...');
    try {
      await page.goto(`http://localhost:${frontend.port}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      console.log('  ✅ Page loaded successfully');
    } catch (error) {
      console.log(`  ❌ Failed to load page: ${error.message}`);
      await page.screenshot({
        path: path.join(screenshotDir, '01-load-error.png'),
        fullPage: true
      });
      return;
    }

    // Take initial screenshot
    await page.screenshot({
      path: path.join(screenshotDir, '01-initial.png'),
      fullPage: true
    });

    // Wait for any async operations
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check page elements
    console.log('\n🎨 Step 2: Checking visualization elements...');

    const elements = await page.evaluate(() => {
      const canvasElements = document.querySelectorAll('canvas');
      const svgElements = document.querySelectorAll('svg');
      const nodeText = Array.from(document.querySelectorAll('*'))
        .find(el => el.textContent?.includes('Nodes:'))?.textContent || 'Not found';
      const edgeText = Array.from(document.querySelectorAll('*'))
        .find(el => el.textContent?.includes('Edges:'))?.textContent || 'Not found';
      const loadingText = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent?.toLowerCase().includes('loading') ||
                     el.textContent?.toLowerCase().includes('waiting')).length;

      return {
        canvas: canvasElements.length,
        svg: svgElements.length,
        nodeDisplay: nodeText,
        edgeDisplay: edgeText,
        loadingIndicators: loadingText
      };
    });

    console.log(`  Canvas elements: ${elements.canvas}`);
    console.log(`  SVG elements: ${elements.svg}`);
    console.log(`  Node counter: ${elements.nodeDisplay}`);
    console.log(`  Edge counter: ${elements.edgeDisplay}`);
    console.log(`  Loading indicators: ${elements.loadingIndicators}`);

    await page.screenshot({
      path: path.join(screenshotDir, '02-after-wait.png'),
      fullPage: true
    });

    // Check Redux state
    console.log('\n📊 Step 3: Checking application state...');
    const appState = await page.evaluate(() => {
      // Try to access Redux store
      if (window.__REDUX_STORE__) {
        const state = window.__REDUX_STORE__.getState();
        return {
          hasStore: true,
          nodes: state?.graph?.nodes?.length || 0,
          edges: state?.graph?.edges?.length || 0,
          loading: state?.graph?.loading
        };
      }
      return { hasStore: false };
    });

    if (appState.hasStore) {
      console.log(`  ✅ Redux store found`);
      console.log(`  Nodes in store: ${appState.nodes}`);
      console.log(`  Edges in store: ${appState.edges}`);
      console.log(`  Loading state: ${appState.loading}`);
    } else {
      console.log(`  ⚠️ Redux store not accessible`);
    }

    // Test direct API access
    console.log('\n🔌 Step 4: Testing API connectivity...');
    const apiTests = await page.evaluate(async (port) => {
      const tests = [];

      // Test relative URL
      try {
        const res = await fetch('/api/graph/nodes?limit=5');
        const data = res.ok ? await res.json() : null;
        tests.push({
          url: '/api/graph/nodes',
          status: res.status,
          ok: res.ok,
          nodes: data?.nodes?.length || 0
        });
      } catch (e) {
        tests.push({
          url: '/api/graph/nodes',
          error: e.message
        });
      }

      // Test direct to API gateway
      try {
        const res = await fetch('http://localhost:8080/api/graph/nodes?limit=5');
        const data = res.ok ? await res.json() : null;
        tests.push({
          url: 'http://localhost:8080/api/graph/nodes',
          status: res.status,
          ok: res.ok,
          nodes: data?.nodes?.length || 0
        });
      } catch (e) {
        tests.push({
          url: 'http://localhost:8080/api/graph/nodes',
          error: e.message
        });
      }

      return tests;
    }, frontend.port);

    apiTests.forEach(test => {
      if (test.error) {
        console.log(`  ❌ ${test.url}: ${test.error}`);
      } else {
        console.log(`  ${test.ok ? '✅' : '❌'} ${test.url}: Status ${test.status}, ${test.nodes} nodes`);
      }
    });

    // Try to trigger data load
    console.log('\n🔄 Step 5: Attempting to trigger data load...');
    const triggerResult = await page.evaluate(() => {
      // Try different methods to trigger data load

      // Method 1: Call loadGraphData if available
      if (window.loadGraphData) {
        window.loadGraphData();
        return 'Called window.loadGraphData()';
      }

      // Method 2: Dispatch Redux action
      if (window.__REDUX_STORE__) {
        window.__REDUX_STORE__.dispatch({ type: 'graph/fetchData' });
        return 'Dispatched Redux action';
      }

      // Method 3: Click refresh button if exists
      const refreshBtn = document.querySelector('button[aria-label*="refresh" i], button[title*="refresh" i]');
      if (refreshBtn) {
        refreshBtn.click();
        return 'Clicked refresh button';
      }

      return 'No trigger method available';
    });

    console.log(`  Trigger attempt: ${triggerResult}`);

    // Wait and take final screenshot
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({
      path: path.join(screenshotDir, '03-final.png'),
      fullPage: true
    });

    // Summary
    console.log('\n📋 Summary:');
    console.log(`  API calls made: ${apiCalls.length}`);
    console.log(`  Successful API calls: ${apiCalls.filter(c => c.ok).length}`);
    console.log(`  Failed API calls: ${apiCalls.filter(c => !c.ok).length}`);
    console.log(`  Console errors: ${consoleLogs.filter(l => l.includes('[error]')).length}`);

    // Save detailed report
    const report = {
      frontend: frontend.name,
      port: frontend.port,
      timestamp: new Date().toISOString(),
      elements,
      appState,
      apiTests,
      apiCalls: apiCalls.slice(0, 10),
      consoleLogs: consoleLogs.slice(-20),
      summary: {
        apiTotal: apiCalls.length,
        apiSuccess: apiCalls.filter(c => c.ok).length,
        apiFailed: apiCalls.filter(c => !c.ok).length,
        consoleErrors: consoleLogs.filter(l => l.includes('[error]')).length
      }
    };

    fs.writeFileSync(
      path.join(screenshotDir, 'report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log(`\n📸 Screenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.error(`\n❌ Error testing ${frontend.name}: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🔍 Starting Multi-Frontend Diagnostic Tool');
  console.log('Testing frontends on ports 3006 and 3007...\n');

  for (const frontend of FRONTENDS) {
    await diagnoseFrontend(frontend);
  }

  console.log('\n✅ Diagnostic complete!');
  console.log('Check diagnostic-screenshots/ for visual results');
}

main().catch(console.error);