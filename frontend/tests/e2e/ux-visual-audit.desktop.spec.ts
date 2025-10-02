import { test, expect } from '@playwright/test';

/**
 * Visual UX Audit - UI/UX Guide Compliance
 * Focused on visual inspection and screenshot analysis
 */

test.use({ headless: false }); // Run in headed mode for better visibility

test.describe('Visual UX Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
    await page.waitForTimeout(3000); // Allow full rendering
  });

  test('1. Initial Load - Complete Interface Audit', async ({ page }) => {
    console.log('\n=== COMPLETE INTERFACE AUDIT ===\n');

    // Capture full page
    await expect(page).toHaveScreenshot('01-full-interface.png', {
      fullPage: true,
      timeout: 15000
    });

    // Check viewport coverage
    const viewport = page.viewportSize();
    console.log(`Viewport: ${viewport?.width}x${viewport?.height}`);

    // Count key elements
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const headings = await page.locator('h1, h2, h3').count();

    console.log(`Buttons: ${buttons}`);
    console.log(`Inputs: ${inputs}`);
    console.log(`Headings: ${headings}`);
  });

  test('2. Visual Hierarchy - Typography and Spacing', async ({ page }) => {
    console.log('\n=== TYPOGRAPHY & SPACING AUDIT ===\n');

    // Screenshot main sections
    const mainInterface = page.locator('[data-testid="dj-interface"]');
    await expect(mainInterface).toHaveScreenshot('02-main-interface.png');

    const rightPanel = page.locator('[data-testid="right-panel"]');
    if (await rightPanel.isVisible()) {
      await expect(rightPanel).toHaveScreenshot('02-right-panel.png');
    }

    // Check heading hierarchy
    const h1 = page.locator('h1');
    if (await h1.isVisible()) {
      const h1Text = await h1.textContent();
      const h1Size = await h1.evaluate(el =>
        window.getComputedStyle(el).fontSize
      );
      console.log(`H1: "${h1Text}" - Size: ${h1Size}`);
    }
  });

  test('3. Interactive Elements - Touch Target Sizing', async ({ page }) => {
    console.log('\n=== TOUCH TARGET SIZING AUDIT ===\n');

    // Find all buttons and measure them
    const buttons = await page.locator('button').all();

    console.log(`\nAnalyzing ${buttons.length} buttons...`);

    const smallTargets: any[] = [];

    for (let i = 0; i < Math.min(buttons.length, 30); i++) {
      const button = buttons[i];
      const box = await button.boundingBox();
      const text = (await button.textContent())?.trim() || '';

      if (box) {
        const meetsMinimum = box.width >= 44 && box.height >= 44;

        if (!meetsMinimum) {
          smallTargets.push({
            index: i,
            text: text.substring(0, 30),
            width: Math.round(box.width),
            height: Math.round(box.height)
          });
        }

        // Highlight the button for visual inspection
        await button.evaluate((el, idx) => {
          el.setAttribute('data-button-index', String(idx));
        }, i);
      }
    }

    if (smallTargets.length > 0) {
      console.log(`\n⚠️  Found ${smallTargets.length} buttons below 44x44px:`);
      smallTargets.forEach(t => {
        console.log(`  [${t.index}] "${t.text}" - ${t.width}x${t.height}px`);
      });
    } else {
      console.log(`\n✅ All buttons meet minimum 44x44px requirement`);
    }

    await expect(page).toHaveScreenshot('03-button-sizes.png', { fullPage: true });
  });

  test('4. Color Contrast and Accessibility', async ({ page }) => {
    console.log('\n=== COLOR CONTRAST AUDIT ===\n');

    // Capture different sections for contrast analysis
    const sections = [
      { name: 'Header', selector: 'header, [data-testid*="header"]' },
      { name: 'Main Content', selector: 'main, [data-testid="dj-interface"]' },
      { name: 'Right Panel', selector: '[data-testid="right-panel"]' },
      { name: 'Graph Area', selector: '[data-testid="graph-container"]' }
    ];

    for (const section of sections) {
      const element = page.locator(section.selector).first();
      if (await element.isVisible()) {
        await expect(element).toHaveScreenshot(`04-contrast-${section.name.toLowerCase().replace(' ', '-')}.png`);

        const bgColor = await element.evaluate(el =>
          window.getComputedStyle(el).backgroundColor
        );
        const color = await element.evaluate(el =>
          window.getComputedStyle(el).color
        );

        console.log(`${section.name}:`);
        console.log(`  Background: ${bgColor}`);
        console.log(`  Text Color: ${color}`);
      }
    }
  });

  test('5. Spacing and Whitespace Usage', async ({ page }) => {
    console.log('\n=== WHITESPACE & SPACING AUDIT ===\n');

    // Measure spacing between key elements
    const djInterface = page.locator('[data-testid="dj-interface"]');
    const padding = await djInterface.evaluate(el =>
      window.getComputedStyle(el).padding
    );
    const margin = await djInterface.evaluate(el =>
      window.getComputedStyle(el).margin
    );

    console.log(`Main Interface:`);
    console.log(`  Padding: ${padding}`);
    console.log(`  Margin: ${margin}`);

    await expect(page).toHaveScreenshot('05-spacing-analysis.png', { fullPage: true });
  });

  test('6. Interactive State - Hover and Focus', async ({ page }) => {
    console.log('\n=== INTERACTIVE STATES AUDIT ===\n');

    // Test button hover states
    const firstButton = page.locator('button').first();

    // Default state
    await expect(firstButton).toHaveScreenshot('06-button-default.png');

    // Hover state
    await firstButton.hover();
    await page.waitForTimeout(500);
    await expect(firstButton).toHaveScreenshot('06-button-hover.png');

    // Focus state
    await firstButton.focus();
    await page.waitForTimeout(500);
    await expect(firstButton).toHaveScreenshot('06-button-focus.png');

    const outline = await firstButton.evaluate(el =>
      window.getComputedStyle(el).outline
    );
    const boxShadow = await firstButton.evaluate(el =>
      window.getComputedStyle(el).boxShadow
    );

    console.log(`Focus Indicators:`);
    console.log(`  Outline: ${outline}`);
    console.log(`  Box Shadow: ${boxShadow}`);

    expect(outline !== 'none' || boxShadow !== 'none').toBe(true);
  });

  test('7. Modal and Overlay Detection', async ({ page }) => {
    console.log('\n=== MODAL & OVERLAY AUDIT ===\n');

    // Try to trigger a modal by clicking a node
    const graphNode = page.locator('[data-testid="graph-node"]').first();

    if (await graphNode.isVisible()) {
      console.log('Clicking graph node to open modal...');
      await graphNode.click();
      await page.waitForTimeout(1000);

      const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first();

      if (await modal.isVisible()) {
        console.log('✅ Modal detected');

        await expect(page).toHaveScreenshot('07-modal-open.png');

        // Check for backdrop
        const backdrop = page.locator('.modal-backdrop, .overlay, [class*="backdrop"]').first();
        if (await backdrop.isVisible()) {
          const opacity = await backdrop.evaluate(el =>
            window.getComputedStyle(el).opacity
          );
          console.log(`Backdrop opacity: ${opacity}`);
        }

        // Test Escape key closes modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const modalStillVisible = await modal.isVisible();
        console.log(`Modal closes on Escape: ${!modalStillVisible ? '✅' : '❌'}`);

        await expect(page).toHaveScreenshot('07-modal-closed.png');
      } else {
        console.log('ℹ️  No modal detected');
      }
    }
  });

  test('8. Keyboard Navigation Flow', async ({ page }) => {
    console.log('\n=== KEYBOARD NAVIGATION AUDIT ===\n');

    await expect(page).toHaveScreenshot('08-tab-start.png');

    // Tab through elements
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);

      const focused = page.locator(':focus');
      if (await focused.isVisible()) {
        const tagName = await focused.evaluate(el => el.tagName);
        const text = (await focused.textContent())?.substring(0, 30) || '';
        console.log(`Tab ${i + 1}: ${tagName} - "${text}"`);

        await expect(page).toHaveScreenshot(`08-tab-${String(i + 1).padStart(2, '0')}.png`);
      }
    }
  });

  test('9. Responsive Breakpoints', async ({ page }) => {
    console.log('\n=== RESPONSIVE DESIGN AUDIT ===\n');

    const breakpoints = [
      { width: 1920, height: 1080, name: 'Desktop HD' },
      { width: 1280, height: 720, name: 'Desktop' },
      { width: 1024, height: 768, name: 'Tablet Landscape' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 390, height: 844, name: 'Mobile' }
    ];

    for (const bp of breakpoints) {
      console.log(`Testing ${bp.name}: ${bp.width}x${bp.height}`);
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot(`09-${bp.name.toLowerCase().replace(' ', '-')}.png`, {
        fullPage: true
      });
    }
  });

  test('10. Information Density and Clutter Analysis', async ({ page }) => {
    console.log('\n=== INFORMATION DENSITY AUDIT ===\n');

    // Analyze different sections
    const sections = [
      '[data-testid="dj-interface"]',
      '[data-testid="right-panel"]',
      '[data-testid="graph-container"]'
    ];

    for (const selector of sections) {
      const section = page.locator(selector).first();

      if (await section.isVisible()) {
        const textContent = await section.textContent();
        const textLength = textContent?.length || 0;

        const box = await section.boundingBox();
        if (box) {
          const area = box.width * box.height;
          const density = (textLength / area) * 1000;

          console.log(`${selector}:`);
          console.log(`  Area: ${Math.round(area)}px²`);
          console.log(`  Text: ${textLength} chars`);
          console.log(`  Density: ${density.toFixed(2)} chars/1000px²`);
        }
      }
    }

    await expect(page).toHaveScreenshot('10-density-analysis.png', { fullPage: true });
  });

  test('11. Error State and Feedback', async ({ page }) => {
    console.log('\n=== ERROR & FEEDBACK AUDIT ===\n');

    // Look for existing error messages
    const errorElements = page.locator('[data-testid*="error"], [class*="error"], [role="alert"]');
    const errorCount = await errorElements.count();

    console.log(`Error indicators found: ${errorCount}`);

    if (errorCount > 0) {
      await expect(errorElements.first()).toHaveScreenshot('11-error-message.png');
    }

    // Look for loading indicators
    const loadingElements = page.locator('[data-testid*="loading"], .loading, .spinner');
    const loadingCount = await loadingElements.count();

    console.log(`Loading indicators found: ${loadingCount}`);

    await expect(page).toHaveScreenshot('11-feedback-elements.png');
  });

  test('12. Final Comprehensive Overview', async ({ page }) => {
    console.log('\n=== COMPREHENSIVE UX AUDIT SUMMARY ===\n');

    // Gather comprehensive metrics
    const metrics = {
      buttons: await page.locator('button').count(),
      links: await page.locator('a[href]').count(),
      inputs: await page.locator('input').count(),
      headings: await page.locator('h1, h2, h3, h4, h5, h6').count(),
      images: await page.locator('img').count(),
      ariaLabels: await page.locator('[aria-label]').count(),
      ariaRoles: await page.locator('[role]').count(),
      nav: await page.locator('nav').count(),
      main: await page.locator('main').count(),
    };

    console.log('\nInterface Metrics:');
    console.log('------------------');
    for (const [key, value] of Object.entries(metrics)) {
      console.log(`${key.padEnd(15)}: ${value}`);
    }

    await expect(page).toHaveScreenshot('12-final-overview.png', { fullPage: true });

    // Generate report
    console.log('\n=== UX COMPLIANCE REPORT ===');
    console.log(`✅ Interactive Elements: ${metrics.buttons + metrics.links + metrics.inputs}`);
    console.log(`✅ Semantic Structure: ${metrics.headings + metrics.nav + metrics.main}`);
    console.log(`✅ Accessibility: ${metrics.ariaLabels + metrics.ariaRoles} ARIA features`);
    console.log('===========================\n');
  });
});
