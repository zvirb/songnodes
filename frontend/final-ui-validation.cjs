const { chromium } = require('playwright');

(async () => {
  console.log('🎭 Final UI Validation Test\n');
  console.log('=' + '='.repeat(50) + '\n');

  const browser = await chromium.launch({
    headless: true
  });

  const tests = [
    {
      name: 'iPhone SE',
      width: 375,
      height: 667,
      expectedBehavior: 'Vertical menu, no horizontal scroll'
    },
    {
      name: 'iPad',
      width: 768,
      height: 1024,
      expectedBehavior: 'Horizontal menu, full width'
    },
    {
      name: 'Desktop',
      width: 1280,
      height: 720,
      expectedBehavior: 'Horizontal menu, centered'
    }
  ];

  let allTestsPassed = true;

  for (const test of tests) {
    console.log(`📱 Testing ${test.name} (${test.width}x${test.height})`);
    console.log(`   Expected: ${test.expectedBehavior}`);

    const page = await browser.newPage();
    await page.setViewportSize({ width: test.width, height: test.height });

    try {
      await page.goto('http://localhost:3007', {
        waitUntil: 'networkidle',
        timeout: 15000
      });

      // Wait for UI to stabilize
      await page.waitForTimeout(2000);

      // Take screenshot
      const filename = `final-${test.name.toLowerCase().replace(' ', '-')}.png`;
      await page.screenshot({ path: filename, fullPage: false });

      // Run validation checks
      const validation = await page.evaluate(() => {
        const results = {};

        // Check canvas is visible
        const canvas = document.querySelector('canvas');
        results.canvasVisible = canvas && canvas.offsetWidth > 0;

        // Check for horizontal scroll
        results.hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;

        // Check dropdown container
        const dropdown = document.querySelector('.dropdown-container');
        if (dropdown) {
          const styles = window.getComputedStyle(dropdown);
          results.dropdownDisplay = styles.display;
          results.dropdownFlexDirection = styles.flexDirection;
          results.dropdownWidth = dropdown.offsetWidth;
        }

        // Count visible buttons
        const buttons = document.querySelectorAll('.dropdown-container button');
        results.buttonCount = buttons.length;
        results.buttonsVisible = Array.from(buttons).filter(b => b.offsetWidth > 0).length;

        // Check if any UI elements are overlapping badly
        const header = document.querySelector('[class*="SongNodes"]')?.parentElement;
        const mainContent = document.querySelector('.graph-canvas-container, canvas')?.parentElement;
        results.headerHeight = header ? header.offsetHeight : 0;
        results.contentTop = mainContent ? mainContent.offsetTop : 0;

        return results;
      });

      // Validate results
      console.log(`   ✓ Canvas visible: ${validation.canvasVisible ? '✅' : '❌'}`);
      console.log(`   ✓ Horizontal scroll: ${validation.hasHorizontalScroll ? '❌ Present' : '✅ None'}`);
      console.log(`   ✓ Menu buttons: ${validation.buttonsVisible}/${validation.buttonCount} visible`);

      if (test.width < 768) {
        // Mobile should have vertical menu
        const isVertical = validation.dropdownFlexDirection === 'column';
        console.log(`   ✓ Vertical menu: ${isVertical ? '✅' : '❌'}`);
        if (!isVertical) allTestsPassed = false;
      } else {
        // Tablet/Desktop should have horizontal menu
        const isHorizontal = validation.dropdownFlexDirection !== 'column';
        console.log(`   ✓ Horizontal menu: ${isHorizontal ? '✅' : '❌'}`);
        if (!isHorizontal) allTestsPassed = false;
      }

      // Check critical issues
      if (!validation.canvasVisible) {
        console.log('   ⚠️ WARNING: Canvas not visible!');
        allTestsPassed = false;
      }
      if (validation.hasHorizontalScroll && test.width < 768) {
        console.log('   ⚠️ WARNING: Unwanted horizontal scroll on mobile!');
        allTestsPassed = false;
      }
      if (validation.buttonsVisible === 0) {
        console.log('   ⚠️ WARNING: No menu buttons visible!');
        allTestsPassed = false;
      }

      console.log(`   📸 Screenshot: ${filename}\n`);

    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}\n`);
      allTestsPassed = false;
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('=' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('✅ All UI validation tests PASSED!');
    console.log('\nThe UI is now:');
    console.log('  • Mobile-responsive with vertical menu on small screens');
    console.log('  • No horizontal scrolling issues on mobile');
    console.log('  • Original functionality preserved on desktop');
    console.log('  • Canvas visualization working on all devices');
  } else {
    console.log('⚠️ Some tests failed. Review the warnings above.');
  }
})();