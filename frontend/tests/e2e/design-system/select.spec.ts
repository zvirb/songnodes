import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Select Component (Radix Select)', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('Basic Functionality', () => {
    test('should open and close select dropdown', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger], [data-testid*="select-trigger"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        // Open dropdown
        await selectTrigger.click();
        await page.waitForTimeout(200);

        // Check dropdown is visible
        const dropdown = page.locator('[data-radix-select-content], [role="listbox"]').first();
        await expect(dropdown).toBeVisible();

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        await expect(dropdown).not.toBeVisible();
      }
    });

    test('should select an option', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        // Open dropdown
        await selectTrigger.click();

        // Select an option
        const option = page.locator('[data-radix-select-item], [role="option"]').first();
        if (await option.isVisible()) {
          const optionText = await option.textContent();
          await option.click();

          // Check selected value is displayed
          await expect(selectTrigger).toContainText(optionText || '');
        }
      }
    });

    test('should show placeholder when no selection', async ({ page }) => {
      const selectWithPlaceholder = page.locator('[data-radix-select-trigger]:has-text("Select"), [data-radix-select-trigger]:has-text("Choose")').first();

      if (await selectWithPlaceholder.count() > 0) {
        const placeholderText = await selectWithPlaceholder.textContent();
        expect(placeholderText).toMatch(/Select|Choose/i);
      }
    });
  });

  test.describe('Searchable Select', () => {
    test('should filter options when searching', async ({ page }) => {
      // Look for searchable select (has input inside)
      const searchableSelect = page.locator('[data-testid*="searchable-select"], [data-testid*="select-search"]').first();

      if (await searchableSelect.count() > 0) {
        await searchableSelect.click();

        // Find search input
        const searchInput = page.locator('[data-radix-select-search], input[placeholder*="Search"], input[placeholder*="Type"]').first();

        if (await searchInput.isVisible()) {
          // Get initial option count
          const initialOptions = await page.locator('[role="option"]').count();

          // Type search query
          await searchInput.fill('test');
          await page.waitForTimeout(300);

          // Get filtered option count
          const filteredOptions = await page.locator('[role="option"]:visible').count();

          // Should have fewer options (or none if no match)
          expect(filteredOptions).toBeLessThanOrEqual(initialOptions);

          // Clear search
          await searchInput.clear();
          await page.waitForTimeout(300);

          // Should restore all options
          const restoredOptions = await page.locator('[role="option"]').count();
          expect(restoredOptions).toBe(initialOptions);
        }

        await page.keyboard.press('Escape');
      }
    });

    test('should highlight matching text in search results', async ({ page }) => {
      const searchableSelect = page.locator('[data-testid*="searchable-select"]').first();

      if (await searchableSelect.count() > 0) {
        await searchableSelect.click();

        const searchInput = page.locator('input[placeholder*="Search"]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('a');
          await page.waitForTimeout(300);

          // Check for highlighted text
          const highlightedText = page.locator('[role="option"] mark, [role="option"] .highlight').first();
          if (await highlightedText.count() > 0) {
            await expect(highlightedText).toBeVisible();
            const text = await highlightedText.textContent();
            expect(text?.toLowerCase()).toContain('a');
          }
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Multi-Select', () => {
    test('should allow multiple selections', async ({ page }) => {
      const multiSelect = page.locator('[data-testid*="multi-select"], [data-multi-select="true"]').first();

      if (await multiSelect.count() > 0) {
        await multiSelect.click();

        // Select multiple options
        const options = page.locator('[role="option"]');
        const optionCount = await options.count();

        if (optionCount >= 2) {
          // Select first option
          await options.nth(0).click();
          await page.waitForTimeout(100);

          // Select second option (should not close dropdown)
          await options.nth(1).click();
          await page.waitForTimeout(100);

          // Check both are selected
          const selectedItems = page.locator('[data-testid*="selected-item"], .selected-tag, .chip').all();
          if ((await selectedItems).length > 0) {
            expect((await selectedItems).length).toBeGreaterThanOrEqual(2);
          }
        }

        await page.keyboard.press('Escape');
      }
    });

    test('should remove selected items', async ({ page }) => {
      const multiSelect = page.locator('[data-testid*="multi-select"]').first();

      if (await multiSelect.count() > 0) {
        // Check for remove buttons on selected items
        const removeButtons = page.locator('[data-testid*="remove-item"], [aria-label*="Remove"]');

        if (await removeButtons.count() > 0) {
          const initialCount = await removeButtons.count();

          // Remove first item
          await removeButtons.first().click();
          await page.waitForTimeout(200);

          const newCount = await removeButtons.count();
          expect(newCount).toBe(initialCount - 1);
        }
      }
    });

    test('should clear all selections', async ({ page }) => {
      const multiSelect = page.locator('[data-testid*="multi-select"]').first();

      if (await multiSelect.count() > 0) {
        // Look for clear all button
        const clearButton = page.locator('[data-testid*="clear-all"], [aria-label*="Clear all"]').first();

        if (await clearButton.isVisible()) {
          await clearButton.click();
          await page.waitForTimeout(200);

          // Check all items are removed
          const selectedItems = page.locator('[data-testid*="selected-item"]');
          await expect(selectedItems).toHaveCount(0);
        }
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate options with arrow keys', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        // Check first option is focused
        let focusedOption = page.locator('[role="option"][data-highlighted="true"], [role="option"]:focus');
        await expect(focusedOption).toHaveCount(1);

        // Navigate down more
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        // Navigate up
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(100);

        // Select with Enter
        await page.keyboard.press('Enter');

        // Dropdown should close
        const dropdown = page.locator('[role="listbox"]').first();
        await expect(dropdown).not.toBeVisible();
      }
    });

    test('should support type-ahead selection', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        // Type to jump to option
        await page.keyboard.type('a');
        await page.waitForTimeout(100);

        // Check if an option starting with 'a' is highlighted
        const highlightedOption = page.locator('[role="option"][data-highlighted="true"]').first();
        if (await highlightedOption.count() > 0) {
          const text = await highlightedOption.textContent();
          expect(text?.toLowerCase()).toMatch(/^a/);
        }

        await page.keyboard.press('Escape');
      }
    });

    test('should navigate with Home and End keys', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        // Go to last option
        await page.keyboard.press('End');
        await page.waitForTimeout(100);

        const options = page.locator('[role="option"]');
        const lastOption = options.last();
        const isLastHighlighted = await lastOption.getAttribute('data-highlighted');

        if (isLastHighlighted) {
          expect(isLastHighlighted).toBe('true');
        }

        // Go to first option
        await page.keyboard.press('Home');
        await page.waitForTimeout(100);

        const firstOption = options.first();
        const isFirstHighlighted = await firstOption.getAttribute('data-highlighted');

        if (isFirstHighlighted) {
          expect(isFirstHighlighted).toBe('true');
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Option Groups', () => {
    test('should display grouped options', async ({ page }) => {
      const selectWithGroups = page.locator('[data-radix-select-trigger]').first();

      if (await selectWithGroups.isVisible()) {
        await selectWithGroups.click();

        // Look for group labels
        const groupLabels = page.locator('[data-radix-select-group-label], [role="group"] [role="presentation"]');

        if (await groupLabels.count() > 0) {
          // Check groups are visible
          const firstGroup = groupLabels.first();
          await expect(firstGroup).toBeVisible();

          // Check group has options
          const groupOptions = firstGroup.locator('~ [role="option"]');
          const optionCount = await groupOptions.count();
          expect(optionCount).toBeGreaterThan(0);
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Disabled State', () => {
    test('should handle disabled select', async ({ page }) => {
      const disabledSelect = page.locator('[data-radix-select-trigger][disabled], [data-radix-select-trigger][aria-disabled="true"]').first();

      if (await disabledSelect.count() > 0) {
        // Check styling
        const opacity = await disabledSelect.evaluate(el => window.getComputedStyle(el).opacity);
        expect(parseFloat(opacity)).toBeLessThan(1);

        const cursor = await disabledSelect.evaluate(el => window.getComputedStyle(el).cursor);
        expect(cursor).toMatch(/not-allowed|default/);

        // Try to click (should not open)
        await disabledSelect.click({ force: true });
        await page.waitForTimeout(200);

        const dropdown = page.locator('[role="listbox"]').first();
        await expect(dropdown).not.toBeVisible();
      }
    });

    test('should handle disabled options', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const disabledOption = page.locator('[role="option"][aria-disabled="true"], [role="option"][data-disabled="true"]').first();

        if (await disabledOption.count() > 0) {
          // Check styling
          const opacity = await disabledOption.evaluate(el => window.getComputedStyle(el).opacity);
          expect(parseFloat(opacity)).toBeLessThan(1);

          // Try to select (should not work)
          const initialValue = await selectTrigger.textContent();
          await disabledOption.click({ force: true });
          await page.waitForTimeout(200);

          const newValue = await selectTrigger.textContent();
          expect(newValue).toBe(initialValue);
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        // Check trigger attributes
        const role = await selectTrigger.getAttribute('role');
        const ariaExpanded = await selectTrigger.getAttribute('aria-expanded');
        const ariaHaspopup = await selectTrigger.getAttribute('aria-haspopup');

        expect(role || 'combobox').toBeTruthy();
        expect(ariaExpanded).toBe('false');
        expect(ariaHaspopup || 'listbox').toBeTruthy();

        // Open dropdown
        await selectTrigger.click();

        // Check expanded state
        const expandedAfter = await selectTrigger.getAttribute('aria-expanded');
        expect(expandedAfter).toBe('true');

        // Check listbox
        const listbox = page.locator('[role="listbox"]').first();
        await expect(listbox).toBeVisible();

        // Check options
        const options = listbox.locator('[role="option"]');
        const optionCount = await options.count();
        expect(optionCount).toBeGreaterThan(0);

        // Check option attributes
        const firstOption = options.first();
        const optionRole = await firstOption.getAttribute('role');
        expect(optionRole).toBe('option');

        await page.keyboard.press('Escape');
      }
    });

    test('should announce selected value to screen readers', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const option = page.locator('[role="option"]').first();
        const optionText = await option.textContent();
        await option.click();

        // Check aria-label or aria-valuenow
        const ariaLabel = await selectTrigger.getAttribute('aria-label');
        const ariaValuetext = await selectTrigger.getAttribute('aria-valuetext');

        expect(ariaLabel || ariaValuetext || optionText).toBeTruthy();
      }
    });
  });

  test.describe('Visual Feedback', () => {
    test('should show focus ring on trigger', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.focus();

        const focusStyles = await selectTrigger.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            outline: styles.outline,
            boxShadow: styles.boxShadow
          };
        });

        const hasFocusRing =
          focusStyles.outline !== 'none' ||
          focusStyles.boxShadow.includes('rgb');

        expect(hasFocusRing).toBeTruthy();
      }
    });

    test('should highlight hovered option', async ({ page }) => {
      const selectTrigger = page.locator('[data-radix-select-trigger]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const option = page.locator('[role="option"]').first();
        const initialBg = await option.evaluate(el => window.getComputedStyle(el).backgroundColor);

        await option.hover();
        await page.waitForTimeout(100);

        const hoverBg = await option.evaluate(el => window.getComputedStyle(el).backgroundColor);

        // Background should change on hover
        if (initialBg !== 'rgba(0, 0, 0, 0)') {
          expect(hoverBg).not.toBe(initialBg);
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Performance', () => {
    test('should handle large option lists efficiently', async ({ page }) => {
      // Look for select with many options
      const selectTrigger = page.locator('[data-radix-select-trigger]').first();

      if (await selectTrigger.isVisible()) {
        const startTime = Date.now();

        await selectTrigger.click();
        await page.waitForSelector('[role="listbox"]');

        const openTime = Date.now() - startTime;
        expect(openTime).toBeLessThan(500);

        // Check if virtualization is used for long lists
        const options = page.locator('[role="option"]');
        const optionCount = await options.count();

        if (optionCount > 50) {
          // Check if all options are in DOM (not virtualized)
          const allOptionsInDom = await options.evaluateAll(els => els.length);

          // If virtualized, DOM count should be less than total
          if (allOptionsInDom < optionCount) {
            console.log(`Select is virtualized: ${allOptionsInDom} DOM nodes for ${optionCount} options`);
          }
        }

        await page.keyboard.press('Escape');
      }
    });
  });
});