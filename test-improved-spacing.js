const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading http://localhost:3006 to test improved spacing...');
  await page.goto('http://localhost:3006/');

  // Wait longer for the simulation to spread out with new parameters
  console.log('Waiting for simulation to stabilize with improved spacing...');
  await page.waitForTimeout(8000);

  await page.screenshot({ path: 'improved-spacing-test.png', fullPage: true });
  console.log('Screenshot saved as improved-spacing-test.png');

  // Test zoomed in view to see edge clarity
  console.log('Testing zoomed view for edge clarity...');
  await page.mouse.move(640, 300);
  await page.mouse.wheel(0, -300); // Zoom in
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'improved-spacing-zoomed.png', fullPage: true });
  console.log('Zoomed screenshot saved as improved-spacing-zoomed.png');

  await browser.close();
})();