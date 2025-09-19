const { chromium } = require('playwright');
const fs = require('fs');

// Create screenshots directory if it doesn't exist
const screenshotDir = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/test-screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function testSongNodesUI() {
  console.log('Starting SongNodes UI Tests...');
  console.log('==========================================');

  let browser, page;
  const results = {
    pageLoaded: false,
    menubarCount: 0,
    songnodesMenuCount: 0,
    buttonTests: {},
    visualizationElements: 0,
    consoleErrors: [],
    domAnalysis: {},
    screenshots: []
  };

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    page = await context.newPage();

    // Listen for console messages and errors
    const consoleMessages = [];
    page.on('console', msg => {
      const message = `[${msg.type()}]: ${msg.text()}`;
      console.log(`BROWSER CONSOLE ${message}`);
      consoleMessages.push(message);
      if (msg.type() === 'error') {
        results.consoleErrors.push(message);
      }
    });

    page.on('pageerror', error => {
      const errorMessage = `PAGE ERROR: ${error.message}`;
      console.log(errorMessage);
      results.consoleErrors.push(errorMessage);
    });

    // Test 1: Initial page load
    console.log('\n1. Testing initial page load...');
    try {
      await page.goto('http://localhost:3007', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      results.pageLoaded = true;
      console.log('✓ Page loaded successfully');

      // Take initial screenshot
      const screenshotPath = `${screenshotDir}/01-initial-load.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.screenshots.push('01-initial-load.png');
      console.log('✓ Initial screenshot saved');

    } catch (error) {
      console.log('✗ Failed to load page:', error.message);
      results.pageLoaded = false;
      return results;
    }

    // Test 2: Check for menubar elements
    console.log('\n2. Analyzing menubar elements...');

    // Look for various menu-related selectors
    const menuSelectors = [
      '[class*="menubar"]',
      '[class*="menu-bar"]',
      '[class*="navigation"]',
      '[class*="nav-bar"]',
      'nav',
      'header',
      '[role="navigation"]',
      '[class*="header"]'
    ];

    let totalMenuElements = 0;
    for (const selector of menuSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Found ${count} elements for selector: ${selector}`);
        totalMenuElements += count;
      }
    }
    results.menubarCount = totalMenuElements;

    // Look specifically for SongNodes menu elements
    const songnodesSelectors = [
      '[class*="songnodes"]',
      '[data-testid*="menu"]',
      '[class*="app-header"]',
      '[class*="main-nav"]'
    ];

    let songnodesMenuElements = 0;
    for (const selector of songnodesSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Found ${count} SongNodes elements for selector: ${selector}`);
        songnodesMenuElements += count;
      }
    }
    results.songnodesMenuCount = songnodesMenuElements;

    // Test 3: Check for specific buttons
    console.log('\n3. Testing menu buttons...');
    const buttons = ['Overview', 'Legend', 'Search', 'Functions'];

    for (const buttonName of buttons) {
      console.log(`Testing ${buttonName} button...`);

      const buttonSelectors = [
        `button:has-text("${buttonName}")`,
        `[aria-label*="${buttonName}"]`,
        `[title*="${buttonName}"]`,
        `button[class*="${buttonName.toLowerCase()}"]`,
        `[data-testid*="${buttonName.toLowerCase()}"]`,
        `button:text("${buttonName}")`,
        `*:text("${buttonName}")`
      ];

      let buttonFound = false;
      let clickable = false;
      let dropdownAppeared = false;

      for (const selector of buttonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.count() > 0) {
            buttonFound = true;
            console.log(`  ✓ Found ${buttonName} button with selector: ${selector}`);

            try {
              await button.click({ timeout: 5000 });
              clickable = true;
              await page.waitForTimeout(1000);

              // Check for dropdown content
              const dropdownSelectors = [
                '[class*="dropdown"]',
                '[class*="modal"]',
                '[class*="menu"]',
                '[role="menu"]',
                '[role="dialog"]',
                '[class*="popover"]',
                '[class*="tooltip"]'
              ];

              for (const dropSelector of dropdownSelectors) {
                if (await page.locator(dropSelector).count() > 0) {
                  dropdownAppeared = true;
                  break;
                }
              }

              // Take screenshot of dropdown state
              const dropdownScreenshot = `${screenshotDir}/02-${buttonName.toLowerCase()}-dropdown.png`;
              await page.screenshot({ path: dropdownScreenshot, fullPage: true });
              results.screenshots.push(`02-${buttonName.toLowerCase()}-dropdown.png`);

              // Close dropdown
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);

              break;
            } catch (clickError) {
              console.log(`  ✗ Could not click ${buttonName}: ${clickError.message}`);
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      results.buttonTests[buttonName] = {
        found: buttonFound,
        clickable: clickable,
        dropdownAppeared: dropdownAppeared
      };

      console.log(`  ${buttonName}: Found=${buttonFound}, Clickable=${clickable}, Dropdown=${dropdownAppeared}`);
    }

    // Test 4: Check visualization elements
    console.log('\n4. Analyzing visualization elements...');

    const vizSelectors = [
      'canvas',
      'svg',
      '[class*="visualization"]',
      '[class*="graph"]',
      '[class*="d3"]',
      '[class*="chart"]',
      '[class*="render"]'
    ];

    let totalVizElements = 0;
    const vizDetails = [];

    for (const selector of vizSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`Found ${elements.length} ${selector} elements`);
        totalVizElements += elements.length;

        for (let i = 0; i < elements.length; i++) {
          try {
            const boundingBox = await elements[i].boundingBox();
            const tagName = await elements[i].evaluate(el => el.tagName);
            vizDetails.push({
              selector,
              tagName,
              boundingBox,
              index: i
            });
          } catch (error) {
            console.log(`Could not analyze element: ${error.message}`);
          }
        }
      }
    }

    results.visualizationElements = totalVizElements;
    results.visualizationDetails = vizDetails;

    // Test 5: DOM structure analysis
    console.log('\n5. Analyzing DOM structure...');

    const domAnalysis = await page.evaluate(() => {
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);

      // Find all elements with flex styling
      const flexElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const styles = window.getComputedStyle(el);
        return styles.display === 'flex' ||
               styles.flexDirection === 'row' ||
               el.className.includes('flex-row') ||
               el.className.includes('horizontal');
      });

      // Find menu-related elements
      const menuElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const className = el.className || '';
        const id = el.id || '';
        return className.includes('menu') ||
               className.includes('nav') ||
               className.includes('header') ||
               el.tagName === 'NAV' ||
               el.tagName === 'HEADER';
      });

      return {
        bodyWidth: bodyStyles.width,
        bodyHeight: bodyStyles.height,
        flexElementsCount: flexElements.length,
        menuElementsCount: menuElements.length,
        totalElements: document.querySelectorAll('*').length,
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    results.domAnalysis = domAnalysis;
    console.log(`DOM Analysis: ${domAnalysis.totalElements} total elements, ${domAnalysis.flexElementsCount} flex elements, ${domAnalysis.menuElementsCount} menu elements`);

    // Take final screenshot
    const finalScreenshot = `${screenshotDir}/03-final-layout.png`;
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    results.screenshots.push('03-final-layout.png');

  } catch (error) {
    console.log('Test execution error:', error.message);
    results.error = error.message;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

// Run the tests and generate report
async function main() {
  const testResults = await testSongNodesUI();

  console.log('\n==========================================');
  console.log('SONGNODES UI TEST RESULTS');
  console.log('==========================================');

  console.log('\n📊 SUMMARY:');
  console.log(`Page Loaded: ${testResults.pageLoaded ? '✓' : '✗'}`);
  console.log(`Total Menu Elements Found: ${testResults.menubarCount}`);
  console.log(`SongNodes Menu Elements: ${testResults.songnodesMenuCount}`);
  console.log(`Visualization Elements: ${testResults.visualizationElements}`);
  console.log(`Console Errors: ${testResults.consoleErrors.length}`);
  console.log(`Screenshots Captured: ${testResults.screenshots.length}`);

  console.log('\n🎯 BUTTON FUNCTIONALITY:');
  for (const [button, result] of Object.entries(testResults.buttonTests)) {
    const status = result.found ? (result.clickable ? (result.dropdownAppeared ? '✓✓✓' : '✓✓') : '✓') : '✗';
    console.log(`${button}: ${status} (Found: ${result.found}, Clickable: ${result.clickable}, Dropdown: ${result.dropdownAppeared})`);
  }

  console.log('\n🖥️ DOM ANALYSIS:');
  if (testResults.domAnalysis) {
    console.log(`Viewport: ${testResults.domAnalysis.viewportSize.width}x${testResults.domAnalysis.viewportSize.height}`);
    console.log(`Body Size: ${testResults.domAnalysis.bodyWidth} x ${testResults.domAnalysis.bodyHeight}`);
    console.log(`Flex Elements: ${testResults.domAnalysis.flexElementsCount}`);
    console.log(`Menu Elements: ${testResults.domAnalysis.menuElementsCount}`);
  }

  if (testResults.consoleErrors.length > 0) {
    console.log('\n❌ CONSOLE ERRORS:');
    testResults.consoleErrors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  console.log('\n📸 SCREENSHOTS:');
  testResults.screenshots.forEach(screenshot => {
    console.log(`- ${screenshotDir}/${screenshot}`);
  });

  console.log('\n==========================================');

  // Write results to JSON file
  const reportPath = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/ui-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`Detailed report saved to: ${reportPath}`);

  return testResults;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSongNodesUI, main };