const puppeteer = require('puppeteer');

async function test3DVisualizationVisual() {
  console.log('Starting VISUAL 3D visualization test...');

  const browser = await puppeteer.launch({
    headless: false, // Show the browser window
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=desktop',
      '--enable-accelerated-2d-canvas'
    ]
  });

  try {
    const page = await browser.newPage();

    console.log('Navigating to localhost:8088...');
    await page.goto('http://localhost:8088', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Page loaded, waiting for graph data...');
    await page.waitForFunction(() => {
      const body = document.body.textContent || '';
      return body.includes('Heroes') || body.includes('nodes') || body.includes('edges');
    }, { timeout: 10000 }).catch(() => {
      console.log('Timeout waiting for data, continuing...');
    });

    // Open Overview dropdown
    const overviewButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Overview'));
    });

    if (overviewButton && overviewButton.asElement) {
      console.log('Clicking Overview button...');
      await overviewButton.asElement().click();
      await page.waitForTimeout(1000);
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
      await page.waitForTimeout(3000);

      // Check for canvas and WebGL
      const result = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { hasCanvas: false };

        try {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          return {
            hasCanvas: true,
            hasWebGL: !!gl,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            glVendor: gl ? gl.getParameter(gl.VENDOR) : null,
            glRenderer: gl ? gl.getParameter(gl.RENDERER) : null
          };
        } catch (e) {
          return {
            hasCanvas: true,
            error: e.message
          };
        }
      });

      console.log('3D Visualization Result:', result);

      if (result.hasWebGL) {
        console.log('🎉 SUCCESS: 3D visualization is working!');
        console.log('WebGL Vendor:', result.glVendor);
        console.log('WebGL Renderer:', result.glRenderer);
      } else {
        console.log('❌ WebGL not available:', result.error || 'Unknown reason');
      }

      // Keep browser open for 10 seconds to see the result
      console.log('Keeping browser open for 10 seconds to observe...');
      await page.waitForTimeout(10000);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

test3DVisualizationVisual();