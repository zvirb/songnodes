const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading http://localhost:3006 to test centered zoom...');
  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(4000);

  // Take screenshot to see if graph is now centered
  await page.screenshot({ path: 'zoom-fix-test.png', fullPage: true });
  console.log('Screenshot saved as zoom-fix-test.png');

  // Test a simple zoom at center
  console.log('Testing zoom at center (640, 300)...');
  await page.mouse.move(640, 300);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'zoom-fix-zoomed.png', fullPage: true });
  console.log('Zoomed screenshot saved as zoom-fix-zoomed.png');

  await browser.close();
})();