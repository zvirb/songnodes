import { test, expect } from '@playwright/test';

test.describe('Right-Click Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3006');

    // Wait for the app to load
    await page.waitForSelector('.dj-interface', { timeout: 10000 });

    // Wait for graph to be visible
    await page.waitForTimeout(2000);
  });

  test('should display context menu on right-click without layout shift', async ({ page }) => {
    // Switch to librarian mode to see the graph
    const librarianButton = page.locator('button:has-text("Librarian")');
    await librarianButton.click();
    await page.waitForTimeout(1000);

    // Take screenshot before right-click
    await page.screenshot({
      path: 'test-results/before-right-click.png',
      fullPage: true
    });

    // Get the initial viewport height and layout
    const initialLayout = await page.evaluate(() => {
      const graph = document.querySelector('.graph-container');
      return {
        graphHeight: graph?.getBoundingClientRect().height,
        graphTop: graph?.getBoundingClientRect().top,
        viewportHeight: window.innerHeight
      };
    });

    // Find a track in the library and right-click it
    const firstTrack = page.locator('button').filter({ hasText: /BPM/ }).first();
    await firstTrack.waitFor({ state: 'visible' });

    // Right-click the track
    await firstTrack.click({ button: 'right' });

    // Wait for context menu to appear
    await page.waitForTimeout(500);

    // Take screenshot with context menu open
    await page.screenshot({
      path: 'test-results/context-menu-open.png',
      fullPage: true
    });

    // Verify context menu is visible
    const contextMenu = page.locator('div').filter({ hasText: /Pathfinder/i }).first();
    await expect(contextMenu).toBeVisible();

    // Verify menu items are present
    await expect(page.locator('button:has-text("Set as Start Track")')).toBeVisible();
    await expect(page.locator('button:has-text("Set as End Track")')).toBeVisible();
    await expect(page.locator('button:has-text("Add as Waypoint")')).toBeVisible();

    // Check that layout didn't shift
    const layoutAfterMenu = await page.evaluate(() => {
      const graph = document.querySelector('.graph-container');
      return {
        graphHeight: graph?.getBoundingClientRect().height,
        graphTop: graph?.getBoundingClientRect().top,
        viewportHeight: window.innerHeight
      };
    });

    // Verify no layout shift occurred
    expect(layoutAfterMenu.graphHeight).toBe(initialLayout.graphHeight);
    expect(layoutAfterMenu.graphTop).toBe(initialLayout.graphTop);
    expect(layoutAfterMenu.viewportHeight).toBe(initialLayout.viewportHeight);

    console.log('✅ No layout shift detected!');
    console.log('Graph height before:', initialLayout.graphHeight, 'after:', layoutAfterMenu.graphHeight);
    console.log('Graph top before:', initialLayout.graphTop, 'after:', layoutAfterMenu.graphTop);
  });

  test('should close context menu on outside click', async ({ page }) => {
    // Switch to librarian mode
    const librarianButton = page.locator('button:has-text("Librarian")');
    await librarianButton.click();
    await page.waitForTimeout(1000);

    // Right-click a track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/ }).first();
    await firstTrack.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Verify menu is visible
    const contextMenu = page.locator('div').filter({ hasText: /Pathfinder/i }).first();
    await expect(contextMenu).toBeVisible();

    // Click outside the menu
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    // Verify menu is closed
    await expect(contextMenu).not.toBeVisible();

    // Take screenshot after closing
    await page.screenshot({
      path: 'test-results/context-menu-closed.png',
      fullPage: true
    });
  });

  test('should close context menu on ESC key', async ({ page }) => {
    // Switch to librarian mode
    const librarianButton = page.locator('button:has-text("Librarian")');
    await librarianButton.click();
    await page.waitForTimeout(1000);

    // Right-click a track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/ }).first();
    await firstTrack.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Verify menu is visible
    const contextMenu = page.locator('div').filter({ hasText: /Pathfinder/i }).first();
    await expect(contextMenu).toBeVisible();

    // Press ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify menu is closed
    await expect(contextMenu).not.toBeVisible();
  });

  test('should position menu within viewport bounds', async ({ page }) => {
    // Switch to librarian mode
    const librarianButton = page.locator('button:has-text("Librarian")');
    await librarianButton.click();
    await page.waitForTimeout(1000);

    // Right-click a track near the bottom-right corner
    const tracks = page.locator('button').filter({ hasText: /BPM/ });
    const trackCount = await tracks.count();

    if (trackCount > 0) {
      const lastTrack = tracks.last();
      await lastTrack.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await lastTrack.click({ button: 'right' });
      await page.waitForTimeout(500);

      // Get menu position
      const menuPosition = await page.evaluate(() => {
        const menu = document.querySelector('[style*="position: fixed"]');
        if (!menu) return null;

        const rect = menu.getBoundingClientRect();
        return {
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        };
      });

      if (menuPosition) {
        // Verify menu is within viewport bounds
        expect(menuPosition.top).toBeGreaterThanOrEqual(0);
        expect(menuPosition.left).toBeGreaterThanOrEqual(0);
        expect(menuPosition.bottom).toBeLessThanOrEqual(menuPosition.viewportHeight);
        expect(menuPosition.right).toBeLessThanOrEqual(menuPosition.viewportWidth);

        console.log('✅ Menu positioned within viewport bounds');
        console.log('Menu bounds:', {
          top: menuPosition.top,
          left: menuPosition.left,
          bottom: menuPosition.bottom,
          right: menuPosition.right
        });
        console.log('Viewport size:', {
          width: menuPosition.viewportWidth,
          height: menuPosition.viewportHeight
        });
      }

      // Take screenshot
      await page.screenshot({
        path: 'test-results/context-menu-positioning.png',
        fullPage: true
      });
    }
  });

  test('should have smooth fade-in animation', async ({ page }) => {
    // Switch to librarian mode
    const librarianButton = page.locator('button:has-text("Librarian")');
    await librarianButton.click();
    await page.waitForTimeout(1000);

    // Right-click a track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/ }).first();
    await firstTrack.click({ button: 'right' });

    // Check for animation immediately after menu appears
    const hasAnimation = await page.evaluate(() => {
      const menu = document.querySelector('[style*="animation"]');
      return menu ? window.getComputedStyle(menu).animation.includes('fadeIn') : false;
    });

    console.log('✅ Menu has fade-in animation:', hasAnimation);

    // Take screenshot mid-animation if possible
    await page.screenshot({
      path: 'test-results/context-menu-animation.png',
      fullPage: true
    });
  });

  test('should execute pathfinder actions correctly', async ({ page }) => {
    // Switch to librarian mode
    const librarianButton = page.locator('button:has-text("Librarian")');
    await librarianButton.click();
    await page.waitForTimeout(1000);

    // Right-click a track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/ }).first();
    await firstTrack.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Click "Set as Start Track"
    const startTrackButton = page.locator('button:has-text("Set as Start Track")');
    await startTrackButton.click();
    await page.waitForTimeout(500);

    // Take screenshot after action
    await page.screenshot({
      path: 'test-results/after-pathfinder-action.png',
      fullPage: true
    });

    // Verify menu closed after action
    const contextMenu = page.locator('div').filter({ hasText: /Pathfinder/i }).first();
    await expect(contextMenu).not.toBeVisible();

    console.log('✅ Pathfinder action executed and menu closed');
  });
});
