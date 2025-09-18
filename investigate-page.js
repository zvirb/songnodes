const { chromium } = require('playwright');
const fs = require('fs');

async function investigatePage() {
  console.log('=== SongNodes Page Investigation ===');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('Navigating to http://localhost:3008...');
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Get page title and basic info
    const title = await page.title();
    const url = page.url();
    console.log(`Page Title: "${title}"`);
    console.log(`Page URL: ${url}`);

    // Get all nav elements
    console.log('\n=== All nav elements ===');
    const navElements = await page.locator('nav').count();
    console.log(`Total nav elements: ${navElements}`);

    for (let i = 0; i < navElements; i++) {
      const nav = page.locator('nav').nth(i);
      const className = await nav.getAttribute('class');
      const innerHTML = await nav.innerHTML();
      console.log(`Nav ${i}: class="${className}"`);
      console.log(`  HTML: ${innerHTML.substring(0, 200)}...`);
    }

    // Look for dropdown-related elements
    console.log('\n=== Dropdown-related elements ===');
    const dropdownElements = await page.locator('[class*="dropdown"]').count();
    console.log(`Elements with "dropdown" in class: ${dropdownElements}`);

    // Look for menu-related elements
    console.log('\n=== Menu-related elements ===');
    const menuElements = await page.locator('[class*="menu"]').count();
    console.log(`Elements with "menu" in class: ${menuElements}`);

    // Get all elements with button tags
    console.log('\n=== Button elements ===');
    const buttonElements = await page.locator('button').count();
    console.log(`Total button elements: ${buttonElements}`);

    for (let i = 0; i < Math.min(buttonElements, 10); i++) {
      const button = page.locator('button').nth(i);
      const text = await button.textContent();
      const className = await button.getAttribute('class');
      console.log(`Button ${i}: "${text.trim()}" class="${className}"`);
    }

    // Get page HTML content
    console.log('\n=== Page HTML (first 1000 chars) ===');
    const bodyHTML = await page.locator('body').innerHTML();
    console.log(bodyHTML.substring(0, 1000));

    // Look for any elements containing the text "Overview", "Legend", "Search", "Functions"
    console.log('\n=== Looking for expected button texts ===');
    const expectedTexts = ['Overview', 'Legend', 'Search', 'Functions'];
    for (const text of expectedTexts) {
      const elements = await page.locator(`text=${text}`).count();
      console.log(`Elements containing "${text}": ${elements}`);
    }

    // Check if React has loaded
    console.log('\n=== React and JavaScript status ===');
    const reactElements = await page.locator('[data-reactroot], #root, #app').count();
    console.log(`React root elements: ${reactElements}`);

    // Check for any errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    console.log('\n=== Console errors ===');
    if (errors.length > 0) {
      errors.forEach(error => console.log(`ERROR: ${error}`));
    } else {
      console.log('No console errors detected');
    }

    // Take a screenshot for visual inspection
    const screenshotsDir = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    await page.screenshot({
      path: `${screenshotsDir}/page-investigation.png`,
      fullPage: true
    });
    console.log(`\n📸 Screenshot saved to: ${screenshotsDir}/page-investigation.png`);

    // Check page loading state
    console.log('\n=== Page loading state ===');
    const readyState = await page.evaluate(() => document.readyState);
    console.log(`Document ready state: ${readyState}`);

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  } finally {
    await browser.close();
  }
}

investigatePage().catch(console.error);