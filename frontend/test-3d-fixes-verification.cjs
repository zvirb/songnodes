const puppeteer = require('puppeteer');

async function test3DVisualizationFixes() {
  console.log('🔧 Testing 3D visualization fixes...');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for visual verification
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=desktop',
      '--enable-accelerated-2d-canvas',
      '--disable-web-security',
      '--allow-running-insecure-content'
    ]
  });

  try {
    const page = await browser.newPage();

    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🌌') || text.includes('WebGL') || text.includes('Three')) {
        console.log('Browser Console:', text);
      }
    });

    // Enable error logging
    page.on('error', error => {
      console.error('Page Error:', error.message);
    });

    page.on('pageerror', error => {
      console.error('Page Error:', error.message);
    });

    console.log('Navigating to localhost:8091...');
    await page.goto('http://localhost:8091', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Page loaded, waiting for graph data...');
    await page.waitForFunction(() => {
      const body = document.body.textContent || '';
      return body.includes('Heroes') || body.includes('nodes') || body.includes('edges');
    }, { timeout: 15000 }).catch(() => {
      console.log('Timeout waiting for data, continuing...');
    });

    // Check initial state (should be 2D mode)
    const initialMode = await page.evaluate(() => {
      const debugOverlay = document.querySelector('.absolute.top-2.right-2');
      return debugOverlay ? debugOverlay.textContent : 'No debug overlay found';
    });
    console.log('Initial mode:', initialMode);

    // Take screenshot of 2D mode
    await page.screenshot({ path: 'frontend-2d-mode-fixed.png', fullPage: false });

    // Open Overview dropdown
    const overviewButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Overview'));
    });

    if (overviewButton && overviewButton.asElement) {
      console.log('Clicking Overview button...');
      await overviewButton.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Find and click 3D toggle
    const toggleButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn =>
        btn.textContent?.includes('2D Mode') || btn.textContent?.includes('3D Mode')
      );
    });

    if (toggleButton && toggleButton.asElement) {
      const buttonText = await page.evaluate(btn => btn.textContent, toggleButton);
      console.log('Found toggle button:', buttonText);
      console.log('Clicking 3D toggle...');

      await toggleButton.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for 3D initialization

      // Check for WebGL diagnostics in console
      await page.evaluate(() => {
        if (window.console && console.group) {
          console.log('🔧 Manual WebGL check...');
        }
      });

      // Check debug overlay after toggle
      const newMode = await page.evaluate(() => {
        const debugOverlay = document.querySelector('.absolute.top-2.right-2');
        return debugOverlay ? debugOverlay.textContent : 'No debug overlay found';
      });
      console.log('Mode after toggle:', newMode);

      // Comprehensive 3D verification
      const result = await page.evaluate(() => {
        // Check for canvas
        const canvas = document.querySelector('canvas');
        if (!canvas) return { hasCanvas: false };

        // Check for WebGL context
        try {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          const hasWebGL = !!gl;

          // Check for Three.js objects in the scene
          const mountDiv = document.querySelector('[style*=\"width\"][style*=\"height\"]');
          const hasThreeJSMount = !!mountDiv;

          // Check for error messages
          const errorMessage = document.querySelector('[style*=\"WebGL Not Compatible\"]') ||
                             document.querySelector('[style*=\"WebGL Not Available\"]');

          // Check for 3D mode indicator
          const debugOverlay = document.querySelector('.absolute.top-2.right-2');
          const is3DModeActive = debugOverlay?.textContent?.includes('3D Mode');

          return {
            hasCanvas: true,
            hasWebGL,
            hasThreeJSMount,
            hasErrorMessage: !!errorMessage,
            errorText: errorMessage?.textContent || null,
            is3DModeActive,
            debugOverlayText: debugOverlay?.textContent || null,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            canvasStyle: canvas.style.cssText,
            glVendor: hasWebGL ? gl.getParameter(gl.VENDOR) : null,
            glRenderer: hasWebGL ? gl.getParameter(gl.RENDERER) : null
          };
        } catch (e) {
          return {
            hasCanvas: true,
            error: e.message
          };
        }
      });

      console.log('🔧 3D Visualization Test Results:', JSON.stringify(result, null, 2));

      // Take screenshot of 3D mode
      await page.screenshot({ path: 'frontend-3d-mode-fixed.png', fullPage: false });

      // Final assessment
      if (result.hasErrorMessage) {
        console.log('❌ 3D Mode shows error message:', result.errorText);
      } else if (result.hasWebGL && result.is3DModeActive) {
        console.log('✅ SUCCESS: 3D visualization appears to be working!');
        console.log('WebGL Vendor:', result.glVendor);
        console.log('WebGL Renderer:', result.glRenderer);
      } else if (!result.hasWebGL) {
        console.log('⚠️ WebGL not available - this is expected in some environments');
      } else {
        console.log('❓ 3D mode toggled but status unclear');
      }

      // Keep browser open for manual inspection
      console.log('Keeping browser open for 15 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    } else {
      console.log('❌ Could not find 3D toggle button');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

test3DVisualizationFixes();