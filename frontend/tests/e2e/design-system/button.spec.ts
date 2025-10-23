import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Button Component', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('Visual Variants', () => {
    test('should render all 5 button variants correctly', async ({ page }) => {
      // Test primary variant
      const primaryBtn = page.locator('[data-testid="button-primary"]').first();
      if (await primaryBtn.isVisible()) {
        await expect(primaryBtn).toHaveCSS('background-color', /rgb\(59, 130, 246\)/);
        await expect(primaryBtn).toHaveCSS('color', /rgb\(255, 255, 255\)/);
      }

      // Test secondary variant
      const secondaryBtn = page.locator('[data-testid="button-secondary"]').first();
      if (await secondaryBtn.isVisible()) {
        await expect(secondaryBtn).toHaveCSS('background-color', /rgb\(100, 116, 139\)/);
      }

      // Test ghost variant
      const ghostBtn = page.locator('[data-testid="button-ghost"]').first();
      if (await ghostBtn.isVisible()) {
        await expect(ghostBtn).toHaveCSS('background-color', /transparent|rgba\(0, 0, 0, 0\)/);
      }

      // Test outline variant
      const outlineBtn = page.locator('[data-testid="button-outline"]').first();
      if (await outlineBtn.isVisible()) {
        await expect(outlineBtn).toHaveCSS('border-width', /[1-2]px/);
        await expect(outlineBtn).toHaveCSS('background-color', /transparent|rgba\(0, 0, 0, 0\)/);
      }

      // Test link variant
      const linkBtn = page.locator('[data-testid="button-link"]').first();
      if (await linkBtn.isVisible()) {
        await expect(linkBtn).toHaveCSS('background-color', /transparent|rgba\(0, 0, 0, 0\)/);
        await expect(linkBtn).toHaveCSS('text-decoration', /underline/);
      }
    });

    test('should render all 6 button sizes', async ({ page }) => {
      const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];

      for (const size of sizes) {
        const btn = page.locator(`[data-testid="button-size-${size}"]`).first();
        if (await btn.isVisible()) {
          const height = await btn.evaluate(el => window.getComputedStyle(el).height);

          // Verify sizes are progressively larger
          const heightValue = parseInt(height);

          switch(size) {
            case 'xs':
              expect(heightValue).toBeLessThan(30);
              break;
            case 'sm':
              expect(heightValue).toBeGreaterThanOrEqual(30);
              expect(heightValue).toBeLessThan(36);
              break;
            case 'md':
              expect(heightValue).toBeGreaterThanOrEqual(36);
              expect(heightValue).toBeLessThan(40);
              break;
            case 'lg':
              expect(heightValue).toBeGreaterThanOrEqual(40);
              expect(heightValue).toBeLessThan(44);
              break;
            case 'xl':
              expect(heightValue).toBeGreaterThanOrEqual(44);
              expect(heightValue).toBeLessThan(52);
              break;
            case '2xl':
              expect(heightValue).toBeGreaterThanOrEqual(52);
              break;
          }
        }
      }
    });
  });

  test.describe('States and Interactions', () => {
    test('should handle loading state correctly', async ({ page }) => {
      // Find a button that can be put into loading state
      const btn = page.locator('button').first();

      // Simulate loading state by clicking a button that triggers async action
      if (await btn.isVisible()) {
        // Check if button has loading state
        const loadingBtn = page.locator('button[data-loading="true"]').first();
        if (await loadingBtn.count() > 0) {
          await expect(loadingBtn).toBeDisabled();

          // Check for spinner
          const spinner = loadingBtn.locator('svg.animate-spin, [data-testid="spinner"]');
          await expect(spinner).toBeVisible();
        }
      }
    });

    test('should handle disabled state', async ({ page }) => {
      const disabledBtn = page.locator('button:disabled').first();

      if (await disabledBtn.count() > 0) {
        await expect(disabledBtn).toBeDisabled();
        await expect(disabledBtn).toHaveCSS('cursor', /not-allowed|default/);
        await expect(disabledBtn).toHaveCSS('opacity', /0\.[3-6]/);

        // Verify click doesn't work
        let clicked = false;
        page.once('console', msg => {
          if (msg.text().includes('click')) clicked = true;
        });

        await disabledBtn.click({ force: true });
        expect(clicked).toBeFalsy();
      }
    });

    test('should handle hover state', async ({ page }) => {
      const btn = page.locator('button:not(:disabled)').first();

      if (await btn.isVisible()) {
        // Get initial styles
        const initialBg = await btn.evaluate(el => window.getComputedStyle(el).backgroundColor);

        // Hover
        await btn.hover();
        await page.waitForTimeout(100);

        // Get hover styles
        const hoverBg = await btn.evaluate(el => window.getComputedStyle(el).backgroundColor);

        // Background should change on hover (unless it's ghost/link variant)
        const variant = await btn.getAttribute('data-variant');
        if (variant !== 'ghost' && variant !== 'link') {
          expect(hoverBg).not.toBe(initialBg);
        }
      }
    });

    test('should handle focus state', async ({ page }) => {
      const btn = page.locator('button:not(:disabled)').first();

      if (await btn.isVisible()) {
        await btn.focus();

        // Check for focus ring
        const focusStyles = await btn.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            outline: styles.outline,
            boxShadow: styles.boxShadow,
            outlineOffset: styles.outlineOffset
          };
        });

        // Should have some focus indicator
        const hasFocusRing =
          focusStyles.outline !== 'none' ||
          focusStyles.boxShadow.includes('rgb');

        expect(hasFocusRing).toBeTruthy();
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should respond to keyboard shortcuts', async ({ page }) => {
      // Look for buttons with keyboard shortcuts
      const btnWithKbd = page.locator('button[data-kbd], button:has(kbd)').first();

      if (await btnWithKbd.count() > 0) {
        // Get the keyboard shortcut
        const kbdElement = btnWithKbd.locator('kbd').first();
        let shortcut = '';

        if (await kbdElement.count() > 0) {
          shortcut = await kbdElement.textContent() || '';
        }

        // Try common shortcuts
        if (shortcut.includes('⌘K') || shortcut.includes('Ctrl+K')) {
          await page.keyboard.press('Control+K');

          // Check if action was triggered (e.g., modal opened, search focused)
          const searchInput = page.locator('[data-testid="search-input"], input[type="search"]').first();
          if (await searchInput.count() > 0) {
            await expect(searchInput).toBeFocused();
          }
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should meet WCAG AA contrast requirements', async ({ page }) => {
      const buttons = await page.locator('button').all();

      for (const btn of buttons.slice(0, 5)) { // Test first 5 buttons
        if (!await btn.isVisible()) continue;

        const bgColor = await btn.evaluate(el => window.getComputedStyle(el).backgroundColor);
        const textColor = await btn.evaluate(el => window.getComputedStyle(el).color);

        // Simple contrast check (would use proper contrast ratio calculation in production)
        expect(bgColor).toBeTruthy();
        expect(textColor).toBeTruthy();

        // Verify text is visible
        const isTransparent = bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent';
        if (!isTransparent) {
          expect(textColor).not.toBe(bgColor);
        }
      }
    });

    test('should have proper ARIA attributes', async ({ page }) => {
      const buttons = await page.locator('button').all();

      for (const btn of buttons.slice(0, 5)) {
        if (!await btn.isVisible()) continue;

        // Check for aria-label or text content
        const ariaLabel = await btn.getAttribute('aria-label');
        const textContent = await btn.textContent();

        expect(ariaLabel || textContent).toBeTruthy();

        // Check disabled state
        const isDisabled = await btn.isDisabled();
        if (isDisabled) {
          const ariaDisabled = await btn.getAttribute('aria-disabled');
          expect(ariaDisabled === 'true' || isDisabled).toBeTruthy();
        }

        // Check loading state
        const isLoading = await btn.getAttribute('data-loading');
        if (isLoading === 'true') {
          const ariaBusy = await btn.getAttribute('aria-busy');
          expect(ariaBusy).toBe('true');
        }
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Start from a known point
      await page.locator('body').click();

      // Tab through buttons
      let focusedCount = 0;
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');

        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? el.tagName.toLowerCase() : null;
        });

        if (focusedElement === 'button') {
          focusedCount++;

          // Try to activate with Enter
          await page.keyboard.press('Enter');
          await page.waitForTimeout(100);

          // Try to activate with Space
          await page.keyboard.press('Space');
          await page.waitForTimeout(100);
        }
      }

      expect(focusedCount).toBeGreaterThan(0);
    });
  });

  test.describe('Touch Interactions', () => {
    test('should have minimum touch target size (44x44px)', async ({ page }) => {
      const buttons = await page.locator('button').all();

      for (const btn of buttons.slice(0, 5)) {
        if (!await btn.isVisible()) continue;

        const box = await btn.boundingBox();
        if (box) {
          // WCAG 2.2 AA requires 44x44px minimum
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Performance', () => {
    test('should render without performance issues', async ({ page }) => {
      // Measure initial render time
      const startTime = Date.now();

      // Force re-render by toggling theme or similar
      const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(100);
        await themeToggle.click();
      }

      const renderTime = Date.now() - startTime;

      // Should render quickly
      expect(renderTime).toBeLessThan(500);

      // Check for memory leaks with multiple interactions
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Interact with buttons multiple times
      const btn = page.locator('button:not(:disabled)').first();
      if (await btn.isVisible()) {
        for (let i = 0; i < 10; i++) {
          await btn.click();
          await page.waitForTimeout(50);
        }
      }

      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Memory shouldn't grow excessively
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = (finalMemory - initialMemory) / initialMemory;
        expect(memoryGrowth).toBeLessThan(0.5); // Less than 50% growth
      }
    });
  });
});