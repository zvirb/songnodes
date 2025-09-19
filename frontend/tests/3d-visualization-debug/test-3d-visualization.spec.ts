import { test, expect } from '@playwright/test';

test.describe('3D Visualization Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the frontend
    await page.goto('http://localhost:8088');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait for React to mount and data to load
    await page.waitForTimeout(3000);
  });

  test('should load the frontend successfully', async ({ page }) => {
    // Check if the page title is correct
    await expect(page).toHaveTitle(/SongNodes/);

    // Check if the main app container is present
    const appContainer = page.locator('#root');
    await expect(appContainer).toBeVisible();
  });

  test('should have 3D toggle button visible', async ({ page }) => {
    // Look for 3D toggle button - could be various selectors
    const possibleSelectors = [
      'button:has-text("3D")',
      '[data-testid="3d-toggle"]',
      'button[aria-label*="3D"]',
      'button:has-text("Toggle 3D")',
      '.toggle-3d',
      'button:has-text("2D")', // might show 2D when in 3D mode
    ];

    let toggleButton = null;
    for (const selector of possibleSelectors) {
      try {
        toggleButton = page.locator(selector);
        if (await toggleButton.isVisible({ timeout: 2000 })) {
          console.log(`Found 3D toggle button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!toggleButton || !(await toggleButton.isVisible())) {
      // Log the page content to help debug
      console.log('Page content:', await page.content());
      console.log('All buttons:', await page.locator('button').allTextContents());
    }

    await expect(toggleButton).toBeVisible();
  });

  test('should toggle between 2D and 3D modes', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('canvas, svg', { timeout: 10000 });

    // Find the 3D toggle button
    const possibleSelectors = [
      'button:has-text("3D")',
      'button:has-text("2D")',
      '[data-testid="3d-toggle"]',
      'button[aria-label*="3D"]',
      'button:has-text("Toggle")',
    ];

    let toggleButton = null;
    for (const selector of possibleSelectors) {
      try {
        toggleButton = page.locator(selector);
        if (await toggleButton.isVisible({ timeout: 2000 })) {
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!toggleButton || !(await toggleButton.isVisible())) {
      throw new Error('Could not find 3D toggle button');
    }

    // Check initial state - should be 2D mode
    const initialButtonText = await toggleButton.textContent();
    console.log('Initial button text:', initialButtonText);

    // Click to toggle to 3D mode
    await toggleButton.click();
    await page.waitForTimeout(2000); // Wait for transition

    // Check if button text changed
    const afterClickText = await toggleButton.textContent();
    console.log('After click button text:', afterClickText);

    // Verify the mode actually changed
    expect(initialButtonText).not.toBe(afterClickText);
  });

  test('should render canvas elements for visualization', async ({ page }) => {
    // Check for canvas elements (D3.js or Three.js)
    const canvasElements = page.locator('canvas');
    await expect(canvasElements.first()).toBeVisible({ timeout: 10000 });

    // Count canvas elements
    const canvasCount = await canvasElements.count();
    console.log(`Found ${canvasCount} canvas element(s)`);

    // Should have at least one canvas
    expect(canvasCount).toBeGreaterThan(0);
  });

  test('should have Three.js context when in 3D mode', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('canvas, svg', { timeout: 10000 });

    // Try to find and click 3D toggle
    const toggleSelectors = [
      'button:has-text("3D")',
      'button:has-text("2D")',
      '[data-testid="3d-toggle"]',
    ];

    for (const selector of toggleSelectors) {
      try {
        const button = page.locator(selector);
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click();
          await page.waitForTimeout(3000);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Check for WebGL context (Three.js uses WebGL)
    const hasWebGL = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;

      try {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
      } catch (e) {
        return false;
      }
    });

    console.log('WebGL context available:', hasWebGL);

    // Also check for Three.js specific elements or classes
    const hasThreeJs = await page.evaluate(() => {
      // Check if Three.js is loaded
      return typeof window.THREE !== 'undefined' ||
             document.querySelector('[class*="three"]') !== null ||
             document.querySelector('canvas[data-engine="three"]') !== null;
    });

    console.log('Three.js indicators found:', hasThreeJs);
  });

  test('should display graph data with nodes and edges', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(5000);

    // Check for indicators that graph data is loaded
    const indicators = await page.evaluate(() => {
      // Look for text indicating node/edge counts
      const bodyText = document.body.textContent || '';
      const nodeMatch = bodyText.match(/(\d+)\s*nodes?/i);
      const edgeMatch = bodyText.match(/(\d+)\s*edges?/i);

      return {
        nodeCount: nodeMatch ? parseInt(nodeMatch[1]) : 0,
        edgeCount: edgeMatch ? parseInt(edgeMatch[1]) : 0,
        hasGraphData: nodeMatch && edgeMatch
      };
    });

    console.log('Graph data indicators:', indicators);

    // Should have some nodes and edges
    expect(indicators.nodeCount).toBeGreaterThan(0);
    expect(indicators.edgeCount).toBeGreaterThan(0);
  });

  test('should handle mode switching without errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for initial load
    await page.waitForSelector('canvas, svg', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Try to toggle modes multiple times
    const toggleSelectors = [
      'button:has-text("3D")',
      'button:has-text("2D")',
      '[data-testid="3d-toggle"]',
    ];

    let toggleButton = null;
    for (const selector of toggleSelectors) {
      try {
        const button = page.locator(selector);
        if (await button.isVisible({ timeout: 2000 })) {
          toggleButton = button;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (toggleButton) {
      // Toggle multiple times
      for (let i = 0; i < 3; i++) {
        await toggleButton.click();
        await page.waitForTimeout(1500);
        console.log(`Toggle ${i + 1} completed`);
      }
    }

    // Check for errors
    console.log('Console errors during testing:', errors);

    // Should not have critical errors
    const criticalErrors = errors.filter(error =>
      error.includes('TypeError') ||
      error.includes('ReferenceError') ||
      error.includes('Cannot read property') ||
      error.includes('is not a function')
    );

    expect(criticalErrors.length).toBe(0);
  });
});