const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept API responses
  let nodeData = null;
  let edgeData = null;

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/graph/nodes')) {
      console.log('Nodes URL:', url);
      try {
        nodeData = await response.json();
        console.log('Nodes response:', {
          status: response.status(),
          nodeCount: nodeData.nodes?.length || 0,
          firstNode: nodeData.nodes?.[0]
        });
      } catch (e) {
        console.log('Failed to parse nodes response');
      }
    }
    if (url.includes('/api/graph/edges')) {
      try {
        edgeData = await response.json();
        console.log('Edges response:', {
          status: response.status(),
          edgeCount: edgeData.edges?.length || 0,
          firstEdge: edgeData.edges?.[0]
        });
      } catch (e) {
        console.log('Failed to parse edges response');
      }
    }
  });

  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(3000);

  // Check store state
  const storeData = await page.evaluate(() => {
    // Try to access the store if it's available in window
    if (window.__STORE__) {
      const state = window.__STORE__.getState();
      return {
        nodeCount: state.graph?.nodes?.length || 0,
        edgeCount: state.graph?.edges?.length || 0,
        filteredNodeCount: state.graph?.filteredNodes?.length || 0,
        filteredEdgeCount: state.graph?.filteredEdges?.length || 0
      };
    }
    return null;
  });

  console.log('Store state:', storeData);

  await browser.close();
})();