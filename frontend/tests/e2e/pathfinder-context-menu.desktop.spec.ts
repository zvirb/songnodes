import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Pathfinder Context Menu Integration
 *
 * Tests the right-click context menu functionality for:
 * - Graph nodes (PIXI.js canvas)
 * - Tracklist items
 * - Integration with PathfinderPanel via Zustand store
 */

test.describe('Pathfinder Context Menu Integration', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Navigate to the application
    await page.goto('http://localhost:3006');

    // Wait for the application to load
    await page.waitForLoadState('networkidle');

    // Wait for graph to be visible
    await page.waitForSelector('canvas', { timeout: 10000 });

    // Switch to Librarian mode by looking for the "Librarian" toggle button
    const librarianButton = page.getByText('Librarian').first();
    if (await librarianButton.isVisible()) {
      await librarianButton.click();
      await page.waitForTimeout(1000);
    }

    // Verify we're in Librarian mode by checking for the Library panel
    const libraryHeading = page.getByText('Library').first();
    await expect(libraryHeading).toBeVisible({ timeout: 5000 });

    // Open the Pathfinder panel
    const pathfinderTab = page.getByText('🗺️ Pathfinder').or(page.getByText('Pathfinder')).first();
    if (await pathfinderTab.isVisible()) {
      await pathfinderTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('should show context menu on right-click on graph node', async () => {
    // Find the canvas element
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Right-click near the center of the canvas
    // (assuming there are nodes rendered in the center)
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('Canvas not found');
    }

    await canvas.click({
      button: 'right',
      position: {
        x: box.width / 2,
        y: box.height / 2,
      },
    });

    // Wait for context menu to appear
    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Verify context menu has the expected sections
    await expect(contextMenu.getByText('Pathfinder')).toBeVisible();
    await expect(contextMenu.getByText(/Set as Start Track/i)).toBeVisible();
    await expect(contextMenu.getByText(/Set as End Track/i)).toBeVisible();
    await expect(contextMenu.getByText(/Add as Waypoint/i)).toBeVisible();
  });

  test('should show context menu on right-click on tracklist item', async () => {
    // Find the first track in the library/tracklist
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();

    // Wait for tracks to load
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    // Right-click on the track
    await firstTrack.click({ button: 'right' });

    // Wait for context menu to appear
    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Verify context menu shows track info
    await expect(contextMenu).toContainText(/BPM/i);
  });

  test('should set start track via context menu and reflect in PathfinderPanel', async () => {
    // Find a track in the tracklist
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    // Get the track name for verification
    const trackText = await firstTrack.textContent();
    const trackName = trackText?.split('•')[0].trim() || '';

    // Right-click to open context menu
    await firstTrack.click({ button: 'right' });

    // Wait for context menu
    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Click "Set as Start Track"
    const setStartButton = contextMenu.getByText(/Set as Start Track/i);
    await setStartButton.click();

    // Wait for context menu to close
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Verify the PathfinderPanel shows the selected start track
    const pathfinderPanel = page.locator('text=Start Track').locator('..').locator('..');
    await expect(pathfinderPanel).toContainText(trackName.substring(0, 20), { timeout: 5000 });
  });

  test('should set end track via context menu and reflect in PathfinderPanel', async () => {
    // Find a track in the tracklist
    const tracks = page.locator('button').filter({ hasText: /BPM/i });
    await expect(tracks.first()).toBeVisible({ timeout: 10000 });

    // Use the second track as end track (if available)
    const count = await tracks.count();
    const trackToUse = count > 1 ? tracks.nth(1) : tracks.first();

    // Get the track name for verification
    const trackText = await trackToUse.textContent();
    const trackName = trackText?.split('•')[0].trim() || '';

    // Right-click to open context menu
    await trackToUse.click({ button: 'right' });

    // Wait for context menu
    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Click "Set as End Track"
    const setEndButton = contextMenu.getByText(/Set as End Track/i);
    await setEndButton.click();

    // Wait for context menu to close
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Verify the PathfinderPanel shows the selected end track
    const pathfinderPanel = page.locator('text=End Track').locator('..').locator('..');
    await expect(pathfinderPanel).toContainText(trackName.substring(0, 20), { timeout: 5000 });
  });

  test('should add waypoint via context menu and reflect in PathfinderPanel', async () => {
    // Find a track in the tracklist
    const tracks = page.locator('button').filter({ hasText: /BPM/i });
    await expect(tracks.first()).toBeVisible({ timeout: 10000 });

    // Use the third track as waypoint (if available)
    const count = await tracks.count();
    const trackToUse = count > 2 ? tracks.nth(2) : tracks.first();

    // Get the track name for verification
    const trackText = await trackToUse.textContent();
    const trackName = trackText?.split('•')[0].trim() || '';

    // Right-click to open context menu
    await trackToUse.click({ button: 'right' });

    // Wait for context menu
    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Click "Add as Waypoint"
    const addWaypointButton = contextMenu.getByText(/Add as Waypoint/i);
    await addWaypointButton.click();

    // Wait for context menu to close
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Verify the PathfinderPanel shows the waypoint
    const waypointsSection = page.locator('text=Waypoints').locator('..').locator('..');
    await expect(waypointsSection).toContainText(trackName.substring(0, 20), { timeout: 5000 });
  });

  test('should remove waypoint via context menu', async () => {
    // First add a waypoint
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    // Add as waypoint
    await firstTrack.click({ button: 'right' });
    let contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    await contextMenu.getByText(/Add as Waypoint/i).click();
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Wait a bit for state to update
    await page.waitForTimeout(500);

    // Right-click again to remove
    await firstTrack.click({ button: 'right' });
    contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Now the button should say "Remove from Waypoints"
    const removeButton = contextMenu.getByText(/Remove from Waypoints/i);
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Context menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });
  });

  test('should clear start track via context menu', async () => {
    // First set a start track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    // Set as start track
    await firstTrack.click({ button: 'right' });
    let contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    await contextMenu.getByText(/Set as Start Track/i).click();
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Wait for state to update
    await page.waitForTimeout(500);

    // Right-click again to see clear option
    await firstTrack.click({ button: 'right' });
    contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Should show "Clear Start Track" option
    const clearButton = contextMenu.getByText(/Clear Start Track/i);
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Context menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // PathfinderPanel should show "Select Start Track" button again
    const selectButton = page.getByText(/Select Start Track/i);
    await expect(selectButton).toBeVisible({ timeout: 5000 });
  });

  test('should close context menu when clicking outside', async () => {
    // Open context menu
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });
    await firstTrack.click({ button: 'right' });

    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Click somewhere else on the page
    await page.click('body', { position: { x: 50, y: 50 } });

    // Context menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });
  });

  test('should close context menu when pressing Escape', async () => {
    // Open context menu
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });
    await firstTrack.click({ button: 'right' });

    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Press Escape key
    await page.keyboard.press('Escape');

    // Context menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });
  });

  test('should show visual indicators for selected tracks in context menu', async () => {
    // Set a track as start track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    await firstTrack.click({ button: 'right' });
    let contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    await contextMenu.getByText(/Set as Start Track/i).click();
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Wait for state update
    await page.waitForTimeout(500);

    // Right-click again
    await firstTrack.click({ button: 'right' });
    contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Should show "Start Track (Current)" with green styling
    const currentStartButton = contextMenu.getByText(/Start Track \(Current\)/i);
    await expect(currentStartButton).toBeVisible();

    // Verify the button has the green background class
    const buttonElement = contextMenu.locator('button').filter({ hasText: /Start Track \(Current\)/i });
    const classes = await buttonElement.getAttribute('class');
    expect(classes).toContain('bg-green-50');
    expect(classes).toContain('text-green-700');
  });

  test('should handle multiple tracks selection (start, end, waypoints)', async () => {
    const tracks = page.locator('button').filter({ hasText: /BPM/i });
    await expect(tracks.first()).toBeVisible({ timeout: 10000 });

    const count = await tracks.count();
    if (count < 3) {
      test.skip('Need at least 3 tracks for this test');
    }

    // Set first track as start
    await tracks.nth(0).click({ button: 'right' });
    let contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    await contextMenu.getByText(/Set as Start Track/i).click();
    await page.waitForTimeout(500);

    // Set second track as end
    await tracks.nth(1).click({ button: 'right' });
    contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    await contextMenu.getByText(/Set as End Track/i).click();
    await page.waitForTimeout(500);

    // Set third track as waypoint
    await tracks.nth(2).click({ button: 'right' });
    contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    await contextMenu.getByText(/Add as Waypoint/i).click();
    await page.waitForTimeout(500);

    // Verify all selections in PathfinderPanel
    const pathfinderContent = page.locator('text=DJ Set Pathfinder').locator('..').locator('..');
    await expect(pathfinderContent).toContainText(/Remove/i); // Start track shows Remove button

    // Check that the "Find Path" button is enabled (start track is selected)
    const findPathButton = page.getByRole('button', { name: /Find Path/i });
    await expect(findPathButton).toBeEnabled({ timeout: 5000 });
  });

  test('should adjust context menu position to stay on screen', async () => {
    // Find a track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    // Right-click near the edge of the viewport
    const box = await firstTrack.boundingBox();
    if (!box) {
      throw new Error('Track not found');
    }

    // Simulate right-click very close to the bottom-right edge
    await page.mouse.click(
      Math.min(box.x + box.width, page.viewportSize()!.width - 50),
      Math.min(box.y + box.height, page.viewportSize()!.height - 50),
      { button: 'right' }
    );

    // Context menu should appear
    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Get the context menu position
    const menuBox = await contextMenu.boundingBox();
    if (!menuBox) {
      throw new Error('Context menu not rendered');
    }

    // Verify the menu is within the viewport bounds
    const viewport = page.viewportSize()!;
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
  });

  test('should not show duplicate context menus', async () => {
    // Right-click multiple times quickly
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    await firstTrack.click({ button: 'right' });
    await page.waitForTimeout(100);
    await firstTrack.click({ button: 'right' });
    await page.waitForTimeout(100);
    await firstTrack.click({ button: 'right' });

    // Should only have one context menu visible
    const contextMenus = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    const count = await contextMenus.count();
    expect(count).toBe(1);
  });

  test('should show track details in context menu header', async () => {
    // Find a track
    const firstTrack = page.locator('button').filter({ hasText: /BPM/i }).first();
    await expect(firstTrack).toBeVisible({ timeout: 10000 });

    const trackText = await firstTrack.textContent();

    // Right-click
    await firstTrack.click({ button: 'right' });

    const contextMenu = page.locator('.fixed.z-50.bg-white.rounded-lg.shadow-2xl');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Verify the header shows track info
    const header = contextMenu.locator('.bg-gray-50').first();
    await expect(header).toBeVisible();

    // Should contain artist and BPM info
    await expect(header).toContainText(/BPM/i);
  });
});
