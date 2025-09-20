#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testFinal3D() {
  console.log('🌌 Final 3D visualization test...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Monitor console for Three.js messages
  const messages = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log(`Browser: ${text}`);
    messages.push(text);
  });

  page.on('pageerror', error => {
    console.error(`Page Error: ${error.message}`);
  });

  try {
    console.log('🔗 Navigating to 3D mode...');
    await page.goto('http://localhost:3007?mode=3d', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('⏳ Waiting for data and 3D scene...');
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait longer for full initialization

    // Check final state
    const finalState = await page.evaluate(() => {
      const debugOverlay = document.querySelector('.absolute.top-2.right-2');
      const canvases = document.querySelectorAll('canvas');
      const threeCanvas = document.querySelector('[data-testid="3d-canvas"]');

      return {
        debugInfo: debugOverlay ? debugOverlay.textContent : 'No debug overlay',
        canvasCount: canvases.length,
        has3DCanvas: !!threeCanvas,
        canvasDetails: Array.from(canvases).map(c => ({
          width: c.width,
          height: c.height,
          id: c.id,
          className: c.className
        })),
        title: document.title,
        hasError: document.body.textContent.includes('Application Error'),
        url: window.location.href
      };
    });

    console.log('\n📊 Final 3D State:', JSON.stringify(finalState, null, 2));

    // Take final screenshot
    await page.screenshot({
      path: './test-results/final-3d-verification.png',
      fullPage: true
    });
    console.log('📸 Final screenshot: ./test-results/final-3d-verification.png');

    // Check for Three.js success indicators
    const hasThreeInit = messages.some(msg => msg.includes('Three.js scene initialized'));
    const has3DGraph = messages.some(msg => msg.includes('Creating 3D graph'));
    const hasDataLoaded = messages.some(msg => msg.includes('Set 45 nodes'));

    console.log('\n🎯 Success Indicators:');
    console.log(`  Three.js Init: ${hasThreeInit ? '✅' : '❌'}`);
    console.log(`  3D Graph Created: ${has3DGraph ? '✅' : '❌'}`);
    console.log(`  Data Loaded: ${hasDataLoaded ? '✅' : '❌'}`);
    console.log(`  Canvas Present: ${finalState.canvasCount > 0 ? '✅' : '❌'}`);
    console.log(`  No Errors: ${!finalState.hasError ? '✅' : '❌'}`);

    const isFullyWorking = hasThreeInit && has3DGraph && hasDataLoaded &&
                          finalState.canvasCount > 0 && !finalState.hasError;

    if (isFullyWorking) {
      console.log('\n🎉 SUCCESS: 3D visualization is fully working!');
      return true;
    } else {
      console.log('\n⚠️  3D visualization has some issues');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

testFinal3D()
  .then(success => {
    console.log(`\n🏁 Final test: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(console.error);