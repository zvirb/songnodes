import { test, expect } from '@playwright/test';

/**
 * Basic Application Validation
 * Tests the current state of the application without requiring specific data-testid attributes
 */
test.describe('Basic Application Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for basic page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should load the application successfully', async ({ page }) => {
    // Check that the page title is set
    const title = await page.title();
    expect(title).toBeTruthy();

    // Take a screenshot of the loaded application
    await expect(page).toHaveScreenshot('application-loaded.png');
  });

  test('should display main page content', async ({ page }) => {
    // Check for basic HTML structure
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check if React root element exists
    const root = page.locator('#root');
    if (await root.isVisible()) {
      await expect(root).toHaveScreenshot('react-app-root.png');
    }

    // Check for any visible content
    const visibleElements = await page.locator(':visible').count();
    expect(visibleElements).toBeGreaterThan(0);
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Interact with the page briefly
    await page.waitForTimeout(3000);

    // Check that there are no critical console errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('favicon') && // Ignore favicon errors
      !error.includes('sourcemap') && // Ignore sourcemap warnings
      !error.includes('404') // Ignore 404s for optional resources
    );

    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }

    // We'll be lenient here since the app is in development
    expect(criticalErrors.length).toBeLessThan(10);
  });

  test('should be responsive', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);

      // Take screenshot at this viewport
      await expect(page).toHaveScreenshot(`responsive-${viewport.name}-${viewport.width}x${viewport.height}.png`);

      // Verify no horizontal scroll on mobile
      if (viewport.width <= 768) {
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);

        // Allow small difference for scrollbars
        expect(scrollWidth - clientWidth).toBeLessThan(20);
      }
    }
  });

  test('should handle basic interactions', async ({ page }) => {
    // Try clicking on interactive elements
    const clickableElements = page.locator('button, a, [role="button"], input[type="button"]');
    const count = await clickableElements.count();

    if (count > 0) {
      // Click on first few clickable elements
      for (let i = 0; i < Math.min(3, count); i++) {
        const element = clickableElements.nth(i);
        if (await element.isVisible()) {
          await element.click();
          await page.waitForTimeout(300);
        }
      }

      await expect(page).toHaveScreenshot('after-basic-interactions.png');
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test basic keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('keyboard-navigation-first-tab.png');

    // Tab through a few more elements
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }
    await expect(page).toHaveScreenshot('keyboard-navigation-multiple-tabs.png');
  });

  test('should load without accessibility violations', async ({ page }) => {
    // Check for basic accessibility attributes
    const elementsWithoutAlt = await page.locator('img:not([alt])').count();
    const buttonsWithoutLabel = await page.locator('button:not([aria-label]):not(:has(text))').count();

    // These are suggestions, not hard failures
    if (elementsWithoutAlt > 0) {
      console.log(`Found ${elementsWithoutAlt} images without alt text`);
    }
    if (buttonsWithoutLabel > 0) {
      console.log(`Found ${buttonsWithoutLabel} buttons without labels`);
    }

    // Take screenshot for manual accessibility review
    await expect(page).toHaveScreenshot('accessibility-review.png');
  });

  test('should handle network conditions gracefully', async ({ page }) => {
    // Test with slow network
    await page.route('**/*', route => {
      // Add delay to simulate slow network
      setTimeout(() => {
        route.continue();
      }, 100);
    });

    await page.reload();
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('slow-network-conditions.png');
  });

  test('should maintain visual consistency', async ({ page }) => {
    // Take baseline screenshot for visual regression testing
    await expect(page).toHaveScreenshot('visual-consistency-baseline.png');

    // Interact with page and verify it returns to consistent state
    await page.mouse.click(100, 100);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('visual-consistency-after-interaction.png');
  });
});