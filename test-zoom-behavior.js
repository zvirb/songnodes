const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // Run with visible browser to see zoom behavior
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1280, height: 800 });

  console.log('Loading http://localhost:3006...');
  await page.goto('http://localhost:3006/');

  // Wait for graph to load
  await page.waitForTimeout(5000);
  console.log('Graph loaded, testing zoom behavior...');

  // Test zoom at different cursor positions
  const canvas = await page.locator('canvas').first();

  // Take initial screenshot
  await page.screenshot({ path: 'zoom-test-initial.png' });
  console.log('Initial screenshot taken');

  // Test zoom in at top-left corner
  console.log('Zooming in at top-left (200, 150)...');
  await canvas.hover();
  await page.mouse.move(200, 150);
  await page.mouse.wheel(0, -300); // Zoom in
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'zoom-test-topleft.png' });

  // Reset zoom
  console.log('Resetting zoom...');
  await page.keyboard.press('Control+0'); // Try reset
  await page.waitForTimeout(1000);

  // Test zoom in at center-right
  console.log('Zooming in at center-right (900, 400)...');
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, -300); // Zoom in
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'zoom-test-centerright.png' });

  // Test zoom out at bottom-left
  console.log('Zooming out at bottom-left (200, 600)...');
  await page.mouse.move(200, 600);
  await page.mouse.wheel(0, 300); // Zoom out
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'zoom-test-bottomleft.png' });

  console.log('Zoom behavior test complete. Screenshots saved.');
  console.log('Please check if zoom centers on cursor position in the screenshots.');

  // Keep browser open for manual testing
  console.log('Browser will stay open for 30 seconds for manual testing...');
  await page.waitForTimeout(30000);

  await browser.close();
})();