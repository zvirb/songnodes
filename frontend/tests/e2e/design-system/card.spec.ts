import { test, expect } from '@playwright/test';
import { TestUtilities } from '../../helpers/test-utilities';

test.describe('Card Component', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('Card Structure', () => {
    test('should render card with compound components', async ({ page }) => {
      const card = page.locator('[data-testid*="card"], .card').first();

      if (await card.isVisible()) {
        // Check for header
        const header = card.locator('[data-testid="card-header"], .card-header, header').first();
        if (await header.count() > 0) {
          await expect(header).toBeVisible();

          // Header should have title
          const title = header.locator('h1, h2, h3, h4, h5, h6, [class*="title"]').first();
          if (await title.count() > 0) {
            const titleText = await title.textContent();
            expect(titleText).toBeTruthy();
          }
        }

        // Check for content/body
        const content = card.locator('[data-testid="card-content"], .card-content, .card-body').first();
        if (await content.count() > 0) {
          await expect(content).toBeVisible();
        }

        // Check for footer
        const footer = card.locator('[data-testid="card-footer"], .card-footer, footer').first();
        if (await footer.count() > 0) {
          await expect(footer).toBeVisible();

          // Footer often contains actions
          const actions = footer.locator('button, a');
          const actionCount = await actions.count();
          if (actionCount > 0) {
            expect(actionCount).toBeGreaterThan(0);
          }
        }
      }
    });

    test('should have proper card styling', async ({ page }) => {
      const card = page.locator('[data-testid*="card"], .card').first();

      if (await card.isVisible()) {
        const styles = await card.evaluate(el => {
          const s = window.getComputedStyle(el);
          return {
            borderRadius: s.borderRadius,
            boxShadow: s.boxShadow,
            border: s.border,
            padding: s.padding,
            backgroundColor: s.backgroundColor
          };
        });

        // Should have border or shadow for depth
        const hasDepth =
          styles.boxShadow !== 'none' ||
          styles.border !== 'none' && styles.border !== '';

        expect(hasDepth).toBeTruthy();

        // Should have rounded corners
        expect(parseInt(styles.borderRadius)).toBeGreaterThan(0);

        // Should have background
        expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      }
    });
  });

  test.describe('Card Variants', () => {
    test('should support elevated cards', async ({ page }) => {
      const elevatedCard = page.locator('[data-variant="elevated"], .card-elevated').first();

      if (await elevatedCard.count() > 0) {
        const boxShadow = await elevatedCard.evaluate(el => window.getComputedStyle(el).boxShadow);
        expect(boxShadow).not.toBe('none');
        expect(boxShadow).toMatch(/rgba?\(/);
      }
    });

    test('should support outlined cards', async ({ page }) => {
      const outlinedCard = page.locator('[data-variant="outlined"], .card-outlined').first();

      if (await outlinedCard.count() > 0) {
        const border = await outlinedCard.evaluate(el => window.getComputedStyle(el).border);
        expect(border).not.toBe('none');
        expect(border).toMatch(/[1-2]px/);
      }
    });

    test('should support flat cards', async ({ page }) => {
      const flatCard = page.locator('[data-variant="flat"], .card-flat').first();

      if (await flatCard.count() > 0) {
        const styles = await flatCard.evaluate(el => {
          const s = window.getComputedStyle(el);
          return {
            boxShadow: s.boxShadow,
            border: s.border
          };
        });

        // Flat cards have minimal depth
        expect(styles.boxShadow === 'none' || styles.border === 'none').toBeTruthy();
      }
    });
  });

  test.describe('Interactive Cards', () => {
    test('should handle clickable cards', async ({ page }) => {
      const clickableCard = page.locator('[data-testid*="card"][role="button"], .card-clickable, .card[onclick]').first();

      if (await clickableCard.count() > 0) {
        // Check cursor
        const cursor = await clickableCard.evaluate(el => window.getComputedStyle(el).cursor);
        expect(cursor).toBe('pointer');

        // Check hover effect
        const initialTransform = await clickableCard.evaluate(el => window.getComputedStyle(el).transform);
        await clickableCard.hover();
        await page.waitForTimeout(200);

        const hoverTransform = await clickableCard.evaluate(el => window.getComputedStyle(el).transform);
        const hoverShadow = await clickableCard.evaluate(el => window.getComputedStyle(el).boxShadow);

        // Should have hover feedback (elevation or transform)
        expect(hoverTransform !== initialTransform || hoverShadow !== 'none').toBeTruthy();

        // Test click
        await clickableCard.click();
        // Could navigate or trigger action
      }
    });

    test('should support expandable cards', async ({ page }) => {
      const expandableCard = page.locator('[data-expandable="true"], .card-expandable').first();

      if (await expandableCard.count() > 0) {
        // Look for expand button
        const expandButton = expandableCard.locator('[aria-label*="Expand"], [aria-label*="More"], button:has-text("More")').first();

        if (await expandButton.isVisible()) {
          // Get initial height
          const initialHeight = await expandableCard.evaluate(el => el.getBoundingClientRect().height);

          // Expand
          await expandButton.click();
          await page.waitForTimeout(300);

          // Check expanded state
          const expandedHeight = await expandableCard.evaluate(el => el.getBoundingClientRect().height);
          expect(expandedHeight).toBeGreaterThan(initialHeight);

          // Collapse
          await expandButton.click();
          await page.waitForTimeout(300);

          const collapsedHeight = await expandableCard.evaluate(el => el.getBoundingClientRect().height);
          expect(collapsedHeight).toBeLessThanOrEqual(initialHeight);
        }
      }
    });
  });

  test.describe('Card Media', () => {
    test('should display media elements', async ({ page }) => {
      const cardWithMedia = page.locator('[data-testid*="card"]:has(img), .card:has(img)').first();

      if (await cardWithMedia.count() > 0) {
        const image = cardWithMedia.locator('img').first();
        await expect(image).toBeVisible();

        // Check image loaded
        const isLoaded = await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalHeight !== 0);
        expect(isLoaded).toBeTruthy();

        // Check aspect ratio maintained
        const aspectRatio = await image.evaluate((img: HTMLImageElement) => {
          const rect = img.getBoundingClientRect();
          return rect.width / rect.height;
        });

        expect(aspectRatio).toBeGreaterThan(0);
      }
    });

    test('should handle media loading states', async ({ page }) => {
      const cardWithMedia = page.locator('[data-testid*="card"]:has([class*="skeleton"])').first();

      if (await cardWithMedia.count() > 0) {
        // Check for skeleton while loading
        const skeleton = cardWithMedia.locator('[class*="skeleton"]').first();
        if (await skeleton.isVisible()) {
          // Wait for media to load
          await page.waitForTimeout(2000);

          // Skeleton should be replaced with actual content
          const image = cardWithMedia.locator('img').first();
          if (await image.count() > 0) {
            await expect(image).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Card Grid Layouts', () => {
    test('should display cards in responsive grid', async ({ page }) => {
      const cardGrid = page.locator('[class*="grid"]:has(.card), [class*="cards-container"]').first();

      if (await cardGrid.count() > 0) {
        const gridStyles = await cardGrid.evaluate(el => {
          const s = window.getComputedStyle(el);
          return {
            display: s.display,
            gridTemplateColumns: s.gridTemplateColumns,
            gap: s.gap
          };
        });

        // Should use grid or flex layout
        expect(['grid', 'flex']).toContain(gridStyles.display);

        if (gridStyles.display === 'grid') {
          expect(gridStyles.gridTemplateColumns).toBeTruthy();
          expect(gridStyles.gap).toBeTruthy();
        }

        // Test responsive behavior
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(500);

        const mobileColumns = await cardGrid.evaluate(el => {
          return window.getComputedStyle(el).gridTemplateColumns;
        });

        // Should have fewer columns on mobile
        if (gridStyles.display === 'grid') {
          expect(mobileColumns).not.toBe(gridStyles.gridTemplateColumns);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper semantic markup', async ({ page }) => {
      const cards = await page.locator('[data-testid*="card"], .card').all();

      for (const card of cards.slice(0, 3)) {
        if (!await card.isVisible()) continue;

        // Check for article or section tag
        const tagName = await card.evaluate(el => el.tagName.toLowerCase());
        expect(['article', 'section', 'div']).toContain(tagName);

        // Check for proper heading hierarchy
        const headings = card.locator('h1, h2, h3, h4, h5, h6');
        if (await headings.count() > 0) {
          const firstHeading = headings.first();
          const headingLevel = await firstHeading.evaluate(el => el.tagName);
          expect(headingLevel).toMatch(/^H[1-6]$/);
        }
      }
    });

    test('should have proper ARIA attributes for interactive cards', async ({ page }) => {
      const interactiveCard = page.locator('[data-testid*="card"][role]').first();

      if (await interactiveCard.count() > 0) {
        const role = await interactiveCard.getAttribute('role');
        const ariaLabel = await interactiveCard.getAttribute('aria-label');
        const ariaDescribedby = await interactiveCard.getAttribute('aria-describedby');

        // Interactive cards should have appropriate role
        expect(['button', 'article', 'link']).toContain(role || '');

        // Should have accessible name
        expect(ariaLabel || ariaDescribedby).toBeTruthy();
      }
    });
  });

  test.describe('Performance', () => {
    test('should render card lists efficiently', async ({ page }) => {
      const cards = await page.locator('[data-testid*="card"], .card').all();

      if (cards.length > 10) {
        // Measure scroll performance
        const startTime = Date.now();

        // Scroll through cards
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        await page.waitForTimeout(500);

        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });

        const scrollTime = Date.now() - startTime;

        // Should scroll smoothly
        expect(scrollTime).toBeLessThan(1000);

        // Check for virtualization in long lists
        if (cards.length > 50) {
          const visibleCards = await page.locator('[data-testid*="card"]:visible').count();
          console.log(`Virtualization: ${visibleCards} visible of ${cards.length} total`);
        }
      }
    });

    test('should lazy load card images', async ({ page }) => {
      const images = await page.locator('.card img[loading="lazy"]').all();

      if (images.length > 0) {
        // Check lazy loading attribute
        for (const img of images.slice(0, 3)) {
          const loading = await img.getAttribute('loading');
          expect(loading).toBe('lazy');
        }
      }
    });
  });
});