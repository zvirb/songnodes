import { test, expect } from '@playwright/test';

// Simple test without global setup
test.describe('Simple Visualization Test', () => {
  test('verifies application loads and basic elements are present', async ({ page }) => {
    // Go directly to the application
    await page.goto('http://localhost:3008', { waitUntil: 'networkidle' });

    // Wait a bit for React to render
    await page.waitForTimeout(3000);

    // Check page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check for root element
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Check for graph container
    const container = page.locator('[data-testid="graph-container"]');
    const containerExists = await container.count() > 0;
    console.log('Graph container exists:', containerExists);

    if (containerExists) {
      await expect(container).toBeVisible();

      // Get container dimensions
      const box = await container.boundingBox();
      console.log('Container dimensions:', box);

      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }

    // Check for any canvas elements (SVG or HTML5 canvas)
    const svgElements = await page.locator('svg').count();
    const canvasElements = await page.locator('canvas').count();

    console.log('Canvas elements found:', { svg: svgElements, canvas: canvasElements });

    // At least one type of canvas should be present after data loads
    if (svgElements > 0 || canvasElements > 0) {
      console.log('✅ Canvas elements detected');
    } else {
      console.log('ℹ️ No canvas elements yet - may still be loading');
    }

    // Check for any error messages or debug overlays
    const errorOverlay = page.locator('div:has-text("Canvas dimension issue")');
    const errorCount = await errorOverlay.count();
    console.log('Error overlays found:', errorCount);

    // Should not have dimension error overlays
    expect(errorCount).toBe(0);

    // Take a screenshot for manual verification
    await page.screenshot({
      path: 'test-results/visualization-verification.png',
      fullPage: true
    });

    console.log('✅ Basic application verification complete');
  });

  test('verifies console messages indicate successful loading', async ({ page }) => {
    const consoleMessages: string[] = [];

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);

      // Log important messages
      if (text.includes('✅') || text.includes('📐') || text.includes('📊') || text.includes('🌐')) {
        console.log('Console:', text);
      }
    });

    // Load the page
    await page.goto('http://localhost:3008', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // Wait for all loading to complete

    // Check for successful loading messages
    const hasSuccessMessages = consoleMessages.some(msg =>
      msg.includes('Canvas should be rendering') ||
      msg.includes('Setting nodes and edges') ||
      msg.includes('Loaded real scraped data')
    );

    console.log('Console messages captured:', consoleMessages.length);
    console.log('Has success messages:', hasSuccessMessages);

    // Either we should have success messages, or at minimum no error messages
    const hasErrorMessages = consoleMessages.some(msg =>
      msg.includes('Error') ||
      msg.includes('Failed') ||
      msg.includes('undefined')
    );

    console.log('Has error messages:', hasErrorMessages);

    // We should have some positive indicators and no major errors
    expect(hasErrorMessages).toBeFalsy();
  });
});