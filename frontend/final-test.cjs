const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    for (const port of [3006, 3007]) {
      console.log(`\nTesting port ${port}...`);

      await page.goto(`http://localhost:${port}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for canvas elements
      const canvasCount = await page.$$eval('canvas', elements => elements.length);
      console.log(`  Canvas elements: ${canvasCount}`);

      // Check for PIXI rendering
      const pixiInfo = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        if (canvases.length > 0) {
          const canvas = canvases[0];
          return {
            width: canvas.width,
            height: canvas.height,
            hasContent: canvas.getContext('2d') !== null || canvas.getContext('webgl') !== null
          };
        }
        return null;
      });

      if (pixiInfo) {
        console.log(`  Canvas size: ${pixiInfo.width}x${pixiInfo.height}, Has content: ${pixiInfo.hasContent}`);
      }

      // Check Redux store
      const storeData = await page.evaluate(() => {
        const store = window.__REDUX_STORE__;
        if (store) {
          const state = store.getState();
          return {
            nodes: state.graph?.nodes?.length || 0,
            edges: state.graph?.edges?.length || 0
          };
        }
        return null;
      });

      if (storeData) {
        console.log(`  Redux: ${storeData.nodes} nodes, ${storeData.edges} edges`);
      }

      // Check for errors in error boundary
      const hasError = await page.evaluate(() => {
        const errorEl = document.querySelector('.bg-red-900\\/50');
        return errorEl !== null;
      });

      console.log(`  Error boundary active: ${hasError}`);

      // Take screenshot
      await page.screenshot({
        path: `final-${port}.png`,
        fullPage: true
      });
      console.log(`  Screenshot saved: final-${port}.png`);
    }

  } finally {
    await browser.close();
  }

  console.log('\nTest complete!');
})();