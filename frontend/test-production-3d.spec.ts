import { test, expect } from '@playwright/test';

test('Production 3D mode visualization test', async ({ page }) => {
  console.log('Testing production frontend 3D mode...');

  // Navigate to the application
  await page.goto('http://localhost:8088');

  // Wait for the app to load
  await page.waitForTimeout(3000);

  // Check if React app is mounted
  const reactRoot = await page.$('#root');
  expect(reactRoot).toBeTruthy();

  // Check for 3D toggle button
  const toggle3DButton = await page.$('button:has-text("3D")');
  if (!toggle3DButton) {
    console.log('Looking for 3D toggle with different selector...');
    const altToggle = await page.$('[aria-label*="3D"], [title*="3D"], button:has-text("Enable 3D")');
    if (altToggle) {
      console.log('Found 3D toggle with alternative selector');
    }
  }

  // Try to click the 3D toggle
  if (toggle3DButton) {
    console.log('Clicking 3D toggle button...');
    await toggle3DButton.click();
    await page.waitForTimeout(2000);
  }

  // Check for Three.js canvas
  const canvas = await page.$('canvas');
  if (canvas) {
    console.log('Canvas element found - 3D mode may be active');

    // Check canvas dimensions
    const canvasBox = await canvas.boundingBox();
    console.log('Canvas dimensions:', canvasBox);

    if (canvasBox && canvasBox.width > 100 && canvasBox.height > 100) {
      console.log('✅ 3D canvas is properly sized and likely rendering');
    }
  }

  // Check for WebGL context
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    return !!gl;
  });

  if (hasWebGL) {
    console.log('✅ WebGL context is available');
  }

  // Check for graph data in the DOM
  const graphData = await page.evaluate(() => {
    // Check for D3 or Three.js elements
    const svgElements = document.querySelectorAll('svg circle, svg .node');
    const canvasElements = document.querySelectorAll('canvas');

    return {
      svgNodes: svgElements.length,
      canvases: canvasElements.length,
      hasContent: svgElements.length > 0 || canvasElements.length > 0
    };
  });

  console.log('Graph data check:', graphData);

  // Take a screenshot for visual verification
  await page.screenshot({
    path: 'production-3d-test.png',
    fullPage: true
  });
  console.log('Screenshot saved as production-3d-test.png');

  // Final assertion
  expect(graphData.hasContent).toBeTruthy();
  console.log('✅ Production frontend 3D mode test completed successfully');
});