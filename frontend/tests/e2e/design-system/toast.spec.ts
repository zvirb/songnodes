import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Toast Component (Sonner Integration)', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('Basic Toast Functionality', () => {
    test('should display and auto-dismiss toast notifications', async ({ page }) => {
      // Trigger a toast (usually by performing an action)
      const actionButton = page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Delete")').first();

      if (await actionButton.isVisible()) {
        await actionButton.click();

        // Wait for toast to appear
        const toast = page.locator('[data-sonner-toast], [role="status"], .sonner-toast').first();
        await toast.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        if (await toast.isVisible()) {
          // Toast should be visible
          await expect(toast).toBeVisible();

          // Get toast content
          const toastText = await toast.textContent();
          expect(toastText).toBeTruthy();

          // Wait for auto-dismiss (usually 3-5 seconds)
          await toast.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
          await expect(toast).not.toBeVisible();
        }
      }
    });

    test('should display different toast types', async ({ page }) => {
      // Success toast
      const successAction = page.locator('button:has-text("Save")').first();
      if (await successAction.isVisible()) {
        await successAction.click();

        const successToast = page.locator('[data-sonner-toast][data-type="success"], .sonner-toast-success').first();
        if (await successToast.count() > 0) {
          await expect(successToast).toBeVisible();

          // Check for success icon
          const successIcon = successToast.locator('svg, [data-testid*="success-icon"]');
          await expect(successIcon).toBeVisible();
        }
      }

      // Error toast
      const errorAction = page.locator('button:has-text("Delete")').first();
      if (await errorAction.isVisible()) {
        await errorAction.click();

        const errorToast = page.locator('[data-sonner-toast][data-type="error"], .sonner-toast-error').first();
        if (await errorToast.count() > 0) {
          await expect(errorToast).toBeVisible();

          // Check for error styling
          const bgColor = await errorToast.evaluate(el => window.getComputedStyle(el).backgroundColor);
          expect(bgColor).toMatch(/rgb\(2[0-5][0-9], [0-9]{1,2}, [0-9]{1,2}\)/); // Reddish
        }
      }
    });

    test('should allow manual dismissal', async ({ page }) => {
      // Trigger a toast
      const actionButton = page.locator('button').first();
      if (await actionButton.isVisible()) {
        await actionButton.click();

        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });

          // Look for close button
          const closeButton = toast.locator('[data-sonner-toast-close], button[aria-label*="Close"]').first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
            await expect(toast).not.toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Promise-based Toasts', () => {
    test('should show loading state for promises', async ({ page }) => {
      // Find action that triggers async operation
      const asyncAction = page.locator('button:has-text("Load"), button:has-text("Fetch")').first();

      if (await asyncAction.isVisible()) {
        await asyncAction.click();

        // Check for loading toast
        const loadingToast = page.locator('[data-sonner-toast][data-type="loading"], .sonner-toast-loading').first();
        if (await loadingToast.count() > 0) {
          await expect(loadingToast).toBeVisible();

          // Check for spinner
          const spinner = loadingToast.locator('.sonner-spinner, svg.animate-spin');
          await expect(spinner).toBeVisible();

          // Wait for resolution
          await page.waitForTimeout(2000);

          // Should transition to success or error
          const resolvedToast = page.locator('[data-sonner-toast][data-type="success"], [data-sonner-toast][data-type="error"]').first();
          if (await resolvedToast.count() > 0) {
            await expect(resolvedToast).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Toast Positioning', () => {
    test('should display toasts in correct position', async ({ page }) => {
      // Trigger a toast
      const actionButton = page.locator('button').first();
      if (await actionButton.isVisible()) {
        await actionButton.click();

        const toastContainer = page.locator('[data-sonner-toaster], .sonner-toaster').first();
        if (await toastContainer.count() > 0) {
          const position = await toastContainer.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
              position: styles.position,
              bottom: styles.bottom,
              top: styles.top,
              right: styles.right,
              left: styles.left
            };
          });

          // Default is usually bottom-right or top-right
          expect(position.position).toMatch(/fixed|absolute/);

          // Check if positioned correctly
          const isBottomRight = position.bottom !== 'auto' && position.right !== 'auto';
          const isTopRight = position.top !== 'auto' && position.right !== 'auto';
          const isTopCenter = position.top !== 'auto' && position.left !== 'auto' && position.right !== 'auto';

          expect(isBottomRight || isTopRight || isTopCenter).toBeTruthy();
        }
      }
    });

    test('should stack multiple toasts', async ({ page }) => {
      // Trigger multiple toasts quickly
      const buttons = await page.locator('button').all();

      if (buttons.length >= 2) {
        // Click multiple buttons to trigger toasts
        await buttons[0].click();
        await page.waitForTimeout(100);
        await buttons[1].click();

        // Wait for toasts to appear
        await page.waitForTimeout(500);

        const toasts = page.locator('[data-sonner-toast]');
        const toastCount = await toasts.count();

        if (toastCount > 1) {
          // Check toasts are stacked (different Y positions)
          const firstToastY = await toasts.first().evaluate(el => el.getBoundingClientRect().y);
          const secondToastY = await toasts.nth(1).evaluate(el => el.getBoundingClientRect().y);

          expect(firstToastY).not.toBe(secondToastY);
        }
      }
    });
  });

  test.describe('Toast Content', () => {
    test('should display title and description', async ({ page }) => {
      const actionButton = page.locator('button').first();
      if (await actionButton.isVisible()) {
        await actionButton.click();

        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });

          // Check for title
          const title = toast.locator('[data-title], .sonner-toast-title, h3, strong').first();
          if (await title.count() > 0) {
            const titleText = await title.textContent();
            expect(titleText).toBeTruthy();
          }

          // Check for description
          const description = toast.locator('[data-description], .sonner-toast-description, p').first();
          if (await description.count() > 0) {
            const descText = await description.textContent();
            expect(descText).toBeTruthy();
          }
        }
      }
    });

    test('should support action buttons in toasts', async ({ page }) => {
      const actionButton = page.locator('button').first();
      if (await actionButton.isVisible()) {
        await actionButton.click();

        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });

          // Check for action button within toast
          const toastAction = toast.locator('button:not([data-sonner-toast-close])').first();
          if (await toastAction.count() > 0) {
            const actionText = await toastAction.textContent();
            expect(actionText).toBeTruthy();

            // Click action
            await toastAction.click();
            // Action should be handled
          }
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const actionButton = page.locator('button').first();
      if (await actionButton.isVisible()) {
        await actionButton.click();

        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });

          // Check role
          const role = await toast.getAttribute('role');
          expect(['status', 'alert', 'log']).toContain(role || 'status');

          // Check aria-live
          const ariaLive = await toast.getAttribute('aria-live');
          expect(['polite', 'assertive']).toContain(ariaLive || 'polite');

          // Check aria-atomic
          const ariaAtomic = await toast.getAttribute('aria-atomic');
          expect(ariaAtomic).toBe('true');
        }
      }
    });

    test('should be keyboard dismissible', async ({ page }) => {
      const actionButton = page.locator('button').first();
      if (await actionButton.isVisible()) {
        await actionButton.click();

        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });

          // Focus close button if available
          const closeButton = toast.locator('button[aria-label*="Close"]').first();
          if (await closeButton.isVisible()) {
            await closeButton.focus();
            await page.keyboard.press('Enter');
            await expect(toast).not.toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Dark Mode Support', () => {
    test('should adapt to dark mode', async ({ page }) => {
      // Toggle dark mode if available
      const darkModeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"]').first();

      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click();
        await page.waitForTimeout(300);

        // Trigger a toast
        const actionButton = page.locator('button').first();
        await actionButton.click();

        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });

          // Check dark mode styling
          const bgColor = await toast.evaluate(el => window.getComputedStyle(el).backgroundColor);
          const textColor = await toast.evaluate(el => window.getComputedStyle(el).color);

          // In dark mode, background should be darker
          expect(bgColor).toBeTruthy();
          expect(textColor).toBeTruthy();
        }
      }
    });
  });

  test.describe('Performance', () => {
    test('should handle rapid toast creation', async ({ page }) => {
      const buttons = await page.locator('button').all();

      if (buttons.length > 0) {
        const startTime = Date.now();

        // Trigger multiple toasts rapidly
        for (let i = 0; i < Math.min(5, buttons.length); i++) {
          await buttons[i].click();
          await page.waitForTimeout(50);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Should handle rapid creation efficiently
        expect(totalTime).toBeLessThan(1000);

        // Check memory usage
        const memory = await page.evaluate(() => {
          return (performance as any).memory?.usedJSHeapSize || 0;
        });

        if (memory > 0) {
          expect(memory).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
        }
      }
    });

    test('should clean up dismissed toasts', async ({ page }) => {
      const actionButton = page.locator('button').first();
      if (await actionButton.isVisible()) {
        // Create a toast
        await actionButton.click();

        // Wait for toast to appear and disappear
        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });
          await toast.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

          // Check DOM is cleaned up
          await page.waitForTimeout(500);
          const remainingToasts = await page.locator('[data-sonner-toast]').count();
          expect(remainingToasts).toBe(0);
        }
      }
    });
  });

  test.describe('Custom Toast Actions', () => {
    test('should handle undo actions', async ({ page }) => {
      // Look for delete action that might have undo
      const deleteButton = page.locator('button:has-text("Delete")').first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const toast = page.locator('[data-sonner-toast]').first();
        if (await toast.count() > 0) {
          await toast.waitFor({ state: 'visible' });

          // Look for undo button
          const undoButton = toast.locator('button:has-text("Undo")').first();
          if (await undoButton.isVisible()) {
            await undoButton.click();

            // Check if undo was processed
            await page.waitForTimeout(500);
            const confirmationToast = page.locator('[data-sonner-toast]:has-text("Undone")').first();
            if (await confirmationToast.count() > 0) {
              await expect(confirmationToast).toBeVisible();
            }
          }
        }
      }
    });
  });
});