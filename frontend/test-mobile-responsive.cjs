const { chromium } = require('playwright');

(async () => {
  console.log('🎭 Testing Mobile Responsive Fixes...\n');

  const browser = await chromium.launch({
    headless: true
  });

  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 720 }
  ];

  for (const viewport of viewports) {
    console.log(`\n📱 Testing ${viewport.name} View (${viewport.width}x${viewport.height})...`);

    const page = await browser.newPage();
    await page.setViewportSize(viewport);

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    try {
      await page.goto('http://localhost:3007', {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      await page.waitForTimeout(2000);

      // Take screenshot
      const filename = `${viewport.name.toLowerCase()}-responsive.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`  📸 Screenshot saved as ${filename}`);

      // Check if canvas is visible
      const canvasVisible = await page.locator('canvas').count() > 0;
      console.log(`  Canvas visible: ${canvasVisible ? '✅' : '❌'}`);

      // Check if header is visible
      const headerVisible = await page.locator('[class*="header"]').count() > 0;
      console.log(`  Header visible: ${headerVisible ? '✅' : '❌'}`);

      // Check for horizontal scroll (bad on mobile)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`  Horizontal scroll: ${hasHorizontalScroll ? '❌ Present' : '✅ None'}`);

      // Check if dropdowns are accessible
      const dropdownButtons = await page.locator('.dropdown-menu-container button').count();
      console.log(`  Dropdown buttons found: ${dropdownButtons}`);

      // Check computed styles of menu container
      const menuStyles = await page.evaluate(() => {
        const menu = document.querySelector('.dropdown-menu-container');
        if (!menu) return null;
        const styles = window.getComputedStyle(menu);
        return {
          display: styles.display,
          flexDirection: styles.flexDirection,
          overflow: styles.overflow
        };
      });
      if (menuStyles) {
        console.log(`  Menu styles:`, menuStyles);
      }

      if (errors.length > 0) {
        console.log(`  ⚠️ Console errors: ${errors.length}`);
      }

    } catch (error) {
      console.error(`  ❌ Test failed for ${viewport.name}:`, error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\n✅ Mobile Responsive Testing Complete');
})();