const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture console messages
    const consoleLogs = [];
    page.on('console', async msg => {
      const type = msg.type();
      let text = msg.text();

      // Try to extract actual error messages
      try {
        const args = msg.args();
        if (args.length > 0) {
          const firstArg = await args[0].jsonValue().catch(() => null);
          if (firstArg && typeof firstArg === 'object' && firstArg.message) {
            text = firstArg.message;
          }
        }
      } catch (e) {
        // Ignore extraction errors
      }

      consoleLogs.push({ type, text });
      if (type === 'error' && !text.includes('WebSocket')) {
        console.log(`❌ Error: ${text}`);
      }
    });

    // Test both frontends
    for (const port of [3006, 3007]) {
      console.log(`\n📍 Testing port ${port}...`);
      
      await page.goto(`http://localhost:${port}`, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for canvas elements
      const canvasCount = await page.$$eval('canvas', elements => elements.length);
      console.log(`  Canvas elements: ${canvasCount}`);
      
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
      
      // Check for force simulation logs
      const hasForceLayout = consoleLogs.some(log => 
        log.text.includes('Using fallback') || 
        log.text.includes('Force layout') ||
        log.text.includes('Using Web Worker')
      );
      console.log(`  Force layout: ${hasForceLayout ? '✅ Running' : '❌ Not detected'}`);
      
      // Check for error boundary
      const errorBoundaryMessage = await page.evaluate(() => {
        const errorEl = document.querySelector('.bg-red-900\\/50');
        if (errorEl) {
          const pre = errorEl.querySelector('pre');
          return pre ? pre.textContent : 'Error caught but no details';
        }
        return null;
      });

      if (errorBoundaryMessage) {
        console.log('  ⚠️ ErrorBoundary caught error:');
        console.log(errorBoundaryMessage.split('\n')[0]);
      }

      // Take screenshot
      await page.screenshot({
        path: `test-${port}.png`,
        fullPage: true
      });
      console.log(`  📸 Screenshot saved: test-${port}.png`);
      
      // Clear logs for next test
      consoleLogs.length = 0;
    }
    
  } finally {
    await browser.close();
  }
  
  console.log('\n✅ Quick test complete!');
})();
