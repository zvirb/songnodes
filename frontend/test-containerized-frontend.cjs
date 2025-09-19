#!/usr/bin/env node

const http = require('http');

async function testContainerizedFrontend() {
  console.log('🔍 Testing containerized frontend on port 3006...');

  try {
    // Test the containerized frontend
    const response = await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:3006', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });

    if (response.status !== 200) {
      console.log('❌ Containerized frontend not responding:', response.status);
      return;
    }

    const html = response.data;

    // Check for key indicators
    const hasErrorOverlay = html.includes('Application Error');
    const hasLoadingSpinner = html.includes('loading-spinner');
    const hasReactRoot = html.includes('id="root"');
    const hasViteScript = html.includes('/src/main.tsx') || html.includes('script');
    const hasActualReactContent = html.includes('app-ready') || html.includes('react-') || html.includes('Graph');
    const has3DToggle = html.includes('3D') || html.includes('Mode') || html.includes('Toggle');

    console.log('📊 Containerized Frontend Analysis:');
    console.log(`  - React root element: ${hasReactRoot ? '✅' : '❌'}`);
    console.log(`  - Script loaded: ${hasViteScript ? '✅' : '❌'}`);
    console.log(`  - Loading spinner: ${hasLoadingSpinner ? '⏳' : '✅'}`);
    console.log(`  - Error overlay: ${hasErrorOverlay ? '❌' : '✅'}`);
    console.log(`  - React content mounted: ${hasActualReactContent ? '✅' : '❌'}`);
    console.log(`  - 3D toggle present: ${has3DToggle ? '✅' : '❌'}`);

    // Check for visualization API
    console.log('\n🔍 Testing API endpoints through containerized frontend...');
    const apiResponse = await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:3006/api/v1/visualization/graph', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, data, error: e.message });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    if (apiResponse.status === 200 && apiResponse.data) {
      console.log(`✅ API working: { nodes: ${apiResponse.data.nodes?.length || 0}, edges: ${apiResponse.data.edges?.length || 0} }`);
    } else {
      console.log(`❌ API error: ${apiResponse.status} - ${apiResponse.error || 'Unknown error'}`);
    }

    // Overall assessment
    console.log('\n🎯 Containerized Frontend Assessment:');
    if (hasErrorOverlay) {
      console.log('❌ Application still showing error overlay');
    } else if (hasLoadingSpinner && !hasActualReactContent) {
      console.log('⏳ Application stuck on loading - React not fully mounted');
    } else if (hasActualReactContent) {
      console.log('✅ React application successfully mounted!');
      if (has3DToggle) {
        console.log('✅ 3D mode controls should be available for testing');
      } else {
        console.log('⚠️ 3D mode controls may not be visible yet');
      }
    } else {
      console.log('❓ Application state unclear - manual browser testing recommended');
    }

    // If React is mounted, recommend next steps
    if (hasActualReactContent || (!hasErrorOverlay && !hasLoadingSpinner)) {
      console.log('\n🚀 Next Steps:');
      console.log('1. Open http://localhost:3006 in browser');
      console.log('2. Look for 3D/2D toggle button');
      console.log('3. Test switching to 3D mode');
      console.log('4. Verify that visualization renders in 3D');
    }

  } catch (error) {
    console.log('❌ Failed to test containerized frontend:', error.message);
  }
}

testContainerizedFrontend();