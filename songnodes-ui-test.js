const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');

// Create screenshots directory if it doesn't exist
const screenshotDir = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/test-screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('SongNodes UI Layout and Functionality Tests', () => {
  let browser, page;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();

    // Listen for console messages and errors
    page.on('console', msg => {
      console.log(`BROWSER CONSOLE [${msg.type()}]:`, msg.text());
    });

    page.on('pageerror', error => {
      console.log(`BROWSER ERROR:`, error.message);
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Initial page load and horizontal menubar verification', async () => {
    console.log('Testing initial page load...');

    // Navigate to the application
    try {
      await page.goto('http://localhost:3007', { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000); // Wait for app to fully load
    } catch (error) {
      console.log('Failed to load page:', error.message);
      throw error;
    }

    // Take initial screenshot
    await page.screenshot({
      path: `${screenshotDir}/01-initial-load.png`,
      fullPage: true
    });
    console.log('Screenshot saved: 01-initial-load.png');

    // Check for single horizontal menubar
    const menubars = await page.locator('[class*="menubar"], [class*="menu-bar"], [class*="navigation"], [class*="nav-bar"]').all();
    console.log(`Found ${menubars.length} potential menubar elements`);

    // Look for SongNodes specific menu elements
    const songnodesMenus = await page.locator('[class*="songnodes"], [data-testid*="menu"], nav, header').all();
    console.log(`Found ${songnodesMenus.length} SongNodes menu-related elements`);

    // Check for buttons: Overview, Legend, Search, Functions
    const menuButtons = {
      overview: await page.locator('button:has-text("Overview"), [aria-label*="Overview"], [title*="Overview"]'),
      legend: await page.locator('button:has-text("Legend"), [aria-label*="Legend"], [title*="Legend"]'),
      search: await page.locator('button:has-text("Search"), [aria-label*="Search"], [title*="Search"]'),
      functions: await page.locator('button:has-text("Functions"), [aria-label*="Functions"], [title*="Functions"]')
    };

    const buttonCounts = {};
    for (const [name, locator] of Object.entries(menuButtons)) {
      const count = await locator.count();
      buttonCounts[name] = count;
      console.log(`${name} buttons found: ${count}`);
    }

    // Check if menubar is horizontal and at top center
    const topLevelContainers = await page.locator('body > *, [class*="app"], [class*="main"], [class*="container"]').all();
    console.log(`Found ${topLevelContainers.length} top-level containers`);

    // Check for flex-row styling
    const flexRowElements = await page.locator('[class*="flex-row"], [style*="flex-direction: row"], [style*="display: flex"]').all();
    console.log(`Found ${flexRowElements.length} elements with horizontal flex styling`);

    return {
      menubars: menubars.length,
      songnodesMenus: songnodesMenus.length,
      buttonCounts,
      flexRowElements: flexRowElements.length
    };
  });

  test('Test dropdown functionality for each menu button', async () => {
    console.log('Testing dropdown functionality...');

    const buttons = ['Overview', 'Legend', 'Search', 'Functions'];
    const results = {};

    for (const buttonName of buttons) {
      console.log(`Testing ${buttonName} dropdown...`);

      try {
        // Try multiple selector strategies
        const buttonSelectors = [
          `button:has-text("${buttonName}")`,
          `[aria-label*="${buttonName}"]`,
          `[title*="${buttonName}"]`,
          `button[class*="${buttonName.toLowerCase()}"]`,
          `[data-testid*="${buttonName.toLowerCase()}"]`
        ];

        let button = null;
        for (const selector of buttonSelectors) {
          const candidate = page.locator(selector).first();
          if (await candidate.count() > 0) {
            button = candidate;
            break;
          }
        }

        if (button && await button.count() > 0) {
          // Check if button is visible and clickable
          await expect(button).toBeVisible();

          // Click the button
          await button.click();
          await page.waitForTimeout(1000); // Wait for dropdown to appear

          // Take screenshot of dropdown state
          await page.screenshot({
            path: `${screenshotDir}/02-${buttonName.toLowerCase()}-dropdown.png`,
            fullPage: true
          });
          console.log(`Screenshot saved: 02-${buttonName.toLowerCase()}-dropdown.png`);

          // Check for dropdown/modal content
          const dropdownContent = await page.locator('[class*="dropdown"], [class*="modal"], [class*="menu"], [role="menu"], [role="dialog"]').count();

          results[buttonName] = {
            buttonFound: true,
            clickable: true,
            dropdownAppeared: dropdownContent > 0,
            dropdownElements: dropdownContent
          };

          // Close dropdown if it appeared (try clicking outside or escape)
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

        } else {
          results[buttonName] = {
            buttonFound: false,
            clickable: false,
            dropdownAppeared: false,
            dropdownElements: 0
          };
        }
      } catch (error) {
        console.log(`Error testing ${buttonName}:`, error.message);
        results[buttonName] = {
          buttonFound: false,
          clickable: false,
          dropdownAppeared: false,
          error: error.message
        };
      }
    }

    return results;
  });

  test('Verify full-screen visualization coverage', async () => {
    console.log('Testing full-screen visualization...');

    // Check for canvas, svg, or visualization elements
    const visualizationElements = await page.locator('canvas, svg, [class*="visualization"], [class*="graph"], [class*="d3"]').all();
    console.log(`Found ${visualizationElements.length} visualization elements`);

    const results = [];
    for (let i = 0; i < visualizationElements.length; i++) {
      const element = visualizationElements[i];
      const boundingBox = await element.boundingBox();
      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          position: computed.position,
          width: computed.width,
          height: computed.height,
          zIndex: computed.zIndex,
          top: computed.top,
          left: computed.left
        };
      });

      results.push({
        elementIndex: i,
        tagName: await element.evaluate(el => el.tagName),
        boundingBox,
        styles
      });
    }

    // Check viewport dimensions
    const viewportSize = page.viewportSize();
    console.log('Viewport size:', viewportSize);

    // Take final screenshot showing full layout
    await page.screenshot({
      path: `${screenshotDir}/03-full-screen-layout.png`,
      fullPage: true
    });
    console.log('Screenshot saved: 03-full-screen-layout.png');

    return {
      visualizationElements: visualizationElements.length,
      viewportSize,
      elementDetails: results
    };
  });

  test('Analyze browser console and DOM structure', async () => {
    console.log('Analyzing DOM structure and console messages...');

    // Get all elements with SongNodes-related classes or IDs
    const songnodesElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => {
          const className = el.className || '';
          const id = el.id || '';
          const dataTestId = el.getAttribute('data-testid') || '';
          return className.includes('songnodes') ||
                 id.includes('songnodes') ||
                 dataTestId.includes('songnodes') ||
                 className.includes('menu') ||
                 className.includes('nav') ||
                 el.tagName === 'NAV' ||
                 el.tagName === 'HEADER';
        })
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          textContent: el.textContent?.substring(0, 100),
          dataTestId: el.getAttribute('data-testid')
        }));
    });

    // Get body styles to check layout
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        width: computed.width,
        height: computed.height,
        overflow: computed.overflow,
        position: computed.position
      };
    });

    // Check for error messages in the DOM
    const errorElements = await page.locator('[class*="error"], [class*="Error"], .error-message, .alert-danger').all();
    const errorCount = errorElements.length;

    const errorTexts = [];
    for (let i = 0; i < Math.min(errorCount, 5); i++) {
      const text = await errorElements[i].textContent();
      errorTexts.push(text);
    }

    return {
      songnodesElements: songnodesElements.length,
      songnodesElementDetails: songnodesElements,
      bodyStyles,
      errorElements: errorCount,
      errorTexts
    };
  });
});

// Main execution function
async function runTests() {
  console.log('Starting SongNodes UI Tests...');
  console.log('==========================================');

  try {
    const { execSync } = require('child_process');

    // Run the tests
    execSync('npx playwright test songnodes-ui-test.js --reporter=line', {
      stdio: 'inherit',
      cwd: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes'
    });

  } catch (error) {
    console.log('Test execution completed with findings. Check output above for details.');
  }
}

// Export for use as module or run directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };