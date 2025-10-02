import { test, expect } from '@playwright/test';

/**
 * Quick UX Audit - UI/UX Guide Compliance Check
 * Fast validation against key UX principles
 */

test('Quick UX Compliance Audit', async ({ page }) => {
  console.log('\n=== QUICK UX COMPLIANCE AUDIT ===\n');

  await page.goto('/');
  await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1. CAPTURE FULL INTERFACE
  console.log('1. Capturing full interface...');
  await expect(page).toHaveScreenshot('quick-audit-full-interface.png', {
    fullPage: true,
    timeout: 10000
  });

  // 2. FITTS'S LAW - Touch Target Sizing
  console.log('\n2. Checking touch target sizes (Fitts\'s Law)...');
  const buttons = await page.locator('button').all();
  const smallTargets: any[] = [];

  for (let i = 0; i < Math.min(buttons.length, 20); i++) {
    const box = await buttons[i].boundingBox();
    if (box && (box.width < 44 || box.height < 44)) {
      const text = await buttons[i].textContent();
      smallTargets.push({
        text: text?.substring(0, 20),
        size: `${Math.round(box.width)}x${Math.round(box.height)}px`
      });
    }
  }

  if (smallTargets.length > 0) {
    console.log(`⚠️  Found ${smallTargets.length} buttons below 44x44px minimum:`);
    smallTargets.forEach(t => console.log(`  - "${t.text}" (${t.size})`));
  } else {
    console.log('✅ All tested buttons meet 44x44px minimum');
  }

  // 3. HICK'S LAW - Navigation Complexity
  console.log('\n3. Checking navigation complexity (Hick\'s Law)...');
  const navButtons = await page.locator('nav button, header button').count();
  console.log(`Navigation items: ${navButtons}`);
  if (navButtons > 9) {
    console.log(`⚠️  Navigation has ${navButtons} items (ideal: 5-7, max: 9)`);
  } else {
    console.log('✅ Navigation complexity is acceptable');
  }

  // 4. WCAG - Accessibility
  console.log('\n4. Checking accessibility features (WCAG 2.1)...');
  const ariaLabels = await page.locator('[aria-label]').count();
  const ariaRoles = await page.locator('[role]').count();
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();

  console.log(`ARIA labels: ${ariaLabels}`);
  console.log(`ARIA roles: ${ariaRoles}`);
  console.log(`Headings: ${headings}`);

  if (ariaLabels + ariaRoles < 10) {
    console.log('⚠️  Low accessibility markup detected');
  } else {
    console.log('✅ Good accessibility markup');
  }

  // 5. NIELSEN #1 - System Status Visibility
  console.log('\n5. Checking system status visibility (Nielsen #1)...');
  const loadingIndicators = await page.locator('[data-testid*="loading"], .loading, .spinner').count();
  console.log(`Loading indicators found: ${loadingIndicators}`);

  // 6. VISUAL HIERARCHY - Typography
  console.log('\n6. Checking visual hierarchy...');
  const h1 = page.locator('h1').first();
  if (await h1.isVisible()) {
    const h1Size = await h1.evaluate(el =>
      parseFloat(window.getComputedStyle(el).fontSize)
    );
    const bodySize = await page.locator('p, div').filter({ hasText: /.{20,}/ }).first().evaluate(el =>
      parseFloat(window.getComputedStyle(el).fontSize)
    );

    const ratio = h1Size / bodySize;
    console.log(`H1/Body font size ratio: ${ratio.toFixed(2)}`);

    if (ratio < 1.5) {
      console.log('⚠️  H1 should be at least 1.5x larger than body text');
    } else {
      console.log('✅ Good heading hierarchy');
    }
  }

  // 7. INFORMATION DENSITY
  console.log('\n7. Checking information density...');
  const textContent = await page.textContent('body');
  const textLength = textContent?.length || 0;
  const viewport = page.viewportSize();
  const screenArea = viewport ? viewport.width * viewport.height : 1;
  const density = (textLength / screenArea) * 1000;

  console.log(`Information density: ${density.toFixed(2)} chars/1000px²`);

  if (density > 50) {
    console.log('⚠️  Interface may be too cluttered');
  } else {
    console.log('✅ Information density is good');
  }

  // 8. INTERACTIVE ELEMENTS COUNT
  console.log('\n8. Interface metrics summary...');
  const metrics = {
    buttons: await page.locator('button').count(),
    links: await page.locator('a[href]').count(),
    inputs: await page.locator('input').count(),
    total: 0
  };
  metrics.total = metrics.buttons + metrics.links + metrics.inputs;

  console.log(`Buttons: ${metrics.buttons}`);
  console.log(`Links: ${metrics.links}`);
  console.log(`Inputs: ${metrics.inputs}`);
  console.log(`Total interactive elements: ${metrics.total}`);

  // 9. FOCUS INDICATORS
  console.log('\n9. Testing keyboard navigation and focus indicators...');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);

  const focused = page.locator(':focus');
  if (await focused.isVisible()) {
    const outline = await focused.evaluate(el =>
      window.getComputedStyle(el).outline
    );
    const boxShadow = await focused.evaluate(el =>
      window.getComputedStyle(el).boxShadow
    );

    const hasFocusIndicator = outline !== 'none' || boxShadow !== 'none';

    if (hasFocusIndicator) {
      console.log('✅ Focus indicators are visible');
    } else {
      console.log('⚠️  No visible focus indicator detected');
    }

    await expect(focused).toHaveScreenshot('quick-audit-focus-indicator.png');
  }

  // 10. MODAL/OVERLAY TEST
  console.log('\n10. Testing modal behavior...');
  const graphNode = page.locator('[data-testid="graph-node"]').first();

  if (await graphNode.isVisible()) {
    await graphNode.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first();

    if (await modal.isVisible()) {
      console.log('✅ Modal detected');
      await expect(page).toHaveScreenshot('quick-audit-modal-open.png');

      // Test Escape closes modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      if (!(await modal.isVisible())) {
        console.log('✅ Modal closes with Escape key');
      } else {
        console.log('⚠️  Modal does not close with Escape key');
      }
    }
  }

  // FINAL SUMMARY
  console.log('\n========================================');
  console.log('UX COMPLIANCE SUMMARY');
  console.log('========================================');
  console.log(`✅ Full interface captured`);
  console.log(`${smallTargets.length > 0 ? '⚠️ ' : '✅'} Touch targets: ${smallTargets.length} issues`);
  console.log(`${navButtons > 9 ? '⚠️ ' : '✅'} Navigation complexity: ${navButtons} items`);
  console.log(`${ariaLabels + ariaRoles < 10 ? '⚠️ ' : '✅'} Accessibility: ${ariaLabels + ariaRoles} features`);
  console.log(`✅ Total interactive elements: ${metrics.total}`);
  console.log('========================================\n');

  // Take final screenshot
  await expect(page).toHaveScreenshot('quick-audit-final.png', { fullPage: true });
});
