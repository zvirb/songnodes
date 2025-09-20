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

    console.log('Navigating to production site...');
    await page.goto('http://localhost:3006', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for initial load
    await new Promise(r => setTimeout(r, 2000));

    // Take initial screenshot
    await page.screenshot({ path: 'production-initial.png' });
    console.log('Initial screenshot saved');

    // Click Functions button to open the panel
    console.log('Opening Functions panel...');
    const functionsButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('Functions'));
    });

    if (functionsButton) {
      await functionsButton.asElement().click();
      await new Promise(r => setTimeout(r, 1000));
      console.log('Functions panel opened');
    }

    // Now look for 3D toggle button
    console.log('Looking for 3D toggle...');
    const clicked3D = await page.evaluate(() => {
      // Look for the 3D Space button
      const buttons = Array.from(document.querySelectorAll('button'));
      const button3D = buttons.find(btn =>
        btn.textContent.includes('3D Space') ||
        btn.textContent.includes('🌌')
      );

      if (button3D) {
        button3D.click();
        return true;
      }
      return false;
    });

    if (clicked3D) {
      console.log('3D mode activated, waiting for canvas to render...');
      await new Promise(r => setTimeout(r, 5000));

      // Take screenshot of 3D mode
      await page.screenshot({ path: 'production-3d-mode.png' });
      console.log('3D mode screenshot saved');

      // Now try to find the force layout toggle
      console.log('Looking for layout controls...');
      const layoutToggled = await page.evaluate(() => {
        // Look for any button/toggle containing "Force" or "Sphere"
        const buttons = Array.from(document.querySelectorAll('button'));
        const layoutBtn = buttons.find(btn =>
          btn.textContent.includes('Force') ||
          btn.textContent.includes('Sphere') ||
          btn.textContent.includes('Layout')
        );

        if (layoutBtn) {
          layoutBtn.click();
          return layoutBtn.textContent;
        }

        // Check for toggle switches
        const toggles = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"]'));
        for (const toggle of toggles) {
          const label = toggle.closest('label') || toggle.parentElement;
          if (label && (label.textContent.includes('Force') || label.textContent.includes('Layout'))) {
            toggle.click();
            return 'Toggle clicked';
          }
        }

        return false;
      });

      if (layoutToggled) {
        console.log(`Layout control found and clicked: ${layoutToggled}`);
        console.log('Waiting for force simulation to settle...');
        await new Promise(r => setTimeout(r, 5000));

        // Take screenshot of force layout
        await page.screenshot({ path: 'production-force-layout.png' });
        console.log('Force layout screenshot saved');
      } else {
        console.log('No layout toggle found - force layout might be default or not available');
      }

      // Check for console errors
      const errors = await page.evaluate(() => window.consoleErrors || []);
      if (errors.length > 0) {
        console.log('\nConsole errors detected:');
        errors.forEach(err => console.log('  -', err));
      } else {
        console.log('No console errors detected');
      }

      // Get graph info
      const info = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return {
          hasCanvas: !!canvas,
          canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
          url: window.location.href,
          mode: window.location.search.includes('mode=3d') ? '3D' : '2D'
        };
      });

      console.log('\nGraph info:', info);

    } else {
      console.log('Could not find 3D toggle button');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await browser.close();
  }
})();
