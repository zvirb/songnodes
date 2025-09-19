const http = require('http');

async function debugApplication() {
  console.log('🔍 Debugging 3D mode issue...');

  // Test if the application is accessible
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:3009', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });

    if (response.status === 200) {
      console.log('✅ Application is accessible');

      // Parse the HTML to check for key elements
      const html = response.data;

      // Check for React elements
      const hasReactRoot = html.includes('id="root"');
      const hasViteScript = html.includes('/@vite/client');

      // Check for error indicators in the HTML
      const hasErrorElement = html.includes('Application Error');

      console.log('📊 HTML Analysis:');
      console.log(`  - React root: ${hasReactRoot ? '✅' : '❌'}`);
      console.log(`  - Vite script: ${hasViteScript ? '✅' : '❌'}`);
      console.log(`  - Error element: ${hasErrorElement ? '❌' : '✅'}`);

      if (hasErrorElement) {
        console.log('\n❌ Application Error detected in HTML');

        // Look for error details in the HTML
        const errorMatch = html.match(/<div[^>]*>[\s\S]*?Application Error[\s\S]*?<\/div>/i);
        if (errorMatch) {
          console.log('Error HTML snippet:', errorMatch[0]);
        }
      }

      // Check for Three.js related scripts
      const hasThreeJS = html.includes('three') || html.includes('Three');
      console.log(`  - Three.js references: ${hasThreeJS ? '✅' : '❌'}`);

      // Check script tags for errors
      const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
      if (scriptMatches) {
        console.log(`  - Script tags found: ${scriptMatches.length}`);
      }

    } else {
      console.log(`❌ Application returned status: ${response.status}`);
    }

  } catch (error) {
    console.log('❌ Failed to access application:', error.message);
  }

  // Test the API endpoints
  console.log('\n🔍 Testing API endpoints...');

  try {
    const apiTest = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ max_nodes: 3 });
      const options = {
        hostname: 'localhost',
        port: 3009,
        path: '/api/v1/visualization/graph',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (apiTest.status === 200) {
      const apiData = JSON.parse(apiTest.data);
      console.log('✅ API working:', {
        nodes: apiData.nodes?.length || 0,
        edges: apiData.edges?.length || 0
      });
    } else {
      console.log(`❌ API returned status: ${apiTest.status}`);
    }

  } catch (error) {
    console.log('❌ API test failed:', error.message);
  }

  // Analyze the source code for 3D-related issues
  console.log('\n🔍 Analyzing source code for 3D issues...');

  try {
    const fs = require('fs');

    // Check ThreeD3Canvas component
    const threeCanvasPath = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/src/components/GraphCanvas/ThreeD3Canvas.tsx';
    if (fs.existsSync(threeCanvasPath)) {
      const threeCanvas = fs.readFileSync(threeCanvasPath, 'utf8');

      // Check for key 3D functionality
      const hasThreeImport = threeCanvas.includes("import * as THREE from 'three'");
      const hasWebGLRenderer = threeCanvas.includes('WebGLRenderer');
      const hasSceneCreation = threeCanvas.includes('new THREE.Scene()');
      const hasCameraSetup = threeCanvas.includes('PerspectiveCamera');
      const hasAnimationLoop = threeCanvas.includes('requestAnimationFrame');

      console.log('📊 ThreeD3Canvas Analysis:');
      console.log(`  - Three.js import: ${hasThreeImport ? '✅' : '❌'}`);
      console.log(`  - WebGL renderer: ${hasWebGLRenderer ? '✅' : '❌'}`);
      console.log(`  - Scene creation: ${hasSceneCreation ? '✅' : '❌'}`);
      console.log(`  - Camera setup: ${hasCameraSetup ? '✅' : '❌'}`);
      console.log(`  - Animation loop: ${hasAnimationLoop ? '✅' : '❌'}`);

      // Check for error conditions
      if (threeCanvas.includes('console.log') && threeCanvas.includes('nodes.length === 0')) {
        console.log('ℹ️ Component has empty nodes check');
      }

    } else {
      console.log('❌ ThreeD3Canvas component not found');
    }

    // Check App.tsx for 3D mode toggle
    const appPath = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/src/App.tsx';
    if (fs.existsSync(appPath)) {
      const appContent = fs.readFileSync(appPath, 'utf8');

      const hasIs3DMode = appContent.includes('is3DMode');
      const hasThreeD3Canvas = appContent.includes('ThreeD3Canvas');
      const hasConditional = appContent.includes('is3DMode ?');

      console.log('📊 App.tsx 3D Integration:');
      console.log(`  - is3DMode state: ${hasIs3DMode ? '✅' : '❌'}`);
      console.log(`  - ThreeD3Canvas import: ${hasThreeD3Canvas ? '✅' : '❌'}`);
      console.log(`  - Conditional rendering: ${hasConditional ? '✅' : '❌'}`);

      // Check the conditional rendering logic
      const conditionalMatch = appContent.match(/is3DMode\s*\?\s*\(\s*<ThreeD3Canvas[\s\S]*?\)\s*:\s*\(\s*<WorkingD3Canvas[\s\S]*?\)/);
      if (conditionalMatch) {
        console.log('✅ 3D/2D conditional rendering found');
      } else {
        console.log('❌ 3D/2D conditional rendering not found or malformed');
      }

    } else {
      console.log('❌ App.tsx not found');
    }

  } catch (error) {
    console.log('❌ Source code analysis failed:', error.message);
  }

  console.log('\n🎯 Debugging Summary:');
  console.log('If you see "Application Error" in the HTML, the React app is failing to mount.');
  console.log('Check browser console for JavaScript errors by visiting http://localhost:3009');
  console.log('Look for TypeScript compilation errors or missing dependencies.');
}

debugApplication();