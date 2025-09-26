const { chromium } = require('playwright');

(async () => {
  console.log('🎯 Starting UI Visibility Check...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--enable-webgl2-compute-context']
  });

  const page = await browser.newPage();

  try {
    // Navigate to the frontend
    console.log('📍 Navigating to http://localhost:3006/');
    await page.goto('http://localhost:3006/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit for React to mount
    await page.waitForTimeout(2000);

    // Check if page is blank
    const bodyText = await page.locator('body').innerText();
    if (bodyText.trim() === '') {
      console.log('❌ FAIL: Page is completely blank - no text content found!');
    } else {
      console.log('✅ PASS: Page has content - not blank');
      console.log('   Found text:', bodyText.substring(0, 100) + '...');
    }

    // Check for app container
    const appContainer = await page.locator('.app-container').count();
    if (appContainer > 0) {
      console.log('✅ PASS: App container is present');
    } else {
      console.log('❌ FAIL: App container (.app-container) not found');
    }

    // Check for canvas
    const canvasCount = await page.locator('canvas').count();
    if (canvasCount > 0) {
      const canvas = page.locator('canvas').first();
      const box = await canvas.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        console.log(`✅ PASS: Canvas found with dimensions ${box.width}x${box.height}`);
      } else {
        console.log('⚠️  WARNING: Canvas found but has no dimensions');
      }
    } else {
      console.log('❌ FAIL: No canvas element found (PIXI not rendering)');
    }

    // Check for SongNodes title
    const titleVisible = await page.locator('text=SongNodes').first().isVisible().catch(() => false);
    if (titleVisible) {
      console.log('✅ PASS: "SongNodes" title is visible');
    } else {
      console.log('❌ FAIL: "SongNodes" title not visible');
    }

    // Check for graph container
    const graphContainer = await page.locator('.graph-container').count();
    if (graphContainer > 0) {
      const isVisible = await page.locator('.graph-container').first().isVisible();
      if (isVisible) {
        console.log('✅ PASS: Graph container is visible');
      } else {
        console.log('⚠️  WARNING: Graph container exists but not visible');
      }
    } else {
      console.log('❌ FAIL: Graph container (.graph-container) not found');
    }

    // Check background color
    const bgColor = await page.locator('body').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log(`ℹ️  INFO: Page background color: ${bgColor}`);

    // Check for API data
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/graph/nodes');
        const data = await response.json();
        return { success: true, nodeCount: data.nodes?.length || 0 };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    if (apiResponse.success) {
      console.log(`✅ PASS: API working - ${apiResponse.nodeCount} nodes loaded`);
    } else {
      console.log(`❌ FAIL: API error - ${apiResponse.error}`);
    }

    // Take a screenshot
    await page.screenshot({
      path: 'ui-check-screenshot.png',
      fullPage: true
    });
    console.log('\n📸 Screenshot saved as ui-check-screenshot.png');

    // Get console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    if (errors.length > 0) {
      console.log('\n⚠️  Console errors found:');
      errors.forEach(err => console.log('   -', err));
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 UI Visibility Check Complete');
  }
})();