const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept API calls
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/graph/')) {
      const data = await response.json().catch(() => null);
      if (data) {
        if (url.includes('nodes')) {
          console.log('Nodes API: Got', data.nodes ? data.nodes.length : 0, 'nodes');
          if (data.nodes && data.nodes[0]) {
            console.log('  First node ID:', data.nodes[0].id);
          }
        }
        if (url.includes('edges')) {
          console.log('Edges API: Got', data.edges ? data.edges.length : 0, 'edges');
        }
      }
    }
  });

  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(3000);
  await browser.close();
})();
