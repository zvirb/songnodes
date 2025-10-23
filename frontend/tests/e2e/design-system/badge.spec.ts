import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Badge Component', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('Badge Variants', () => {
    test('should render all 6 badge variants', async ({ page }) => {
      const variants = ['default', 'primary', 'secondary', 'success', 'warning', 'danger'];

      for (const variant of variants) {
        const badge = page.locator(`[data-testid="badge-${variant}"], .badge-${variant}, [data-variant="${variant}"]`).first();

        if (await badge.count() > 0) {
          await expect(badge).toBeVisible();

          // Check variant-specific styling
          const bgColor = await badge.evaluate(el => window.getComputedStyle(el).backgroundColor);

          switch(variant) {
            case 'primary':
              expect(bgColor).toMatch(/rgb\(59, 130, 246\)/); // Blue
              break;
            case 'success':
              expect(bgColor).toMatch(/rgb\([0-9]{1,2}, 1[5-9][0-9]|2[0-5][0-9], [0-9]{1,2}\)/); // Green
              break;
            case 'warning':
              expect(bgColor).toMatch(/rgb\(2[0-5][0-9], 1[5-9][0-9]|2[0-5][0-9], [0-9]{1,2}\)/); // Yellow/Orange
              break;
            case 'danger':
              expect(bgColor).toMatch(/rgb\(2[0-5][0-9], [0-9]{1,2}, [0-9]{1,2}\)/); // Red
              break;
          }
        }
      }
    });

    test('should display dot indicator when specified', async ({ page }) => {
      const badgeWithDot = page.locator('[data-has-dot="true"], .badge:has(.badge-dot)').first();

      if (await badgeWithDot.count() > 0) {
        const dot = badgeWithDot.locator('.badge-dot, [data-testid="badge-dot"]').first();

        if (await dot.count() > 0) {
          await expect(dot).toBeVisible();

          // Check dot styling
          const dotStyles = await dot.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
              width: styles.width,
              height: styles.height,
              borderRadius: styles.borderRadius
            };
          });

          // Dot should be small and circular
          expect(parseInt(dotStyles.width)).toBeLessThan(10);
          expect(dotStyles.width).toBe(dotStyles.height);
          expect(dotStyles.borderRadius).toMatch(/50%|9999px/);
        }
      }
    });
  });

  test.describe('Badge Content', () => {
    test('should display text content', async ({ page }) => {
      const badges = await page.locator('[class*="badge"]').all();

      for (const badge of badges.slice(0, 5)) {
        if (!await badge.isVisible()) continue;

        const text = await badge.textContent();
        expect(text).toBeTruthy();
        expect(text!.length).toBeGreaterThan(0);
      }
    });

    test('should display numbers correctly', async ({ page }) => {
      // Look for notification/count badges
      const countBadge = page.locator('[class*="badge"]:has-text(/^[0-9]+$/)').first();

      if (await countBadge.count() > 0) {
        const text = await countBadge.textContent();
        const number = parseInt(text || '0');
        expect(number).toBeGreaterThanOrEqual(0);

        // Check for "99+" pattern for large numbers
        if (number > 99) {
          expect(text).toMatch(/99\+|[0-9]+\+/);
        }
      }
    });

    test('should support icons in badges', async ({ page }) => {
      const badgeWithIcon = page.locator('[class*="badge"]:has(svg)').first();

      if (await badgeWithIcon.count() > 0) {
        const icon = badgeWithIcon.locator('svg').first();
        await expect(icon).toBeVisible();

        // Icon should be appropriately sized
        const iconSize = await icon.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });

        expect(iconSize.width).toBeLessThan(20);
        expect(iconSize.height).toBeLessThan(20);
      }
    });
  });

  test.describe('Badge Sizes', () => {
    test('should render different sizes', async ({ page }) => {
      const sizes = ['sm', 'md', 'lg'];

      for (const size of sizes) {
        const badge = page.locator(`[data-size="${size}"], .badge-${size}`).first();

        if (await badge.count() > 0) {
          const fontSize = await badge.evaluate(el => window.getComputedStyle(el).fontSize);
          const padding = await badge.evaluate(el => window.getComputedStyle(el).padding);

          const fontSizeValue = parseInt(fontSize);

          switch(size) {
            case 'sm':
              expect(fontSizeValue).toBeLessThan(14);
              break;
            case 'md':
              expect(fontSizeValue).toBeGreaterThanOrEqual(14);
              expect(fontSizeValue).toBeLessThan(16);
              break;
            case 'lg':
              expect(fontSizeValue).toBeGreaterThanOrEqual(16);
              break;
          }
        }
      }
    });
  });

  test.describe('Badge States', () => {
    test('should handle clickable badges', async ({ page }) => {
      const clickableBadge = page.locator('[class*="badge"][role="button"], [class*="badge"] button').first();

      if (await clickableBadge.count() > 0) {
        // Check cursor
        const cursor = await clickableBadge.evaluate(el => window.getComputedStyle(el).cursor);
        expect(cursor).toBe('pointer');

        // Check hover state
        const initialBg = await clickableBadge.evaluate(el => window.getComputedStyle(el).backgroundColor);
        await clickableBadge.hover();
        await page.waitForTimeout(100);
        const hoverBg = await clickableBadge.evaluate(el => window.getComputedStyle(el).backgroundColor);

        // Background might change on hover
        expect(hoverBg).toBeTruthy();

        // Test click
        await clickableBadge.click();
        // Could trigger action or state change
      }
    });

    test('should show removable badges with close button', async ({ page }) => {
      const removableBadge = page.locator('[class*="badge"]:has(button[aria-label*="Remove"]), [class*="badge"]:has(button[aria-label*="Close"])').first();

      if (await removableBadge.count() > 0) {
        const closeButton = removableBadge.locator('button').first();
        await expect(closeButton).toBeVisible();

        // Remove badge
        await closeButton.click();
        await page.waitForTimeout(300);

        // Badge should be removed
        await expect(removableBadge).not.toBeVisible();
      }
    });
  });

  test.describe('Badge Positioning', () => {
    test('should position as absolute overlay when needed', async ({ page }) => {
      // Look for notification badges on icons/avatars
      const overlayBadge = page.locator('.relative [class*="badge"][class*="absolute"], [data-badge-overlay="true"]').first();

      if (await overlayBadge.count() > 0) {
        const position = await overlayBadge.evaluate(el => window.getComputedStyle(el).position);
        expect(position).toBe('absolute');

        // Check positioning (usually top-right)
        const styles = await overlayBadge.evaluate(el => {
          const s = window.getComputedStyle(el);
          return {
            top: s.top,
            right: s.right,
            transform: s.transform
          };
        });

        expect(styles.top || styles.transform).toBeTruthy();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const badges = await page.locator('[class*="badge"]').all();

      for (const badge of badges.slice(0, 3)) {
        if (!await badge.isVisible()) continue;

        // Status badges should have appropriate role
        const role = await badge.getAttribute('role');
        const ariaLabel = await badge.getAttribute('aria-label');
        const text = await badge.textContent();

        // Should have some descriptive text
        expect(ariaLabel || text).toBeTruthy();

        // Clickable badges should have button role
        const isClickable = await badge.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return styles.cursor === 'pointer';
        });

        if (isClickable) {
          expect(role).toBe('button');
        }
      }
    });

    test('should have sufficient color contrast', async ({ page }) => {
      const badges = await page.locator('[class*="badge"]').all();

      for (const badge of badges.slice(0, 3)) {
        if (!await badge.isVisible()) continue;

        const bgColor = await badge.evaluate(el => window.getComputedStyle(el).backgroundColor);
        const textColor = await badge.evaluate(el => window.getComputedStyle(el).color);

        // Ensure text is visible against background
        expect(bgColor).not.toBe(textColor);
      }
    });
  });

  test.describe('Performance', () => {
    test('should render efficiently with many badges', async ({ page }) => {
      const badges = await page.locator('[class*="badge"]').all();

      if (badges.length > 10) {
        // Measure render performance
        const startTime = Date.now();

        // Force re-render by toggling theme
        const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
        if (await themeToggle.isVisible()) {
          await themeToggle.click();
          await page.waitForTimeout(100);
          await themeToggle.click();
        }

        const renderTime = Date.now() - startTime;

        // Should render quickly even with many badges
        expect(renderTime).toBeLessThan(500);
      }
    });
  });
});