const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Quick Diagnostic Test for SongNodes Menubar...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('📱 Setting viewport size...');
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('🌐 Navigating to localhost:3006...');
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle' });

    console.log('⏱️  Waiting for page to load...');
    await page.waitForTimeout(5000);

    console.log('📸 Taking initial screenshot...');
    await page.screenshot({
      path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/diagnostic-initial.png',
      fullPage: true
    });

    console.log('🔍 Searching for nav element...');
    const navElements = await page.locator('nav').count();
    console.log(`Found ${navElements} nav elements`);

    if (navElements > 0) {
      const navContent = await page.locator('nav').first().textContent();
      console.log('Nav content:', navContent);

      console.log('🔍 Looking for buttons in nav...');
      const buttons = await page.locator('nav button').count();
      console.log(`Found ${buttons} buttons in nav`);

      if (buttons > 0) {
        console.log('Button texts:');
        for (let i = 0; i < buttons; i++) {
          const buttonText = await page.locator('nav button').nth(i).textContent();
          console.log(`  ${i + 1}. "${buttonText}"`);
        }
      }
    }

    console.log('🔍 Looking for any menubar-related classes...');
    const menubarElements = await page.locator('[class*="menubar"], [class*="menu-bar"], [class*="nav-bar"]').count();
    console.log(`Found ${menubarElements} elements with menubar-related classes`);

    console.log('🔍 Looking for dropdown-related elements...');
    const dropdownElements = await page.locator('[class*="dropdown"], [class*="drop-down"]').count();
    console.log(`Found ${dropdownElements} elements with dropdown-related classes`);

    console.log('🔍 Testing Overview button click...');
    const overviewButton = page.locator('button:has-text("Overview")');
    const overviewCount = await overviewButton.count();
    console.log(`Found ${overviewCount} Overview buttons`);

    if (overviewCount > 0) {
      console.log('Clicking Overview button...');
      await overviewButton.click();
      await page.waitForTimeout(1000);

      console.log('📸 Taking screenshot after Overview click...');
      await page.screenshot({
        path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/diagnostic-overview-clicked.png',
        fullPage: true
      });

      console.log('🔍 Looking for Graph Overview dropdown...');
      const overviewDropdown = page.locator('div:has-text("Graph Overview")');
      const dropdownVisible = await overviewDropdown.isVisible();
      console.log(`Overview dropdown visible: ${dropdownVisible}`);

      if (dropdownVisible) {
        const dropdownText = await overviewDropdown.textContent();
        console.log('Dropdown content:', dropdownText);
      }
    }

    console.log('✅ Diagnostic test completed successfully!');

  } catch (error) {
    console.error('❌ Diagnostic test failed:', error);
  } finally {
    await browser.close();
  }
})();