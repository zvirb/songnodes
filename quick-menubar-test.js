const { chromium } = require('playwright');

async function quickMenubarTest() {
  console.log('🚀 Quick Menubar Test Starting...');

  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    // Navigate to the page
    console.log('📍 Navigating to http://localhost:3006...');
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ path: 'initial-menubar.png', fullPage: false });
    console.log('📸 Initial screenshot taken');

    // Check if menubar exists
    const menubar = await page.locator('nav.fixed.top-6').first();
    const menubarExists = await menubar.count() > 0;
    console.log(`🔍 Menubar exists: ${menubarExists}`);

    if (menubarExists) {
      // Get menubar position
      const boundingBox = await menubar.boundingBox();
      console.log('📐 Menubar position:', boundingBox);

      // Check buttons
      const buttons = await page.locator('nav.fixed.top-6 button').count();
      console.log(`🔘 Number of buttons found: ${buttons}`);

      // Test Overview dropdown
      console.log('🧪 Testing Overview dropdown...');
      await page.locator('button:has-text("Overview")').click();
      await page.waitForTimeout(1000);

      // Take screenshot with dropdown
      await page.screenshot({ path: 'overview-dropdown.png', fullPage: false });

      const dropdowns = await page.locator('div.absolute.top-full').count();
      console.log(`📋 Dropdowns visible: ${dropdowns}`);

      // Test menubar stability
      const newBoundingBox = await menubar.boundingBox();
      const moved = Math.abs(newBoundingBox.x - boundingBox.x) > 2 ||
                   Math.abs(newBoundingBox.y - boundingBox.y) > 2;
      console.log(`📌 Menubar moved after dropdown: ${moved}`);

      // Close dropdown
      await page.locator('body').click({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(500);

      // Test other buttons
      const buttonNames = ['Legend', 'Search', 'Functions'];
      for (const buttonName of buttonNames) {
        console.log(`🧪 Testing ${buttonName} button...`);
        await page.locator(`button:has-text("${buttonName}")`).click();
        await page.waitForTimeout(500);

        const dropdownCount = await page.locator('div.absolute.top-full').count();
        console.log(`   ${buttonName} dropdown visible: ${dropdownCount === 1}`);

        await page.screenshot({ path: `${buttonName.toLowerCase()}-dropdown.png`, fullPage: false });

        // Close dropdown
        await page.locator('body').click({ position: { x: 100, y: 100 } });
        await page.waitForTimeout(500);
      }

      console.log('✅ Quick test completed successfully');
    } else {
      console.log('❌ Menubar not found on page');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

quickMenubarTest();