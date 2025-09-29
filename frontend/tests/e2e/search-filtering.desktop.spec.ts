import { test, expect } from '@playwright/test';

/**
 * Search & Filtering Tests
 * Testing TrackSearch.tsx, FilterPanel.tsx, and QuickSearch.tsx
 */
test.describe('Search & Filtering Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test('should display search components', async ({ page }) => {
    // Check for main search input
    const searchInput = page.locator('[data-testid="track-search-input"]');
    if (await searchInput.isVisible()) {
      await expect(searchInput).toHaveScreenshot('track-search-input.png');
    }

    // Check for quick search
    const quickSearch = page.locator('[data-testid="quick-search"]');
    if (await quickSearch.isVisible()) {
      await expect(quickSearch).toHaveScreenshot('quick-search-component.png');
    }

    // Check for filter panel
    const filterPanel = page.locator('[data-testid="filter-panel"]');
    if (await filterPanel.isVisible()) {
      await expect(filterPanel).toHaveScreenshot('filter-panel.png');
    }
  });

  test('should perform track search with autocomplete', async ({ page }) => {
    const searchInput = page.locator('[data-testid="track-search-input"]');

    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('test track');
      await page.waitForTimeout(500);
      await expect(searchInput).toHaveScreenshot('search-input-filled.png');

      // Check for autocomplete dropdown
      const autocomplete = page.locator('[data-testid="search-autocomplete"]');
      if (await autocomplete.isVisible()) {
        await expect(autocomplete).toHaveScreenshot('search-autocomplete-dropdown.png');

        // Click on first suggestion
        const firstSuggestion = autocomplete.locator('[data-testid="search-suggestion"]').first();
        if (await firstSuggestion.isVisible()) {
          await firstSuggestion.click();
          await page.waitForTimeout(1000);
          await expect(page).toHaveScreenshot('search-suggestion-selected.png');
        }
      }

      // Test clear search
      const clearButton = page.locator('[data-testid="clear-search-button"]');
      if (await clearButton.isVisible()) {
        await clearButton.click();
        await page.waitForTimeout(500);
        await expect(searchInput).toHaveValue('');
        await expect(page).toHaveScreenshot('search-cleared.png');
      }
    }
  });

  test('should use quick search for instant results', async ({ page }) => {
    const quickSearch = page.locator('[data-testid="quick-search-input"]');

    if (await quickSearch.isVisible()) {
      // Type in quick search
      await quickSearch.fill('quick');
      await page.waitForTimeout(300);

      // Check for instant results
      const quickResults = page.locator('[data-testid="quick-search-results"]');
      if (await quickResults.isVisible()) {
        await expect(quickResults).toHaveScreenshot('quick-search-results.png');
      }

      await expect(page).toHaveScreenshot('quick-search-active.png');
    }
  });

  test('should apply genre filters', async ({ page }) => {
    const genreFilter = page.locator('[data-testid="genre-filter-dropdown"]');

    if (await genreFilter.isVisible()) {
      // Open genre dropdown
      await genreFilter.click();
      await page.waitForTimeout(300);

      const genreOptions = page.locator('[data-testid="genre-option"]');
      if (await genreOptions.count() > 0) {
        await expect(page).toHaveScreenshot('genre-filter-open.png');

        // Select a genre
        await genreOptions.first().click();
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot('genre-filter-applied.png');
      }
    }
  });

  test('should use BPM range sliders', async ({ page }) => {
    const bpmSlider = page.locator('[data-testid="bpm-range-slider"]');

    if (await bpmSlider.isVisible()) {
      await expect(bpmSlider).toHaveScreenshot('bpm-slider-initial.png');

      // Interact with BPM slider
      const sliderHandle = bpmSlider.locator('.slider-handle').first();
      if (await sliderHandle.isVisible()) {
        // Drag slider to new position
        await sliderHandle.hover();
        await page.mouse.down();
        await page.mouse.move(100, 0);
        await page.mouse.up();

        await page.waitForTimeout(500);
        await expect(bpmSlider).toHaveScreenshot('bpm-slider-adjusted.png');
      }
    }
  });

  test('should use energy level slider', async ({ page }) => {
    const energySlider = page.locator('[data-testid="energy-level-slider"]');

    if (await energySlider.isVisible()) {
      await expect(energySlider).toHaveScreenshot('energy-slider-initial.png');

      // Adjust energy slider
      const sliderTrack = energySlider.locator('.slider-track');
      if (await sliderTrack.isVisible()) {
        // Click at 75% position
        const box = await sliderTrack.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
          await page.waitForTimeout(500);
          await expect(energySlider).toHaveScreenshot('energy-slider-adjusted.png');
        }
      }
    }
  });

  test('should filter by key signature', async ({ page }) => {
    const keyFilter = page.locator('[data-testid="key-signature-filter"]');

    if (await keyFilter.isVisible()) {
      await keyFilter.click();
      await page.waitForTimeout(300);

      const keyOptions = page.locator('[data-testid="key-option"]');
      if (await keyOptions.count() > 0) {
        await expect(page).toHaveScreenshot('key-filter-options.png');

        // Select a key
        await keyOptions.first().click();
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot('key-filter-applied.png');
      }
    }
  });

  test('should use year range picker', async ({ page }) => {
    const yearPicker = page.locator('[data-testid="year-range-picker"]');

    if (await yearPicker.isVisible()) {
      await expect(yearPicker).toHaveScreenshot('year-picker-initial.png');

      // Interact with year inputs
      const startYear = yearPicker.locator('[data-testid="start-year-input"]');
      const endYear = yearPicker.locator('[data-testid="end-year-input"]');

      if (await startYear.isVisible()) {
        await startYear.fill('2010');
        await page.waitForTimeout(300);
      }

      if (await endYear.isVisible()) {
        await endYear.fill('2020');
        await page.waitForTimeout(300);
      }

      await expect(yearPicker).toHaveScreenshot('year-picker-configured.png');
    }
  });

  test('should clear all filters', async ({ page }) => {
    const clearFiltersButton = page.locator('[data-testid="clear-filters-button"]');

    if (await clearFiltersButton.isVisible()) {
      // First apply some filters to have something to clear
      const genreFilter = page.locator('[data-testid="genre-filter-dropdown"]');
      if (await genreFilter.isVisible()) {
        await genreFilter.click();
        const firstOption = page.locator('[data-testid="genre-option"]').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
          await page.waitForTimeout(500);
        }
      }

      // Now clear all filters
      await clearFiltersButton.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('all-filters-cleared.png');
    }
  });

  test('should show search results in graph', async ({ page }) => {
    // Perform search
    const searchInput = page.locator('[data-testid="track-search-input"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      // Check if graph updates with search results
      const graphContainer = page.locator('[data-testid="graph-container"]');
      if (await graphContainer.isVisible()) {
        await expect(graphContainer).toHaveScreenshot('graph-with-search-results.png');
      }

      // Check for search highlighting
      const highlightedNodes = page.locator('[data-testid="highlighted-node"]');
      if (await highlightedNodes.count() > 0) {
        await expect(graphContainer).toHaveScreenshot('search-highlighted-nodes.png');
      }
    }
  });

  test('should combine multiple filters', async ({ page }) => {
    // Apply genre filter
    const genreFilter = page.locator('[data-testid="genre-filter-dropdown"]');
    if (await genreFilter.isVisible()) {
      await genreFilter.click();
      const genreOption = page.locator('[data-testid="genre-option"]').first();
      if (await genreOption.isVisible()) {
        await genreOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Apply energy filter
    const energySlider = page.locator('[data-testid="energy-level-slider"]');
    if (await energySlider.isVisible()) {
      const sliderTrack = energySlider.locator('.slider-track');
      if (await sliderTrack.isVisible()) {
        const box = await sliderTrack.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
          await page.waitForTimeout(500);
        }
      }
    }

    // Add search term
    const searchInput = page.locator('[data-testid="track-search-input"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('dance');
      await page.waitForTimeout(1000);
    }

    // Take screenshot of combined filters result
    await expect(page).toHaveScreenshot('combined-filters-applied.png');
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab through search elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Should be able to use search with keyboard
    await page.keyboard.type('search term');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('keyboard-search-entry.png');

    // Arrow keys should navigate autocomplete
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('keyboard-autocomplete-navigation.png');

    // Enter should select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('keyboard-selection-made.png');
  });

  test('should handle no search results', async ({ page }) => {
    const searchInput = page.locator('[data-testid="track-search-input"]');
    if (await searchInput.isVisible()) {
      // Search for something that likely won't exist
      await searchInput.fill('xyzabc123nonexistent');
      await page.waitForTimeout(1000);

      // Check for no results message
      const noResults = page.locator('[data-testid="no-search-results"]');
      if (await noResults.isVisible()) {
        await expect(noResults).toHaveScreenshot('no-search-results-message.png');
      }

      await expect(page).toHaveScreenshot('empty-search-results.png');
    }
  });
});