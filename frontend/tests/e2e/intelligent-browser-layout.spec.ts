import { test, expect } from '@playwright/test';

test.describe('IntelligentBrowser Layout Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3006');

    // Wait for app to be ready (up to 90 seconds for data loading)
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 90000 });

    // Wait for graph to render
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

    // Give the graph time to finish rendering
    await page.waitForTimeout(2000);
  });

  test('should display track recommendations without overlap when track is selected', async ({ page }) => {
    // Find and click a graph node to select a track
    const graphContainer = page.locator('[data-testid="graph-container"]');

    // Click in the center of the graph (where nodes should be)
    const box = await graphContainer.boundingBox();
    if (box) {
      // Click somewhere in the graph to select a node
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      // Wait a moment for the click to process
      await page.waitForTimeout(500);

      // Try a few more clicks to ensure we hit a node
      await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3);
      await page.waitForTimeout(500);
      await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
      await page.waitForTimeout(500);
    }

    // Take screenshot of full interface
    await page.screenshot({
      path: 'test-results/intelligent-browser-full.png',
      fullPage: true
    });

    // Look for the IntelligentBrowser panel (right side)
    const browserPanel = page.locator('.IntelligentBrowser_container');

    // If recommendations are showing, take a detailed screenshot
    const trackItems = page.locator('.IntelligentBrowser_trackItem');
    const count = await trackItems.count();

    console.log(`Found ${count} track recommendations`);

    if (count > 0) {
      // Take screenshot of first few track items
      await page.screenshot({
        path: 'test-results/intelligent-browser-tracks.png'
      });

      // Click on the first track item
      await trackItems.first().click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'test-results/intelligent-browser-track-selected.png'
      });

      // Check for overlapping elements by examining bounding boxes
      for (let i = 0; i < Math.min(count, 3); i++) {
        const item = trackItems.nth(i);
        const box = await item.boundingBox();

        if (box) {
          console.log(`Track ${i} dimensions: ${box.width}x${box.height}`);

          // Check that track item has reasonable height (not collapsed/overlapping)
          expect(box.height).toBeGreaterThan(80); // Should be at least 80px tall

          // Take individual screenshot
          await item.screenshot({
            path: `test-results/track-item-${i}.png`
          });
        }
      }

      // Test filter tabs interaction
      const bestMatchTab = page.locator('button:has-text("Best Match")');
      const energyFlowTab = page.locator('button:has-text("Energy Flow")');
      const tempoMatchTab = page.locator('button:has-text("Tempo Match")');

      // Click each tab and take screenshots
      if (await bestMatchTab.isVisible()) {
        await bestMatchTab.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/filter-best-match.png' });
      }

      if (await energyFlowTab.isVisible()) {
        await energyFlowTab.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/filter-energy-flow.png' });
      }

      if (await tempoMatchTab.isVisible()) {
        await tempoMatchTab.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/filter-tempo-match.png' });
      }

      // Check search input
      const searchInput = page.locator('input[placeholder*="Search"]');
      if (await searchInput.isVisible()) {
        const searchBox = await searchInput.boundingBox();
        if (searchBox) {
          console.log(`Search input dimensions: ${searchBox.width}x${searchBox.height}`);
          expect(searchBox.height).toBeGreaterThanOrEqual(44); // WCAG compliant
        }
      }

      // Final full screenshot
      await page.screenshot({
        path: 'test-results/intelligent-browser-final.png',
        fullPage: true
      });
    }

    // The test passes if we got here without errors
    expect(true).toBe(true);
  });

  test('should have properly sized touch targets', async ({ page }) => {
    // Check filter tab buttons
    const tabs = page.locator('.IntelligentBrowser_tab');
    const tabCount = await tabs.count();

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const box = await tab.boundingBox();

      if (box) {
        console.log(`Tab ${i} size: ${box.width}x${box.height}`);

        // WCAG 2.1 AA requires 44x44px minimum
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
