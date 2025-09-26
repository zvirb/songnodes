const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => {
    console.log(`Console [${msg.type()}]:`, msg.text());
  });

  await page.goto('http://localhost:3006/');
  console.log('Page loaded, waiting for graph to render...');

  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: 'ui-current-state.png' });
  console.log('Screenshot saved as ui-current-state.png');

  // Check graph data
  const graphInfo = await page.evaluate(() => {
    const nodeCount = document.querySelectorAll('circle').length ||
                     document.querySelectorAll('[data-node]').length || 0;
    const edgeCount = document.querySelectorAll('line').length ||
                     document.querySelectorAll('[data-edge]').length || 0;

    return {
      nodeCount,
      edgeCount,
      hasCanvas: !!document.querySelector('canvas'),
      canvasVisible: document.querySelector('canvas')?.offsetParent !== null
    };
  });

  console.log('Graph info:', graphInfo);

  await browser.close();
})();