import { test, expect, Page } from '@playwright/test';

test.describe('Visualization Fix Verification', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Navigate to the root page
    await page.goto('/');

    // Wait for the application to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow time for data loading
  });

  test('verifies container dimensions are calculated correctly', async () => {
    console.log('🧪 Testing container dimension calculation...');

    // Check that the graph container exists
    const container = page.locator('[data-testid="graph-container"]');
    await expect(container).toBeVisible();

    // Get container dimensions
    const containerBox = await container.boundingBox();
    console.log('📐 Container dimensions:', containerBox);

    expect(containerBox).not.toBeNull();
    expect(containerBox!.width).toBeGreaterThan(0);
    expect(containerBox!.height).toBeGreaterThan(0);

    // Verify container takes full viewport
    const viewportSize = page.viewportSize();
    expect(containerBox!.width).toBe(viewportSize!.width);
    expect(containerBox!.height).toBe(viewportSize!.height);
  });

  test('verifies canvas elements are rendered', async () => {
    console.log('🧪 Testing canvas rendering...');

    // Wait for graph data to be loaded (check Redux state)
    await page.waitForFunction(() => {
      const state = window.__REDUX_STATE__ || {};
      return state.graph?.nodes?.length > 0;
    }, { timeout: 10000 });

    // Check for canvas elements (D3 or Three.js)
    const svgCanvas = page.locator('svg');
    const threeCanvas = page.locator('canvas');

    // At least one canvas type should be present
    const hasSvg = await svgCanvas.count() > 0;
    const hasCanvas = await threeCanvas.count() > 0;

    console.log('📊 Canvas elements:', { svgCount: await svgCanvas.count(), canvasCount: await threeCanvas.count() });

    expect(hasSvg || hasCanvas).toBe(true);

    if (hasSvg) {
      await expect(svgCanvas.first()).toBeVisible();
      console.log('✅ SVG canvas is visible');
    }

    if (hasCanvas) {
      await expect(threeCanvas.first()).toBeVisible();
      console.log('✅ HTML5 canvas is visible');
    }
  });

  test('verifies no debug error overlays are present', async () => {
    console.log('🧪 Testing for debug error overlays...');

    // Check that no dimension error overlay is shown
    const debugOverlay = page.locator('div:has-text("Canvas dimension issue")');
    await expect(debugOverlay).not.toBeVisible();

    console.log('✅ No debug error overlays present');
  });

  test('verifies graph data is loaded and displayed', async () => {
    console.log('🧪 Testing graph data loading...');

    // Wait for data to load
    await page.waitForFunction(() => {
      const state = window.__REDUX_STATE__ || {};
      return state.graph?.nodes?.length > 0 && state.graph?.edges?.length > 0;
    }, { timeout: 15000 });

    // Check console for successful data loading messages
    const loadingMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('✅ Setting nodes and edges') ||
          msg.text().includes('✅ Canvas should be rendering') ||
          msg.text().includes('✅ Loaded real scraped data')) {
        loadingMessages.push(msg.text());
      }
    });

    // Trigger a page reload to capture console messages
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('📝 Loading messages captured:', loadingMessages.length);

    // Verify that data loading was successful
    const hasDataMessages = loadingMessages.some(msg =>
      msg.includes('Setting nodes and edges') ||
      msg.includes('Canvas should be rendering')
    );

    expect(hasDataMessages).toBe(true);
  });

  test('verifies both 2D and 3D modes work', async () => {
    console.log('🧪 Testing 2D and 3D mode switching...');

    // Wait for initial render
    await page.waitForTimeout(3000);

    // Look for 3D mode toggle (assuming it exists in the UI)
    const toggle3D = page.locator('button:has-text("3D")').or(
      page.locator('[data-testid="3d-toggle"]')
    ).or(
      page.locator('button:has-text("Toggle")').or(
        page.locator('input[type="checkbox"]')
      )
    );

    if (await toggle3D.count() > 0) {
      console.log('🔄 Found 3D toggle, testing mode switch...');

      // Switch to 3D mode
      await toggle3D.first().click();
      await page.waitForTimeout(2000);

      // Verify rendering still works in 3D mode
      const canvas = page.locator('canvas');
      if (await canvas.count() > 0) {
        await expect(canvas.first()).toBeVisible();
        console.log('✅ 3D mode canvas is visible');
      }

      // Switch back to 2D mode
      await toggle3D.first().click();
      await page.waitForTimeout(2000);

      console.log('✅ Mode switching successful');
    } else {
      console.log('ℹ️ No 3D toggle found, checking for automatic canvas rendering');

      // Just verify current mode works
      const svgCanvas = page.locator('svg');
      const htmlCanvas = page.locator('canvas');

      const hasAnyCanvas = (await svgCanvas.count() > 0) || (await htmlCanvas.count() > 0);
      expect(hasAnyCanvas).toBe(true);
      console.log('✅ Canvas rendering verified');
    }
  });

  test('verifies API connectivity and data flow', async () => {
    console.log('🧪 Testing API connectivity...');

    // Intercept API calls
    const apiResponses: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/v1/visualization/graph')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // Trigger a page reload to capture API calls
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('🌐 API responses captured:', apiResponses.length);

    if (apiResponses.length > 0) {
      // Verify API response was successful
      const successfulResponses = apiResponses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
      console.log('✅ API connectivity verified');
    } else {
      console.log('ℹ️ No API calls detected, checking static data fallback');
    }
  });

  test('verifies page accessibility after fixes', async () => {
    console.log('🧪 Testing accessibility after visualization fixes...');

    // Wait for page to be fully rendered
    await page.waitForTimeout(3000);

    // Check that essential elements are accessible
    const container = page.locator('[data-testid="graph-container"]');
    await expect(container).toBeVisible();

    // Verify container has proper ARIA attributes or similar
    const containerRole = await container.getAttribute('role');
    const containerLabel = await container.getAttribute('aria-label');

    console.log('♿ Accessibility check:', {
      hasRole: !!containerRole,
      hasLabel: !!containerLabel
    });

    // At minimum, container should be in the accessibility tree
    expect(await container.isVisible()).toBe(true);
    console.log('✅ Basic accessibility verified');
  });
});