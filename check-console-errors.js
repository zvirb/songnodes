const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Checking for JavaScript errors and console logs...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture all console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.toString());
  });

  try {
    console.log('📍 Navigating to http://localhost:3006/');
    await page.goto('http://localhost:3006/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for potential React mounting
    await page.waitForTimeout(3000);

    // Group console logs by type
    const errors = consoleLogs.filter(log => log.type === 'error');
    const warnings = consoleLogs.filter(log => log.type === 'warning');
    const infos = consoleLogs.filter(log => log.type === 'log' || log.type === 'info');

    console.log('\n📊 Console Summary:');
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    console.log(`   Info/Logs: ${infos.length}`);
    console.log(`   Page Errors: ${pageErrors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ JavaScript Errors:');
      errors.forEach((err, i) => {
        console.log(`\n   Error ${i + 1}:`);
        console.log(`   Message: ${err.text}`);
        if (err.location.url) {
          console.log(`   Source: ${err.location.url}:${err.location.lineNumber}`);
        }
      });
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach(warn => {
        console.log(`   - ${warn.text}`);
      });
    }

    if (pageErrors.length > 0) {
      console.log('\n💥 Page Errors:');
      pageErrors.forEach(err => {
        console.log(`   - ${err}`);
      });
    }

    // Show first few info logs
    if (infos.length > 0) {
      console.log('\nℹ️  Info/Logs (first 10):');
      infos.slice(0, 10).forEach(info => {
        console.log(`   - ${info.text}`);
      });
    }

    // Check if React mounted
    const reactRoot = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        hasChildren: root?.children.length > 0,
        innerHTML: root?.innerHTML?.substring(0, 200),
        reactFiber: root?._reactRootContainer ? 'Yes' : 'No'
      };
    });

    console.log('\n🔧 React Root Analysis:');
    console.log(`   Has Children: ${reactRoot.hasChildren}`);
    console.log(`   React Fiber: ${reactRoot.reactFiber}`);
    if (reactRoot.innerHTML) {
      console.log(`   Inner HTML: ${reactRoot.innerHTML || '(empty)'}`);
    }

    // Check for loading screen
    const loadingScreen = await page.evaluate(() => {
      const loading = document.querySelector('.loading');
      return {
        exists: !!loading,
        display: loading ? window.getComputedStyle(loading).display : null,
        visibility: loading ? window.getComputedStyle(loading).visibility : null
      };
    });

    console.log('\n🔄 Loading Screen Status:');
    console.log(`   Exists: ${loadingScreen.exists}`);
    if (loadingScreen.exists) {
      console.log(`   Display: ${loadingScreen.display}`);
      console.log(`   Visibility: ${loadingScreen.visibility}`);
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Error Check Complete');
  }
})();