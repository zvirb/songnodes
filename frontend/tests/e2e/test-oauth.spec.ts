import { test, expect } from '@playwright/test';

test.describe('SongNodes OAuth Testing', () => {
  test('should load the homepage and check for errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the site
    console.log('🌐 Navigating to http://localhost:3006...');
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle', timeout: 30000 });

    // Take a screenshot
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
    console.log('📸 Screenshot saved to test-results/homepage.png');

    // Wait for the app to load
    await page.waitForTimeout(2000);

    // Check page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    expect(title).toContain('SongNodes');

    // Check if main app is rendered
    const appElement = await page.locator('body').innerHTML();
    console.log('✅ Page loaded successfully');

    // Log any console errors
    if (consoleErrors.length > 0) {
      console.log('⚠️  Console errors detected:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    } else {
      console.log('✅ No console errors');
    }

    // Log any page errors
    if (pageErrors.length > 0) {
      console.log('❌ Page errors detected:');
      pageErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err.message}`));
    } else {
      console.log('✅ No page errors');
    }

    // Keep browser open for 5 seconds
    console.log('⏳ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
  });

  test('should find and test OAuth buttons', async ({ page }) => {
    console.log('🔐 Testing OAuth functionality...');
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Look for connection buttons
    const connectButtons = await page.locator('button:has-text("Connect"), button:has-text("Tidal"), button:has-text("Spotify")').all();
    console.log(`🔍 Found ${connectButtons.length} potential connection buttons`);

    for (const button of connectButtons) {
      const text = await button.textContent();
      console.log(`  - Button: "${text}"`);
    }

    // Take screenshot of interface
    await page.screenshot({ path: 'test-results/oauth-interface.png', fullPage: true });
    console.log('📸 OAuth interface screenshot saved');

    await page.waitForTimeout(3000);
  });
});
