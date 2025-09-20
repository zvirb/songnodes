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

    console.log('Navigating directly to 3D mode...');
    await page.goto('http://localhost:3006?mode=3d', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for 3D canvas to initialize
    await new Promise(r => setTimeout(r, 8000));

    // Take screenshot of 3D mode
    await page.screenshot({ path: 'production-3d-direct.png' });
    console.log('3D mode screenshot saved as production-3d-direct.png');

    // Check if canvas exists
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const mode = document.querySelector('.absolute.top-2.right-2');
      return {
        hasCanvas: !!canvas,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
        modeText: mode ? mode.textContent.trim() : 'No mode info',
        url: window.location.href
      };
    });

    console.log('Canvas info:', canvasInfo);

    // Look for layout controls in 3D mode
    const layoutControls = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const layoutButtons = buttons.filter(btn =>
        btn.textContent.includes('Force') ||
        btn.textContent.includes('Sphere') ||
        btn.textContent.includes('Layout')
      ).map(btn => btn.textContent.trim());

      const toggles = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"]'));
      const layoutToggles = toggles.filter(toggle => {
        const label = toggle.closest('label') || toggle.parentElement;
        return label && (label.textContent.includes('Force') || label.textContent.includes('Layout'));
      }).map(toggle => {
        const label = toggle.closest('label') || toggle.parentElement;
        return label.textContent.trim();
      });

      return { buttons: layoutButtons, toggles: layoutToggles };
    });

    console.log('Layout controls found:', layoutControls);

    // Try to trigger force layout if control exists
    const forceTriggered = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const forceBtn = buttons.find(btn =>
        btn.textContent.includes('Force') && !btn.disabled
      );

      if (forceBtn) {
        forceBtn.click();
        return true;
      }

      // Try toggle switches
      const toggles = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"]'));
      for (const toggle of toggles) {
        const label = toggle.closest('label') || toggle.parentElement;
        if (label && label.textContent.includes('Force')) {
          toggle.click();
          return true;
        }
      }
      return false;
    });

    if (forceTriggered) {
      console.log('Force layout triggered, waiting for simulation...');
      await new Promise(r => setTimeout(r, 6000));

      await page.screenshot({ path: 'production-force-final.png' });
      console.log('Force layout screenshot saved as production-force-final.png');
    } else {
      console.log('No force layout control found - taking final screenshot');
      await page.screenshot({ path: 'production-3d-final.png' });
    }

    // Check for errors
    const errors = await page.evaluate(() => window.consoleErrors || []);
    if (errors.length > 0) {
      console.log('\nConsole errors detected:');
      errors.forEach(err => console.log('  -', err));
    } else {
      console.log('No console errors detected - 3D mode working properly');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
