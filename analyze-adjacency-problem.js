const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Analyzing adjacency problem in detail...');

  // Intercept both nodes and edges to analyze the relationships
  let nodeData = null;
  let edgeData = null;

  page.on('response', async response => {
    const url = response.url();
    try {
      if (url.includes('/api/graph/nodes')) {
        nodeData = await response.json();
        console.log('✓ Loaded', nodeData.nodes?.length || 0, 'nodes');
      }
      if (url.includes('/api/graph/edges')) {
        edgeData = await response.json();
        console.log('✓ Loaded', edgeData.edges?.length || 0, 'edges');

        // Deep analysis of adjacency patterns
        if (edgeData.edges?.length > 0) {
          console.log('\n=== DETAILED ADJACENCY ANALYSIS ===');

          // Group edges by weight to understand the pattern
          const weightGroups = {};
          edgeData.edges.forEach(edge => {
            const w = edge.weight || 0;
            if (!weightGroups[w]) weightGroups[w] = [];
            weightGroups[w].push(edge);
          });

          console.log('Edges grouped by weight:');
          Object.keys(weightGroups)
            .sort((a, b) => Number(b) - Number(a))
            .slice(0, 5)
            .forEach(weight => {
              console.log(`  Weight ${weight}: ${weightGroups[weight].length} edges`);
            });

          // Analyze source-target patterns
          const sourceTargetCounts = {};
          const targetSourceCounts = {};

          edgeData.edges.forEach(edge => {
            // Count outgoing connections
            if (!sourceTargetCounts[edge.source]) sourceTargetCounts[edge.source] = 0;
            sourceTargetCounts[edge.source]++;

            // Count incoming connections
            if (!targetSourceCounts[edge.target]) targetSourceCounts[edge.target] = 0;
            targetSourceCounts[edge.target]++;
          });

          const outgoingCounts = Object.values(sourceTargetCounts);
          const incomingCounts = Object.values(targetSourceCounts);

          console.log('\nOutgoing connections per song:');
          console.log(`  Min: ${Math.min(...outgoingCounts)}, Max: ${Math.max(...outgoingCounts)}`);
          console.log(`  Average: ${(outgoingCounts.reduce((a,b) => a+b, 0) / outgoingCounts.length).toFixed(2)}`);

          console.log('Incoming connections per song:');
          console.log(`  Min: ${Math.min(...incomingCounts)}, Max: ${Math.max(...incomingCounts)}`);
          console.log(`  Average: ${(incomingCounts.reduce((a,b) => a+b, 0) / incomingCounts.length).toFixed(2)}`);

          // For proper sequential adjacency, most songs should have:
          // - 1 outgoing connection (except last songs in setlists)
          // - 1 incoming connection (except first songs in setlists)
          const properOutgoing = outgoingCounts.filter(c => c <= 2).length;
          const properIncoming = incomingCounts.filter(c => c <= 2).length;

          console.log('\n=== ADJACENCY DIAGNOSIS ===');
          console.log(`Songs with proper outgoing connections (≤2): ${properOutgoing}/${outgoingCounts.length} (${((properOutgoing/outgoingCounts.length)*100).toFixed(1)}%)`);
          console.log(`Songs with proper incoming connections (≤2): ${properIncoming}/${incomingCounts.length} (${((properIncoming/incomingCounts.length)*100).toFixed(1)}%)`);

          if (properOutgoing / outgoingCounts.length < 0.8) {
            console.log('❌ PROBLEM: Most songs have too many outgoing connections');
            console.log('   Expected: Sequential adjacency (track n → track n+1)');
            console.log('   Actual: Songs connected to many non-adjacent tracks');
          } else {
            console.log('✅ Adjacency pattern looks correct');
          }
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  });

  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(3000);

  console.log('\n=== RECOMMENDATION ===');
  console.log('The visualization should only show edges between consecutive tracks in setlists.');
  console.log('For example, in a setlist [A, B, C, D], only show edges: A→B, B→C, C→D');
  console.log('Current data appears to have non-sequential relationships.');

  await browser.close();
})();