const { chromium } = require('playwright');

(async () => {
  console.log('🎭 Starting Playwright UI Test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log('❌ Page Error:', error.message);
  });

  try {
    console.log('📱 Testing Desktop View (1280x720)...');
    await page.goto('http://localhost:3007', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot of desktop view
    await page.screenshot({ path: 'desktop-view.png', fullPage: true });
    console.log('📸 Desktop screenshot saved as desktop-view.png');

    // Check for key elements
    console.log('\n🔍 Checking for UI elements...');

    // Check if graph canvas is visible
    const canvasVisible = await page.isVisible('.graph-canvas-container');
    console.log(`  Graph Canvas: ${canvasVisible ? '✅ Visible' : '❌ Not Found'}`);

    // Check for header
    const headerVisible = await page.isVisible('.unified-header-bar, [class*="header"], header');
    console.log(`  Header Bar: ${headerVisible ? '✅ Visible' : '❌ Not Found'}`);

    // Check for bottom navigation (mobile)
    const bottomNavVisible = await page.isVisible('.bottom-navigation, [class*="BottomNavigation"]');
    console.log(`  Bottom Navigation: ${bottomNavVisible ? '✅ Visible' : '❌ Not Found'}`);

    // Check for any error messages
    const errorText = await page.locator('text=/error|failed|exception/i').count();
    if (errorText > 0) {
      console.log(`  ⚠️ Found ${errorText} error messages on page`);
    }

    // Test mobile view
    console.log('\n📱 Testing Mobile View (375x667)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'mobile-view.png', fullPage: true });
    console.log('📸 Mobile screenshot saved as mobile-view.png');

    // Check mobile-specific elements
    const mobileBottomNav = await page.isVisible('.bottom-navigation, [class*="BottomNavigation"]');
    console.log(`  Mobile Bottom Nav: ${mobileBottomNav ? '✅ Visible' : '❌ Not Found'}`);

    // Check if graph is still visible on mobile
    const mobileCanvasVisible = await page.isVisible('.graph-canvas-container');
    console.log(`  Mobile Graph Canvas: ${mobileCanvasVisible ? '✅ Visible' : '❌ Not Found'}`);

    // Test tablet view
    console.log('\n📱 Testing Tablet View (768x1024)...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'tablet-view.png', fullPage: true });
    console.log('📸 Tablet screenshot saved as tablet-view.png');

    // Get computed styles to check layout issues
    console.log('\n🎨 Checking layout styles...');
    const appContainer = await page.locator('.app-container, #root > div').first();
    if (await appContainer.count() > 0) {
      const styles = await appContainer.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          display: computed.display,
          position: computed.position,
          overflow: computed.overflow,
          width: computed.width,
          height: computed.height
        };
      });
      console.log('  App Container Styles:', styles);
    }

    // Check for overlapping elements
    const elements = await page.locator('body *').evaluateAll(elements => {
      const overlapping = [];
      for (let i = 0; i < Math.min(elements.length, 50); i++) {
        const rect = elements[i].getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        for (let j = i + 1; j < Math.min(elements.length, 50); j++) {
          const rect2 = elements[j].getBoundingClientRect();
          if (rect2.width === 0 || rect2.height === 0) continue;

          // Check if elements overlap
          if (!(rect.right < rect2.left ||
                rect.left > rect2.right ||
                rect.bottom < rect2.top ||
                rect.top > rect2.bottom)) {
            const el1Classes = elements[i].className || 'no-class';
            const el2Classes = elements[j].className || 'no-class';
            if (el1Classes.includes('canvas') || el2Classes.includes('canvas')) continue;
            overlapping.push({
              elem1: el1Classes.substring(0, 50),
              elem2: el2Classes.substring(0, 50)
            });
          }
        }
      }
      return overlapping.slice(0, 5);
    });

    if (elements.length > 0) {
      console.log('\n⚠️ Potentially overlapping elements found:');
      elements.forEach(pair => {
        console.log(`  - "${pair.elem1}" overlaps with "${pair.elem2}"`);
      });
    }

    console.log('\n✅ UI Test Complete - Check screenshots to see the actual state');
    console.log('   - desktop-view.png');
    console.log('   - mobile-view.png');
    console.log('   - tablet-view.png');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
})();