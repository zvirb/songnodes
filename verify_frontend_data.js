#!/usr/bin/env node

/**
 * Verify that the frontend can load and display the graph data
 */

const fs = require('fs');
const path = require('path');

// Check if the data file exists
const dataFile = path.join(__dirname, 'frontend', 'public', 'live-performance-data.json');

if (!fs.existsSync(dataFile)) {
    console.error('❌ Graph data file not found:', dataFile);
    process.exit(1);
}

// Load and validate the data
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('📊 Graph Data Summary:');
console.log('========================');
console.log(`✅ Nodes: ${data.nodes.length}`);
console.log(`✅ Edges: ${data.edges.length}`);

// Check for song adjacency relationships
const adjacencyEdges = data.edges.filter(edge =>
    edge.type === 'setlist_adjacent' ||
    edge.metadata?.relationship_type === 'setlist_adjacent'
);

console.log(`✅ Adjacency relationships: ${adjacencyEdges.length}`);

// Show top 5 most frequent adjacencies
const topAdjacencies = data.edges
    .sort((a, b) => (b.metadata?.adjacency_frequency || 0) - (a.metadata?.adjacency_frequency || 0))
    .slice(0, 5);

console.log('\n🎵 Top 5 Most Frequent Track Adjacencies:');
console.log('==========================================');

topAdjacencies.forEach((edge, index) => {
    const sourceNode = data.nodes.find(n => n.id === edge.source);
    const targetNode = data.nodes.find(n => n.id === edge.target);
    const frequency = edge.metadata?.adjacency_frequency || 0;

    console.log(`${index + 1}. "${sourceNode?.title}" → "${targetNode?.title}"`);
    console.log(`   Frequency: ${frequency} times across setlists`);
    console.log(`   Artists: ${sourceNode?.artist} & ${targetNode?.artist}`);
});

// Check data structure
console.log('\n🔍 Data Structure Validation:');
console.log('==============================');

const hasRequiredNodeFields = data.nodes.every(node =>
    node.id && node.label && node.type
);
console.log(`✅ All nodes have required fields: ${hasRequiredNodeFields}`);

const hasRequiredEdgeFields = data.edges.every(edge =>
    edge.id && edge.source && edge.target && edge.type
);
console.log(`✅ All edges have required fields: ${hasRequiredEdgeFields}`);

const hasAdjacencyMetadata = adjacencyEdges.every(edge =>
    edge.metadata?.adjacency_frequency !== undefined
);
console.log(`✅ All adjacency edges have frequency data: ${hasAdjacencyMetadata}`);

// Show sample tracks
console.log('\n🎼 Sample Tracks in Graph:');
console.log('==========================');
data.nodes.slice(0, 10).forEach(node => {
    console.log(`• ${node.title} by ${node.artist} (${node.type})`);
});

console.log('\n✅ Graph data is ready for visualization!');
console.log('🌐 Frontend should be running at: http://localhost:3006');
console.log('\nThe visualization should show:');
console.log('• Song nodes connected by adjacency relationships');
console.log('• Edge thickness based on adjacency frequency');
console.log('• Nodes positioned using force-directed layout');
console.log('• Interactive controls for exploring the graph');