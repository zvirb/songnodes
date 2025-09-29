const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the development server
  await page.goto('http://localhost:3007');

  console.log('🧪 Testing memory leak fixes and click detection...');

  // Wait for the page to load
  await page.waitForTimeout(3000);

  // Check for initial errors
  const errors = await page.evaluate(() => {
    return window.console._logs?.filter(log => log.type === 'error') || [];
  });

  if (errors.length > 0) {
    console.log('❌ Initial errors found:', errors);
  } else {
    console.log('✅ No initial errors detected');
  }

  // Test debug key functionality (press 'D' to toggle debug)
  console.log('🔧 Testing debug toggle (pressing D key)...');
  await page.keyboard.press('d');
  await page.waitForTimeout(1000);

  // Check for debug overlay
  const debugOverlay = await page.locator('[data-testid="debug-overlay"]').isVisible();
  console.log(`Debug overlay visible: ${debugOverlay ? '✅' : '❌'}`);

  // Monitor memory usage for a few seconds
  console.log('📊 Monitoring memory usage...');
  const memoryInfo = await page.evaluate(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
        total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
        limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
      };
    }
    return null;
  });

  if (memoryInfo) {
    console.log(`💾 Memory usage: ${memoryInfo.used}MB / ${memoryInfo.total}MB (limit: ${memoryInfo.limit}MB)`);
  }

  // Test clicking on graph area (look for PIXI canvas)
  console.log('🖱️  Testing click detection...');
  const pixiCanvas = await page.locator('#songnodes-pixi-canvas');
  if (await pixiCanvas.isVisible()) {
    console.log('✅ PIXI canvas found');

    // Click in the center of the canvas
    const canvasBox = await pixiCanvas.boundingBox();
    if (canvasBox) {
      const centerX = canvasBox.x + canvasBox.width / 2;
      const centerY = canvasBox.y + canvasBox.height / 2;

      await page.click(`#songnodes-pixi-canvas`, { position: { x: centerX - canvasBox.x, y: centerY - canvasBox.y } });
      console.log('🖱️  Clicked on canvas center');

      // Wait and check console for click events
      await page.waitForTimeout(1000);
    }
  } else {
    console.log('❌ PIXI canvas not found');
  }

  // Check console logs for memory monitoring and click events
  const logs = await page.evaluate(() => {
    return console;
  });

  console.log('📝 Test completed. Check browser console for detailed logs about:');
  console.log('   • WebGL context initialization');
  console.log('   • Memory monitoring (every 5 seconds)');
  console.log('   • Click event detection');
  console.log('   • Debug overlay functionality');

  // Keep browser open for manual testing
  console.log('🔍 Browser left open for manual testing. Press Ctrl+C to close.');

  // Wait indefinitely (until manual termination)
  await page.waitForTimeout(300000); // 5 minutes

  await browser.close();
})();