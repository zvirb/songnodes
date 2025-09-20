#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function test3DButtonClick() {
  console.log('🧪 Testing 3D button click in production...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true // Open DevTools to see console
  });

  const page = await browser.newPage();

  // Log all console messages
  page.on('console', msg => {
    console.log(`Browser Console: ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.error(`Page Error: ${error.message}`);
  });

  try {
    console.log('🔗 Navigating to production frontend...');
    await page.goto('http://localhost:3006', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take initial screenshot
    await page.screenshot({
      path: './test-results/before-3d-click.png',
      fullPage: true
    });

    console.log('🔍 Looking for Overview button to open navigation menu...');

    // Click Overview button to open the dropdown
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const overviewBtn = buttons.find(btn => btn.textContent?.includes('Overview'));
      if (overviewBtn) {
        console.log('Found Overview button, clicking...');
        overviewBtn.click();
      } else {
        console.log('Overview button not found!');
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🔍 Looking for 3D Space button...');

    // Click the 3D Space button
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button3D = buttons.find(btn => btn.textContent?.includes('3D Space'));
      if (button3D) {
        console.log('Found 3D Space button, clicking...');
        button3D.click();
        return true;
      } else {
        console.log('3D Space button not found!');
        return false;
      }
    });

    if (clicked) {
      console.log('✅ Clicked 3D Space button');

      // Wait for potential re-render
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot after clicking
      await page.screenshot({
        path: './test-results/after-3d-click.png',
        fullPage: true
      });

      // Check if ThreeD3Canvas is rendered
      const has3DCanvas = await page.evaluate(() => {
        return document.querySelector('[data-testid="3d-canvas"]') !== null;
      });

      console.log(`3D Canvas element present: ${has3DCanvas ? '✅ YES' : '❌ NO'}`);

      // Check current URL
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
    } else {
      console.log('❌ Could not find 3D Space button');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    console.log('🎯 Test complete. Check screenshots in ./test-results/');
    console.log('Browser will stay open for inspection. Press Ctrl+C to close.');
    // Keep browser open for manual inspection
    await new Promise(() => {}); // Infinite wait
  }
}

test3DButtonClick().catch(console.error);