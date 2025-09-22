// Test script to simulate frontend API calls

async function testGraphAPI() {
  try {
    console.log('Testing graph API endpoints...\n');

    // Test nodes endpoint
    const nodesResponse = await fetch('http://localhost:8084/api/graph/nodes?limit=500');
    const nodesData = await nodesResponse.json();

    console.log('Nodes endpoint:');
    console.log('  Total nodes:', nodesData.nodes?.length || 0);
    console.log('  First node:', JSON.stringify(nodesData.nodes?.[0], null, 2));
    console.log('  Node types:', [...new Set(nodesData.nodes?.map(n => n.metadata?.node_type || 'unknown'))]);

    // Test edges endpoint
    const edgesResponse = await fetch('http://localhost:8084/api/graph/edges?limit=5000');
    const edgesData = await edgesResponse.json();

    console.log('\nEdges endpoint:');
    console.log('  Total edges:', edgesData.edges?.length || 0);
    console.log('  First edge:', JSON.stringify(edgesData.edges?.[0], null, 2));
    console.log('  Edge types:', [...new Set(edgesData.edges?.map(e => e.edge_type || 'unknown'))]);

    // Check what happens with filterToSongsOnly logic
    const isSongNode = (n) => {
      const nodeType = n.metadata?.node_type || '';
      console.log(`    Checking node ${n.id}: node_type="${nodeType}" -> ${nodeType === 'song' ? 'YES' : 'NO'}`);
      return nodeType === 'song';
    };

    console.log('\nApplying song filter (as frontend does):');
    const songNodes = nodesData.nodes?.filter(isSongNode) || [];
    console.log('  Song nodes after filter:', songNodes.length);

    // Check if we're correctly identifying track type from the dataLoader conversion
    console.log('\nAfter dataLoader conversion (type: "track"):');
    const convertedNodes = nodesData.nodes?.map(node => ({
      id: node.id,
      type: 'track', // dataLoader sets this to 'track'
      label: node.metadata?.label || ''
    }));

    const trackNodes = convertedNodes?.filter(n => {
      const t = (n.type || '').toLowerCase();
      const isTrack = t === 'track' || t === 'song';
      console.log(`    Node ${n.id}: type="${n.type}" -> ${isTrack ? 'YES' : 'NO'}`);
      return isTrack;
    });
    console.log('  Track nodes after conversion and filter:', trackNodes?.length || 0);

  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testGraphAPI();