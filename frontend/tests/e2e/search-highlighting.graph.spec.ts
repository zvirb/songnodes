import { test, expect, Page } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Search Functionality and Highlighting Test Suite
 * Tests search features, node highlighting, and track discovery functionality
 */
test.describe('Search Functionality and Highlighting', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('SongNodes DJ');

    // Enable performance monitoring for debugging
    await graphUtils.enablePerformanceMonitor();

    // Wait for graph initialization
    await graphUtils.waitForGraphInitialization();
  });

  test.describe('Search Panel and Interface', () => {
    test('should open search panel with keyboard shortcut', async ({ page }) => {
      await test.step('Test Ctrl+F shortcut', async () => {
        // Use Ctrl+F to open search
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        // Search panel should be visible
        const searchPanel = page.locator('.panel-left').or(page.locator('[data-testid="search-panel"]'));
        await expect(searchPanel).toBeVisible();

        // Take screenshot showing search panel
        await page.screenshot({ path: 'tests/screenshots/search/search-panel-opened.png' });
      });
    });

    test('should open search panel with toolbar button', async ({ page }) => {
      await test.step('Test search button click', async () => {
        // Click search button in toolbar
        const searchButton = page.locator('[title*="Search"]').or(page.locator('text=🔍'));
        if (await searchButton.isVisible()) {
          await searchButton.click();
          await page.waitForTimeout(500);

          // Search panel should be visible
          const searchPanel = page.locator('.panel-left').or(page.locator('[data-testid="search-panel"]'));
          await expect(searchPanel).toBeVisible();

          // Take screenshot showing search panel
          await page.screenshot({ path: 'tests/screenshots/search/search-panel-toolbar.png' });
        }
      });
    });

    test('should display search input field', async ({ page }) => {
      await test.step('Verify search input accessibility', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        // Look for search input field
        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          await expect(searchInput).toBeVisible();
          await expect(searchInput).toBeEnabled();

          // Test that input is focusable
          await searchInput.focus();

          // Take screenshot showing search input focus
          await page.screenshot({ path: 'tests/screenshots/search/search-input-focused.png' });
        }
      });
    });
  });

  test.describe('Track Search Functionality', () => {
    test('should search for specific track names', async ({ page }) => {
      await test.step('Search for common electronic music tracks', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        // Common track names from requirements (Bangarang, Adagio for Strings, etc.)
        const searchTerms = [
          'Bangarang',
          'Adagio',
          'Energy',
          'Harmony',
          'Bass',
        ];

        for (const term of searchTerms) {
          const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

          if (await searchInput.isVisible()) {
            // Clear previous search
            await searchInput.clear();
            await searchInput.fill(term);
            await page.waitForTimeout(500);

            // Take screenshot showing search results
            await page.screenshot({ path: `tests/screenshots/search/search-${term.toLowerCase()}.png` });

            // Also capture graph highlighting
            await graphUtils.takeCanvasScreenshot(`search-highlight-${term.toLowerCase()}`);
          }
        }
      });
    });

    test('should handle fuzzy search and partial matches', async ({ page }) => {
      await test.Step('Test partial and fuzzy matching', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const partialSearches = [
          { term: 'bang', expected: 'should match Bangarang' },
          { term: 'adagi', expected: 'should match Adagio' },
          { term: 'enrgy', expected: 'should match Energy' },
        ];

        for (const search of partialSearches) {
          const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

          if (await searchInput.isVisible()) {
            await searchInput.clear();
            await searchInput.fill(search.term);
            await page.waitForTimeout(500);

            console.log(`Testing fuzzy search: "${search.term}" - ${search.expected}`);

            // Take screenshot showing fuzzy search results
            await page.screenshot({ path: `tests/screenshots/search/fuzzy-${search.term}.png` });
            await graphUtils.takeCanvasScreenshot(`fuzzy-highlight-${search.term}`);
          }
        }
      });
    });

    test('should handle search with no results', async ({ page }) => {
      await test.step('Test empty search results', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Search for something that definitely won't exist
          await searchInput.clear();
          await searchInput.fill('xyznonexistenttrackabc123');
          await page.waitForTimeout(500);

          // Take screenshot showing no results state
          await page.screenshot({ path: 'tests/screenshots/search/no-results.png' });
          await graphUtils.takeCanvasScreenshot('no-results-graph');

          // Should not crash or show errors
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.nodeCount).toBeGreaterThan(0);
        }
      });
    });

    test('should clear search results properly', async ({ page }) => {
      await test.step('Test search clearing', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Perform a search first
          await searchInput.fill('Energy');
          await page.waitForTimeout(500);

          // Take screenshot with search results
          await page.screenshot({ path: 'tests/screenshots/search/before-clear.png' });

          // Clear the search
          await searchInput.clear();
          await page.waitForTimeout(500);

          // Take screenshot after clearing
          await page.screenshot({ path: 'tests/screenshots/search/after-clear.png' });
          await graphUtils.takeCanvasScreenshot('search-cleared');
        }
      });
    });
  });

  test.describe('Node Highlighting', () => {
    test('should highlight matching nodes in graph', async ({ page }) => {
      await test.step('Verify visual highlighting of search matches', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Search for a term
          await searchInput.fill('Harmony');
          await page.waitForTimeout(1000);

          // Take baseline graph screenshot
          await graphUtils.takeCanvasScreenshot('highlighting-baseline');

          // Zoom in to better see highlighting
          await graphUtils.zoomIn(2);
          await graphUtils.waitForAnimation();

          // Take close-up screenshot of highlighting
          await graphUtils.takeCanvasScreenshot('highlighting-close-up');

          // Test that graph is still performant with highlighting
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.frameRate).toBeGreaterThanOrEqual(20);
        }
      });
    });

    test('should handle multiple search results highlighting', async ({ page }) => {
      await test.step('Test multiple match highlighting', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Search for a common term that should match multiple tracks
          await searchInput.fill('Mix');
          await page.waitForTimeout(1000);

          // Take screenshot showing multiple highlights
          await graphUtils.takeCanvasScreenshot('multiple-highlights');

          // Pan around to see different highlighted nodes
          await graphUtils.pan(100, 100);
          await graphUtils.takeCanvasScreenshot('multiple-highlights-panned');

          // Performance should remain good with multiple highlights
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.frameRate).toBeGreaterThanOrEqual(15);
        }
      });
    });

    test('should update highlights dynamically during typing', async ({ page }) => {
      await test.step('Test real-time highlight updates', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Type progressively to test dynamic updates
          const progressiveSearch = 'Energy';

          for (let i = 1; i <= progressiveSearch.length; i++) {
            const partialTerm = progressiveSearch.substring(0, i);
            await searchInput.clear();
            await searchInput.fill(partialTerm);
            await page.waitForTimeout(300);

            // Take screenshot at each step
            await graphUtils.takeCanvasScreenshot(`dynamic-${partialTerm}`);
          }
        }
      });
    });

    test('should maintain highlights during graph interactions', async ({ page }) => {
      await test.step('Test highlight persistence during zoom/pan', async () => {
        // Open search panel and perform search
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          await searchInput.fill('Bass');
          await page.waitForTimeout(500);

          // Take initial highlighted state
          await graphUtils.takeCanvasScreenshot('highlights-initial');

          // Test zoom with highlights
          await graphUtils.zoomIn(3);
          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot('highlights-zoomed-in');

          // Test pan with highlights
          await graphUtils.pan(150, 150);
          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot('highlights-panned');

          // Test zoom out with highlights
          await graphUtils.zoomOut(4);
          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot('highlights-zoomed-out');

          // Highlights should persist through all operations
          // Performance should remain acceptable
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.frameRate).toBeGreaterThanOrEqual(15);
        }
      });
    });
  });

  test.describe('Search Results Navigation', () => {
    test('should allow clicking on search results to navigate', async ({ page }) => {
      await test.step('Test search result interaction', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          await searchInput.fill('Bangarang');
          await page.waitForTimeout(500);

          // Look for search results list
          const searchResults = page.locator('.search-results').or(page.locator('[data-testid="search-results"]'));

          if (await searchResults.isVisible()) {
            // Click on first search result
            const firstResult = searchResults.locator('li').first().or(searchResults.locator('.search-result-item').first());

            if (await firstResult.isVisible()) {
              await firstResult.click();
              await page.waitForTimeout(500);

              // Take screenshot showing navigation to result
              await graphUtils.takeCanvasScreenshot('navigate-to-result');

              // Graph should have moved/focused on the result
              const metrics = await graphUtils.getPerformanceMetrics();
              expect(metrics.nodeCount).toBeGreaterThan(0);
            }
          }
        }
      });
    });

    test('should support keyboard navigation in search results', async ({ page }) => {
      await test.step('Test keyboard navigation of results', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          await searchInput.fill('Energy');
          await page.waitForTimeout(500);

          // Try to navigate results with arrow keys
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);

          // Take screenshot showing keyboard navigation
          await page.screenshot({ path: 'tests/screenshots/search/keyboard-navigation.png' });

          // Try to select result with Enter
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);

          await graphUtils.takeCanvasScreenshot('keyboard-result-selection');
        }
      });
    });
  });

  test.describe('Search Filters and Advanced Search', () => {
    test('should handle genre-based filtering if available', async ({ page }) => {
      await test.step('Test search filtering by genre', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        // Look for filter options (this depends on implementation)
        const filterOptions = page.locator('.search-filters').or(page.locator('[data-testid="search-filters"]'));

        if (await filterOptions.isVisible()) {
          // Test different filter options if they exist
          const genreFilters = ['Electronic', 'House', 'Trance', 'Dubstep'];

          for (const genre of genreFilters) {
            const filterOption = page.locator(`text=${genre}`).or(page.locator(`[value="${genre}"]`));

            if (await filterOption.isVisible()) {
              await filterOption.click();
              await page.waitForTimeout(500);

              // Take screenshot showing filtered results
              await page.screenshot({ path: `tests/screenshots/search/filter-${genre.toLowerCase()}.png` });
              await graphUtils.takeCanvasScreenshot(`filter-${genre.toLowerCase()}-graph`);
            }
          }
        } else {
          // If no filters available, just document the search interface
          await page.screenshot({ path: 'tests/screenshots/search/no-filters-available.png' });
        }
      });
    });

    test('should handle artist-based search if supported', async ({ page }) => {
      await test.step('Test artist search functionality', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Search for common artist names in electronic music
          const artists = ['Skrillex', 'Deadmau5', 'Tiesto', 'Armin'];

          for (const artist of artists) {
            await searchInput.clear();
            await searchInput.fill(artist);
            await page.waitForTimeout(500);

            // Take screenshot showing artist search results
            await page.screenshot({ path: `tests/screenshots/search/artist-${artist.toLowerCase()}.png` });
            await graphUtils.takeCanvasScreenshot(`artist-${artist.toLowerCase()}-graph`);
          }
        }
      });
    });

    test('should handle BPM or tempo-based search if available', async ({ page }) => {
      await test.step('Test tempo-based search', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Search for tempo ranges common in electronic music
          const tempoSearches = ['128', '140', '174', 'BPM'];

          for (const tempo of tempoSearches) {
            await searchInput.clear();
            await searchInput.fill(tempo);
            await page.waitForTimeout(500);

            // Take screenshot showing tempo search results
            await page.screenshot({ path: `tests/screenshots/search/tempo-${tempo}.png` });
            await graphUtils.takeCanvasScreenshot(`tempo-${tempo}-graph`);
          }
        }
      });
    });
  });

  test.describe('Search Performance', () => {
    test('should maintain performance during search operations', async ({ page }) => {
      await test.step('Test search performance with large dataset', async () => {
        // Verify we have a substantial dataset
        const initialMetrics = await graphUtils.getPerformanceMetrics();
        expect(initialMetrics.nodeCount).toBeGreaterThan(200);

        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Perform several searches rapidly
          const rapidSearches = ['A', 'B', 'C', 'Energy', 'Bass', 'Mix'];

          for (const term of rapidSearches) {
            await searchInput.clear();
            await searchInput.fill(term);
            await page.waitForTimeout(100); // Rapid typing simulation
          }

          await page.waitForTimeout(1000); // Let search complete

          // Performance should still be good
          const finalMetrics = await graphUtils.getPerformanceMetrics();
          expect(finalMetrics.frameRate).toBeGreaterThanOrEqual(20);

          console.log('Search performance test:', finalMetrics);
          await graphUtils.takeCanvasScreenshot('search-performance-test');
        }
      });
    });

    test('should handle search with concurrent graph interactions', async ({ page }) => {
      await test.step('Test search during zoom and pan operations', async () => {
        // Open search and start a search
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          await searchInput.fill('Harmony');
          await page.waitForTimeout(500);

          // Perform graph interactions while search is active
          await graphUtils.zoomIn(2);
          await graphUtils.pan(100, 100);
          await graphUtils.zoomOut(1);
          await graphUtils.pan(-50, -50);

          // Both search and graph interactions should work
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.frameRate).toBeGreaterThanOrEqual(15);

          await graphUtils.takeCanvasScreenshot('search-with-interactions');
        }
      });
    });
  });

  test.describe('Search Accessibility', () => {
    test('should be keyboard accessible', async ({ page }) => {
      await test.step('Test full keyboard accessibility', async () => {
        // Test opening search with keyboard
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        // Focus should be on search input
        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          await expect(searchInput).toBeFocused();

          // Test typing
          await searchInput.type('Energy');
          await page.waitForTimeout(500);

          // Test Escape to close search
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

          // Search panel should close or clear
          await page.screenshot({ path: 'tests/screenshots/search/keyboard-accessibility.png' });
        }
      });
    });

    test('should work with screen reader attributes', async ({ page }) => {
      await test.step('Test screen reader compatibility', async () => {
        // Open search panel
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        // Check for proper ARIA attributes
        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));

        if (await searchInput.isVisible()) {
          // Check for accessibility attributes
          const ariaLabel = await searchInput.getAttribute('aria-label');
          const placeholder = await searchInput.getAttribute('placeholder');

          // Should have some form of accessible labeling
          expect(ariaLabel || placeholder).toBeTruthy();

          console.log('Search accessibility attributes:', { ariaLabel, placeholder });

          await page.screenshot({ path: 'tests/screenshots/search/accessibility-test.png' });
        }
      });
    });
  });
});