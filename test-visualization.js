const { chromium } = require('playwright');

async function testVisualization() {
  console.log('🔍 Starting browser test for SongNodes visualization...');

  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const message = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(message);
    console.log(`🖥️  Console: ${message}`);
  });

  // Capture errors
  const errors = [];
  page.on('pageerror', error => {
    const message = `❌ Page Error: ${error.message}`;
    errors.push(message);
    console.log(message);
  });

  try {
    console.log('📂 Navigating to http://localhost:3006...');
    await page.goto('http://localhost:3006');

    console.log('⏳ Waiting 5 seconds for app initialization...');
    await page.waitForTimeout(5000);

    // Check if the main app container exists
    const appContainer = await page.locator('[data-testid="graph-container"]').count();
    console.log(`📊 Graph container found: ${appContainer > 0 ? '✅ YES' : '❌ NO'}`);

    // Check for node and edge counts in the sidebar
    const nodeCount = await page.locator('[data-testid="node-count"]').textContent();
    const edgeCount = await page.locator('[data-testid="edge-count"]').textContent();
    console.log(`🎵 Node count displayed: ${nodeCount || 'Not found'}`);
    console.log(`🔗 Edge count displayed: ${edgeCount || 'Not found'}`);

    // Check for Redux state in devtools
    await page.waitForTimeout(2000);

    // Look for specific console messages we expect
    const expectedMessages = [
      '🚀 App useEffect: nodes.length',
      '📥 Loading local graph data',
      '✅ Setting nodes and edges',
      '📊 Redux State Update',
      '🎯 Redux setNodes: Set',
      '🔗 Redux setEdges: Set'
    ];

    console.log('\n📋 Checking for expected console messages:');
    expectedMessages.forEach(expected => {
      const found = consoleMessages.some(msg => msg.includes(expected));
      console.log(`   ${found ? '✅' : '❌'} "${expected}"`);
    });

    console.log('\n📝 All Console Messages:');
    consoleMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });

    if (errors.length > 0) {
      console.log('\n🚨 JavaScript Errors Found:');
      errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No JavaScript errors detected!');
    }

    // Take a screenshot
    await page.screenshot({ path: 'visualization-test.png', fullPage: true });
    console.log('📸 Screenshot saved as visualization-test.png');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testVisualization().catch(console.error);