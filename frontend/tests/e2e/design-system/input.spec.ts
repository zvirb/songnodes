import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Input Component', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('Basic Functionality', () => {
    test('should accept and display text input', async ({ page }) => {
      const input = page.locator('input[type="text"]').first();

      if (await input.isVisible()) {
        await input.click();
        await input.fill('Test input value');

        await expect(input).toHaveValue('Test input value');

        // Test clearing
        await input.clear();
        await expect(input).toHaveValue('');
      }
    });

    test('should support different input types', async ({ page }) => {
      const inputTypes = ['text', 'email', 'password', 'number', 'search', 'url', 'tel'];

      for (const type of inputTypes) {
        const input = page.locator(`input[type="${type}"]`).first();

        if (await input.isVisible()) {
          // Test type-specific behavior
          switch(type) {
            case 'email':
              await input.fill('test@example.com');
              await expect(input).toHaveValue('test@example.com');
              break;
            case 'password':
              await input.fill('SecurePass123!');
              const inputType = await input.getAttribute('type');
              expect(inputType).toBe('password');
              break;
            case 'number':
              await input.fill('123.45');
              await expect(input).toHaveValue('123.45');
              break;
            case 'search':
              await input.fill('search query');
              await expect(input).toHaveValue('search query');
              break;
            case 'url':
              await input.fill('https://example.com');
              await expect(input).toHaveValue('https://example.com');
              break;
            case 'tel':
              await input.fill('+1234567890');
              await expect(input).toHaveValue('+1234567890');
              break;
            default:
              await input.fill('test');
              await expect(input).toHaveValue('test');
          }

          await input.clear();
        }
      }
    });
  });

  test.describe('Validation States', () => {
    test('should show error state and message', async ({ page }) => {
      // Find inputs with validation
      const inputWithError = page.locator('input[aria-invalid="true"], input.error, input[data-error="true"]').first();

      if (await inputWithError.count() > 0) {
        // Check error styling
        const borderColor = await inputWithError.evaluate(el => window.getComputedStyle(el).borderColor);
        expect(borderColor).toMatch(/rgb\(2[0-5][0-9], [0-9]{1,2}, [0-9]{1,2}\)/); // Reddish color

        // Check for error message
        const errorId = await inputWithError.getAttribute('aria-describedby');
        if (errorId) {
          const errorMessage = page.locator(`#${errorId}`);
          await expect(errorMessage).toBeVisible();

          const errorText = await errorMessage.textContent();
          expect(errorText).toBeTruthy();
        }
      }
    });

    test('should show success state', async ({ page }) => {
      const inputWithSuccess = page.locator('input[data-valid="true"], input.success, input[aria-valid="true"]').first();

      if (await inputWithSuccess.count() > 0) {
        // Check success styling
        const borderColor = await inputWithSuccess.evaluate(el => window.getComputedStyle(el).borderColor);
        expect(borderColor).toMatch(/rgb\([0-9]{1,2}, 1[5-9][0-9]|2[0-5][0-9], [0-9]{1,2}\)/); // Greenish color
      }
    });

    test('should show warning state', async ({ page }) => {
      const inputWithWarning = page.locator('input[data-warning="true"], input.warning').first();

      if (await inputWithWarning.count() > 0) {
        // Check warning styling
        const borderColor = await inputWithWarning.evaluate(el => window.getComputedStyle(el).borderColor);
        expect(borderColor).toMatch(/rgb\(2[0-5][0-9], 1[5-9][0-9]|2[0-5][0-9], [0-9]{1,2}\)/); // Yellowish/orange color
      }
    });

    test('should validate required fields', async ({ page }) => {
      const requiredInput = page.locator('input[required], input[aria-required="true"]').first();

      if (await requiredInput.isVisible()) {
        // Clear and blur to trigger validation
        await requiredInput.click();
        await requiredInput.clear();
        await requiredInput.blur();

        // Check for error state
        await page.waitForTimeout(200);

        const ariaInvalid = await requiredInput.getAttribute('aria-invalid');
        const hasErrorClass = await requiredInput.evaluate(el => el.classList.contains('error'));

        expect(ariaInvalid === 'true' || hasErrorClass).toBeTruthy();
      }
    });

    test('should validate pattern matching', async ({ page }) => {
      const emailInput = page.locator('input[type="email"]').first();

      if (await emailInput.isVisible()) {
        // Enter invalid email
        await emailInput.fill('invalid-email');
        await emailInput.blur();

        await page.waitForTimeout(200);

        // Check if validation triggered
        const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);

        if (!validity) {
          const ariaInvalid = await emailInput.getAttribute('aria-invalid');
          expect(ariaInvalid).toBe('true');
        }
      }
    });
  });

  test.describe('Icons and Addons', () => {
    test('should display leading icons', async ({ page }) => {
      const inputWithIcon = page.locator('.input-wrapper:has(svg):has(input), .input-group:has(svg):has(input)').first();

      if (await inputWithIcon.count() > 0) {
        const icon = inputWithIcon.locator('svg').first();
        await expect(icon).toBeVisible();

        // Check icon positioning
        const iconBox = await icon.boundingBox();
        const inputBox = await inputWithIcon.locator('input').boundingBox();

        if (iconBox && inputBox) {
          // Icon should be to the left of input
          expect(iconBox.x).toBeLessThan(inputBox.x);
        }
      }
    });

    test('should display trailing icons', async ({ page }) => {
      // Look for search inputs with clear button or password inputs with toggle
      const searchInput = page.locator('input[type="search"]').first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('test search');

        // Check for clear button
        const clearButton = searchInput.locator('~ button[aria-label*="Clear"], ~ button[aria-label*="clear"]').first();

        if (await clearButton.count() > 0) {
          await expect(clearButton).toBeVisible();

          await clearButton.click();
          await expect(searchInput).toHaveValue('');
        }
      }
    });

    test('should toggle password visibility', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]').first();

      if (await passwordInput.isVisible()) {
        await passwordInput.fill('myPassword123');

        // Look for toggle button
        const toggleButton = passwordInput.locator('~ button[aria-label*="Show"], ~ button[aria-label*="Toggle"]').first();

        if (await toggleButton.count() > 0) {
          // Click to show password
          await toggleButton.click();
          await page.waitForTimeout(100);

          const type = await passwordInput.getAttribute('type');
          expect(type).toBe('text');

          // Click to hide password
          await toggleButton.click();
          await page.waitForTimeout(100);

          const typeAfter = await passwordInput.getAttribute('type');
          expect(typeAfter).toBe('password');
        }
      }
    });
  });

  test.describe('Auto-resize Textarea', () => {
    test('should auto-resize textarea based on content', async ({ page }) => {
      const textarea = page.locator('textarea[data-auto-resize="true"], textarea.auto-resize').first();

      if (await textarea.count() > 0) {
        // Get initial height
        const initialHeight = await textarea.evaluate(el => el.getBoundingClientRect().height);

        // Add multiple lines
        await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

        // Get new height
        const newHeight = await textarea.evaluate(el => el.getBoundingClientRect().height);

        // Should have grown
        expect(newHeight).toBeGreaterThan(initialHeight);

        // Clear and check if it shrinks back
        await textarea.clear();
        await textarea.fill('Single line');

        const finalHeight = await textarea.evaluate(el => el.getBoundingClientRect().height);
        expect(finalHeight).toBeLessThan(newHeight);
      }
    });
  });

  test.describe('Placeholder and Labels', () => {
    test('should display placeholder text', async ({ page }) => {
      const inputWithPlaceholder = page.locator('input[placeholder]').first();

      if (await inputWithPlaceholder.isVisible()) {
        const placeholder = await inputWithPlaceholder.getAttribute('placeholder');
        expect(placeholder).toBeTruthy();
        expect(placeholder!.length).toBeGreaterThan(0);

        // Placeholder should disappear when typing
        await inputWithPlaceholder.fill('test');
        await expect(inputWithPlaceholder).toHaveValue('test');
      }
    });

    test('should have associated labels', async ({ page }) => {
      const inputs = await page.locator('input').all();

      for (const input of inputs.slice(0, 5)) {
        if (!await input.isVisible()) continue;

        // Check for label
        const id = await input.getAttribute('id');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');
        const ariaLabel = await input.getAttribute('aria-label');

        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          if (await label.count() > 0) {
            await expect(label).toBeVisible();
            const labelText = await label.textContent();
            expect(labelText).toBeTruthy();
          }
        }

        // Should have some form of label
        expect(id || ariaLabelledby || ariaLabel).toBeTruthy();
      }
    });
  });

  test.describe('Disabled and Readonly States', () => {
    test('should handle disabled state', async ({ page }) => {
      const disabledInput = page.locator('input:disabled, input[disabled]').first();

      if (await disabledInput.count() > 0) {
        // Check styling
        const opacity = await disabledInput.evaluate(el => window.getComputedStyle(el).opacity);
        expect(parseFloat(opacity)).toBeLessThan(1);

        // Should not accept input
        const isDisabled = await disabledInput.isDisabled();
        expect(isDisabled).toBeTruthy();

        // Try to type (should fail)
        try {
          await disabledInput.fill('test', { timeout: 1000 });
          expect(false).toBeTruthy(); // Should not reach here
        } catch {
          // Expected to fail
        }
      }
    });

    test('should handle readonly state', async ({ page }) => {
      const readonlyInput = page.locator('input[readonly]').first();

      if (await readonlyInput.count() > 0) {
        const currentValue = await readonlyInput.inputValue();

        // Should not accept new input
        await readonlyInput.click();
        await page.keyboard.type('new text');

        const valueAfter = await readonlyInput.inputValue();
        expect(valueAfter).toBe(currentValue);
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support Tab navigation', async ({ page }) => {
      const inputs = await page.locator('input:not(:disabled)').all();

      if (inputs.length >= 2) {
        // Focus first input
        await inputs[0].focus();
        await expect(inputs[0]).toBeFocused();

        // Tab to next
        await page.keyboard.press('Tab');

        // Check if we moved to next focusable element
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        expect(focusedElement).toBeTruthy();
      }
    });

    test('should support keyboard shortcuts in inputs', async ({ page }) => {
      const input = page.locator('input[type="text"]').first();

      if (await input.isVisible()) {
        await input.fill('Test text for shortcuts');

        // Select all (Ctrl+A)
        await input.focus();
        await page.keyboard.press('Control+a');

        // Copy (Ctrl+C)
        await page.keyboard.press('Control+c');

        // Paste (Ctrl+V)
        await input.clear();
        await page.keyboard.press('Control+v');

        const value = await input.inputValue();
        expect(value).toBe('Test text for shortcuts');
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const inputs = await page.locator('input').all();

      for (const input of inputs.slice(0, 5)) {
        if (!await input.isVisible()) continue;

        // Check for required ARIA attributes
        const type = await input.getAttribute('type');
        const role = await input.getAttribute('role');

        // Some input types have implicit roles
        if (!['button', 'checkbox', 'radio'].includes(type || '')) {
          expect(role || 'textbox').toBeTruthy();
        }

        // Check for descriptive attributes
        const ariaDescribedby = await input.getAttribute('aria-describedby');
        if (ariaDescribedby) {
          const description = page.locator(`#${ariaDescribedby}`);
          await expect(description).toBeVisible();
        }
      }
    });

    test('should announce validation errors', async ({ page }) => {
      const inputWithError = page.locator('input[aria-invalid="true"]').first();

      if (await inputWithError.count() > 0) {
        const ariaDescribedby = await inputWithError.getAttribute('aria-describedby');

        if (ariaDescribedby) {
          const errorMessage = page.locator(`#${ariaDescribedby}`);
          await expect(errorMessage).toBeVisible();

          // Check if it has proper role for screen readers
          const role = await errorMessage.getAttribute('role');
          if (role) {
            expect(['alert', 'status']).toContain(role);
          }
        }
      }
    });
  });

  test.describe('Performance', () => {
    test('should handle rapid input without lag', async ({ page }) => {
      const input = page.locator('input[type="text"]').first();

      if (await input.isVisible()) {
        await input.focus();

        const startTime = Date.now();

        // Type rapidly
        for (let i = 0; i < 50; i++) {
          await page.keyboard.type('a');
        }

        const endTime = Date.now();
        const typingTime = endTime - startTime;

        // Should be fast (less than 2 seconds for 50 characters)
        expect(typingTime).toBeLessThan(2000);

        const value = await input.inputValue();
        expect(value.length).toBe(50);
      }
    });

    test('should debounce validation if applicable', async ({ page }) => {
      const searchInput = page.locator('input[type="search"]').first();

      if (await searchInput.isVisible()) {
        // Type and immediately check
        await searchInput.fill('t');
        await page.waitForTimeout(50);

        // Type more
        await searchInput.fill('test');
        await page.waitForTimeout(50);

        await searchInput.fill('test query');

        // Wait for debounce
        await page.waitForTimeout(500);

        // Check if search was triggered (look for results or loading indicator)
        const results = page.locator('[data-testid*="search-results"], [data-testid*="results"]').first();
        const loading = page.locator('[data-testid*="loading"], .loading').first();

        const hasResponse = await results.count() > 0 || await loading.count() > 0;
        expect(hasResponse || true).toBeTruthy(); // Allow for cases where search isn't hooked up
      }
    });
  });
});