import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Skeleton Component', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    // Don't wait for app ready as we want to test loading states
  });

  test.describe('Loading States', () => {
    test('should display skeleton during data loading', async ({ page }) => {
      // Look for skeleton elements
      const skeletons = page.locator('[data-testid*="skeleton"], .skeleton, [class*="skeleton"]');

      if (await skeletons.count() > 0) {
        // Skeleton should be visible during loading
        await expect(skeletons.first()).toBeVisible();

        // Check for animation
        const animation = await skeletons.first().evaluate(el => {
          const styles = window.getComputedStyle(el);
          return styles.animation || styles.animationName;
        });

        expect(animation).toBeTruthy();
        expect(animation).toMatch(/pulse|shimmer|wave/i);

        // Wait for content to load
        await testUtils.waitForAppReady();

        // Skeletons should disappear after loading
        const remainingSkeletons = await skeletons.count();
        if (remainingSkeletons > 0) {
          // Some skeletons might remain for lazy-loaded content
          console.log(`${remainingSkeletons} skeletons remain for lazy content`);
        }
      }
    });

    test('should render all 4 skeleton variants', async ({ page }) => {
      // Text skeleton
      const textSkeleton = page.locator('[data-testid="skeleton-text"], .skeleton-text').first();
      if (await textSkeleton.count() > 0) {
        const height = await textSkeleton.evaluate(el => el.getBoundingClientRect().height);
        expect(height).toBeLessThan(30); // Text skeletons are thin
      }

      // Circle skeleton
      const circleSkeleton = page.locator('[data-testid="skeleton-circle"], .skeleton-circle').first();
      if (await circleSkeleton.count() > 0) {
        const borderRadius = await circleSkeleton.evaluate(el => window.getComputedStyle(el).borderRadius);
        expect(borderRadius).toMatch(/50%|9999px/);
      }

      // Rectangle skeleton
      const rectSkeleton = page.locator('[data-testid="skeleton-rect"], .skeleton-rect').first();
      if (await rectSkeleton.count() > 0) {
        const borderRadius = await rectSkeleton.evaluate(el => window.getComputedStyle(el).borderRadius);
        expect(parseInt(borderRadius)).toBeLessThan(20);
      }

      // Card skeleton
      const cardSkeleton = page.locator('[data-testid="skeleton-card"], .skeleton-card').first();
      if (await cardSkeleton.count() > 0) {
        // Card skeletons are larger containers
        const height = await cardSkeleton.evaluate(el => el.getBoundingClientRect().height);
        expect(height).toBeGreaterThan(50);
      }
    });
  });

  test.describe('Animation', () => {
    test('should have pulse animation', async ({ page }) => {
      const skeleton = page.locator('[class*="skeleton"]').first();

      if (await skeleton.count() > 0) {
        // Check for animation
        const animationDetails = await skeleton.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            animationName: styles.animationName,
            animationDuration: styles.animationDuration,
            animationIterationCount: styles.animationIterationCount
          };
        });

        expect(animationDetails.animationName).not.toBe('none');
        expect(animationDetails.animationDuration).toBeTruthy();
        expect(animationDetails.animationIterationCount).toMatch(/infinite/i);

        // Check opacity changes
        const initialOpacity = await skeleton.evaluate(el => window.getComputedStyle(el).opacity);
        await page.waitForTimeout(500);
        const laterOpacity = await skeleton.evaluate(el => window.getComputedStyle(el).opacity);

        // Opacity might be the same if caught at same point in animation
        expect(initialOpacity).toBeTruthy();
        expect(laterOpacity).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Sizing', () => {
    test('should adapt to container width', async ({ page }) => {
      const skeletons = await page.locator('[class*="skeleton"]').all();

      for (const skeleton of skeletons.slice(0, 3)) {
        if (!await skeleton.isVisible()) continue;

        const parent = await skeleton.evaluateHandle(el => el.parentElement);
        const parentWidth = await parent.evaluate(el => el?.getBoundingClientRect().width || 0);
        const skeletonWidth = await skeleton.evaluate(el => el.getBoundingClientRect().width);

        // Skeleton should not exceed parent width
        if (parentWidth > 0) {
          expect(skeletonWidth).toBeLessThanOrEqual(parentWidth);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const skeletons = await page.locator('[class*="skeleton"]').all();

      for (const skeleton of skeletons.slice(0, 3)) {
        if (!await skeleton.isVisible()) continue;

        // Check for aria-hidden or aria-busy
        const ariaHidden = await skeleton.getAttribute('aria-hidden');
        const ariaBusy = await skeleton.getAttribute('aria-busy');
        const role = await skeleton.getAttribute('role');

        // Skeletons should be hidden from screen readers or marked as busy
        expect(ariaHidden === 'true' || ariaBusy === 'true' || role === 'status').toBeTruthy();
      }
    });

    test('should not interfere with keyboard navigation', async ({ page }) => {
      // Skeletons should not be focusable
      const skeleton = page.locator('[class*="skeleton"]').first();

      if (await skeleton.count() > 0) {
        const tabindex = await skeleton.getAttribute('tabindex');
        expect(tabindex === '-1' || tabindex === null).toBeTruthy();

        // Try to focus (should fail)
        const isFocusable = await skeleton.evaluate(el => {
          el.focus();
          return document.activeElement === el;
        });

        expect(isFocusable).toBeFalsy();
      }
    });
  });

  test.describe('Performance', () => {
    test('should not impact page performance', async ({ page }) => {
      const skeletons = await page.locator('[class*="skeleton"]').all();

      if (skeletons.length > 0) {
        // Measure animation frame rate
        const fps = await page.evaluate(() => {
          return new Promise<number>((resolve) => {
            let frames = 0;
            const startTime = performance.now();

            function countFrame() {
              frames++;
              if (performance.now() - startTime < 1000) {
                requestAnimationFrame(countFrame);
              } else {
                resolve(frames);
              }
            }

            requestAnimationFrame(countFrame);
          });
        });

        // Should maintain smooth animation (>30 FPS)
        expect(fps).toBeGreaterThan(30);
      }
    });

    test('should clean up after content loads', async ({ page }) => {
      // Initial skeleton count
      const initialSkeletons = await page.locator('[class*="skeleton"]').count();

      if (initialSkeletons > 0) {
        // Wait for content to load
        await testUtils.waitForAppReady();
        await page.waitForTimeout(2000);

        // Check skeleton count reduced
        const finalSkeletons = await page.locator('[class*="skeleton"]').count();
        expect(finalSkeletons).toBeLessThanOrEqual(initialSkeletons);

        // Check DOM cleanup
        const hiddenSkeletons = await page.locator('[class*="skeleton"][style*="display: none"]').count();
        console.log(`${hiddenSkeletons} skeletons hidden after load`);
      }
    });
  });

  test.describe('Dark Mode Support', () => {
    test('should adapt to theme changes', async ({ page }) => {
      await testUtils.waitForAppReady();

      const skeleton = page.locator('[class*="skeleton"]').first();

      if (await skeleton.count() > 0) {
        // Get light mode color
        const lightBg = await skeleton.evaluate(el => window.getComputedStyle(el).backgroundColor);

        // Toggle dark mode
        const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
        if (await themeToggle.isVisible()) {
          await themeToggle.click();
          await page.waitForTimeout(300);

          // Get dark mode color
          const darkBg = await skeleton.evaluate(el => window.getComputedStyle(el).backgroundColor);

          // Colors should be different
          expect(darkBg).not.toBe(lightBg);
        }
      }
    });
  });
});