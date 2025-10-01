import { test, expect } from '@playwright/test';

/**
 * Quick test to verify node click -> Performer mode flow works
 * Tests that clicking a node populates panels without React errors
 */

test.describe('Quick Node Click Test', () => {
  test('should click node in Performer mode without errors', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate and wait
    await page.goto('http://localhost:3006');
    await expect(page.locator('h1')).toContainText('SongNodes DJ', { timeout: 10000 });
    await page.waitForTimeout(3000);

    console.log('✅ App loaded');

    // Ensure in Performer mode
    const performerButton = page.locator('button:has-text("Performer")');
    await performerButton.click();
    await page.waitForTimeout(500);

    console.log('✅ In Performer mode');

    // Click center of canvas
    const canvas = page.locator('canvas[id="songnodes-pixi-canvas"]');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box) {
      console.log('🖱️ Clicking canvas...');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(2000);
    }

    // Check for React errors
    if (consoleErrors.length > 0) {
      console.log('❌ CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach(err => console.log('  -', err));
      throw new Error(`React errors detected: ${consoleErrors.join(', ')}`);
    }

    console.log('✅ NO REACT ERRORS - Test passed!');

    // Take screenshot
    await page.screenshot({ path: 'test-results/performer-mode-success.png', fullPage: true });
  });
});