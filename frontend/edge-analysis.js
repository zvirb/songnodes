// Quick analysis of node/edge relationship issue
async function analyzeGraphData() {
  console.log('🔍 Analyzing graph data relationships...');

  try {
    // Fetch nodes and edges separately (same as frontend does)
    const [nodesResponse, edgesResponse] = await Promise.all([
      fetch('http://localhost:8080/api/graph/nodes?limit=500').then(r => r.json()),
      fetch('http://localhost:8080/api/graph/edges?limit=500').then(r => r.json())
    ]);

    const nodes = nodesResponse.nodes || [];
    const edges = edgesResponse.edges || [];

    console.log(`📊 Data loaded:`);
    console.log(`   Nodes: ${nodes.length}`);
    console.log(`   Edges: ${edges.length}`);

    // Create node ID set
    const nodeIds = new Set(nodes.map(n => n.id));
    console.log(`   Unique node IDs: ${nodeIds.size}`);

    // Analyze edges
    const validEdges = [];
    const invalidEdges = [];

    edges.forEach(edge => {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        validEdges.push(edge);
      } else {
        invalidEdges.push(edge);
      }
    });

    console.log(`\n🔗 Edge Analysis:`);
    console.log(`   Valid edges (both nodes exist): ${validEdges.length}`);
    console.log(`   Invalid edges (missing nodes): ${invalidEdges.length}`);
    console.log(`   Edge validity rate: ${(validEdges.length / edges.length * 100).toFixed(1)}%`);

    // Analyze which nodes have no edges
    const connectedNodes = new Set();
    validEdges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const isolatedNodes = nodes.filter(node => !connectedNodes.has(node.id));
    console.log(`\n🏝️  Node Connectivity:`);
    console.log(`   Connected nodes: ${connectedNodes.size}`);
    console.log(`   Isolated nodes (no edges): ${isolatedNodes.length}`);
    console.log(`   Node connectivity rate: ${(connectedNodes.size / nodes.length * 100).toFixed(1)}%`);

    // Show some example isolated nodes
    if (isolatedNodes.length > 0) {
      console.log(`\n📋 Example isolated nodes:`);
      isolatedNodes.slice(0, 5).forEach((node, i) => {
        console.log(`   ${i + 1}. ${node.metadata?.label || node.id}`);
      });
    }

    // Show some example invalid edges
    if (invalidEdges.length > 0) {
      console.log(`\n🔴 Example invalid edges (referencing missing nodes):`);
      invalidEdges.slice(0, 3).forEach((edge, i) => {
        const sourceExists = nodeIds.has(edge.source);
        const targetExists = nodeIds.has(edge.target);
        console.log(`   ${i + 1}. ${edge.source} -> ${edge.target}`);
        console.log(`      Source exists: ${sourceExists}, Target exists: ${targetExists}`);
      });
    }

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      validEdges: validEdges.length,
      invalidEdges: invalidEdges.length,
      connectedNodes: connectedNodes.size,
      isolatedNodes: isolatedNodes.length
    };

  } catch (error) {
    console.error('❌ Error analyzing graph data:', error);
    return null;
  }
}

// Run the analysis
analyzeGraphData().then(result => {
  if (result) {
    console.log('\n✅ Analysis complete!');
    console.log('\n📋 DIAGNOSIS:');
    if (result.isolatedNodes > 0) {
      console.log(`❌ ISSUE CONFIRMED: ${result.isolatedNodes} tracks appear without edges`);
      console.log(`   This happens because:`);
      console.log(`   1. Database has more nodes (${result.totalNodes}) than the edges reference`);
      console.log(`   2. Some tracks were added but their adjacency relationships weren't computed`);
      console.log(`   3. Edge creation process may have failed or been incomplete`);
    } else {
      console.log(`✅ No isolated nodes found - all tracks have connections`);
    }
  }
}).catch(console.error);