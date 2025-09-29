import { test, expect } from '@playwright/test';

/**
 * Key & Mood Analysis Tests
 * Testing CamelotWheel.tsx, MoodVisualizer.tsx, and KeyMoodPanel.tsx
 */
test.describe('Key & Mood Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });

    // Navigate to Key & Mood tab
    const keyMoodTab = page.locator('[data-testid="right-panel-tab-keymood"]');
    await keyMoodTab.click();
    await page.waitForTimeout(1000);

    // Wait for panel to load
    await page.waitForSelector('[data-testid="key-mood-panel"]');
  });

  test('should display Key & Mood panel with all components', async ({ page }) => {
    const panel = page.locator('[data-testid="key-mood-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveScreenshot('key-mood-panel-full.png');
  });

  test('should expand and collapse panel', async ({ page }) => {
    const expandToggle = page.locator('[data-testid="key-mood-expand-toggle"]');

    // Collapse panel
    await expandToggle.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="key-mood-panel"]')).toHaveScreenshot('key-mood-collapsed.png');

    // Expand panel
    await expandToggle.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="key-mood-panel"]')).toHaveScreenshot('key-mood-expanded.png');
  });

  test('should switch between view tabs (Wheel/Flow/Both)', async ({ page }) => {
    // Test Wheel tab
    const wheelTab = page.locator('[data-testid="tab-wheel"]');
    await wheelTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="camelot-wheel"]')).toBeVisible();
    await expect(page).toHaveScreenshot('wheel-view-only.png');

    // Test Flow tab
    const flowTab = page.locator('[data-testid="tab-flow"]');
    await flowTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="mood-visualizer"]')).toBeVisible();
    await expect(page).toHaveScreenshot('flow-view-only.png');

    // Test Both tab
    const bothTab = page.locator('[data-testid="tab-both"]');
    await bothTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="camelot-wheel"]')).toBeVisible();
    await expect(page.locator('[data-testid="mood-visualizer"]')).toBeVisible();
    await expect(page).toHaveScreenshot('both-views.png');
  });

  test('should toggle playlist priority setting', async ({ page }) => {
    const playlistToggle = page.locator('[data-testid="playlist-priority-toggle"]');

    // Get initial state
    const initialState = await playlistToggle.isChecked();

    // Toggle setting
    await playlistToggle.click();
    await page.waitForTimeout(500);
    await expect(playlistToggle).not.toBeChecked({ checked: initialState });
    await expect(page).toHaveScreenshot('playlist-priority-toggled.png');

    // Toggle back
    await playlistToggle.click();
    await page.waitForTimeout(500);
    await expect(playlistToggle).toBeChecked({ checked: initialState });
  });

  test('should toggle harmonic suggestions setting', async ({ page }) => {
    const harmonicToggle = page.locator('[data-testid="harmonic-suggestions-toggle"]');

    // Get initial state
    const initialState = await harmonicToggle.isChecked();

    // Toggle setting
    await harmonicToggle.click();
    await page.waitForTimeout(500);
    await expect(harmonicToggle).not.toBeChecked({ checked: initialState });
    await expect(page).toHaveScreenshot('harmonic-suggestions-toggled.png');

    // Verify wheel updates with suggestions
    const wheel = page.locator('[data-testid="camelot-wheel"]');
    await expect(wheel).toHaveScreenshot('camelot-wheel-with-suggestions.png');
  });

  test('should interact with Camelot Wheel segments', async ({ page }) => {
    const wheel = page.locator('[data-testid="camelot-wheel"]');
    await expect(wheel).toBeVisible();

    // Take baseline screenshot
    await expect(wheel).toHaveScreenshot('camelot-wheel-baseline.png');

    // Click on different key segments
    const keySegments = wheel.locator('[data-testid^="key-segment-"]');
    const segmentCount = await keySegments.count();

    if (segmentCount > 0) {
      // Test clicking first segment (1A)
      const firstSegment = keySegments.first();
      await firstSegment.click();
      await page.waitForTimeout(500);
      await expect(wheel).toHaveScreenshot('camelot-wheel-1a-selected.png');

      // Test hover effect on another segment
      const secondSegment = keySegments.nth(1);
      await secondSegment.hover();
      await page.waitForTimeout(200);
      await expect(wheel).toHaveScreenshot('camelot-wheel-hover-effect.png');
    }
  });

  test('should display track counts on wheel segments', async ({ page }) => {
    const wheel = page.locator('[data-testid="camelot-wheel"]');

    // Look for track count indicators
    const trackCounts = wheel.locator('[data-testid^="track-count-"]');
    const countElements = await trackCounts.count();

    if (countElements > 0) {
      // Verify track counts are visible
      await expect(trackCounts.first()).toBeVisible();
      await expect(wheel).toHaveScreenshot('camelot-wheel-with-counts.png');
    }
  });

  test('should show connection lines between keys', async ({ page }) => {
    const wheel = page.locator('[data-testid="camelot-wheel"]');

    // Enable harmonic suggestions to see more connections
    const harmonicToggle = page.locator('[data-testid="harmonic-suggestions-toggle"]');
    await harmonicToggle.check();
    await page.waitForTimeout(500);

    // Look for connection lines
    const connections = wheel.locator('[data-testid^="key-connection-"]');
    const connectionCount = await connections.count();

    if (connectionCount > 0) {
      await expect(wheel).toHaveScreenshot('camelot-wheel-connections.png');
    }
  });

  test('should interact with Mood Visualizer', async ({ page }) => {
    // Ensure we're in Flow or Both view
    const bothTab = page.locator('[data-testid="tab-both"]');
    await bothTab.click();
    await page.waitForTimeout(500);

    const visualizer = page.locator('[data-testid="mood-visualizer"]');
    await expect(visualizer).toBeVisible();

    // Take baseline screenshot
    await expect(visualizer).toHaveScreenshot('mood-visualizer-baseline.png');

    // Test clicking on energy points
    const energyPoints = visualizer.locator('[data-testid^="energy-point-"]');
    const pointCount = await energyPoints.count();

    if (pointCount > 0) {
      // Click on first energy point
      const firstPoint = energyPoints.first();
      await firstPoint.click();
      await page.waitForTimeout(500);
      await expect(visualizer).toHaveScreenshot('mood-visualizer-point-selected.png');
    }
  });

  test('should display quick stats correctly', async ({ page }) => {
    const statsSection = page.locator('[data-testid="quick-stats"]');
    await expect(statsSection).toBeVisible();
    await expect(statsSection).toHaveScreenshot('quick-stats-display.png');

    // Verify individual stats
    const totalTracks = statsSection.locator('[data-testid="total-tracks-count"]');
    const connections = statsSection.locator('[data-testid="connections-count"]');
    const keysFound = statsSection.locator('[data-testid="keys-found-count"]');
    const playlistEdges = statsSection.locator('[data-testid="playlist-edges-count"]');

    // Check if stats display non-zero values (when data is loaded)
    if (await totalTracks.isVisible()) {
      const tracksText = await totalTracks.textContent();
      expect(tracksText).toMatch(/\d+/); // Should contain numbers
    }
  });

  test('should execute quick action buttons', async ({ page }) => {
    const actionsSection = page.locator('[data-testid="quick-actions"]');
    await expect(actionsSection).toBeVisible();

    // Test Shuffle View button
    const shuffleButton = actionsSection.locator('[data-testid="shuffle-view-button"]');
    await shuffleButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('after-shuffle-action.png');

    // Test Reset Filters button
    const resetButton = actionsSection.locator('[data-testid="reset-filters-button"]');
    await resetButton.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('after-reset-filters.png');

    // Test High Energy button
    const highEnergyButton = actionsSection.locator('[data-testid="high-energy-button"]');
    await highEnergyButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('high-energy-filter-applied.png');

    // Test Mellow button
    const mellowButton = actionsSection.locator('[data-testid="mellow-button"]');
    await mellowButton.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('mellow-filter-applied.png');
  });

  test('should display help text section', async ({ page }) => {
    const helpSection = page.locator('[data-testid="help-text"]');
    await expect(helpSection).toBeVisible();
    await expect(helpSection).toHaveScreenshot('help-text-section.png');

    // Verify help text contains expected instructions
    const helpText = await helpSection.textContent();
    expect(helpText).toContain('Camelot Wheel');
    expect(helpText).toContain('Energy Flow');
    expect(helpText).toContain('Playlist Priority');
    expect(helpText).toContain('Harmonic Suggestions');
  });

  test('should handle side panel vs main panel sizing', async ({ page }) => {
    // Test in side panel mode (smaller sizing)
    const panel = page.locator('[data-testid="key-mood-panel"]');
    await expect(panel).toHaveScreenshot('side-panel-sizing.png');

    // Test wheel sizing in side panel
    const wheel = page.locator('[data-testid="camelot-wheel"]');
    if (await wheel.isVisible()) {
      await expect(wheel).toHaveScreenshot('camelot-wheel-side-panel-size.png');
    }
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab through key components
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Should be able to navigate tabs with keyboard
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('keyboard-tab-navigation.png');

    // Test Enter to activate buttons
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('keyboard-button-activation.png');
  });
});