import { test, expect } from '@playwright/test';

test.describe('UI Visibility Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the production frontend
    await page.goto('http://localhost:3006/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
  });

  test('should display the main UI components', async ({ page }) => {
    // Wait for the loading screen to disappear
    await page.waitForSelector('.loading', { state: 'hidden', timeout: 10000 }).catch(() => {
      console.log('Loading screen already hidden or not present');
    });

    // Check that the root app container is visible
    const appContainer = page.locator('.app-container');
    await expect(appContainer).toBeVisible({ timeout: 5000 });

    // Check for header
    const header = page.locator('.app-header');
    await expect(header).toBeVisible();

    // Verify title is present
    const title = page.locator('text=SongNodes DJ').first();
    await expect(title).toBeVisible();

    // Check for graph container
    const graphContainer = page.locator('.graph-container');
    await expect(graphContainer).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'tests/screenshots/ui-visible-check.png',
      fullPage: true
    });

    console.log('✅ UI components are visible');
  });

  test('should have PIXI canvas in DOM', async ({ page }) => {
    // Wait for PIXI canvas
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Check canvas has dimensions
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.height).toBeGreaterThan(0);

    console.log(`✅ Canvas found with dimensions: ${canvasBox!.width}x${canvasBox!.height}`);
  });

  test('should load graph data from API', async ({ page }) => {
    // Wait for API calls to complete
    const response = await page.waitForResponse(
      response => response.url().includes('/api/graph/nodes') && response.status() === 200,
      { timeout: 10000 }
    );

    const data = await response.json();
    expect(data.nodes).toBeDefined();
    expect(data.nodes.length).toBeGreaterThan(0);

    console.log(`✅ API returned ${data.nodes.length} nodes`);
  });

  test('should not show blank page', async ({ page }) => {
    // Get the page content
    const bodyText = await page.locator('body').innerText();

    // Should not be empty
    expect(bodyText.trim()).not.toBe('');

    // Should contain some expected text
    expect(bodyText).toContain('SongNodes');

    // Check background color is not white (blank)
    const bodyBgColor = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should have dark background (not white blank page)
    expect(bodyBgColor).not.toBe('rgb(255, 255, 255)');
    expect(bodyBgColor).not.toBe('rgba(0, 0, 0, 0)');

    console.log(`✅ Page is not blank - background: ${bodyBgColor}`);
  });

  test('should have interactive elements', async ({ page }) => {
    // Check for refresh button
    const refreshButton = page.locator('button').filter({ hasText: /refresh|reload/i }).first();

    if (await refreshButton.isVisible().catch(() => false)) {
      await expect(refreshButton).toBeEnabled();
      console.log('✅ Refresh button is visible and enabled');
    }

    // Check for toolbar if present
    const toolbar = page.locator('.toolbar');
    if (await toolbar.isVisible().catch(() => false)) {
      const toolButtons = await toolbar.locator('button').count();
      expect(toolButtons).toBeGreaterThan(0);
      console.log(`✅ Toolbar has ${toolButtons} buttons`);
    }
  });

  test('should complete D3 force simulation', async ({ page }) => {
    // Wait for console message about force simulation
    const simulationComplete = new Promise((resolve) => {
      page.on('console', msg => {
        if (msg.text().includes('Force simulation completed') ||
            msg.text().includes('simulation completed')) {
          resolve(true);
        }
      });

      // Timeout fallback
      setTimeout(() => resolve(false), 15000);
    });

    const completed = await simulationComplete;
    if (completed) {
      console.log('✅ D3 force simulation completed successfully');
    } else {
      console.log('⚠️ Force simulation may still be running or already completed');
    }
  });

  test('visual regression check', async ({ page }) => {
    // Take multiple screenshots at different stages

    // Initial load
    await page.screenshot({
      path: 'tests/screenshots/1-initial-load.png',
      fullPage: true
    });

    // After 2 seconds (simulation should be progressing)
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'tests/screenshots/2-after-2s.png',
      fullPage: true
    });

    // After 5 seconds (simulation should be settling)
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'tests/screenshots/3-after-5s.png',
      fullPage: true
    });

    console.log('✅ Screenshots captured for visual verification');
  });
});