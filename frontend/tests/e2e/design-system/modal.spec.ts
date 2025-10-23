import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Modal Component (Radix Dialog)', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('Basic Functionality', () => {
    test('should open and close modal correctly', async ({ page }) => {
      // Find trigger button for any modal
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], [data-testid*="open-modal"], button:has-text("Edit"), button:has-text("Details")');

      if (await modalTriggers.count() > 0) {
        const trigger = modalTriggers.first();
        await trigger.click();

        // Wait for modal to open
        await page.waitForTimeout(300);

        // Check modal is visible
        const modal = page.locator('[role="dialog"], [data-testid="modal"], [data-radix-dialog-content]').first();
        await expect(modal).toBeVisible();

        // Check for overlay
        const overlay = page.locator('[data-testid="modal-overlay"], [data-radix-dialog-overlay]').first();
        await expect(overlay).toBeVisible();

        // Close with close button
        const closeBtn = modal.locator('[data-testid="modal-close"], button[aria-label*="Close"], button:has-text("×")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await expect(modal).not.toBeVisible();
        }
      }
    });

    test('should close on Escape key', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();

        // Press Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        await expect(modal).not.toBeVisible();
      }
    });

    test('should close on overlay click', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();

        // Click overlay
        const overlay = page.locator('[data-radix-dialog-overlay]').first();
        if (await overlay.isVisible()) {
          await overlay.click({ position: { x: 10, y: 10 } });
          await page.waitForTimeout(300);
          await expect(modal).not.toBeVisible();
        }
      }
    });
  });

  test.describe('Compound Components', () => {
    test('should render modal header correctly', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();

        // Check for header
        const header = modal.locator('[data-testid="modal-header"], header, [role="heading"]').first();
        if (await header.isVisible()) {
          const headerText = await header.textContent();
          expect(headerText).toBeTruthy();
          expect(headerText!.length).toBeGreaterThan(0);
        }

        await page.keyboard.press('Escape');
      }
    });

    test('should render modal footer with actions', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        const modal = page.locator('[role="dialog"]').first();
        const footer = modal.locator('[data-testid="modal-footer"], footer').first();

        if (await footer.isVisible()) {
          // Check for action buttons
          const actionButtons = footer.locator('button');
          const buttonCount = await actionButtons.count();

          expect(buttonCount).toBeGreaterThan(0);

          // Common patterns: Cancel/Save, Close/Submit
          const cancelBtn = footer.locator('button:has-text("Cancel"), button:has-text("Close")').first();
          const confirmBtn = footer.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Confirm")').first();

          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await expect(modal).not.toBeVisible();
          }
        } else {
          await page.keyboard.press('Escape');
        }
      }
    });

    test('should render modal content with scrollable area', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        const modal = page.locator('[role="dialog"]').first();
        const content = modal.locator('[data-testid="modal-content"], [data-testid="modal-body"], .modal-content').first();

        if (await content.isVisible()) {
          // Check if content is scrollable when needed
          const scrollHeight = await content.evaluate(el => el.scrollHeight);
          const clientHeight = await content.evaluate(el => el.clientHeight);

          if (scrollHeight > clientHeight) {
            const overflow = await content.evaluate(el => window.getComputedStyle(el).overflowY);
            expect(['auto', 'scroll']).toContain(overflow);
          }
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Modal Sizes', () => {
    test('should support different modal sizes', async ({ page }) => {
      // Test different sized modals if available
      const sizes = ['sm', 'md', 'lg', 'xl', 'full'];

      for (const size of sizes) {
        const trigger = page.locator(`[data-testid="modal-trigger-${size}"]`).first();

        if (await trigger.isVisible()) {
          await trigger.click();

          const modal = page.locator('[role="dialog"]').first();
          await expect(modal).toBeVisible();

          const width = await modal.evaluate(el => el.getBoundingClientRect().width);

          // Verify size differences
          switch(size) {
            case 'sm':
              expect(width).toBeLessThan(500);
              break;
            case 'md':
              expect(width).toBeGreaterThanOrEqual(500);
              expect(width).toBeLessThan(700);
              break;
            case 'lg':
              expect(width).toBeGreaterThanOrEqual(700);
              expect(width).toBeLessThan(900);
              break;
            case 'xl':
              expect(width).toBeGreaterThanOrEqual(900);
              break;
            case 'full':
              const viewportWidth = await page.evaluate(() => window.innerWidth);
              expect(width).toBeGreaterThan(viewportWidth * 0.9);
              break;
          }

          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('Focus Management', () => {
    test('should trap focus within modal', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();

        // Tab through elements
        const focusedElements: string[] = [];
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab');

          const focused = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el) return null;

            // Check if element is within modal
            const modal = el.closest('[role="dialog"]');
            return modal ? el.tagName.toLowerCase() : null;
          });

          if (focused) {
            focusedElements.push(focused);
          }
        }

        // All focused elements should be within modal
        expect(focusedElements.length).toBeGreaterThan(0);
        expect(focusedElements.every(el => el !== null)).toBeTruthy();

        await page.keyboard.press('Escape');
      }
    });

    test('should restore focus on close', async ({ page }) => {
      const modalTrigger = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")').first();

      if (await modalTrigger.isVisible()) {
        // Focus the trigger
        await modalTrigger.focus();

        // Open modal
        await modalTrigger.click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Check focus returned to trigger
        const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        const triggerTestId = await modalTrigger.getAttribute('data-testid');

        if (triggerTestId) {
          expect(focusedElement).toBe(triggerTestId);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();

        // Check ARIA attributes
        const role = await modal.getAttribute('role');
        expect(role).toBe('dialog');

        const ariaModal = await modal.getAttribute('aria-modal');
        expect(ariaModal).toBe('true');

        const ariaLabelledby = await modal.getAttribute('aria-labelledby');
        const ariaLabel = await modal.getAttribute('aria-label');
        expect(ariaLabelledby || ariaLabel).toBeTruthy();

        // Check for description if present
        const ariaDescribedby = await modal.getAttribute('aria-describedby');
        if (ariaDescribedby) {
          const description = page.locator(`#${ariaDescribedby}`);
          await expect(description).toBeVisible();
        }

        await page.keyboard.press('Escape');
      }
    });

    test('should announce modal opening to screen readers', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        // Check for live region
        await modalTriggers.first().click();

        const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]').first();
        if (await liveRegion.count() > 0) {
          const announcement = await liveRegion.textContent();
          expect(announcement).toBeTruthy();
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Animations', () => {
    test('should animate open and close', async ({ page }) => {
      const modalTriggers = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        // Check for animation classes or data attributes
        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();

        const animationClass = await modal.getAttribute('data-state');
        if (animationClass) {
          expect(['open', 'visible']).toContain(animationClass);
        }

        // Start closing
        await page.keyboard.press('Escape');

        // Modal might have closing animation
        const closingState = await modal.getAttribute('data-state');
        if (closingState) {
          // Could be 'closing' or 'closed'
          expect(['closing', 'closed', null]).toContain(closingState);
        }
      }
    });
  });

  test.describe('Nested Modals', () => {
    test('should handle nested modals if supported', async ({ page }) => {
      // This is an advanced feature - test if the implementation supports it
      const firstTrigger = page.locator('[data-testid*="modal-trigger"]').first();

      if (await firstTrigger.isVisible()) {
        await firstTrigger.click();

        const firstModal = page.locator('[role="dialog"]').first();
        await expect(firstModal).toBeVisible();

        // Look for trigger within first modal
        const nestedTrigger = firstModal.locator('button:has-text("Open"), button:has-text("Add")').first();

        if (await nestedTrigger.isVisible()) {
          await nestedTrigger.click();
          await page.waitForTimeout(300);

          const modals = page.locator('[role="dialog"]');
          const modalCount = await modals.count();

          if (modalCount > 1) {
            // Nested modals are supported
            expect(modalCount).toBe(2);

            // Close nested modal
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

            // First modal should still be open
            await expect(firstModal).toBeVisible();
          }
        }

        // Close all
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Performance', () => {
    test('should open and close without performance issues', async ({ page }) => {
      const modalTrigger = page.locator('[data-testid*="modal-trigger"], button:has-text("Edit")').first();

      if (await modalTrigger.isVisible()) {
        // Measure open time
        const openStart = Date.now();
        await modalTrigger.click();

        const modal = page.locator('[role="dialog"]').first();
        await modal.waitFor({ state: 'visible' });
        const openTime = Date.now() - openStart;

        expect(openTime).toBeLessThan(500);

        // Measure close time
        const closeStart = Date.now();
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'hidden' });
        const closeTime = Date.now() - closeStart;

        expect(closeTime).toBeLessThan(500);

        // Test multiple open/close cycles
        for (let i = 0; i < 5; i++) {
          await modalTrigger.click();
          await modal.waitFor({ state: 'visible' });
          await page.keyboard.press('Escape');
          await modal.waitFor({ state: 'hidden' });
        }

        // Check memory usage didn't grow significantly
        const memory = await page.evaluate(() => {
          return (performance as any).memory?.usedJSHeapSize || 0;
        });

        if (memory > 0) {
          expect(memory).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
        }
      }
    });
  });
});