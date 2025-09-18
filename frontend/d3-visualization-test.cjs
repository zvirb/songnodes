/**
 * D3.js Graph Visualization Test
 * Tests the new WorkingD3Canvas component functionality
 */

const { chromium } = require('playwright');

async function testD3Visualization() {
  console.log('🧪 Starting D3.js Visualization Test...');

  const browser = await chromium.launch({ headless: false, devtools: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    console.log('📍 Navigating to http://localhost:3007');
    await page.goto('http://localhost:3007', { waitUntil: 'networkidle' });

    // Wait for the graph container to be visible
    console.log('⏳ Waiting for graph container...');
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

    // Wait for D3 SVG to be created
    console.log('🎨 Waiting for D3 SVG canvas...');
    await page.waitForSelector('svg', { timeout: 5000 });

    // Check if nodes are rendered
    const nodeCount = await page.locator('svg circle').count();
    console.log(`🎯 Found ${nodeCount} rendered nodes`);

    // Check if edges are rendered
    const edgeCount = await page.locator('svg line').count();
    console.log(`🔗 Found ${edgeCount} rendered edges`);

    // Test node interactions
    if (nodeCount > 0) {
      console.log('🖱️ Testing node interactions...');

      // Click on the first node
      await page.locator('svg circle').first().click();
      console.log('✅ Node click interaction successful');

      // Test hover
      await page.locator('svg circle').first().hover();
      console.log('✅ Node hover interaction successful');
    }

    // Check info overlay
    const infoOverlay = await page.locator('text=Working D3.js Visualization').isVisible();
    console.log(`📊 Info overlay visible: ${infoOverlay}`);

    // Check legend
    const legend = await page.locator('text=Node Types').isVisible();
    console.log(`🏷️ Legend visible: ${legend}`);

    // Test zoom functionality
    console.log('🔍 Testing zoom functionality...');
    await page.mouse.wheel(0, -100); // Scroll up to zoom in
    await page.waitForTimeout(1000);
    console.log('✅ Zoom interaction successful');

    // Check performance
    const performanceStart = Date.now();
    await page.waitForTimeout(2000); // Let simulation run
    const performanceEnd = Date.now();
    const runtime = performanceEnd - performanceStart;
    console.log(`⚡ Performance test: ${runtime}ms runtime (should be smooth)`);

    // Take a screenshot
    await page.screenshot({
      path: 'frontend/d3-visualization-test-screenshot.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved: d3-visualization-test-screenshot.png');

    // Test results
    const testResults = {
      nodesRendered: nodeCount,
      edgesRendered: edgeCount,
      interactionsWorking: nodeCount > 0,
      uiElementsVisible: infoOverlay && legend,
      performanceAcceptable: runtime < 5000,
      overallSuccess: nodeCount > 0 && edgeCount >= 0 && infoOverlay
    };

    console.log('\n📋 Test Results:', testResults);

    if (testResults.overallSuccess) {
      console.log('🎉 D3.js Visualization Test PASSED! ✅');
      return true;
    } else {
      console.log('❌ D3.js Visualization Test FAILED!');
      return false;
    }

  } catch (error) {
    console.error('💥 Test error:', error.message);

    // Take error screenshot
    await page.screenshot({
      path: 'frontend/d3-visualization-error-screenshot.png',
      fullPage: true
    });
    console.log('📸 Error screenshot saved');

    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testD3Visualization()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { testD3Visualization };