import { test, expect } from '@playwright/test';

test('final graph rendering check', async ({ page }) => {
  await page.goto('http://localhost:3006', { timeout: 15000 });

  // Wait for data to load - look for the track count to change from 0
  console.log('⏳ Waiting for data to load...');
  try {
    await page.waitForFunction(() => {
      const header = document.querySelector('header');
      const text = header?.textContent || '';
      const match = text.match(/(\d+)\s+Tracks\s+Loaded/);
      if (match) {
        const count = parseInt(match[1]);
        console.log('Track count:', count);
        return count > 0;
      }
      return false;
    }, { timeout: 15000 });
    console.log('✅ Data loaded!');
  } catch (e) {
    console.log('⚠️  Timeout waiting for tracks to load');
  }

  // Wait a bit more for rendering
  await page.waitForTimeout(5000);

  // Check what we have now
  const canvasCount = await page.locator('canvas').count();
  const graphContainerCount = await page.locator('[class*="graph"]').count();

  console.log('\n📊 After waiting:');
  console.log('  Canvas elements:', canvasCount);
  console.log('  Elements with "graph" in class:', graphContainerCount);

  // Get header text
  const headerText = await page.locator('header').textContent();
  console.log('  Header text:', headerText);

  // Check for loading/error states
  const loadingText = await page.locator('text=/loading/i').count();
  const errorText = await page.locator('text=/error/i').count();

  console.log('  Loading indicators:', loadingText);
  console.log('  Error messages:', errorText);

  // Take final screenshot
  await page.screenshot({
    path: 'tests/e2e/screenshots/graph-final-state.png',
    fullPage: true
  });

  console.log('\n📸 Screenshot saved to tests/e2e/screenshots/graph-final-state.png');

  // Get full page text to see what's actually displayed
  const bodyText = await page.locator('body').textContent();
  console.log('\n📝 Page text preview:', bodyText?.slice(0, 500));

  // Try to find the main content area
  const mainContent = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return 'No main element';

    return {
      hasContent: main.children.length > 0,
      firstChildClass: main.children[0]?.className || 'no class',
      innerHTML: main.innerHTML.slice(0, 300)
    };
  });

  console.log('\n🎯 Main content:', JSON.stringify(mainContent, null, 2));

  expect(canvasCount).toBeGreaterThan(0);
});
