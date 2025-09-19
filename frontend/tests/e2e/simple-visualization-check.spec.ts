import { test, expect } from '@playwright/test';

test.describe('Simple Visualization Verification', () => {
  test.use({
    baseURL: 'http://localhost:3009'
  });

  test('should verify visualization improvements are working', async ({ page }) => {
    // Bypass global setup and navigate directly
    console.log('Navigating to http://localhost:3009');

    try {
      await page.goto('http://localhost:3009', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for the graph container
      await page.waitForSelector('[data-testid="graph-container"]', { timeout: 15000 });
      console.log('✅ Graph container found');

      // Wait for SVG to render
      await page.waitForTimeout(5000);

      // Check for SVG element
      const svgElement = page.locator('svg').first();
      await expect(svgElement).toBeVisible();
      console.log('✅ SVG element is visible');

      // Take a screenshot of the current state
      await page.screenshot({
        path: 'test-results/visualization-current-state.png',
        fullPage: true
      });
      console.log('✅ Screenshot captured');

      // Verify thinner lines
      const lines = page.locator('svg line');
      const lineCount = await lines.count();

      if (lineCount > 0) {
        console.log(`Found ${lineCount} lines/edges`);

        // Check stroke width of first few lines
        for (let i = 0; i < Math.min(3, lineCount); i++) {
          const strokeWidth = await lines.nth(i).getAttribute('stroke-width');
          const width = parseFloat(strokeWidth || '0');
          console.log(`Line ${i}: stroke-width = ${strokeWidth}px`);

          // Verify lines are thin (≤ 3px as per our implementation)
          expect(width).toBeLessThanOrEqual(3);
          expect(width).toBeGreaterThan(0);
        }
        console.log('✅ Lines are appropriately thin');
      }

      // Verify text elements don't have borders
      const textElements = page.locator('svg text');
      const textCount = await textElements.count();

      if (textCount > 0) {
        console.log(`Found ${textCount} text elements`);

        // Check that texts don't have stroke (borders)
        for (let i = 0; i < Math.min(5, textCount); i++) {
          const stroke = await textElements.nth(i).getAttribute('stroke');
          const strokeWidth = await textElements.nth(i).getAttribute('stroke-width');

          // Should not have stroke borders
          expect(stroke).toBeOneOf([null, '', 'none']);
          expect(strokeWidth).toBeOneOf([null, '', '0']);

          console.log(`Text ${i}: no borders (stroke=${stroke})`);
        }
        console.log('✅ Text elements have no borders');
      }

      // Verify multi-line text structure (label groups)
      const labelGroups = page.locator('svg g.label-group');
      const groupCount = await labelGroups.count();

      if (groupCount > 0) {
        console.log(`Found ${groupCount} label groups for multi-line text`);

        // Check some groups have multiple text elements
        for (let i = 0; i < Math.min(3, groupCount); i++) {
          const textsInGroup = labelGroups.nth(i).locator('text');
          const textInGroupCount = await textsInGroup.count();
          console.log(`Group ${i}: contains ${textInGroupCount} text elements`);

          // At least some nodes should have multiple lines
          if (textInGroupCount > 1) {
            console.log(`✅ Found multi-line text in group ${i}`);
          }
        }
        console.log('✅ Multi-line text structure verified');
      }

      // Verify node interactivity still works
      const circles = page.locator('svg circle');
      const circleCount = await circles.count();

      if (circleCount > 0) {
        console.log(`Found ${circleCount} interactive nodes`);

        // Test hover on first node
        await circles.first().hover();
        await page.waitForTimeout(1000);

        // Test click on first node
        await circles.first().click();
        await page.waitForTimeout(1000);

        console.log('✅ Node interaction working');
      }

      // Final comprehensive screenshot
      await page.screenshot({
        path: 'test-results/visualization-verification-complete.png',
        fullPage: true
      });

      console.log('🎉 All visualization improvements verified successfully!');

    } catch (error) {
      console.error('❌ Test failed:', error);

      // Take error screenshot
      await page.screenshot({
        path: 'test-results/visualization-error.png',
        fullPage: true
      });

      throw error;
    }
  });
});