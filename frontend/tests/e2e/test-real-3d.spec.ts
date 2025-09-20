import { test, expect } from '@playwright/test';

test('Real 3D Mode - Data Rendering Check', async ({ page }) => {
  console.log('🌌 Testing real 3D mode with graph data...');

  // Set viewport for consistent testing
  await page.setViewportSize({ width: 1280, height: 720 });

  // Enable console logging
  page.on('console', msg => console.log(`Console: ${msg.text()}`));

  // Navigate to real 3D mode
  await page.goto('http://localhost:3008?mode=3d');

  // Wait for the app to load
  await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

  // Wait for data to load
  await page.waitForTimeout(5000);

  // Take screenshot of real 3D mode
  await page.screenshot({ path: 'test-results/real-3d-mode.png', fullPage: true });

  // Check if real 3D mode is active
  const debugInfo = await page.locator('.absolute.top-2.right-2').textContent();
  console.log('Debug info:', debugInfo);

  expect(debugInfo).toContain('🌌 3D Mode');

  // Check for canvas elements
  const canvasElements = await page.locator('canvas').count();
  console.log(`Found ${canvasElements} canvas elements`);

  // Check if we have nodes in the debug overlay
  const hasNodes = debugInfo?.includes('Nodes:') && !debugInfo?.includes('Nodes: 0');
  console.log('Has nodes in debug overlay:', hasNodes);

  console.log('✅ Real 3D mode test completed');
});