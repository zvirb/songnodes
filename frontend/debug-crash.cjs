#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function debugCrash() {
  console.log('🔍 Debugging application crash...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture all errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ Console Error: ${msg.text()}`);
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    console.error(`💥 Page Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    errors.push(`Page Error: ${error.message}`);
  });

  try {
    console.log('🔗 Navigating to 3D mode...');
    await page.goto('http://localhost:3008?mode=3d', {
      waitUntil: 'networkidle0',
      timeout: 10000
    });

    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(3000);

    // Check what's actually rendered
    const content = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 200),
        errorVisible: !!document.querySelector('[data-testid="error-boundary"]') || document.body.innerText.includes('Application Error'),
        hasCanvas: document.querySelectorAll('canvas').length,
        reactErrors: window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.reactDevtoolsAgent?.componentFilters || 'N/A'
      };
    });

    console.log('📊 Page Content:', content);
    console.log(`🔢 Total Errors Captured: ${errors.length}`);

    if (errors.length > 0) {
      console.log('🚨 Error Summary:');
      errors.forEach((error, i) => console.log(`  ${i+1}. ${error}`));
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugCrash().catch(console.error);