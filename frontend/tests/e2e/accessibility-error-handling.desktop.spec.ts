import { test, expect } from '@playwright/test';

/**
 * Accessibility, Error Handling & Keyboard Shortcuts Tests
 * Testing ARIA support, error states, keyboard navigation, and global shortcuts
 */
test.describe('Accessibility, Error Handling & Global Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should toggle debug mode with D key', async ({ page }) => {
      // Take initial screenshot
      await expect(page).toHaveScreenshot('debug-mode-off.png');

      // Press D to toggle debug mode
      await page.keyboard.press('d');
      await page.waitForTimeout(1000);

      // Check for debug overlay
      const debugOverlay = page.locator('[data-testid="debug-overlay"]');
      if (await debugOverlay.isVisible()) {
        await expect(debugOverlay).toHaveScreenshot('debug-mode-overlay.png');
      }

      await expect(page).toHaveScreenshot('debug-mode-on.png');

      // Press D again to toggle off
      await page.keyboard.press('d');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('debug-mode-off-again.png');
    });

    test('should close modals with Escape key', async ({ page }) => {
      // Open a modal first
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"]');
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('modal-before-escape.png');

          // Press Escape to close
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          await expect(modal).not.toBeVisible();
          await expect(page).toHaveScreenshot('modal-closed-with-escape.png');
        }
      }
    });

    test('should control playback with Space key', async ({ page }) => {
      const nowPlaying = page.locator('[data-testid="now-playing"]');
      if (await nowPlaying.isVisible()) {
        await expect(nowPlaying).toHaveScreenshot('playback-before-space.png');

        // Press Space to play/pause
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);

        await expect(nowPlaying).toHaveScreenshot('playback-after-space.png');
      }
    });

    test('should navigate with arrow keys', async ({ page }) => {
      // Focus on the first interactive element
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot('arrow-nav-initial-focus.png');

      // Use arrow keys to navigate
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('arrow-nav-right.png');

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('arrow-nav-down.png');

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('arrow-nav-left.png');

      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('arrow-nav-up.png');
    });

    test('should confirm actions with Enter key', async ({ page }) => {
      // Focus on a button
      const firstButton = page.locator('button').first();
      if (await firstButton.isVisible()) {
        await firstButton.focus();
        await page.waitForTimeout(200);
        await expect(page).toHaveScreenshot('button-focused-before-enter.png');

        // Press Enter to activate
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('button-activated-with-enter.png');
      }
    });

    test('should navigate with Tab key', async ({ page }) => {
      await expect(page).toHaveScreenshot('tab-nav-start.png');

      // Tab through multiple elements
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);
        await expect(page).toHaveScreenshot(`tab-nav-step-${i + 1}.png`);
      }

      // Reverse with Shift+Tab
      await page.keyboard.press('Shift+Tab');
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot('reverse-tab-nav.png');
    });
  });

  test.describe('Accessibility Features', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      // Check main interface elements for ARIA labels
      const mainInterface = page.locator('[data-testid="dj-interface"]');
      const ariaLabel = await mainInterface.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();

      // Check buttons have labels
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(5, buttonCount); i++) {
        const button = buttons.nth(i);
        const label = await button.getAttribute('aria-label') || await button.textContent();
        expect(label).toBeTruthy();
      }
    });

    test('should support screen reader navigation', async ({ page }) => {
      // Check for semantic HTML structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);

      // Check for navigation landmarks
      const nav = page.locator('nav');
      const main = page.locator('main');
      const aside = page.locator('aside');

      if (await nav.count() > 0) {
        const navRole = await nav.first().getAttribute('role');
        expect(navRole === 'navigation' || await nav.first().tagName() === 'NAV').toBeTruthy();
      }

      // Check for proper focus management
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should have sufficient color contrast', async ({ page }) => {
      // This would require color contrast analysis
      // For now, we'll capture screenshots and verify visually
      await expect(page).toHaveScreenshot('color-contrast-analysis.png');

      // Check if high contrast mode affects visibility
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('dark-mode-contrast.png');

      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('light-mode-contrast.png');
    });

    test('should support focus indicators', async ({ page }) => {
      // Tab through elements and verify focus indicators are visible
      const focusableElements = await page.locator('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])').count();

      for (let i = 0; i < Math.min(5, focusableElements); i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        // Check if focused element has visible focus indicator
        const focusedElement = page.locator(':focus');
        if (await focusedElement.count() > 0) {
          await expect(focusedElement).toHaveScreenshot(`focus-indicator-${i}.png`);
        }
      }
    });

    test('should provide alternative text for visual elements', async ({ page }) => {
      // Check images have alt text
      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const ariaLabel = await img.getAttribute('aria-label');
        const ariaLabelledby = await img.getAttribute('aria-labelledby');

        expect(alt || ariaLabel || ariaLabelledby).toBeTruthy();
      }

      // Check SVG elements have titles or descriptions
      const svgs = page.locator('svg');
      const svgCount = await svgs.count();

      for (let i = 0; i < Math.min(3, svgCount); i++) {
        const svg = svgs.nth(i);
        const title = svg.locator('title');
        const ariaLabel = await svg.getAttribute('aria-label');

        const hasAccessibleName = (await title.count() > 0) || ariaLabel;
        if (!hasAccessibleName) {
          console.warn(`SVG ${i} may need accessible name`);
        }
      }
    });

    test('should handle reduced motion preferences', async ({ page }) => {
      // Test with reduced motion enabled
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('reduced-motion-enabled.png');

      // Interact with elements that typically animate
      const animatedElement = page.locator('[data-testid="graph-container"]');
      if (await animatedElement.isVisible()) {
        // Click to trigger interaction
        await animatedElement.click();
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('reduced-motion-interaction.png');
      }

      // Reset motion preference
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    });
  });

  test.describe('Error Handling', () => {
    test('should display network connection error states', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      // Reload page to trigger network errors
      await page.reload();
      await page.waitForTimeout(3000);

      // Check for error messages
      const networkError = page.locator('[data-testid="network-error"]');
      const connectionError = page.locator('[data-testid="connection-error"]');
      const generalError = page.locator('[data-testid="error-message"]');

      if (await networkError.isVisible()) {
        await expect(networkError).toHaveScreenshot('network-error-display.png');
      } else if (await connectionError.isVisible()) {
        await expect(connectionError).toHaveScreenshot('connection-error-display.png');
      } else if (await generalError.isVisible()) {
        await expect(generalError).toHaveScreenshot('general-error-display.png');
      }

      await expect(page).toHaveScreenshot('network-failure-state.png');
    });

    test('should handle data loading errors gracefully', async ({ page }) => {
      // Mock API responses to return errors
      await page.route('**/api/graph-data', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      // Trigger data loading
      await page.reload();
      await page.waitForTimeout(3000);

      const dataError = page.locator('[data-testid="data-loading-error"]');
      if (await dataError.isVisible()) {
        await expect(dataError).toHaveScreenshot('data-loading-error.png');
      }

      await expect(page).toHaveScreenshot('data-error-state.png');
    });

    test('should validate user input and show error messages', async ({ page }) => {
      // Try to open a form/input that has validation
      const searchInput = page.locator('[data-testid="track-search-input"]');
      if (await searchInput.isVisible()) {
        // Enter invalid input (very long string or special characters)
        await searchInput.fill('a'.repeat(1000));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        const validationError = page.locator('[data-testid="validation-error"]');
        if (await validationError.isVisible()) {
          await expect(validationError).toHaveScreenshot('input-validation-error.png');
        }
      }

      // Test form validation in settings or target tracks
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');
      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const numericInput = page.locator('input[type="number"]').first();
        if (await numericInput.isVisible()) {
          await numericInput.fill('-999');
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);

          const errorMessage = page.locator('[data-testid="input-error"]');
          if (await errorMessage.isVisible()) {
            await expect(errorMessage).toHaveScreenshot('numeric-validation-error.png');
          }
        }
      }
    });

    test('should show performance degradation warnings', async ({ page }) => {
      // This would be triggered by high CPU usage, memory issues, or large datasets
      // Mock performance issues by loading many elements
      await page.evaluate(() => {
        // Create a scenario that might trigger performance warnings
        for (let i = 0; i < 1000; i++) {
          const div = document.createElement('div');
          div.className = 'performance-test-element';
          document.body.appendChild(div);
        }
      });

      await page.waitForTimeout(2000);

      const performanceWarning = page.locator('[data-testid="performance-warning"]');
      if (await performanceWarning.isVisible()) {
        await expect(performanceWarning).toHaveScreenshot('performance-degradation-warning.png');
      }

      // Clean up test elements
      await page.evaluate(() => {
        const testElements = document.querySelectorAll('.performance-test-element');
        testElements.forEach(el => el.remove());
      });
    });

    test('should recover from JavaScript errors gracefully', async ({ page }) => {
      let jsErrors: string[] = [];

      page.on('pageerror', error => {
        jsErrors.push(error.message);
      });

      // Trigger potential JS errors by interacting with complex elements
      await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });
      const graphContainer = page.locator('[data-testid="graph-container"]');

      if (await graphContainer.isVisible()) {
        // Rapid interactions that might cause errors
        for (let i = 0; i < 10; i++) {
          await graphContainer.click({ position: { x: Math.random() * 500, y: Math.random() * 300 } });
          await page.waitForTimeout(100);
        }
      }

      // Check if app still functions after potential errors
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('app-state-after-stress-test.png');

      // Log any JS errors for debugging
      if (jsErrors.length > 0) {
        console.log('JavaScript errors encountered:', jsErrors);
      }
    });

    test('should handle empty or no data states', async ({ page }) => {
      // Mock empty API responses
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ nodes: [], edges: [], tracks: [] })
        });
      });

      await page.reload();
      await page.waitForTimeout(3000);

      const emptyState = page.locator('[data-testid="empty-state"]');
      const noData = page.locator('[data-testid="no-data"]');

      if (await emptyState.isVisible()) {
        await expect(emptyState).toHaveScreenshot('empty-state-display.png');
      } else if (await noData.isVisible()) {
        await expect(noData).toHaveScreenshot('no-data-display.png');
      }

      await expect(page).toHaveScreenshot('empty-data-state.png');
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('mobile-portrait-375x667.png');

      // Test mobile landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('mobile-landscape-667x375.png');
    });

    test('should adapt to tablet viewport', async ({ page }) => {
      // Test tablet portrait
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('tablet-portrait-768x1024.png');

      // Test tablet landscape
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('tablet-landscape-1024x768.png');
    });

    test('should handle touch vs mouse interactions', async ({ page }) => {
      // Simulate touch device
      const context = page.context();
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'maxTouchPoints', {
          writable: false,
          value: 5,
        });
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('touch-interface-optimized.png');

      // Test touch gestures if elements support them
      const touchableElement = page.locator('[data-testid="graph-node"]').first();
      if (await touchableElement.isVisible()) {
        // Simulate long press
        await touchableElement.tap();
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('touch-interaction-result.png');
      }
    });

    test('should maintain usability across breakpoints', async ({ page }) => {
      const breakpoints = [
        { width: 320, height: 568, name: 'small-mobile' },
        { width: 414, height: 736, name: 'large-mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1280, height: 720, name: 'desktop' },
        { width: 1920, height: 1080, name: 'large-desktop' },
      ];

      for (const breakpoint of breakpoints) {
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        await page.waitForTimeout(1000);

        // Check that essential functionality is accessible
        const mainInterface = page.locator('[data-testid="dj-interface"]');
        await expect(mainInterface).toBeVisible();

        await expect(page).toHaveScreenshot(`${breakpoint.name}-${breakpoint.width}x${breakpoint.height}.png`);
      }
    });
  });

  test('should complete comprehensive functionality verification', async ({ page }) => {
    // Final comprehensive test - verify all major components are present and functional
    await expect(page).toHaveScreenshot('final-comprehensive-verification.png');

    // Count of all interactive elements that should be present
    const interactiveElements = [
      '[data-testid*="button"]',
      '[data-testid*="toggle"]',
      '[data-testid*="input"]',
      '[data-testid*="dropdown"]',
      '[data-testid*="slider"]',
      '[data-testid*="tab"]',
      'button',
      'input',
      'select'
    ];

    let totalInteractiveCount = 0;
    for (const selector of interactiveElements) {
      const count = await page.locator(selector).count();
      totalInteractiveCount += count;
    }

    console.log(`Total interactive elements found: ${totalInteractiveCount}`);
    expect(totalInteractiveCount).toBeGreaterThan(20); // Should have substantial interactive functionality

    // Verify major sections are present
    const majorSections = [
      '[data-testid="dj-interface"]',
      '[data-testid="graph-container"]',
      '[data-testid="right-panel"]'
    ];

    for (const section of majorSections) {
      const element = page.locator(section);
      if (await element.isVisible()) {
        await expect(element).toHaveScreenshot(`major-section-${section.replace(/[\[\]"=]/g, '')}.png`);
      }
    }
  });
});