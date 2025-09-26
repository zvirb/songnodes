const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Track ALL console messages to see edge debugging
  page.on('console', msg => {
    console.log('[CONSOLE]', msg.text());
  });

  console.log('Loading http://localhost:3006 for edge debugging...');
  await page.goto('http://localhost:3006/');

  // Wait longer to catch edge rendering
  console.log('Waiting 8 seconds to catch edge rendering...');
  await page.waitForTimeout(8000);

  // Take screenshot
  await page.screenshot({ path: 'edge-debug-final.png', fullPage: true });
  console.log('Edge debug screenshot saved');

  await browser.close();
})();