#!/usr/bin/env node
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('🌐 Loading frontend...');
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle', timeout: 10000 });

    // Wait for graph to potentially render
    await page.waitForTimeout(3000);

    // Check graph data in the page
    const graphInfo = await page.evaluate(() => {
      // Try to get graph data from Redux store if available
      const state = window.store?.getState();
      const graphState = state?.graph;

      // Count visible SVG elements
      const svgNodes = document.querySelectorAll('circle, .node');
      const svgEdges = document.querySelectorAll('line, path, .edge');

      // Get canvas info if using canvas rendering
      const canvas = document.querySelector('canvas');
      const canvasInfo = canvas ? {
        width: canvas.width,
        height: canvas.height,
        exists: true
      } : { exists: false };

      return {
        redux: {
          nodes: graphState?.nodes?.length || 0,
          edges: graphState?.edges?.length || 0,
          loading: graphState?.loading,
          error: graphState?.error
        },
        dom: {
          svgNodes: svgNodes.length,
          svgEdges: svgEdges.length,
          canvas: canvasInfo
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    console.log('\n📊 Graph Visualization Status:');
    console.log('Redux State:', JSON.stringify(graphInfo.redux, null, 2));
    console.log('DOM Elements:', JSON.stringify(graphInfo.dom, null, 2));
    console.log('Viewport:', JSON.stringify(graphInfo.viewport, null, 2));

    // Try clicking on Overview to trigger data load
    console.log('\n🔄 Clicking Overview button...');
    await page.click('text=Overview');
    await page.waitForTimeout(2000);

    // Take a screenshot after interaction
    await page.screenshot({ path: 'graph-after-click.png' });
    console.log('📸 Screenshot saved to graph-after-click.png');

    // Check for any network requests to data endpoints
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('json') || request.url().includes('api')) {
        requests.push(request.url());
      }
    });

    await page.reload();
    await page.waitForTimeout(2000);

    console.log('\n🌐 Data requests made:', requests.length > 0 ? requests : 'None');

    console.log('\n📝 Console logs:');
    consoleLogs.slice(-20).forEach(log => console.log(log));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();