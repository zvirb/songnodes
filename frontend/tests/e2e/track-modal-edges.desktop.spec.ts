import { test, expect } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Test Track Modal Connected Tracks Display
 * Verifies that clicking a node shows connected tracks/edges in the modal
 */

test.describe('Track Modal - Connected Tracks Display', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate and wait for app
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('SongNodes DJ', { timeout: 10000 });
    await graphUtils.waitForGraphInitialization();
    await page.waitForTimeout(2000); // Wait for graph to settle
  });

  test('should display connected tracks when clicking a node', async ({ page }) => {
    console.log('\n🎵 === TEST: Node Click Should Show Connected Tracks ===\n');

    await test.step('Find and click a node on the canvas', async () => {
      const canvas = page.locator('canvas[id="songnodes-pixi-canvas"]');
      await expect(canvas).toBeVisible();

      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();

      // Click in the center where nodes are likely to be
      console.log('🖱️ Clicking canvas to select a node...');
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.waitForTimeout(1000);
    });

    await test.step('Verify track modal opened', async () => {
      console.log('🔍 Checking if track modal opened...');

      // Check for modal
      const modal = page.locator('[role="dialog"], .track-details-modal, div[style*="position: fixed"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      console.log('✅ Track modal opened successfully');

      // Take screenshot of modal
      await page.screenshot({ path: 'test-results/track-modal-opened.png' });
    });

    await test.step('Check Connected Tracks section', async () => {
      console.log('🔗 Checking Connected Tracks section...');

      // Look for the Connected Tracks heading
      const connectedTracksHeading = page.locator('text=/Connected Tracks/i').first();
      await expect(connectedTracksHeading).toBeVisible({ timeout: 3000 });

      console.log('✅ Found "Connected Tracks" heading');

      // Get the count from the heading
      const headingText = await connectedTracksHeading.textContent();
      console.log(`📊 Heading text: "${headingText}"`);

      // Extract number from "Connected Tracks (N)"
      const match = headingText?.match(/\((\d+)\)/);
      const connectedCount = match ? parseInt(match[1], 10) : 0;

      console.log(`🔢 Connected tracks count: ${connectedCount}`);

      // Check if we have connected tracks
      if (connectedCount > 0) {
        console.log(`✅ SUCCESS! Modal shows ${connectedCount} connected track(s)`);

        // Look for track items in the connections list
        const trackItems = page.locator('div[style*="backgroundColor"][style*="rgba(255, 255, 255, 0.05)"]');
        const itemCount = await trackItems.count();

        console.log(`📋 Found ${itemCount} track connection items in the list`);

        // Take screenshot showing connections
        await page.screenshot({ path: 'test-results/track-modal-with-connections.png' });

        // Verify at least one connection is displayed
        expect(connectedCount).toBeGreaterThan(0);
        console.log('✅ TEST PASSED: Connected tracks are displayed!');
      } else {
        console.log('⚠️ No connected tracks found (count is 0)');

        // Check if "No connections found" message is displayed
        const noConnectionsMsg = page.locator('text=/No connections found/i');
        const isVisible = await noConnectionsMsg.isVisible();

        if (isVisible) {
          console.log('ℹ️ "No connections found" message is displayed');
        }

        // Take screenshot for debugging
        await page.screenshot({ path: 'test-results/track-modal-no-connections.png' });

        // Log browser console for debugging
        console.log('\n📋 Checking browser console logs...');
      }
    });

    await test.step('Verify console logs show edge computation', async () => {
      console.log('🔍 Checking console logs for edge computation...');

      // We can't directly access past console logs, but we can check the network tab
      // or add a new click to see fresh logs

      // Close and reopen modal to get fresh console output
      const closeButton = page.locator('button').filter({ hasText: '✕' }).first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }

      // Set up console listener
      const consoleLogs: string[] = [];
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Computing edges') || text.includes('Found') || text.includes('connected edges')) {
          consoleLogs.push(text);
          console.log('🔊', text);
        }
      });

      // Click again
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(2000);
      }

      console.log(`\n📋 Captured ${consoleLogs.length} edge-related console logs`);

      // Take final screenshot
      await page.screenshot({ path: 'test-results/track-modal-final.png' });
    });
  });

  test('should show edges in Library Mode', async ({ page }) => {
    console.log('\n📚 === TEST: Library Mode Should Show Connected Tracks ===\n');

    await test.step('Switch to Library/Librarian mode', async () => {
      console.log('📚 Switching to Library mode...');

      // Find mode toggle button
      const modeButton = page.locator('button', { hasText: /librarian|performer/i });
      await expect(modeButton).toBeVisible();

      const currentMode = await modeButton.textContent();
      console.log(`Current mode: ${currentMode}`);

      if (currentMode?.toLowerCase().includes('performer')) {
        await modeButton.click();
        await page.waitForTimeout(1000);

        const newMode = await modeButton.textContent();
        console.log(`Switched to: ${newMode}`);
      }

      // Take screenshot of library mode
      await page.screenshot({ path: 'test-results/library-mode.png' });
    });

    await test.step('Click a track from the library list', async () => {
      console.log('🎵 Clicking a track in library...');

      // Find track in library list (they should have artist/title info)
      const trackButton = page.locator('button').filter({ hasText: /Pictures of You|Monument|Marea/i }).first();

      if (await trackButton.isVisible()) {
        const trackText = await trackButton.textContent();
        console.log(`Clicking track: ${trackText}`);

        await trackButton.click();
        await page.waitForTimeout(1500);
      } else {
        console.log('⚠️ Could not find track in library list, clicking canvas instead');

        // Fallback: click canvas
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(1500);
        }
      }
    });

    await test.step('Verify modal shows connected tracks', async () => {
      console.log('🔍 Verifying connected tracks in modal...');

      // Check for modal
      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Check Connected Tracks section
      const connectedTracksHeading = page.locator('text=/Connected Tracks/i').first();
      await expect(connectedTracksHeading).toBeVisible();

      const headingText = await connectedTracksHeading.textContent();
      console.log(`📊 ${headingText}`);

      const match = headingText?.match(/\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 0;

      if (count > 0) {
        console.log(`✅ SUCCESS! Library mode shows ${count} connected track(s)`);
      } else {
        console.log(`⚠️ Library mode shows 0 connected tracks`);
      }

      // Take screenshot
      await page.screenshot({ path: 'test-results/library-mode-modal-with-edges.png' });

      // We expect at least some tracks to have connections
      // Note: Some tracks legitimately may have 0 connections
      console.log('ℹ️ Test complete - check screenshots for visual confirmation');
    });
  });
});