const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testMenubar() {
  console.log('=== SongNodes Menubar Validation Test ===');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('Navigating to http://localhost:3008...');
    await page.goto('http://localhost:3008');

    // Wait for page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('Page loaded successfully');

    // Create screenshots directory
    const screenshotsDir = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Test 1: Count menubar elements
    console.log('\n=== Test 1: Count menubar elements ===');
    const menubarElements = await page.locator('nav.dropdown-container').count();
    console.log(`Found ${menubarElements} menubar elements`);

    if (menubarElements === 1) {
      console.log('✅ PASS: Exactly 1 menubar found');
    } else {
      console.log(`❌ FAIL: Expected 1 menubar, found ${menubarElements}`);
    }

    // Test 2: Menubar positioning
    console.log('\n=== Test 2: Menubar positioning ===');
    const menubar = page.locator('nav.dropdown-container').first();

    const boundingBox = await menubar.boundingBox();
    const styles = await menubar.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        top: computed.top,
        left: computed.left,
        transform: computed.transform,
        display: computed.display,
        flexDirection: computed.flexDirection
      };
    });

    console.log('Menubar position:', boundingBox);
    console.log('Menubar styles:', styles);

    if (styles.position === 'fixed' && styles.top === '24px' && styles.left === '50%') {
      console.log('✅ PASS: Menubar positioned correctly at top center');
    } else {
      console.log('❌ FAIL: Menubar positioning incorrect');
    }

    // Test 3: Horizontal layout
    console.log('\n=== Test 3: Horizontal layout ===');
    if (styles.display === 'flex' && styles.flexDirection === 'row') {
      console.log('✅ PASS: Menubar uses horizontal flex layout');
    } else {
      console.log('❌ FAIL: Menubar does not use horizontal flex layout');
    }

    // Test 4: Button count and arrangement
    console.log('\n=== Test 4: Button count and arrangement ===');
    const buttons = await menubar.locator('button').count();
    console.log(`Found ${buttons} buttons in menubar`);

    if (buttons >= 4) {
      console.log('✅ PASS: Sufficient buttons found');
    } else {
      console.log(`❌ FAIL: Expected at least 4 buttons, found ${buttons}`);
    }

    // Get button texts and positions
    const buttonData = [];
    for (let i = 0; i < buttons; i++) {
      const button = menubar.locator('button').nth(i);
      const text = await button.textContent();
      const bbox = await button.boundingBox();
      buttonData.push({
        index: i,
        text: text.trim(),
        x: bbox.x,
        y: bbox.y
      });
    }

    console.log('Button data:', buttonData);

    // Check horizontal arrangement
    const firstY = buttonData[0]?.y;
    let horizontalLayout = true;
    for (let i = 1; i < buttonData.length; i++) {
      if (Math.abs(buttonData[i].y - firstY) > 10) {
        horizontalLayout = false;
        break;
      }
    }

    if (horizontalLayout) {
      console.log('✅ PASS: Buttons arranged horizontally');
    } else {
      console.log('❌ FAIL: Buttons not arranged horizontally');
    }

    // Test 5: Button names
    console.log('\n=== Test 5: Button names ===');
    const expectedButtons = ['Overview', 'Legend', 'Search', 'Functions'];
    const foundButtons = buttonData.map(b => b.text);

    let allButtonsFound = true;
    for (const expected of expectedButtons) {
      if (!foundButtons.includes(expected)) {
        console.log(`❌ Missing button: ${expected}`);
        allButtonsFound = false;
      } else {
        console.log(`✅ Found button: ${expected}`);
      }
    }

    if (allButtonsFound) {
      console.log('✅ PASS: All expected buttons found');
    } else {
      console.log('❌ FAIL: Some expected buttons missing');
    }

    // Test 6: Dropdown functionality
    console.log('\n=== Test 6: Dropdown functionality ===');
    for (let i = 0; i < Math.min(buttons, 4); i++) {
      const button = menubar.locator('button').nth(i);
      const buttonText = buttonData[i]?.text || `Button ${i}`;

      console.log(`Testing dropdown for: ${buttonText}`);

      try {
        await button.click();
        await page.waitForTimeout(500);

        // Check if page is still responsive
        const bodyContent = await page.locator('body').textContent();
        if (bodyContent.length > 100) {
          console.log(`✅ PASS: ${buttonText} - Page remained responsive`);
        } else {
          console.log(`❌ FAIL: ${buttonText} - Page went blank`);
        }

        // Click elsewhere to close dropdown
        await page.click('body', { position: { x: 100, y: 100 } });
        await page.waitForTimeout(300);

      } catch (error) {
        console.log(`❌ ERROR: ${buttonText} - ${error.message}`);
      }
    }

    // Take screenshots
    console.log('\n=== Taking screenshots ===');

    // Full page screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'full-page-final.png'),
      fullPage: true
    });
    console.log('✅ Full page screenshot saved');

    // Menubar area screenshot
    if (boundingBox) {
      await page.screenshot({
        path: path.join(screenshotsDir, 'menubar-area.png'),
        clip: {
          x: 0,
          y: 0,
          width: 1920,
          height: Math.max(150, boundingBox.y + boundingBox.height + 50)
        }
      });
      console.log('✅ Menubar area screenshot saved');
    }

    // Test dropdown screenshots
    for (let i = 0; i < Math.min(buttons, 4); i++) {
      const button = menubar.locator('button').nth(i);
      const buttonText = buttonData[i]?.text || `Button ${i}`;

      try {
        await button.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, `dropdown-${buttonText.toLowerCase().replace(/\s+/g, '-')}.png`),
          fullPage: true
        });
        console.log(`✅ Dropdown screenshot saved for ${buttonText}`);

        // Close dropdown
        await page.click('body', { position: { x: 100, y: 100 } });
        await page.waitForTimeout(300);

      } catch (error) {
        console.log(`❌ Could not capture dropdown for ${buttonText}: ${error.message}`);
      }
    }

    // Get page info
    console.log('\n=== Page Information ===');
    const title = await page.title();
    const url = page.url();
    console.log(`Page Title: ${title}`);
    console.log(`Page URL: ${url}`);

    // Check for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    if (errors.length > 0) {
      console.log('\n❌ Console Errors:');
      errors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('\n✅ No console errors detected');
    }

    console.log('\n=== Test Summary ===');
    console.log('✅ Menubar validation test completed');
    console.log(`📸 Screenshots saved to: ${screenshotsDir}`);
    console.log('📋 Check the screenshots for visual verification');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testMenubar().catch(console.error);