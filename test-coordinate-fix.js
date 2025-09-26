const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Testing coordinate system fixes...');
  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(4000);

  // Take initial screenshot
  await page.screenshot({ path: 'coordinate-fix-initial.png', fullPage: true });
  console.log('Initial screenshot saved');

  // Test zoom behavior - zoom in at specific position
  console.log('Testing zoom at position (400, 200)...');
  await page.mouse.move(400, 200);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'coordinate-fix-zoomed-in.png', fullPage: true });
  console.log('Zoomed in screenshot saved');

  // Zoom out to see if everything stays centered
  console.log('Testing zoom out...');
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'coordinate-fix-zoomed-out.png', fullPage: true });
  console.log('Zoomed out screenshot saved');

  // Test extreme zoom out
  console.log('Testing extreme zoom out...');
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'coordinate-fix-extreme-zoom.png', fullPage: true });
  console.log('Extreme zoom screenshot saved');

  await browser.close();
})();