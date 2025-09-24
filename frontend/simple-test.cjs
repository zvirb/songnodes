const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Test port 3007 (local Vite)
    console.log('Testing port 3007...');

    await page.goto('http://localhost:3007', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for canvas
    const hasCanvas = await page.evaluate(() => {
      return document.querySelectorAll('canvas').length > 0;
    });

    // Check Redux store
    const storeInfo = await page.evaluate(() => {
      const store = window.__REDUX_STORE__;
      if (store) {
        const state = store.getState();
        return {
          nodes: state.graph?.nodes?.length || 0,
          edges: state.graph?.edges?.length || 0,
          loading: state.graph?.loading || false
        };
      }
      return null;
    });

    // Take screenshot
    await page.screenshot({ path: 'result.png', fullPage: true });

    console.log('Canvas present:', hasCanvas);
    if (storeInfo) {
      console.log('Redux store:', storeInfo);
    }
    console.log('Screenshot saved as result.png');

    if (hasCanvas && storeInfo && storeInfo.nodes > 0) {
      console.log('✅ SUCCESS: Graph visualization is working!');
      console.log(`📊 Displaying ${storeInfo.nodes} nodes and ${storeInfo.edges} edges`);
    } else {
      console.log('⚠️ Visualization not fully working yet');
    }

  } finally {
    await browser.close();
  }
})();