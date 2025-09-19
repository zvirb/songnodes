const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('SongNodes Menubar Validation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3008');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait a bit more for any dynamic content
    await page.waitForTimeout(2000);
  });

  test('Critical Requirement 1: Single Horizontal Menubar Positioning', async ({ page }) => {
    console.log('=== Testing Single Horizontal Menubar Positioning ===');

    // Check for menubar elements
    const menubarElements = await page.locator('nav.dropdown-container').all();
    console.log(`Found ${menubarElements.length} menubar elements`);

    // Verify exactly 1 menubar
    expect(menubarElements.length).toBe(1);

    const menubar = page.locator('nav.dropdown-container').first();

    // Get position and styling
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

    // Verify position is fixed and at top
    expect(styles.position).toBe('fixed');
    expect(styles.top).toBe('24px');

    // Verify horizontal centering
    expect(styles.left).toBe('50%');
    expect(styles.transform).toContain('translateX(-50%)');

    // Verify the menubar is at the top center area
    expect(boundingBox.y).toBeLessThan(100); // Should be near top of page

    // Take screenshot of full page showing menubar position
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'menubar-positioning.png'),
      fullPage: true
    });
  });

  test('Critical Requirement 2: Horizontal Layout Verification', async ({ page }) => {
    console.log('=== Testing Horizontal Layout ===');

    const menubar = page.locator('nav.dropdown-container').first();

    // Check display and flex properties
    const layoutStyles = await menubar.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        flexDirection: computed.flexDirection,
        alignItems: computed.alignItems,
        justifyContent: computed.justifyContent
      };
    });

    console.log('Layout styles:', layoutStyles);

    // Verify horizontal flex layout
    expect(layoutStyles.display).toBe('flex');
    expect(layoutStyles.flexDirection).toBe('row');

    // Get all buttons in the menubar
    const buttons = await menubar.locator('button').all();
    console.log(`Found ${buttons.length} buttons in menubar`);

    // Verify we have the expected buttons
    expect(buttons.length).toBeGreaterThanOrEqual(4); // Overview, Legend, Search, Functions

    // Check button positions to ensure horizontal layout
    const buttonPositions = [];
    for (let i = 0; i < buttons.length; i++) {
      const bbox = await buttons[i].boundingBox();
      const text = await buttons[i].textContent();
      buttonPositions.push({ index: i, text, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height });
    }

    console.log('Button positions:', buttonPositions);

    // Verify buttons are arranged horizontally (similar Y coordinates, different X coordinates)
    const firstButtonY = buttonPositions[0].y;
    for (let i = 1; i < buttonPositions.length; i++) {
      const yDifference = Math.abs(buttonPositions[i].y - firstButtonY);
      expect(yDifference).toBeLessThan(10); // Buttons should be on same horizontal line
    }

    // Verify buttons are ordered left to right (increasing X coordinates)
    for (let i = 1; i < buttonPositions.length; i++) {
      expect(buttonPositions[i].x).toBeGreaterThan(buttonPositions[i-1].x);
    }

    // Take screenshot of menubar layout
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'menubar-layout.png'),
      clip: { x: 0, y: 0, width: 1920, height: 200 }
    });
  });

  test('Critical Requirement 3: Button Names and Order', async ({ page }) => {
    console.log('=== Testing Button Names and Order ===');

    const menubar = page.locator('nav.dropdown-container').first();
    const buttons = await menubar.locator('button').all();

    const buttonTexts = [];
    for (const button of buttons) {
      const text = await button.textContent();
      buttonTexts.push(text.trim());
    }

    console.log('Button texts found:', buttonTexts);

    // Verify expected buttons are present
    const expectedButtons = ['Overview', 'Legend', 'Search', 'Functions'];
    for (const expectedButton of expectedButtons) {
      expect(buttonTexts).toContain(expectedButton);
    }
  });

  test('Critical Requirement 4: Dropdown Functionality', async ({ page }) => {
    console.log('=== Testing Dropdown Functionality ===');

    const menubar = page.locator('nav.dropdown-container').first();
    const buttons = await menubar.locator('button').all();

    // Test each dropdown opens without causing blank screens
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const buttonText = await button.textContent();

      console.log(`Testing dropdown for button: ${buttonText}`);

      // Click the button to open dropdown
      await button.click();
      await page.waitForTimeout(500);

      // Check if page went blank (body should have content)
      const bodyContent = await page.locator('body').textContent();
      expect(bodyContent.length).toBeGreaterThan(100); // Page should not be blank

      // Check for any JavaScript errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Look for dropdown content
      const dropdownContent = await page.locator('.dropdown-content, [role="menu"], [role="listbox"]').first();
      if (await dropdownContent.isVisible()) {
        console.log(`✓ Dropdown opened successfully for ${buttonText}`);

        // Take screenshot of opened dropdown
        await page.screenshot({
          path: path.join(__dirname, 'screenshots', `dropdown-${buttonText.toLowerCase()}.png`),
          fullPage: true
        });

        // Click elsewhere to close dropdown
        await page.click('body', { position: { x: 100, y: 100 } });
        await page.waitForTimeout(300);
      } else {
        console.log(`! No visible dropdown content found for ${buttonText}`);
      }

      // Report any console errors
      if (consoleErrors.length > 0) {
        console.log(`Console errors for ${buttonText}:`, consoleErrors);
      }
    }
  });

  test('Critical Requirement 5: DOM Count Validation', async ({ page }) => {
    console.log('=== Testing DOM Count Validation ===');

    // Count SongNodes elements
    const songNodesElements = await page.locator('*').filter({
      hasText: /SongNodes/i
    }).all();

    console.log(`Found ${songNodesElements.length} elements containing "SongNodes"`);

    // Get more specific counts
    const menubarElements = await page.locator('nav.dropdown-container').all();
    const navElements = await page.locator('nav').all();

    console.log(`Menubar elements (nav.dropdown-container): ${menubarElements.length}`);
    console.log(`Total nav elements: ${navElements.length}`);

    // Verify only 1 dropdown-container
    expect(menubarElements.length).toBe(1);

    // Log DOM structure for debugging
    const menubarHTML = await page.locator('nav.dropdown-container').first().innerHTML();
    console.log('Menubar HTML structure:');
    console.log(menubarHTML.substring(0, 500) + '...');

    // Take screenshot of developer tools (simulate F12)
    await page.keyboard.press('F12');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'dom-structure.png'),
      fullPage: true
    });
    await page.keyboard.press('F12'); // Close dev tools
  });

  test('Comprehensive Visual Validation', async ({ page }) => {
    console.log('=== Comprehensive Visual Validation ===');

    // Wait for complete page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'full-page-final.png'),
      fullPage: true
    });

    // Get page title and basic info
    const title = await page.title();
    const url = page.url();

    console.log(`Page Title: ${title}`);
    console.log(`Page URL: ${url}`);

    // Validate page is not blank
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(100);

    // Check for critical elements
    const menubarExists = await page.locator('nav.dropdown-container').count();
    const buttonsExist = await page.locator('nav.dropdown-container button').count();

    console.log(`Final validation - Menubar count: ${menubarExists}, Button count: ${buttonsExist}`);

    expect(menubarExists).toBe(1);
    expect(buttonsExist).toBeGreaterThanOrEqual(4);
  });
});