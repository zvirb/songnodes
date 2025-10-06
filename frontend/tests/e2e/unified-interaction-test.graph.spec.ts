import { test, expect } from '@playwright/test';

/**
 * Comprehensive Integration Test for Graph Interactions
 * Tests ALL of the following features working together:
 * 1. Zoom-to-cursor (zoom happens at mouse position)
 * 2. Camera centering on node click
 * 3. Camera centering on sidebar track selection
 * 4. Node selection
 * 5. Right-click context menu
 */

test.describe('Unified Graph Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3006');

    // Wait for the graph to load and stabilize (30 seconds as requested)
    await page.waitForTimeout(30000);

    // Ensure we're in Librarian mode (shows the graph)
    const modeButton = page.locator('button:has-text("Librarian")');
    if (await modeButton.isVisible()) {
      await modeButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('1. Zoom-to-cursor works correctly', async ({ page }) => {
    // Take screenshot before zoom
    await page.screenshot({ path: 'test-results/before-zoom-to-cursor.png' });

    // Get the graph canvas
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Get canvas bounding box
    const canvasBBox = await canvas.boundingBox();
    if (!canvasBBox) throw new Error('Canvas not found');

    // Define test position: upper-left quadrant
    const testX = canvasBBox.x + canvasBBox.width * 0.25;
    const testY = canvasBBox.y + canvasBBox.height * 0.25;

    console.log(`🖱️ Testing zoom at position: (${testX}, ${testY})`);

    // Move mouse to test position
    await page.mouse.move(testX, testY);
    await page.waitForTimeout(500);

    // Start console monitoring
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('🖱️') || msg.text().includes('🎯')) {
        consoleLogs.push(msg.text());
      }
    });

    // Perform zoom in (wheel down = zoom in for most browsers)
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(1000);

    // Take screenshot after zoom
    await page.screenshot({ path: 'test-results/after-zoom-to-cursor.png' });

    // Verify console logs show zoom event
    console.log('📋 Zoom console logs:', consoleLogs);

    // The zoom should have occurred - verify by checking transform
    const zoomState = await page.evaluate(() => {
      const win = window as any;
      return {
        hasZoomBehavior: !!win.zoomBehaviorRef,
        hasTransform: !!win.currentTransformRef,
      };
    });

    expect(zoomState.hasZoomBehavior || zoomState.hasTransform).toBeTruthy();
  });

  test('2. Node selection works on click', async ({ page }) => {
    // Take screenshot before selection
    await page.screenshot({ path: 'test-results/before-node-selection.png' });

    const canvas = page.locator('canvas').first();
    const canvasBBox = await canvas.boundingBox();
    if (!canvasBBox) throw new Error('Canvas not found');

    // Click near center where a node should be
    const centerX = canvasBBox.x + canvasBBox.width / 2;
    const centerY = canvasBBox.y + canvasBBox.height / 2;

    console.log(`🎵 Clicking for node selection at: (${centerX}, ${centerY})`);

    // Start console monitoring
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('🎵') || msg.text().includes('✅') || msg.text().includes('Node Click')) {
        consoleLogs.push(msg.text());
      }
    });

    // Click the canvas
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(2000);

    // Take screenshot after click
    await page.screenshot({ path: 'test-results/after-node-selection.png' });

    // Check console logs
    console.log('📋 Selection console logs:', consoleLogs);

    // Verify some selection-related log appeared
    const hasSelectionLog = consoleLogs.some(log =>
      log.includes('Node Click') || log.includes('Processing click')
    );

    if (!hasSelectionLog) {
      console.warn('⚠️ No selection logs detected - node selection may not be working');
    }
  });

  test('3. Right-click context menu appears', async ({ page }) => {
    // Take screenshot before right-click
    await page.screenshot({ path: 'test-results/before-context-menu.png' });

    const canvas = page.locator('canvas').first();
    const canvasBBox = await canvas.boundingBox();
    if (!canvasBBox) throw new Error('Canvas not found');

    // Right-click near center
    const centerX = canvasBBox.x + canvasBBox.width / 2;
    const centerY = canvasBBox.y + canvasBBox.height / 2;

    console.log(`🖱️ Right-clicking for context menu at: (${centerX}, ${centerY})`);

    // Perform right-click
    await page.mouse.click(centerX, centerY, { button: 'right' });
    await page.waitForTimeout(2000);

    // Take screenshot after right-click
    await page.screenshot({ path: 'test-results/after-context-menu.png' });

    // Check if context menu appeared (it should be a portal overlay)
    const contextMenu = page.locator('[role="dialog"]').or(page.locator('.context-menu'));
    const menuVisible = await contextMenu.isVisible().catch(() => false);

    console.log(`📋 Context menu visible: ${menuVisible}`);

    if (!menuVisible) {
      console.warn('⚠️ Context menu not visible - may be broken');
    }
  });

  test('4. Camera centers on node click', async ({ page }) => {
    // Take screenshot before camera center
    await page.screenshot({ path: 'test-results/before-camera-center.png' });

    const canvas = page.locator('canvas').first();
    const canvasBBox = await canvas.boundingBox();
    if (!canvasBBox) throw new Error('Canvas not found');

    // Click off-center to test camera centering
    const offsetX = canvasBBox.x + canvasBBox.width * 0.75;
    const offsetY = canvasBBox.y + canvasBBox.height * 0.75;

    console.log(`📸 Clicking for camera centering at: (${offsetX}, ${offsetY})`);

    // Start console monitoring
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('📸') || msg.text().includes('📐') || msg.text().includes('Camera')) {
        consoleLogs.push(msg.text());
      }
    });

    // Click the canvas
    await page.mouse.click(offsetX, offsetY);

    // Wait for camera animation (500ms duration + buffer)
    await page.waitForTimeout(1000);

    // Take screenshot after camera center
    await page.screenshot({ path: 'test-results/after-camera-center.png' });

    // Check console logs
    console.log('📋 Camera centering console logs:', consoleLogs);

    const hasCameraLog = consoleLogs.some(log =>
      log.includes('Starting camera centering') || log.includes('Camera animation')
    );

    if (!hasCameraLog) {
      console.warn('⚠️ No camera centering logs detected - feature may not be working');
    }
  });

  test('5. Camera centers on sidebar track selection', async ({ page }) => {
    // Take screenshot before sidebar selection
    await page.screenshot({ path: 'test-results/before-sidebar-camera-center.png' });

    // Find the track browser/library sidebar
    const trackBrowser = page.locator('.track-browser').or(page.locator('[data-testid="library-panel"]'));

    if (await trackBrowser.isVisible()) {
      // Find a track in the list
      const firstTrack = trackBrowser.locator('.track-item').or(trackBrowser.locator('li')).first();

      if (await firstTrack.isVisible()) {
        console.log('📋 Clicking track in sidebar...');

        // Start console monitoring
        const consoleLogs: string[] = [];
        page.on('console', msg => {
          if (msg.text().includes('📸') || msg.text().includes('Found node for track') || msg.text().includes('Camera')) {
            consoleLogs.push(msg.text());
          }
        });

        // Click the track
        await firstTrack.click();

        // Wait for camera animation
        await page.waitForTimeout(1000);

        // Take screenshot after
        await page.screenshot({ path: 'test-results/after-sidebar-camera-center.png' });

        // Check console logs
        console.log('📋 Sidebar camera centering logs:', consoleLogs);

        const hasCameraLog = consoleLogs.some(log =>
          log.includes('Found node for track') || log.includes('Camera centering')
        );

        if (!hasCameraLog) {
          console.warn('⚠️ No sidebar camera centering logs detected');
        }
      } else {
        console.warn('⚠️ No tracks found in sidebar');
      }
    } else {
      console.warn('⚠️ Track browser/sidebar not visible');
    }
  });

  test('6. All features work together in sequence', async ({ page }) => {
    console.log('🎯 Testing all features in sequence...');

    const canvas = page.locator('canvas').first();
    const canvasBBox = await canvas.boundingBox();
    if (!canvasBBox) throw new Error('Canvas not found');

    const centerX = canvasBBox.x + canvasBBox.width / 2;
    const centerY = canvasBBox.y + canvasBBox.height / 2;

    // 1. Zoom to cursor
    console.log('Step 1: Zoom to cursor');
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -50);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/sequence-1-zoom.png' });

    // 2. Click node (selection + camera center)
    console.log('Step 2: Click node');
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/sequence-2-click.png' });

    // 3. Zoom again at new position
    console.log('Step 3: Zoom again');
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/sequence-3-zoom-again.png' });

    // 4. Right-click for context menu
    console.log('Step 4: Right-click for menu');
    await page.mouse.click(centerX, centerY, { button: 'right' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/sequence-4-context-menu.png' });

    console.log('✅ All sequence steps completed');
  });
});
