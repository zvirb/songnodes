import { test, expect } from '@playwright/test';

test.describe('Simple Load Test', () => {
  test('should load the homepage and take screenshots', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Navigate to the application
    console.log('Navigating to http://localhost:3006...');
    await page.goto('http://localhost:3006');
    
    // Take screenshot immediately after navigation
    await page.screenshot({ path: 'test-results/initial-navigation.png', fullPage: true });
    
    // Wait for network to be idle
    await page.waitForLoadState('networkidle');
    
    // Take another screenshot after network is idle
    await page.screenshot({ path: 'test-results/after-network-idle.png', fullPage: true });
    
    // Wait a bit more for React to initialize
    await page.waitForTimeout(5000);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/after-react-init.png', fullPage: true });
    
    // Log page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`Page title: ${title}`);
    console.log(`Page URL: ${url}`);
    
    // Get page content
    const bodyText = await page.textContent('body');
    console.log(`Body text length: ${bodyText?.length || 0}`);
    console.log(`Body text preview: ${bodyText?.substring(0, 200)}...`);
    
    // Check for React app root
    const reactRoot = page.locator('#root');
    const reactRootExists = await reactRoot.count() > 0;
    console.log(`React root exists: ${reactRootExists}`);
    
    if (reactRootExists) {
      const rootContent = await reactRoot.textContent();
      console.log(`React root content length: ${rootContent?.length || 0}`);
    }
    
    // Check for any visible elements
    const allElements = page.locator('*:visible');
    const visibleCount = await allElements.count();
    console.log(`Visible elements count: ${visibleCount}`);
    
    // Look for common elements
    const hasCanvas = await page.locator('canvas').count() > 0;
    const hasSvg = await page.locator('svg').count() > 0;
    const hasButtons = await page.locator('button').count() > 0;
    const hasDivs = await page.locator('div').count() > 0;
    
    console.log(`Has canvas: ${hasCanvas}`);
    console.log(`Has SVG: ${hasSvg}`);
    console.log(`Has buttons: ${hasButtons}`);
    console.log(`Has divs: ${hasDivs}`);
    
    // Log any errors found
    console.log(`Console errors: ${errors.length}`);
    errors.forEach((error, index) => {
      console.log(`Error ${index + 1}: ${error}`);
    });
    
    console.log(`Page errors: ${pageErrors.length}`);
    pageErrors.forEach((error, index) => {
      console.log(`Page Error ${index + 1}: ${error.message}`);
    });
    
    // Basic assertion - page should at least load
    expect(title).toBeTruthy();
    expect(url).toBe('http://localhost:3006/');
  });
});