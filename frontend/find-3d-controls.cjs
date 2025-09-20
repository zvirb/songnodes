const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to http://localhost:3006...');
    await page.goto('http://localhost:3006', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for app to fully load
    await new Promise(r => setTimeout(r, 3000));

    // Look for all clickable elements that might toggle 3D mode
    const elements = await page.evaluate(() => {
      const results = [];

      // Check all buttons
      document.querySelectorAll('button').forEach(el => {
        results.push({
          type: 'button',
          text: el.textContent.trim(),
          title: el.title,
          ariaLabel: el.getAttribute('aria-label'),
          visible: el.offsetParent !== null,
          hasIcon: el.querySelector('svg') !== null
        });
      });

      // Check for any elements with role="button"
      document.querySelectorAll('[role="button"]').forEach(el => {
        results.push({
          type: 'role=button',
          text: el.textContent.trim(),
          title: el.title,
          ariaLabel: el.getAttribute('aria-label'),
          visible: el.offsetParent !== null
        });
      });

      // Check for toolbar or icon buttons
      document.querySelectorAll('.MuiIconButton-root, .icon-button, [class*="IconButton"]').forEach(el => {
        results.push({
          type: 'icon-button',
          text: el.textContent.trim(),
          title: el.title,
          ariaLabel: el.getAttribute('aria-label'),
          visible: el.offsetParent !== null
        });
      });

      // Check the bottom left corner where view controls usually are
      const bottomControls = document.querySelector('.absolute.bottom-4.left-4');
      if (bottomControls) {
        results.push({
          type: 'bottom-controls',
          text: 'Found bottom controls area',
          html: bottomControls.innerHTML.substring(0, 200)
        });
      }

      return results;
    });

    console.log('\nAll interactive elements found:');
    const visibleElements = elements.filter(el => el.visible !== false);
    visibleElements.forEach((el, i) => {
      console.log(`  [${i}] ${el.type}: text="${el.text}", aria="${el.ariaLabel}", title="${el.title}"${el.hasIcon ? ' (has icon)' : ''}`);
    });

    // Look for view mode text
    const viewMode = await page.evaluate(() => {
      const viewText = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent.includes('2D Mode') ||
        el.textContent.includes('3D Mode') ||
        el.textContent.includes('View Mode')
      );
      return viewText ? viewText.textContent.trim() : null;
    });

    if (viewMode) {
      console.log('\nFound view mode indicator:', viewMode);
    }

    // Try clicking on any icon button without text (might be the 3D toggle)
    const iconButtons = visibleElements.filter(el =>
      el.type === 'button' && el.hasIcon && !el.text
    );

    console.log(`\nFound ${iconButtons.length} icon-only buttons`);

    // Take screenshot
    await page.screenshot({ path: 'production-controls-check.png' });
    console.log('\nScreenshot saved as production-controls-check.png');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();