const { chromium } = require('playwright');

async function testApplication() {
  console.log('🚀 Starting Playwright browser test...');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Capture console logs
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });

      if (msg.type() === 'error' || text.includes('Error')) {
        console.log(`❌ Browser Console ${msg.type()}:`, text);
      } else if (text.includes('✅') || text.includes('📊')) {
        console.log(`ℹ️ Browser Console:`, text);
      }
    });

    // Capture page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
      console.log('❌ Page Error:', error.message);
    });

    console.log('🌐 Navigating to application...');
    await page.goto('http://localhost:3009', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for potential React errors to surface
    await page.waitForTimeout(5000);

    // Check basic elements
    const rootElement = await page.$('#root');
    const hasRoot = !!rootElement;
    console.log('React root element found:', hasRoot);

    const graphContainer = await page.$('[data-testid="graph-container"]');
    const hasGraphContainer = !!graphContainer;
    console.log('Graph container found:', hasGraphContainer);

    // Check for error overlays
    const errorOverlay = await page.$('h2:text("Application Error")');
    const hasErrorOverlay = !!errorOverlay;
    console.log('Error overlay present:', hasErrorOverlay);

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Count console messages
    const errors = consoleMessages.filter(m => m.type === 'error').length;
    const warnings = consoleMessages.filter(m => m.type === 'warning').length;

    console.log('\n📊 Summary:');
    console.log(`- Root element: ${hasRoot ? '✅' : '❌'}`);
    console.log(`- Graph container: ${hasGraphContainer ? '✅' : '❌'}`);
    console.log(`- Error overlay: ${hasErrorOverlay ? '❌' : '✅'}`);
    console.log(`- Console errors: ${errors}`);
    console.log(`- Console warnings: ${warnings}`);
    console.log(`- Page errors: ${pageErrors.length}`);

    // Take screenshot
    await page.screenshot({ path: 'playwright-test-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as playwright-test-screenshot.png');

    if (pageErrors.length > 0) {
      console.log('\n❌ Page Errors:');
      pageErrors.forEach(error => console.log(`  - ${error}`));
    }

    const significantErrors = consoleMessages.filter(m =>
      m.type === 'error' &&
      !m.text.includes('Service Worker') &&
      !m.text.includes('favicon')
    );

    if (significantErrors.length > 0) {
      console.log('\n❌ Significant Console Errors:');
      significantErrors.forEach(error => console.log(`  - ${error.text}`));
    }

    // Final assessment
    if (!hasRoot) {
      console.log('\n❌ CRITICAL: React root not found - application failed to mount');
    } else if (hasErrorOverlay) {
      console.log('\n❌ Application showing error overlay - runtime error present');
    } else if (pageErrors.length > 0 || significantErrors.length > 0) {
      console.log('\n⚠️ Application loaded but has errors');
    } else {
      console.log('\n✅ Application appears to be loading successfully');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testApplication();