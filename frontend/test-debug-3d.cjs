#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function debugThreeJS() {
  console.log('🔧 Debugging Three.js initialization...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Log all console messages
  page.on('console', msg => {
    const text = msg.text();
    console.log(`Browser: ${text}`);
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

    console.log('⏳ Waiting for initialization logs...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('📸 Taking screenshot...');
    await page.screenshot({
      path: './test-results/debug-3d-init.png',
      fullPage: true
    });

    console.log('✅ Debug test complete');

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugThreeJS().catch(console.error);