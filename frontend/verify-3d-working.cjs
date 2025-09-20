#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function verify3DVisualization() {
  console.log('🌌 Starting 3D visualization verification...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => console.log(`Browser: ${msg.text()}`));
  page.on('pageerror', error => console.error(`Page Error: ${error.message}`));

  try {
    console.log('🔗 Navigating to 3D mode...');
    await page.goto('http://localhost:3008?mode=3d', { waitUntil: 'networkidle0' });

    console.log('⏳ Waiting 10 seconds for data to load...');
    await page.waitForTimeout(10000);

    // Take screenshot
    await page.screenshot({
      path: './test-results/manual-3d-verification.png',
      fullPage: true
    });

    console.log('📸 Screenshot saved to ./test-results/manual-3d-verification.png');

    // Check if we can find canvas elements
    const canvases = await page.$$eval('canvas', canvases => canvases.length);
    console.log(`🖼️ Found ${canvases} canvas elements`);

    // Check for the WebGL context
    const webglCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 'No canvas found';
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl ? 'WebGL context available' : 'No WebGL context';
    });
    console.log(`🎮 WebGL Status: ${webglCheck}`);

    // Check if data is loaded
    const dataCheck = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        debugElements: document.querySelectorAll('.absolute.top-2.right-2').length,
        canvasElements: document.querySelectorAll('canvas').length
      };
    });
    console.log('📊 Page State:', dataCheck);

    console.log('✅ 3D verification complete! Check the screenshot to see if 3D visualization is working.');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await browser.close();
  }
}

verify3DVisualization().catch(console.error);