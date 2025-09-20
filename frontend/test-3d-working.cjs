#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function test3DVisualization() {
  console.log('🌌 Testing new 3D visualization implementation...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console messages
  const messages = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log(`Browser: ${text}`);
    messages.push(text);
  });

  page.on('pageerror', error => {
    console.error(`Page Error: ${error.message}`);
  });

  try {
    console.log('🔗 Navigating to 3D mode...');
    await page.goto('http://localhost:3007?mode=3d', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('⏳ Waiting for 3D scene to initialize...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Give time for Three.js to load

    // Check for 3D canvas
    const canvasCount = await page.$$eval('canvas', canvases => canvases.length);
    console.log(`🖼️ Found ${canvasCount} canvas elements`);

    // Check for WebGL context
    const webglInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 'No canvas found';

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl ? 'WebGL context available' : 'No WebGL context';
    });
    console.log(`🎮 WebGL Status: ${webglInfo}`);

    // Check for 3D scene elements
    const sceneInfo = await page.evaluate(() => {
      const debugOverlay = document.querySelector('.absolute.top-2.right-2');
      return {
        hasDebugOverlay: !!debugOverlay,
        debugText: debugOverlay ? debugOverlay.textContent : 'No debug overlay',
        has3DCanvas: !!document.querySelector('[data-testid="3d-canvas"]'),
        hasLoadingState: !!document.querySelector('[data-testid="3d-canvas-loading"]'),
        hasErrorState: !!document.querySelector('[data-testid="3d-canvas-error"]'),
        title: document.title,
        bodyClasses: document.body.className
      };
    });

    console.log('📊 Scene Information:', sceneInfo);

    // Take screenshot
    await page.screenshot({
      path: './test-results/working-3d-verification.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved: ./test-results/working-3d-verification.png');

    // Check for Three.js success messages
    const hasThreeJSInit = messages.some(msg => msg.includes('Three.js scene initialized'));
    const has3DGraphCreation = messages.some(msg => msg.includes('Creating 3D graph'));
    const hasDataLoading = messages.some(msg => msg.includes('nodes') && msg.includes('edges'));

    console.log('\n🔍 Verification Results:');
    console.log(`✅ Canvas elements: ${canvasCount > 0 ? 'Found' : 'Missing'}`);
    console.log(`✅ WebGL support: ${webglInfo === 'WebGL context available' ? 'Available' : 'Missing'}`);
    console.log(`✅ Three.js initialization: ${hasThreeJSInit ? 'Success' : 'Failed'}`);
    console.log(`✅ 3D graph creation: ${has3DGraphCreation ? 'Success' : 'Failed'}`);
    console.log(`✅ Data loading: ${hasDataLoading ? 'Success' : 'Failed'}`);
    console.log(`✅ Debug overlay: ${sceneInfo.hasDebugOverlay ? 'Present' : 'Missing'}`);

    const isWorking = canvasCount > 0 &&
                     webglInfo === 'WebGL context available' &&
                     sceneInfo.has3DCanvas &&
                     !sceneInfo.hasErrorState;

    if (isWorking) {
      console.log('\n🎉 SUCCESS: 3D visualization is working correctly!');
    } else {
      console.log('\n❌ ISSUES DETECTED: 3D visualization needs fixes');
    }

    return isWorking;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

test3DVisualization()
  .then(success => {
    console.log(`\n🏁 Test completed: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(console.error);