import { test } from '@playwright/test';

test('Quick 3D Mode Check', async ({ page }) => {
  console.log('🔍 Quick 3D mode check...');

  // Set short timeout
  page.setDefaultTimeout(15000);

  // Navigate to 3D mode
  await page.goto('http://localhost:3007?mode=3d');

  // Wait for basic page load
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: 'test-results/quick-3d-check.png', fullPage: true });

  // Check basic elements
  const title = await page.title();
  console.log('Page title:', title);

  // Check debug info
  try {
    const debugInfo = await page.locator('.absolute.top-2.right-2').textContent();
    console.log('Debug info:', debugInfo);
  } catch (e) {
    console.log('No debug info found');
  }

  // Check for canvas
  const canvasCount = await page.locator('canvas').count();
  console.log('Canvas elements:', canvasCount);

  console.log('✅ Quick test completed');
});
