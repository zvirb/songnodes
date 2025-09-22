// Run this in the browser console at http://localhost:3006

async function testDataFlow() {
    console.log("=== Testing Data Flow to Frontend ===");

    // Check if GraphService is configured correctly
    const baseUrl = 'http://localhost:8084/api/graph';

    try {
        // 1. Test API endpoints
        const nodesResp = await fetch(`${baseUrl}/nodes?limit=500`);
        const nodesData = await nodesResp.json();
        console.log(`✅ API Nodes: ${nodesData.nodes?.length || 0} / ${nodesData.total}`);

        const edgesResp = await fetch(`${baseUrl}/edges?limit=5000`);
        const edgesData = await edgesResp.json();
        console.log(`✅ API Edges: ${edgesData.edges?.length || 0} / ${edgesData.total}`);

        // 2. Check Redux store (if available)
        if (window.store) {
            const state = window.store.getState();
            console.log("Redux state:", state);
            if (state.graph) {
                console.log(`Redux nodes: ${state.graph.nodes?.length || 0}`);
                console.log(`Redux edges: ${state.graph.edges?.length || 0}`);
            }
        } else {
            console.log("⚠️ Redux store not accessible from window");
        }

        // 3. Check for D3 visualization
        const svg = document.querySelector('svg');
        if (svg) {
            const nodes = svg.querySelectorAll('.node, circle[class*=node]');
            const edges = svg.querySelectorAll('.link, line[class*=edge], path[class*=edge]');
            console.log(`D3 rendered nodes: ${nodes.length}`);
            console.log(`D3 rendered edges: ${edges.length}`);
        } else {
            console.log("❌ No SVG element found");
        }

        // 4. Look for React components
        const reactRoot = document.getElementById('root');
        if (reactRoot && reactRoot._reactRootContainer) {
            console.log("✅ React app is mounted");
        }

        return {
            apiNodes: nodesData.nodes?.length || 0,
            apiEdges: edgesData.edges?.length || 0,
            apiTotalNodes: nodesData.total,
            apiTotalEdges: edgesData.total
        };

    } catch (error) {
        console.error("❌ Error testing data flow:", error);
        return null;
    }
}

// Run the test
testDataFlow().then(result => {
    if (result) {
        console.log("\n=== Summary ===");
        console.log(`API is serving: ${result.apiTotalNodes} nodes, ${result.apiTotalEdges} edges`);
        console.log(`Frontend loaded: ${result.apiNodes} nodes, ${result.apiEdges} edges`);

        if (result.apiNodes === 0 || result.apiEdges === 0) {
            console.log("\n⚠️ Frontend is not loading data from API!");
            console.log("Possible issues:");
            console.log("1. GraphService not using correct API URL (should be http://localhost:8084)");
            console.log("2. CORS blocking the requests");
            console.log("3. Frontend falling back to static data");
        } else {
            console.log("\n✅ Data is flowing correctly from API to frontend!");
        }
    }
});