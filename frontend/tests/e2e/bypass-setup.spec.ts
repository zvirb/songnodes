import { test, expect } from '@playwright/test';

// Override config to disable global setup for this test file
test.describe('Application Debug Test', () => {
  test('debug application errors', async ({ page }) => {
    // Track console messages
    const consoleMessages: Array<{ type: string; text: string }> = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });

      // Log important messages immediately
      if (msg.type() === 'error' || msg.text().includes('Error')) {
        console.log(`❌ Console ${msg.type()}:`, msg.text());
      }
    });

    // Track page errors
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
      console.log('❌ Page Error:', error.message);
    });

    try {
      console.log('🔍 Navigating to application at http://localhost:3009...');

      // Go to the application
      await page.goto('http://localhost:3009', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      console.log('✅ Page loaded, waiting for React...');

      // Wait for React to initialize
      await page.waitForTimeout(3000);

      // Check for React root
      const rootExists = await page.locator('#root').count() > 0;
      console.log('React root exists:', rootExists);

      // Check for error messages
      const errorElements = await page.locator('h2:has-text("Application Error")').count();
      console.log('Error elements found:', errorElements);

      if (errorElements > 0) {
        // Get the error container content
        const errorContent = await page.locator('div').filter({ hasText: 'Application Error' }).textContent();
        console.log('Error content:', errorContent);
      }

      // Check for graph container
      const graphContainer = await page.locator('[data-testid="graph-container"]').count();
      console.log('Graph container elements:', graphContainer);

      // Summary of console messages
      const errorMessages = consoleMessages.filter(m => m.type === 'error');
      const infoMessages = consoleMessages.filter(m =>
        m.text.includes('✅') ||
        m.text.includes('📊') ||
        m.text.includes('📐')
      );

      console.log('\n📊 Console Summary:');
      console.log(`Total messages: ${consoleMessages.length}`);
      console.log(`Error messages: ${errorMessages.length}`);
      console.log(`Info messages: ${infoMessages.length}`);
      console.log(`Page errors: ${pageErrors.length}`);

      if (errorMessages.length > 0) {
        console.log('\n❌ Error Messages:');
        errorMessages.forEach(msg => console.log(`  - ${msg.text}`));
      }

      if (pageErrors.length > 0) {
        console.log('\n❌ Page Errors:');
        pageErrors.forEach(error => console.log(`  - ${error}`));
      }

      // Take screenshot for debugging
      await page.screenshot({
        path: 'test-results/debug-application.png',
        fullPage: true
      });
      console.log('📸 Screenshot saved to test-results/debug-application.png');

      // The test should pass even if there are errors - we're just debugging
      expect(rootExists).toBe(true); // At minimum, React should mount

    } catch (error) {
      console.error('❌ Test failed:', error);

      // Take screenshot even on failure
      try {
        await page.screenshot({
          path: 'test-results/debug-failure.png',
          fullPage: true
        });
        console.log('📸 Failure screenshot saved');
      } catch (screenshotError) {
        console.log('Could not take screenshot:', screenshotError);
      }

      throw error;
    }
  });
});