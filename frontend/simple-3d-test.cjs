const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Testing 3D mode...');
    await page.goto('http://localhost:3006?mode=3d', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // Wait for application to load
    await new Promise(r => setTimeout(r, 5000));

    // Check mode indicator
    const modeInfo = await page.evaluate(() => {
      const indicator = document.querySelector('.absolute.top-2.right-2');
      return indicator ? indicator.textContent.trim() : 'No mode indicator found';
    });

    console.log('Mode indicator:', modeInfo);

    // Take screenshot
    await page.screenshot({ path: 'simple-3d-test.png' });
    console.log('Screenshot saved: simple-3d-test.png');

    // Check for canvas
    const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
    console.log('Canvas present:', hasCanvas);

    // Check for any JavaScript errors
    const logs = await page.evaluate(() => {
      const errors = [];
      const originalError = console.error;
      
      // Check if there were any errors logged
      if (window.consoleErrors && window.consoleErrors.length > 0) {
        errors.push(...window.consoleErrors);
      }
      
      return errors;
    });

    if (logs.length > 0) {
      console.log('Errors found:', logs);
    } else {
      console.log('No errors detected');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
