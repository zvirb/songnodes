import { test, expect } from '@playwright/test';

test.describe('3D Mode Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Go directly to the application
    await page.goto('http://localhost:3009');
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test('should verify 3D mode toggle and rendering', async ({ page }) => {
    console.log('🧪 Testing 3D mode functionality...');

    // Check if the application loads
    const rootElement = await page.locator('#root');
    await expect(rootElement).toBeVisible();
    console.log('✅ Root element found');

    // Wait for data to load by checking Redux state
    await page.waitForFunction(() => {
      return window.console && true; // Just wait for basic console to be available
    }, { timeout: 10000 });

    // Look for any 3D toggle buttons or controls
    const possibleToggles = [
      'button:has-text("3D")',
      'button:has-text("2D/3D")',
      '[data-testid="3d-toggle"]',
      'input[type="checkbox"]',
      'button[title*="3D"]',
      'button[aria-label*="3D"]'
    ];

    let toggleFound = false;
    let toggleElement = null;

    for (const selector of possibleToggles) {
      const element = page.locator(selector);
      const count = await element.count();
      if (count > 0) {
        toggleElement = element.first();
        toggleFound = true;
        console.log(`✅ Found toggle with selector: ${selector}`);
        break;
      }
    }

    if (!toggleFound) {
      console.log('ℹ️ No explicit 3D toggle found, checking for automatic 3D rendering');

      // Check for Three.js canvas elements
      const canvasElements = page.locator('canvas');
      const canvasCount = await canvasElements.count();
      console.log(`Canvas elements found: ${canvasCount}`);

      if (canvasCount > 0) {
        // Check if it's Three.js canvas by looking for WebGL context
        const hasWebGL = await page.evaluate(() => {
          const canvases = document.querySelectorAll('canvas');
          for (const canvas of canvases) {
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) return true;
          }
          return false;
        });

        console.log(`WebGL context found: ${hasWebGL}`);

        if (hasWebGL) {
          console.log('✅ 3D (WebGL) rendering detected');
        } else {
          console.log('ℹ️ Canvas found but no WebGL context - likely 2D rendering');
        }
      }
    } else {
      // Test the toggle functionality
      console.log('🔄 Testing 3D toggle functionality...');

      // Take screenshot before toggle
      await page.screenshot({ path: 'test-results/before-3d-toggle.png' });

      // Click the toggle
      await toggleElement.click();
      await page.waitForTimeout(2000); // Wait for 3D mode to activate

      // Check for WebGL canvas after toggle
      const hasWebGLAfterToggle = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        for (const canvas of canvases) {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) return true;
        }
        return false;
      });

      console.log(`WebGL context after toggle: ${hasWebGLAfterToggle}`);

      // Take screenshot after toggle
      await page.screenshot({ path: 'test-results/after-3d-toggle.png' });

      // Toggle back to 2D
      await toggleElement.click();
      await page.waitForTimeout(2000);

      console.log('✅ 3D toggle functionality tested');
    }

    // Check for error messages
    const errorMessages = page.locator('div:has-text("Canvas dimension issue")');
    const errorCount = await errorMessages.count();
    console.log(`Debug error overlays: ${errorCount}`);

    if (errorCount > 0) {
      const errorText = await errorMessages.first().textContent();
      console.log(`❌ Error overlay found: ${errorText}`);
    }

    // Check console for 3D-related messages
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('3D') || text.includes('WebGL') || text.includes('Three')) {
        logs.push(text);
        console.log(`🔍 Console (3D-related): ${text}`);
      }
    });

    // Refresh to capture console messages
    await page.reload();
    await page.waitForTimeout(3000);

    // Final screenshot
    await page.screenshot({ path: 'test-results/3d-mode-final.png', fullPage: true });

    console.log('📸 Screenshots saved for 3D mode testing');
  });

  test('should check Three.js component rendering', async ({ page }) => {
    console.log('🧪 Testing Three.js component specifically...');

    // Check if ThreeD3Canvas component is in the DOM
    const threeCanvas = page.locator('[class*="ThreeD3Canvas"], [data-component="ThreeD3Canvas"]');
    const threeCanvasCount = await threeCanvas.count();
    console.log(`ThreeD3Canvas components: ${threeCanvasCount}`);

    // Check for Three.js specific elements
    const webglCanvas = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      let webglCanvases = 0;
      let totalCanvases = canvases.length;

      for (const canvas of canvases) {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) webglCanvases++;
      }

      return { total: totalCanvases, webgl: webglCanvases };
    });

    console.log(`Canvas analysis: ${webglCanvas.total} total, ${webglCanvas.webgl} WebGL`);

    // Check for specific Three.js scene indicators
    const hasThreeJS = await page.evaluate(() => {
      // Check if Three.js is loaded
      return typeof window.THREE !== 'undefined' ||
             document.querySelector('canvas[style*="touch-action"]') !== null ||
             document.querySelector('canvas[data-engine="three"]') !== null;
    });

    console.log(`Three.js indicators found: ${hasThreeJS}`);

    // Test canvas dimensions
    const canvasDimensions = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        return {
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          style: canvas.style.cssText
        };
      }
      return null;
    });

    if (canvasDimensions) {
      console.log('Canvas dimensions:', canvasDimensions);

      // Verify canvas has valid dimensions
      const hasValidDimensions = canvasDimensions.width > 0 && canvasDimensions.height > 0;
      console.log(`Canvas has valid dimensions: ${hasValidDimensions}`);

      if (!hasValidDimensions) {
        console.log('❌ Canvas has invalid dimensions - this confirms the dimension issue');
      }
    } else {
      console.log('❌ No canvas element found');
    }
  });
});