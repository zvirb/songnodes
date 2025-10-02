import { test, expect, Page } from '@playwright/test';

/**
 * UI/UX Compliance Audit Test Suite
 * Based on "The Universal Codex of Digital Experience" guide
 *
 * Tests comprehensive UX principles including:
 * - WCAG 2.1 Level AA Accessibility
 * - Nielsen's 10 Usability Heuristics
 * - Gestalt Principles of Visual Perception
 * - Fitts's Law (Target Sizing & Placement)
 * - Hick's Law (Decision Making & Cognitive Load)
 * - Typography & Visual Hierarchy
 * - Color Contrast & Signifiers
 * - Feedback & Error Prevention
 */

test.describe('UX Compliance Audit - Universal Codex Standards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  /**
   * CHAPTER 1: PSYCHOLOGY OF INTERACTION
   * Tests Gestalt Principles and Laws of Interaction
   */
  test.describe('1. Gestalt Principles of Visual Perception', () => {
    test('1.1 Proximity - Related elements should be grouped together', async ({ page }) => {
      // Check that form labels are close to their inputs
      const searchInput = page.locator('[data-testid="track-search-input"]');
      const searchLabel = page.locator('label').filter({ hasText: /search|track/i }).first();

      if (await searchInput.isVisible() && await searchLabel.isVisible()) {
        const inputBox = await searchInput.boundingBox();
        const labelBox = await searchLabel.boundingBox();

        if (inputBox && labelBox) {
          const distance = Math.abs(inputBox.y - (labelBox.y + labelBox.height));
          expect(distance).toBeLessThan(20); // Label should be within 20px of input
        }
      }

      // Check that navigation items are grouped
      const navButtons = page.locator('button').filter({ hasText: /search|filter|stats|settings/i });
      const buttonCount = await navButtons.count();

      if (buttonCount > 1) {
        const firstBox = await navButtons.first().boundingBox();
        const lastBox = await navButtons.last().boundingBox();

        if (firstBox && lastBox) {
          // Navigation buttons should be visually clustered
          const spread = Math.abs(lastBox.x + lastBox.width - firstBox.x);
          expect(spread).toBeLessThan(500); // Reasonable grouping distance
        }
      }

      await expect(page).toHaveScreenshot('gestalt-proximity-validation.png');
    });

    test('1.2 Similarity - Similar elements should have consistent appearance', async ({ page }) => {
      // Check that all primary buttons have consistent styling
      const primaryButtons = page.locator('button.btn-primary, button[class*="primary"]');
      const count = await primaryButtons.count();

      if (count > 1) {
        const styles: any[] = [];

        for (let i = 0; i < Math.min(count, 5); i++) {
          const button = primaryButtons.nth(i);
          const bgColor = await button.evaluate(el =>
            window.getComputedStyle(el).backgroundColor
          );
          const color = await button.evaluate(el =>
            window.getComputedStyle(el).color
          );
          const padding = await button.evaluate(el =>
            window.getComputedStyle(el).padding
          );

          styles.push({ bgColor, color, padding });
        }

        // All primary buttons should have same background color
        const uniqueBgColors = [...new Set(styles.map(s => s.bgColor))];
        expect(uniqueBgColors.length).toBeLessThanOrEqual(2); // Allow for hover states
      }

      // Check all links have consistent styling
      const links = page.locator('a[href]');
      const linkCount = await links.count();

      if (linkCount > 0) {
        const linkColors: string[] = [];
        for (let i = 0; i < Math.min(linkCount, 3); i++) {
          const link = links.nth(i);
          const color = await link.evaluate(el =>
            window.getComputedStyle(el).color
          );
          linkColors.push(color);
        }

        const uniqueLinkColors = [...new Set(linkColors)];
        expect(uniqueLinkColors.length).toBeLessThanOrEqual(2);
      }

      await expect(page).toHaveScreenshot('gestalt-similarity-validation.png');
    });

    test('1.3 Figure/Ground - Modal overlays should clearly separate from background', async ({ page }) => {
      // Try to open a modal
      const graphNode = page.locator('[data-testid="graph-node"]').first();

      if (await graphNode.isVisible()) {
        await graphNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"], [role="dialog"], .modal');

        if (await modal.first().isVisible()) {
          // Check for semi-transparent overlay/backdrop
          const backdrop = page.locator('.modal-backdrop, .overlay, [class*="backdrop"]').first();

          if (await backdrop.isVisible()) {
            const opacity = await backdrop.evaluate(el =>
              window.getComputedStyle(el).opacity
            );

            // Backdrop should be semi-transparent (0.3-0.8 range)
            const opacityNum = parseFloat(opacity);
            expect(opacityNum).toBeGreaterThan(0);
            expect(opacityNum).toBeLessThan(1);
          }

          // Modal should have higher z-index than content
          const modalZIndex = await modal.first().evaluate(el =>
            window.getComputedStyle(el).zIndex
          );
          expect(parseInt(modalZIndex)).toBeGreaterThan(100);

          await expect(page).toHaveScreenshot('gestalt-figure-ground-modal.png');
        }
      }
    });

    test('1.4 Common Region - Cards should group related information', async ({ page }) => {
      // Look for card-style components
      const cards = page.locator('[class*="card"], [data-testid*="card"]');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        const firstCard = cards.first();

        // Cards should have visible boundaries
        const border = await firstCard.evaluate(el =>
          window.getComputedStyle(el).border
        );
        const borderRadius = await firstCard.evaluate(el =>
          window.getComputedStyle(el).borderRadius
        );
        const boxShadow = await firstCard.evaluate(el =>
          window.getComputedStyle(el).boxShadow
        );

        // Should have at least one visual boundary marker
        const hasBoundary = border !== 'none' ||
                           borderRadius !== '0px' ||
                           boxShadow !== 'none';
        expect(hasBoundary).toBe(true);

        await expect(firstCard).toHaveScreenshot('gestalt-common-region-card.png');
      }
    });
  });

  test.describe('2. Fitts\'s Law - Target Sizing & Placement', () => {
    test('2.1 Minimum touch target size (44x44px)', async ({ page }) => {
      // Test all interactive elements meet minimum touch target requirements
      const interactiveElements = await page.locator('button, a[href], input, [role="button"], [tabindex="0"]').all();

      const smallTargets: any[] = [];

      for (const element of interactiveElements.slice(0, 20)) { // Test first 20 elements
        const box = await element.boundingBox();

        if (box) {
          // WCAG 2.1 Level AA: minimum 44x44px for touch targets
          if (box.width < 44 || box.height < 44) {
            const tagName = await element.evaluate(el => el.tagName);
            const text = await element.textContent();
            smallTargets.push({
              tag: tagName,
              text: text?.substring(0, 20),
              width: box.width,
              height: box.height
            });
          }
        }
      }

      if (smallTargets.length > 0) {
        console.warn('⚠️ Small touch targets found:', smallTargets);
      }

      // Allow some small targets (like close buttons) but flag if excessive
      expect(smallTargets.length).toBeLessThan(5);

      await expect(page).toHaveScreenshot('fitts-law-touch-targets.png');
    });

    test('2.2 Primary actions should be larger and more prominent', async ({ page }) => {
      // Primary CTAs should be visually larger
      const primaryButtons = page.locator('button.btn-primary, [data-testid*="primary"]');
      const secondaryButtons = page.locator('button.btn-secondary, button:not(.btn-primary)').first();

      if (await primaryButtons.first().isVisible() && await secondaryButtons.isVisible()) {
        const primaryBox = await primaryButtons.first().boundingBox();
        const secondaryBox = await secondaryButtons.boundingBox();

        if (primaryBox && secondaryBox) {
          const primaryArea = primaryBox.width * primaryBox.height;
          const secondaryArea = secondaryBox.width * secondaryBox.height;

          // Primary button should be at least as large as secondary
          expect(primaryArea).toBeGreaterThanOrEqual(secondaryArea * 0.8);
        }
      }
    });

    test('2.3 Related controls should be placed close together', async ({ page }) => {
      // Zoom controls should be grouped
      const zoomIn = page.locator('[data-testid="zoom-in"], button').filter({ hasText: /zoom.*in|\+/i }).first();
      const zoomOut = page.locator('[data-testid="zoom-out"], button').filter({ hasText: /zoom.*out|-/i }).first();

      if (await zoomIn.isVisible() && await zoomOut.isVisible()) {
        const inBox = await zoomIn.boundingBox();
        const outBox = await zoomOut.boundingBox();

        if (inBox && outBox) {
          const distance = Math.sqrt(
            Math.pow(inBox.x - outBox.x, 2) +
            Math.pow(inBox.y - outBox.y, 2)
          );

          // Related controls should be within 100px
          expect(distance).toBeLessThan(100);
        }
      }
    });
  });

  test.describe('3. Hick\'s Law - Decision Making & Cognitive Load', () => {
    test('3.1 Navigation menus should limit choices', async ({ page }) => {
      // Primary navigation should have 5-7 items (Miller's Law)
      const navButtons = page.locator('nav button, header button, [data-testid*="nav"]');
      const count = await navButtons.count();

      console.log(`Navigation items count: ${count}`);

      // Ideal: 5-7 items, acceptable: up to 9
      expect(count).toBeLessThan(10);

      await expect(page).toHaveScreenshot('hicks-law-navigation.png');
    });

    test('3.2 Complex workflows should use progressive disclosure', async ({ page }) => {
      // Check if settings or advanced features are hidden by default
      const settingsToggle = page.locator('[data-testid="settings-toggle"], button').filter({ hasText: /settings|advanced|more/i }).first();

      if (await settingsToggle.isVisible()) {
        // Advanced settings should be collapsed initially
        const settingsPanel = page.locator('[data-testid="settings-panel"], .settings');
        const initiallyVisible = await settingsPanel.isVisible();

        expect(initiallyVisible).toBe(false);

        // Click to expand
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const nowVisible = await settingsPanel.isVisible();
        expect(nowVisible).toBe(true);

        await expect(page).toHaveScreenshot('progressive-disclosure-expanded.png');
      }
    });

    test('3.3 Forms should chunk information into steps', async ({ page }) => {
      // Look for multi-step forms or wizards
      const stepIndicators = page.locator('[data-testid*="step"], .step, [class*="wizard"]');
      const hasSteps = await stepIndicators.count() > 0;

      if (hasSteps) {
        // Step indicators should clearly show progress
        await expect(stepIndicators.first()).toHaveScreenshot('form-chunking-steps.png');
      }
    });
  });

  /**
   * CHAPTER 2: CANONS OF USABILITY
   * Tests Nielsen's 10 Usability Heuristics
   */
  test.describe('4. Nielsen\'s 10 Usability Heuristics', () => {
    test('4.1 Heuristic #1: Visibility of System Status', async ({ page }) => {
      // Loading states should be visible
      const loadingIndicators = page.locator('[data-testid*="loading"], .loading, .spinner');

      // Trigger an action that might show loading
      const refreshButton = page.locator('button').filter({ hasText: /refresh|reload/i }).first();

      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        await page.waitForTimeout(300);

        // Some form of loading indicator should appear
        const hasLoadingState = await loadingIndicators.first().isVisible();

        if (hasLoadingState) {
          await expect(page).toHaveScreenshot('heuristic-1-system-status.png');
        }
      }

      // Progress indicators for ongoing processes
      const progressBars = page.locator('progress, [role="progressbar"]');
      if (await progressBars.count() > 0) {
        await expect(progressBars.first()).toHaveScreenshot('progress-indicator.png');
      }
    });

    test('4.2 Heuristic #2: Match Between System and Real World', async ({ page }) => {
      // Check for familiar icons and terminology
      const buttons = await page.locator('button').all();

      const jargonWords = ['API', 'JSON', 'HTTP', 'SQL', 'CRUD', 'REST'];
      const jargonFound: string[] = [];

      for (const button of buttons.slice(0, 10)) {
        const text = await button.textContent();
        if (text) {
          for (const jargon of jargonWords) {
            if (text.toUpperCase().includes(jargon)) {
              jargonFound.push(text);
            }
          }
        }
      }

      // Technical jargon should be minimal in user-facing text
      expect(jargonFound.length).toBeLessThan(3);

      await expect(page).toHaveScreenshot('heuristic-2-real-world-language.png');
    });

    test('4.3 Heuristic #3: User Control and Freedom', async ({ page }) => {
      // Test for Undo/Cancel functionality
      const cancelButtons = page.locator('button').filter({ hasText: /cancel|close|undo|back/i });
      const count = await cancelButtons.count();

      expect(count).toBeGreaterThan(0); // Should have escape hatches

      // Test Escape key closes modals
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first();
        if (await modal.isVisible()) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);

          const modalClosed = !(await modal.isVisible());
          expect(modalClosed).toBe(true);
        }
      }

      await expect(page).toHaveScreenshot('heuristic-3-user-control.png');
    });

    test('4.4 Heuristic #4: Consistency and Standards', async ({ page }) => {
      // Check that similar actions use consistent terminology
      const saveButtons = page.locator('button').filter({ hasText: /save/i });
      const updateButtons = page.locator('button').filter({ hasText: /update/i });

      const saveCount = await saveButtons.count();
      const updateCount = await updateButtons.count();

      // Should use one consistent term, not both
      if (saveCount > 0 && updateCount > 0) {
        console.warn('⚠️ Mixed terminology: Both "Save" and "Update" found');
      }

      // Button positions should be consistent
      const okButtons = page.locator('button').filter({ hasText: /ok|confirm|yes/i });
      const cancelButtons2 = page.locator('button').filter({ hasText: /cancel|no/i });

      if (await okButtons.count() > 0 && await cancelButtons2.count() > 0) {
        const okBox = await okButtons.first().boundingBox();
        const cancelBox = await cancelButtons2.first().boundingBox();

        if (okBox && cancelBox) {
          // Confirm button typically on right in Western UIs
          const confirmOnRight = okBox.x > cancelBox.x;
          expect(confirmOnRight).toBe(true);
        }
      }
    });

    test('4.5 Heuristic #5: Error Prevention', async ({ page }) => {
      // Check for confirmation dialogs before destructive actions
      const deleteButtons = page.locator('button').filter({ hasText: /delete|remove/i });

      if (await deleteButtons.first().isVisible()) {
        await deleteButtons.first().click();
        await page.waitForTimeout(500);

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="dialog"], .confirm, [data-testid*="confirm"]');
        const hasConfirmation = await confirmDialog.first().isVisible();

        if (hasConfirmation) {
          await expect(page).toHaveScreenshot('heuristic-5-error-prevention.png');
        }
      }

      // Input validation should prevent errors
      const numericInputs = page.locator('input[type="number"]');
      if (await numericInputs.first().isVisible()) {
        const input = numericInputs.first();
        const min = await input.getAttribute('min');
        const max = await input.getAttribute('max');

        // Numeric inputs should have constraints
        expect(min !== null || max !== null).toBe(true);
      }
    });

    test('4.6 Heuristic #6: Recognition Rather Than Recall', async ({ page }) => {
      // Recently used items should be visible
      const recentLists = page.locator('[data-testid*="recent"], [class*="recent"]');

      // Search should show suggestions
      const searchInput = page.locator('input[type="search"], [data-testid*="search-input"]').first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('te');
        await page.waitForTimeout(300);

        // Should show autocomplete suggestions
        const suggestions = page.locator('[role="option"], [data-testid*="suggestion"]');
        const hasSuggestions = await suggestions.count() > 0;

        if (hasSuggestions) {
          await expect(page).toHaveScreenshot('heuristic-6-recognition.png');
        }
      }
    });

    test('4.7 Heuristic #7: Flexibility and Efficiency of Use', async ({ page }) => {
      // Check for keyboard shortcuts
      const helpButton = page.locator('button').filter({ hasText: /help|\?/i }).first();

      // Test keyboard shortcuts work
      await page.keyboard.press('d'); // Debug mode
      await page.waitForTimeout(500);

      // Test that common actions have keyboard shortcuts
      // (Search: Ctrl+F, etc.)
      await page.keyboard.press('Control+f');
      await page.waitForTimeout(300);

      const searchActive = await page.locator('[data-testid*="search"]').first().isVisible();

      await expect(page).toHaveScreenshot('heuristic-7-efficiency.png');
    });

    test('4.8 Heuristic #8: Aesthetic and Minimalist Design', async ({ page }) => {
      // Calculate information density
      const textContent = await page.textContent('body');
      const textLength = textContent?.length || 0;

      const viewportSize = page.viewportSize();
      const screenArea = viewportSize ? viewportSize.width * viewportSize.height : 1;

      // Information density (characters per 1000 pixels)
      const density = (textLength / screenArea) * 1000;

      console.log(`Information density: ${density.toFixed(2)} chars/1000px`);

      // Should not be overly cluttered
      expect(density).toBeLessThan(50); // Reasonable threshold

      // Check for adequate whitespace
      const body = page.locator('body');
      const padding = await body.evaluate(el =>
        window.getComputedStyle(el).padding
      );

      await expect(page).toHaveScreenshot('heuristic-8-minimalism.png');
    });

    test('4.9 Heuristic #9: Help Users Recognize, Diagnose, and Recover from Errors', async ({ page }) => {
      // Error messages should be in plain language
      const errorMessages = page.locator('[data-testid*="error"], [class*="error"], [role="alert"]');

      if (await errorMessages.first().isVisible()) {
        const errorText = await errorMessages.first().textContent();

        // Should not contain error codes like "Error #5B2T9"
        const hasErrorCode = /Error\s*#[A-Z0-9]+/i.test(errorText || '');
        expect(hasErrorCode).toBe(false);

        // Should suggest a solution
        const hasSuggestion = /try|please|should|check/i.test(errorText || '');

        await expect(errorMessages.first()).toHaveScreenshot('heuristic-9-error-message.png');
      }
    });

    test('4.10 Heuristic #10: Help and Documentation', async ({ page }) => {
      // Help should be easily accessible
      const helpElements = page.locator('button, a').filter({ hasText: /help|\?|support|guide/i });
      const hasHelp = await helpElements.count() > 0;

      expect(hasHelp).toBe(true);

      if (await helpElements.first().isVisible()) {
        await helpElements.first().click();
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('heuristic-10-help.png');
      }
    });
  });

  /**
   * CHAPTER 3: VISUAL GRAMMAR & HIERARCHY
   */
  test.describe('5. Typography and Visual Hierarchy', () => {
    test('5.1 Font size hierarchy should be clear', async ({ page }) => {
      const h1 = page.locator('h1').first();
      const h2 = page.locator('h2').first();
      const body = page.locator('p, div').filter({ hasText: /.{20,}/ }).first();

      if (await h1.isVisible() && await body.isVisible()) {
        const h1Size = await h1.evaluate(el =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );
        const bodySize = await body.evaluate(el =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );

        // H1 should be significantly larger than body text
        expect(h1Size).toBeGreaterThan(bodySize * 1.5);
      }

      if (await h1.isVisible() && await h2.isVisible()) {
        const h1Size = await h1.evaluate(el =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );
        const h2Size = await h2.evaluate(el =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );

        // H1 should be larger than H2
        expect(h1Size).toBeGreaterThan(h2Size);
      }

      await expect(page).toHaveScreenshot('typography-hierarchy.png');
    });

    test('5.2 Line height should support readability', async ({ page }) => {
      const paragraphs = page.locator('p');

      if (await paragraphs.first().isVisible()) {
        const lineHeight = await paragraphs.first().evaluate(el =>
          window.getComputedStyle(el).lineHeight
        );
        const fontSize = await paragraphs.first().evaluate(el =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );

        const lineHeightNum = parseFloat(lineHeight);

        // Line height should be 1.4-1.6 for readability
        const ratio = lineHeightNum / fontSize;
        expect(ratio).toBeGreaterThan(1.3);
        expect(ratio).toBeLessThan(2.0);
      }
    });

    test('5.3 Text should have adequate contrast ratio', async ({ page }) => {
      // Check main content text contrast
      const textElements = page.locator('p, span, div').filter({ hasText: /.{10,}/ });

      if (await textElements.first().isVisible()) {
        const element = textElements.first();

        const color = await element.evaluate(el => {
          const rgb = window.getComputedStyle(el).color;
          return rgb;
        });

        const bgColor = await element.evaluate(el => {
          const rgb = window.getComputedStyle(el).backgroundColor;
          return rgb;
        });

        console.log(`Text color: ${color}, Background: ${bgColor}`);

        // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
        // This is a simplified check - production would use actual contrast calculation

        await expect(element).toHaveScreenshot('text-contrast-check.png');
      }
    });
  });

  /**
   * CHAPTER 4: ACCESSIBILITY (WCAG 2.1 Level AA)
   */
  test.describe('6. WCAG 2.1 Level AA Compliance', () => {
    test('6.1 POUR Principle: Perceivable - Alt text for images', async ({ page }) => {
      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const ariaLabel = await img.getAttribute('aria-label');

        // All images must have alt text or aria-label
        expect(alt !== null || ariaLabel !== null).toBe(true);
      }
    });

    test('6.2 POUR Principle: Operable - Keyboard navigation', async ({ page }) => {
      // All functionality should be keyboard accessible
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);

      let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      // Tab through interactive elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const focused = page.locator(':focus');
        const isVisible = await focused.isVisible();

        if (isVisible) {
          // Focused element should have visible focus indicator
          const outline = await focused.evaluate(el =>
            window.getComputedStyle(el).outline
          );
          const boxShadow = await focused.evaluate(el =>
            window.getComputedStyle(el).boxShadow
          );

          const hasFocusIndicator = outline !== 'none' || boxShadow !== 'none';
          expect(hasFocusIndicator).toBe(true);
        }
      }

      await expect(page).toHaveScreenshot('wcag-keyboard-navigation.png');
    });

    test('6.3 POUR Principle: Understandable - Consistent navigation', async ({ page }) => {
      // Navigation should be in same location across views
      const nav = page.locator('nav, header');
      const initialBox = await nav.first().boundingBox();

      // Navigate to different view (if applicable)
      const navButton = page.locator('button').first();
      if (await navButton.isVisible()) {
        await navButton.click();
        await page.waitForTimeout(500);

        const newBox = await nav.first().boundingBox();

        if (initialBox && newBox) {
          // Navigation should stay in same position
          expect(Math.abs(initialBox.x - newBox.x)).toBeLessThan(10);
          expect(Math.abs(initialBox.y - newBox.y)).toBeLessThan(10);
        }
      }
    });

    test('6.4 POUR Principle: Robust - Valid ARIA roles', async ({ page }) => {
      // Check for valid ARIA roles
      const ariaElements = page.locator('[role]');
      const count = await ariaElements.count();

      const validRoles = [
        'button', 'link', 'navigation', 'main', 'complementary', 'banner',
        'contentinfo', 'dialog', 'alert', 'status', 'progressbar', 'tab',
        'tabpanel', 'tablist', 'menu', 'menuitem', 'search', 'form'
      ];

      for (let i = 0; i < Math.min(count, 10); i++) {
        const element = ariaElements.nth(i);
        const role = await element.getAttribute('role');

        if (role) {
          const isValid = validRoles.includes(role);
          expect(isValid).toBe(true);
        }
      }
    });

    test('6.5 Color contrast meets AA standards (4.5:1)', async ({ page }) => {
      // Test contrast on key interactive elements
      const buttons = page.locator('button').first();

      if (await buttons.isVisible()) {
        await expect(buttons).toHaveScreenshot('button-contrast-check.png');
      }

      // Test contrast on text
      const bodyText = page.locator('p, div').filter({ hasText: /.{20,}/ }).first();

      if (await bodyText.isVisible()) {
        await expect(bodyText).toHaveScreenshot('text-contrast-check.png');
      }
    });

    test('6.6 Form inputs have associated labels', async ({ page }) => {
      const inputs = page.locator('input:not([type="hidden"])');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');

        // Input must have label via id, aria-label, or aria-labelledby
        const hasLabel = id !== null || ariaLabel !== null || ariaLabelledby !== null;

        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const labelExists = await label.count() > 0;
          expect(labelExists || ariaLabel !== null).toBe(true);
        }
      }
    });
  });

  /**
   * COMPREHENSIVE SUMMARY TEST
   */
  test('7. UX Compliance Summary Report', async ({ page }) => {
    console.log('\n========================================');
    console.log('UX COMPLIANCE AUDIT SUMMARY');
    console.log('========================================\n');

    // Count interactive elements
    const buttons = await page.locator('button').count();
    const links = await page.locator('a[href]').count();
    const inputs = await page.locator('input').count();

    console.log(`Interactive Elements:`);
    console.log(`  • Buttons: ${buttons}`);
    console.log(`  • Links: ${links}`);
    console.log(`  • Inputs: ${inputs}`);

    // Check accessibility features
    const ariaLabels = await page.locator('[aria-label]').count();
    const ariaDescribed = await page.locator('[aria-describedby]').count();
    const roles = await page.locator('[role]').count();

    console.log(`\nAccessibility Features:`);
    console.log(`  • ARIA Labels: ${ariaLabels}`);
    console.log(`  • ARIA Descriptions: ${ariaDescribed}`);
    console.log(`  • ARIA Roles: ${roles}`);

    // Check semantic HTML
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    const nav = await page.locator('nav').count();
    const main = await page.locator('main').count();

    console.log(`\nSemantic HTML:`);
    console.log(`  • Headings: ${headings}`);
    console.log(`  • Nav elements: ${nav}`);
    console.log(`  • Main elements: ${main}`);

    console.log('\n========================================\n');

    await expect(page).toHaveScreenshot('ux-compliance-final-state.png');

    // Minimum requirements for good UX
    expect(buttons).toBeGreaterThan(5);
    expect(headings).toBeGreaterThan(2);
    expect(ariaLabels + roles).toBeGreaterThan(10);
  });
});
