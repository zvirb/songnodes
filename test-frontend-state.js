#!/usr/bin/env node
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error')) {
      console.log('🔴 Console error:', text);
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log('🔴 Page error:', error.message);
  });

  try {
    console.log('🌐 Loading frontend at http://localhost:3006...');
    await page.goto('http://localhost:3006', { waitUntil: 'domcontentloaded', timeout: 5000 });

    // Wait a bit for React to render
    await page.waitForTimeout(2000);

    // Check for graph canvas
    const canvas = await page.$('[class*="GraphCanvas"], svg, canvas');
    if (canvas) {
      console.log('✅ Graph canvas element found');
    } else {
      console.log('❌ No graph canvas element found');
    }

    // Check for menubar
    const menubar = await page.$('[style*="position: fixed"][style*="top: 0"]');
    if (menubar) {
      console.log('✅ Menubar found');
    } else {
      console.log('❌ No menubar found');
    }

    // Take a screenshot
    await page.screenshot({ path: 'frontend-current-state.png' });
    console.log('📸 Screenshot saved to frontend-current-state.png');

    // Get the page content for debugging
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.trim()) {
      console.log('📝 Page content preview:', bodyText.substring(0, 200));
    } else {
      console.log('⚠️ Page appears to be empty');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();