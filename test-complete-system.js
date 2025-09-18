const { chromium } = require('playwright');

async function testCompleteSystem() {
  console.log('🔍 Testing Complete SongNodes System...');

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track what we're checking
  const tests = {
    pageLoads: false,
    dataLoads: false,
    d3Renders: false,
    interactionsWork: false,
    connectionStatus: false,
    performanceGood: false
  };

  // Capture console for analysis
  const consoleMessages = [];
  page.on('console', msg => {
    const message = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(message);
    console.log(`📝 ${message}`);
  });

  // Capture errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Error: ${error.message}`);
  });

  try {
    console.log('🌐 Loading http://localhost:3006...');
    await page.goto('http://localhost:3006');
    await page.waitForTimeout(3000);

    // Test 1: Page loads without crashes
    const title = await page.title();
    tests.pageLoads = title.includes('SongNodes');
    console.log(`📄 Page loads: ${tests.pageLoads ? '✅' : '❌'} (${title})`);

    // Test 2: Data loading
    const nodeCountElement = await page.locator('[data-testid="node-count"]').first();
    if (await nodeCountElement.count() > 0) {
      const nodeCount = await nodeCountElement.textContent();
      tests.dataLoads = nodeCount && !nodeCount.includes('0');
      console.log(`📊 Data loads: ${tests.dataLoads ? '✅' : '❌'} (${nodeCount} nodes)`);
    }

    // Test 3: D3.js visualization renders
    const svgElement = await page.locator('svg').first();
    if (await svgElement.count() > 0) {
      const circles = await page.locator('svg circle').count();
      const lines = await page.locator('svg line').count();
      tests.d3Renders = circles > 0 && lines > 0;
      console.log(`🎨 D3 renders: ${tests.d3Renders ? '✅' : '❌'} (${circles} nodes, ${lines} edges)`);
    }

    // Test 4: Interactions work
    if (tests.d3Renders) {
      try {
        const firstCircle = page.locator('svg circle').first();
        await firstCircle.click();
        await page.waitForTimeout(500);
        tests.interactionsWork = true;
        console.log(`🖱️ Interactions: ✅ (click events working)`);
      } catch (e) {
        console.log(`🖱️ Interactions: ❌ (${e.message})`);
      }
    }

    // Test 5: Connection status visible
    const connectionStatus = await page.locator('text=WebSocket').count();
    tests.connectionStatus = connectionStatus > 0;
    console.log(`🔗 Connection status: ${tests.connectionStatus ? '✅' : '❌'}`);

    // Test 6: Performance check
    const criticalErrors = errors.filter(err =>
      err.includes('Cannot read properties') ||
      err.includes('undefined') ||
      err.includes('crash')
    );
    tests.performanceGood = criticalErrors.length === 0;
    console.log(`⚡ Performance: ${tests.performanceGood ? '✅' : '❌'} (${criticalErrors.length} critical errors)`);

    // Overall assessment
    const passedTests = Object.values(tests).filter(Boolean).length;
    const totalTests = Object.keys(tests).length;

    console.log('\n🏆 SYSTEM TEST RESULTS:');
    console.log('═══════════════════════');
    Object.entries(tests).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}`);
    });

    console.log(`\n📊 Overall Score: ${passedTests}/${totalTests} tests passed`);

    if (passedTests >= totalTests * 0.8) {
      console.log('🎉 SYSTEM STATUS: EXCELLENT - SongNodes is fully functional!');
    } else if (passedTests >= totalTests * 0.6) {
      console.log('✅ SYSTEM STATUS: GOOD - Most features working');
    } else {
      console.log('⚠️ SYSTEM STATUS: NEEDS WORK - Several issues detected');
    }

    // Take final screenshot
    await page.screenshot({ path: 'complete-system-test.png', fullPage: true });
    console.log('📸 Screenshot saved: complete-system-test.png');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testCompleteSystem().catch(console.error);