const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept API call to examine edge data
  let edgeData = null;
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/graph/edges')) {
      try {
        edgeData = await response.json();
        console.log('\n=== Edge Data Analysis ===');
        console.log('Total edges:', edgeData.edges?.length || 0);

        if (edgeData.edges?.length > 0) {
          // Sample first 10 edges to understand structure
          console.log('\nFirst 10 edges:');
          edgeData.edges.slice(0, 10).forEach((edge, i) => {
            console.log(`${i+1}. ${edge.source} -> ${edge.target} (weight: ${edge.weight || 'N/A'})`);
          });

          // Check for adjacency patterns
          const edgesBySource = {};
          edgeData.edges.forEach(edge => {
            if (!edgesBySource[edge.source]) edgesBySource[edge.source] = [];
            edgesBySource[edge.source].push(edge.target);
          });

          console.log('\nAnalyzing adjacency patterns...');
          let sampleCount = 0;
          for (const [source, targets] of Object.entries(edgesBySource)) {
            if (sampleCount < 5) {
              console.log(`Song ${source} connects to ${targets.length} other songs:`, targets.slice(0, 3).join(', ') + (targets.length > 3 ? '...' : ''));
              sampleCount++;
            }
          }

          // Check if this looks like sequential adjacency (should be 1-2 connections per song mostly)
          const connectionCounts = Object.values(edgesBySource).map(targets => targets.length);
          const avgConnections = connectionCounts.reduce((a, b) => a + b, 0) / connectionCounts.length;
          const maxConnections = Math.max(...connectionCounts);

          console.log(`\nConnection statistics:`);
          console.log(`Average connections per song: ${avgConnections.toFixed(2)}`);
          console.log(`Maximum connections for any song: ${maxConnections}`);
          console.log(`Songs with 1-2 connections: ${connectionCounts.filter(c => c <= 2).length}/${connectionCounts.length}`);

          if (avgConnections > 3) {
            console.log('⚠️  WARNING: High average connections suggests non-sequential adjacency data');
          } else {
            console.log('✅ Connection pattern looks reasonable for sequential adjacency');
          }
        }
      } catch (e) {
        console.log('Error parsing edge response:', e.message);
      }
    }
  });

  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(3000);

  await browser.close();
})();