const puppeteer = require('puppeteer');

async function test3DVisualization() {
  console.log('Starting 3D visualization test...');

  const browser = await puppeteer.launch({
    headless: 'new',
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

    console.log('Navigating to localhost:8088...');
    await page.goto('http://localhost:8088', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Page loaded, checking content...');

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Take a screenshot
    await page.screenshot({ path: 'frontend-test.png', fullPage: true });
    console.log('Screenshot saved as frontend-test.png');

    // Check for React app
    const reactRoot = await page.$('#root');
    console.log('React root found:', !!reactRoot);

    // Look for canvas elements
    const canvases = await page.$$('canvas');
    console.log('Canvas elements found:', canvases.length);

    // Check for any buttons
    const buttons = await page.$$eval('button', buttons =>
      buttons.map(btn => btn.textContent?.trim()).filter(Boolean)
    );
    console.log('Button texts:', buttons);

    // Look for 3D/2D text in the page
    const bodyText = await page.evaluate(() => document.body.textContent);
    const has3DText = bodyText.includes('3D') || bodyText.includes('2D');
    console.log('Page contains 3D/2D text:', has3DText);

    // Look for Three.js indicators
    const hasThreeJs = await page.evaluate(() => {
      return typeof window.THREE !== 'undefined' ||
             document.querySelector('script[src*="three"]') !== null ||
             document.body.textContent?.includes('three') === true;
    });
    console.log('Three.js indicators found:', hasThreeJs);

    // Check for errors in console
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logs.push(`ERROR: ${text}`);
      } else if (text.includes('3D') || text.includes('Three') || text.includes('WebGL') || text.includes('Canvas')) {
        logs.push(`${msg.type().toUpperCase()}: ${text}`);
      }
    });

    // Wait for graph data to load
    console.log('Waiting for graph data to load...');
    await page.waitForFunction(() => {
      const body = document.body.textContent || '';
      return body.includes('nodes') || body.includes('edges') ||
             document.querySelector('canvas') !== null ||
             body.includes('Loading') === false;
    }, { timeout: 10000 }).catch(() => {
      console.log('Timeout waiting for data, continuing...');
    });

    // Check for graph data indicators
    const graphDataInfo = await page.evaluate(() => {
      const body = document.body.textContent || '';
      const nodeMatch = body.match(/(\d+)\s*nodes?/i);
      const edgeMatch = body.match(/(\d+)\s*edges?/i);
      return {
        bodyText: body.substring(0, 500), // First 500 chars for debugging
        hasNodes: nodeMatch ? parseInt(nodeMatch[1]) : 0,
        hasEdges: edgeMatch ? parseInt(edgeMatch[1]) : 0,
        hasCanvas: !!document.querySelector('canvas')
      };
    });
    console.log('Graph data check:', graphDataInfo);

    console.log('Console errors:', logs);

    // First, try to click the Overview button to open the dropdown
    const overviewButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Overview'));
    });

    if (overviewButton && overviewButton.asElement) {
      console.log('Found Overview button, clicking to open dropdown...');
      await overviewButton.asElement().click();
      await page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});

      // Take screenshot of dropdown
      await page.screenshot({ path: 'frontend-overview-dropdown.png', fullPage: true });
      console.log('Screenshot after opening Overview dropdown saved');

      // Check if data is loading or needs to be loaded
      const needsDataLoad = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return !body.includes('nodes') && !body.includes('edges');
      });

      if (needsDataLoad) {
        console.log('No graph data visible, checking for load buttons...');

        // Look for any buttons that might trigger data loading
        const loadButtons = await page.$$eval('button', buttons =>
          buttons.map(btn => btn.textContent?.trim()).filter(text =>
            text && (text.includes('Load') || text.includes('Fetch') || text.includes('Data'))
          )
        );
        console.log('Potential data load buttons:', loadButtons);
      }
    }

    // Now look for 3D toggle button which should be in the dropdown
    const toggleButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn =>
        btn.textContent?.includes('3D Mode') ||
        btn.textContent?.includes('2D Mode')
      );
    });
    if (toggleButton && toggleButton.asElement) {
      console.log('Found 3D toggle button, clicking...');
      const buttonText = await page.evaluate(btn => btn.textContent, toggleButton);
      console.log('Button text before click:', buttonText);

      await toggleButton.asElement().click();
      await page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});

      // Check button text after click
      const newButtonText = await page.evaluate(btn => btn.textContent, toggleButton);
      console.log('Button text after click:', newButtonText);

      // Wait longer for 3D components to initialize and capture logs
      console.log('Waiting for 3D components to initialize...');
      await page.waitForFunction(() => true, { timeout: 8000 }).catch(() => {});
      console.log('Logs captured after 3D toggle:', logs);

      // Take another screenshot after toggle
      await page.screenshot({ path: 'frontend-after-3d-toggle.png', fullPage: true });
      console.log('Screenshot after 3D toggle saved');

      // Check if canvas elements appeared
      const canvasAfterToggle = await page.$$('canvas');
      console.log('Canvas elements after toggle:', canvasAfterToggle.length);

      // Wait a bit more for Three.js to initialize
      await page.waitForFunction(() => true, { timeout: 5000 }).catch(() => {});

      // Check canvas properties
      const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { found: false };

        try {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          const context2d = canvas.getContext('2d');

          return {
            found: true,
            width: canvas.width,
            height: canvas.height,
            hasWebGL: !!gl,
            has2D: !!context2d,
            webglVersion: gl ? gl.getParameter(gl.VERSION) : null,
            canvasClass: canvas.className,
            canvasStyle: canvas.style.cssText
          };
        } catch (e) {
          return {
            found: true,
            error: e.message,
            width: canvas.width,
            height: canvas.height
          };
        }
      });
      console.log('Canvas info after 3D toggle:', canvasInfo);

      // Check for Three.js specific content
      const hasThreeJsAfterToggle = await page.evaluate(() => {
        // Look for WebGL canvas or Three.js indicators
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          return !!context;
        }
        return false;
      });
      console.log('Three.js WebGL context after toggle:', hasThreeJsAfterToggle);

    } else {
      console.log('No 3D toggle button found in dropdown');

      // Look for any buttons containing 3D or 2D text
      const allButtons = await page.$$eval('button', buttons =>
        buttons.map(btn => btn.textContent?.trim()).filter(text =>
          text && (text.includes('3D') || text.includes('2D') || text.toLowerCase().includes('mode'))
        )
      );
      console.log('Buttons with 3D/2D/mode text:', allButtons);
    }

    console.log('Test completed successfully');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

test3DVisualization();