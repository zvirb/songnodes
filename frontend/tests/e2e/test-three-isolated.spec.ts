import { test, expect } from '@playwright/test';

test('Test Mode - Isolated Three.js Rendering', async ({ page }) => {
  console.log('🧪 Testing isolated Three.js rendering...');

  // Set viewport for consistent testing
  await page.setViewportSize({ width: 1280, height: 720 });

  // Enable console logging
  page.on('console', msg => console.log(`Console: ${msg.text()}`));

  // Navigate to test mode
  await page.goto('http://localhost:3007?mode=test3d');

  // Wait for the app to load
  await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

  // Take initial screenshot
  await page.screenshot({ path: 'test-results/test-mode-initial.png', fullPage: true });

  // Check if test mode is active
  const debugInfo = await page.locator('.absolute.top-2.right-2').textContent();
  console.log('Debug info:', debugInfo);

  expect(debugInfo).toContain('🧪 Test Mode');

  // Wait for Three.js to initialize
  await page.waitForTimeout(2000);

  // Check for canvas elements
  const canvasElements = await page.locator('canvas').count();
  console.log(`Found ${canvasElements} canvas elements`);

  expect(canvasElements).toBeGreaterThan(0);

  // Check for test node creation logs
  await page.waitForTimeout(1000);

  // Look for the test overlay
  const testOverlay = await page.locator('.absolute.top-4.left-4').textContent();
  console.log('Test overlay:', testOverlay);

  expect(testOverlay).toContain('🧪 3D Test Mode');
  expect(testOverlay).toContain('Rendering 5 test nodes');

  // Take final screenshot after rendering
  await page.screenshot({ path: 'test-results/test-mode-rendered.png', fullPage: true });

  console.log('✅ Isolated Three.js test completed successfully');
});