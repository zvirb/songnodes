const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Inject error capturing
    await page.evaluateOnNewDocument(() => {
      window.consoleErrors = [];
      const originalError = console.error;
      console.error = (...args) => {
        window.consoleErrors.push(args.join(' '));
        originalError.apply(console, args);
      };
    });

    // Go to production site
    console.log('Navigating to production site...');
    await page.goto('http://localhost:3006', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for app to load
    await new Promise(r => setTimeout(r, 3000));

    // Click the 3D button
    console.log('Clicking 3D mode button...');
    const button3D = await page.waitForSelector('button[aria-label="Switch to 3D view"]', { timeout: 10000 });
    await button3D.click();

    // Wait for 3D canvas to render
    await new Promise(r => setTimeout(r, 3000));

    // Try to find and click the force layout toggle
    console.log('Looking for force layout toggle...');
    const forceToggled = await page.evaluate(() => {
      // Look for any button containing "Force" or "Sphere" text
      const buttons = Array.from(document.querySelectorAll('button'));
      const layoutBtn = buttons.find(btn =>
        btn.textContent.includes('Force') ||
        btn.textContent.includes('Sphere') ||
        btn.textContent.includes('Layout')
      );
      if (layoutBtn) {
        layoutBtn.click();
        return true;
      }

      // Also check for toggle switches or other controls
      const toggles = Array.from(document.querySelectorAll('[role="switch"], input[type="checkbox"]'));
      const layoutToggle = toggles.find(el => {
        const label = el.closest('label') || el.parentElement;
        return label && (label.textContent.includes('Force') || label.textContent.includes('Layout'));
      });
      if (layoutToggle) {
        layoutToggle.click();
        return true;
      }

      return false;
    });

    if (forceToggled) {
      console.log('Force layout toggle clicked, waiting for physics to settle...');
      await new Promise(r => setTimeout(r, 5000));
    } else {
      console.log('Force layout toggle not found - may be default mode');
    }

    // Take screenshot
    await page.screenshot({ path: 'production-3d-force-layout.png' });
    console.log('Screenshot saved as production-3d-force-layout.png');

    // Check for any console errors
    const errors = await page.evaluate(() => window.consoleErrors || []);
    if (errors.length > 0) {
      console.log('\nConsole errors detected:');
      errors.forEach(err => console.log('  -', err));
    } else {
      console.log('No console errors detected');
    }

    // Get current layout info
    const layoutInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const info = {
        canvasFound: !!canvas,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A'
      };

      // Check Redux state if available
      if (window.__REDUX_STORE__) {
        const state = window.__REDUX_STORE__.getState();
        info.nodeCount = state?.graph?.nodes?.length || 0;
        info.edgeCount = state?.graph?.edges?.length || 0;
      }

      return info;
    });

    console.log('\nLayout info:', layoutInfo);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();