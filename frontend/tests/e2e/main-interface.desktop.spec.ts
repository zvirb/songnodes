import { test, expect } from '@playwright/test';

/**
 * Main Interface Tests (DJInterface.tsx)
 * Testing all interactive elements from the functionality catalog
 */
test.describe('Main Interface - DJInterface.tsx', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for the app to fully load
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });

    // Wait for any initial animations to settle
    await page.waitForTimeout(2000);
  });

  test('should display all main interface elements', async ({ page }) => {
    // Take a baseline screenshot of the entire interface
    await expect(page).toHaveScreenshot('main-interface-baseline.png');

    // Verify mode toggle is present
    const modeToggle = page.locator('[data-testid="mode-toggle"]');
    await expect(modeToggle).toBeVisible();
    await expect(modeToggle).toHaveScreenshot('mode-toggle-initial.png');
  });

  test('should switch between Librarian and Performer modes', async ({ page }) => {
    const modeToggle = page.locator('[data-testid="mode-toggle"]');

    // Test mode switching
    await modeToggle.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('performer-mode-layout.png');

    // Switch back
    await modeToggle.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('librarian-mode-layout.png');
  });

  test('should toggle settings panel', async ({ page }) => {
    const settingsToggle = page.locator('[data-testid="settings-toggle"]');

    // Open settings panel
    await settingsToggle.click();
    await page.waitForTimeout(500);

    const settingsPanel = page.locator('[data-testid="settings-panel"]');
    await expect(settingsPanel).toBeVisible();
    await expect(settingsPanel).toHaveScreenshot('settings-panel-open.png');

    // Close settings panel
    await settingsToggle.click();
    await page.waitForTimeout(500);
    await expect(settingsPanel).not.toBeVisible();
  });

  test('should switch right panel tabs', async ({ page }) => {
    // Test Analysis tab
    const analysisTab = page.locator('[data-testid="right-panel-tab-analysis"]');
    await analysisTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="analysis-panel"]')).toBeVisible();
    await expect(page).toHaveScreenshot('analysis-tab-active.png');

    // Test Key & Mood tab
    const keyMoodTab = page.locator('[data-testid="right-panel-tab-keymood"]');
    await keyMoodTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="key-mood-panel"]')).toBeVisible();
    await expect(page).toHaveScreenshot('key-mood-tab-active.png');

    // Test Tidal tab
    const tidalTab = page.locator('[data-testid="right-panel-tab-tidal"]');
    await tidalTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="tidal-panel"]')).toBeVisible();
    await expect(page).toHaveScreenshot('tidal-tab-active.png');
  });

  test('should open track inspection modal', async ({ page }) => {
    // Wait for graph to load with data
    await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });

    // Click on a track/node
    const firstNode = page.locator('[data-testid="graph-node"]').first();
    await firstNode.click();

    // Verify track details modal opens
    const modal = page.locator('[data-testid="track-details-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveScreenshot('track-details-modal.png');

    // Test modal close
    const closeButton = modal.locator('[data-testid="modal-close"]');
    await closeButton.click();
    await expect(modal).not.toBeVisible();
  });

  test('should display now playing controls', async ({ page }) => {
    const nowPlaying = page.locator('[data-testid="now-playing"]');
    await expect(nowPlaying).toBeVisible();
    await expect(nowPlaying).toHaveScreenshot('now-playing-controls.png');

    // Test play/pause button
    const playButton = nowPlaying.locator('[data-testid="play-pause-button"]');
    if (await playButton.isVisible()) {
      await playButton.click();
      await page.waitForTimeout(500);
      await expect(nowPlaying).toHaveScreenshot('now-playing-playing.png');
    }
  });

  test('should show pipeline monitoring dashboard button', async ({ page }) => {
    const dashboardButton = page.locator('[data-testid="pipeline-dashboard-button"]');
    if (await dashboardButton.isVisible()) {
      await expect(dashboardButton).toHaveScreenshot('pipeline-dashboard-button.png');

      // Click to open dashboard (if implemented)
      await dashboardButton.click();
      await page.waitForTimeout(1000);

      // Check if dashboard modal or page opens
      const dashboard = page.locator('[data-testid="pipeline-dashboard"]');
      if (await dashboard.isVisible()) {
        await expect(dashboard).toHaveScreenshot('pipeline-dashboard-open.png');
      }
    }
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Test tab navigation through main interface elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('keyboard-nav-first-focus.png');

    // Continue tabbing through several elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }
    await expect(page).toHaveScreenshot('keyboard-nav-multiple-focus.png');
  });

  test('should handle responsive design', async ({ page }) => {
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('tablet-view.png');

    // Test mobile view
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('mobile-view.png');

    // Back to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
  });
});