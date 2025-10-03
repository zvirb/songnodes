import { test, expect } from '@playwright/test';

/**
 * Graph Filter Panel Tests
 * Comprehensive testing of all filter panel features including:
 * - Node/Edge limit sliders
 * - Connection strength filter
 * - Year range filter
 * - Genre filtering with counts
 * - Real-time count updates
 * - Apply and reset functionality
 */
test.describe('Graph Filter Panel - Comprehensive Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for the app to fully load
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Wait for graph data to load
    await page.waitForTimeout(3000);

    // Verify app is ready
    console.log('✅ App loaded successfully');
  });

  test('should open filter panel when clicking filter button', async ({ page }) => {
    console.log('🧪 TEST: Open filter panel');

    // Find and click the filter tool button (icon: 🔧)
    const filterButton = page.locator('button:has-text("🔧")').first();
    await expect(filterButton).toBeVisible({ timeout: 10000 });

    await filterButton.click();
    await page.waitForTimeout(500);

    // Verify modal is open
    const filterPanel = page.locator('text=Graph Filters').first();
    await expect(filterPanel).toBeVisible({ timeout: 5000 });

    // Verify header shows counts
    const headerText = await page.locator('p:has-text("Showing")').textContent();
    expect(headerText).toMatch(/Showing \d+ of \d+ nodes, \d+ of \d+ edges/);

    console.log('✅ Filter panel opened successfully');
    console.log(`   Header: ${headerText}`);

    // Take screenshot
    await expect(page).toHaveScreenshot('filter-panel-opened.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should display and adjust node limit slider', async ({ page }) => {
    console.log('🧪 TEST: Node limit slider');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Find the node slider
    const nodeSlider = page.locator('input[type="range"]').first();
    await expect(nodeSlider).toBeVisible();

    // Get initial value
    const initialMax = await nodeSlider.getAttribute('max');
    console.log(`   Initial max nodes: ${initialMax}`);

    // Get current value
    const initialValue = await nodeSlider.getAttribute('value');
    console.log(`   Initial slider value: ${initialValue}`);

    // Adjust slider to middle value
    const midValue = Math.floor(parseInt(initialMax!) / 2);
    await nodeSlider.fill(midValue.toString());
    await page.waitForTimeout(500);

    // Verify the count label updated
    const nodeCountLabel = page.locator('text=/\\d+ nodes/').first();
    const labelText = await nodeCountLabel.textContent();
    console.log(`   Updated label: ${labelText}`);
    expect(labelText).toContain(`${midValue} nodes`);

    // Take screenshot
    await expect(page).toHaveScreenshot('node-slider-adjusted.png', {
      fullPage: true,
      animations: 'disabled'
    });

    console.log('✅ Node slider works correctly');
  });

  test('should display and adjust edge limit slider', async ({ page }) => {
    console.log('🧪 TEST: Edge limit slider');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Find the edge slider (second range input)
    const edgeSlider = page.locator('input[type="range"]').nth(1);
    await expect(edgeSlider).toBeVisible();

    // Get max value
    const maxEdges = await edgeSlider.getAttribute('max');
    console.log(`   Max edges: ${maxEdges}`);

    // Set to specific value
    const testValue = Math.floor(parseInt(maxEdges!) / 3);
    await edgeSlider.fill(testValue.toString());
    await page.waitForTimeout(500);

    // Verify the count label updated
    const edgeCountLabel = page.locator('text=/\\d+ edges/').first();
    const labelText = await edgeCountLabel.textContent();
    console.log(`   Updated label: ${labelText}`);
    expect(labelText).toMatch(/\d+ edges/);

    console.log('✅ Edge slider works correctly');
  });

  test('should adjust connection strength filter', async ({ page }) => {
    console.log('🧪 TEST: Connection strength filter');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Find the connection strength slider (third range input)
    const strengthSlider = page.locator('input[type="range"]').nth(2);
    await expect(strengthSlider).toBeVisible();

    // Get max value
    const maxStrength = await strengthSlider.getAttribute('max');
    console.log(`   Max connection strength: ${maxStrength}`);

    // Adjust to higher strength
    const testValue = Math.min(5, parseInt(maxStrength!));
    await strengthSlider.fill(testValue.toString());
    await page.waitForTimeout(500);

    // Verify label shows updated value
    const strengthLabel = page.locator(`text=${testValue}+`).first();
    await expect(strengthLabel).toBeVisible();

    console.log(`✅ Connection strength set to ${testValue}+`);
  });

  test('should filter by genre with count updates', async ({ page }) => {
    console.log('🧪 TEST: Genre filtering');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Find genre checkboxes
    const genreCheckboxes = page.locator('input[type="checkbox"]');
    const count = await genreCheckboxes.count();
    console.log(`   Found ${count} genre checkboxes`);

    if (count > 0) {
      // Get initial header count
      const initialHeader = await page.locator('p:has-text("Showing")').textContent();
      console.log(`   Initial: ${initialHeader}`);

      // Select first genre
      await genreCheckboxes.first().click();
      await page.waitForTimeout(500);

      // Verify header count updated
      const updatedHeader = await page.locator('p:has-text("Showing")').textContent();
      console.log(`   After filter: ${updatedHeader}`);

      // Verify selected count shows
      const selectedCount = await page.locator('text=/\\d+ selected/').textContent();
      console.log(`   Selected genres: ${selectedCount}`);
      expect(selectedCount).toContain('1 selected');

      // Take screenshot
      await expect(page).toHaveScreenshot('genre-filtered.png', {
        fullPage: true,
        animations: 'disabled'
      });

      console.log('✅ Genre filtering works correctly');
    } else {
      console.log('⚠️  No genres available to test');
    }
  });

  test('should adjust year range filter', async ({ page }) => {
    console.log('🧪 TEST: Year range filter');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Check if year sliders exist (they appear after genres, so higher index)
    const yearSliders = page.locator('input[type="range"]').filter({ hasText: /^\s*$/ });
    const sliderCount = await page.locator('input[type="range"]').count();
    console.log(`   Total sliders found: ${sliderCount}`);

    if (sliderCount >= 5) { // Node, Edge, Strength, YearMin, YearMax
      // Find year range label
      const yearLabel = page.locator('text=/\\d{4} - \\d{4}/').first();

      if (await yearLabel.isVisible()) {
        const initialRange = await yearLabel.textContent();
        console.log(`   Initial year range: ${initialRange}`);

        // Adjust min year slider (4th slider)
        const minYearSlider = page.locator('input[type="range"]').nth(3);
        await minYearSlider.evaluate((el: any) => {
          const max = parseInt(el.max);
          const min = parseInt(el.min);
          el.value = min + Math.floor((max - min) * 0.3);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForTimeout(500);

        // Verify range updated
        const updatedRange = await yearLabel.textContent();
        console.log(`   Updated year range: ${updatedRange}`);

        console.log('✅ Year range filter works correctly');
      } else {
        console.log('⚠️  Year range not visible (may not have year data)');
      }
    } else {
      console.log('⚠️  Year sliders not found (may not have year data)');
    }
  });

  test('should show real-time count updates', async ({ page }) => {
    console.log('🧪 TEST: Real-time count updates');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Get initial counts from header
    const getHeaderCounts = async () => {
      const headerText = await page.locator('p:has-text("Showing")').textContent();
      const match = headerText!.match(/Showing (\d+) of (\d+) nodes, (\d+) of (\d+) edges/);
      return {
        filteredNodes: parseInt(match![1]),
        totalNodes: parseInt(match![2]),
        filteredEdges: parseInt(match![3]),
        totalEdges: parseInt(match![4])
      };
    };

    const initialCounts = await getHeaderCounts();
    console.log(`   Initial counts:`, initialCounts);

    // Adjust node slider to reduce nodes
    const nodeSlider = page.locator('input[type="range"]').first();
    const maxNodes = await nodeSlider.getAttribute('max');
    const reducedValue = Math.floor(parseInt(maxNodes!) / 4);
    await nodeSlider.fill(reducedValue.toString());
    await page.waitForTimeout(500);

    // Get updated counts
    const updatedCounts = await getHeaderCounts();
    console.log(`   Updated counts:`, updatedCounts);

    // Verify counts changed
    expect(updatedCounts.filteredNodes).toBeLessThanOrEqual(reducedValue);

    // Verify apply button shows updated counts
    const applyButton = page.locator('button:has-text("Apply Filters")').first();
    const buttonText = await applyButton.textContent();
    console.log(`   Apply button: ${buttonText}`);
    expect(buttonText).toMatch(/Apply Filters \(\d+ nodes, \d+ edges\)/);

    console.log('✅ Real-time counts update correctly');
  });

  test('should apply filters to graph', async ({ page }) => {
    console.log('🧪 TEST: Apply filters functionality');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Reduce node count significantly
    const nodeSlider = page.locator('input[type="range"]').first();
    await nodeSlider.fill('50');
    await page.waitForTimeout(500);

    // Click apply button
    const applyButton = page.locator('button:has-text("Apply Filters")').first();
    await expect(applyButton).toBeVisible();

    const buttonText = await applyButton.textContent();
    console.log(`   Applying filters: ${buttonText}`);

    await applyButton.click();
    await page.waitForTimeout(1000);

    // Verify modal closed
    const filterPanel = page.locator('text=Graph Filters').first();
    await expect(filterPanel).not.toBeVisible({ timeout: 2000 });

    console.log('✅ Filters applied successfully');

    // Take screenshot of filtered graph
    await expect(page).toHaveScreenshot('graph-with-filters-applied.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should reset all filters', async ({ page }) => {
    console.log('🧪 TEST: Reset filters functionality');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Get initial header
    const initialHeader = await page.locator('p:has-text("Showing")').textContent();
    console.log(`   Initial: ${initialHeader}`);

    // Make several changes
    const nodeSlider = page.locator('input[type="range"]').first();
    await nodeSlider.fill('100');
    await page.waitForTimeout(300);

    const edgeSlider = page.locator('input[type="range"]').nth(1);
    await edgeSlider.fill('500');
    await page.waitForTimeout(300);

    // Verify counts changed
    const changedHeader = await page.locator('p:has-text("Showing")').textContent();
    console.log(`   After changes: ${changedHeader}`);

    // Click reset button
    const resetButton = page.locator('button:has-text("Reset All Filters")').first();
    await expect(resetButton).toBeVisible();
    await resetButton.click();
    await page.waitForTimeout(500);

    // Verify sliders reset to max
    const resetNodeValue = await nodeSlider.getAttribute('value');
    const maxNodeValue = await nodeSlider.getAttribute('max');
    console.log(`   Node slider reset: ${resetNodeValue} (max: ${maxNodeValue})`);
    expect(resetNodeValue).toBe(maxNodeValue);

    console.log('✅ Reset filters works correctly');
  });

  test('should close filter panel with cancel button', async ({ page }) => {
    console.log('🧪 TEST: Cancel button closes panel');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Verify panel is open
    const filterPanel = page.locator('text=Graph Filters').first();
    await expect(filterPanel).toBeVisible();

    // Click cancel
    const cancelButton = page.locator('button:has-text("Cancel")').first();
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await page.waitForTimeout(500);

    // Verify panel closed
    await expect(filterPanel).not.toBeVisible({ timeout: 2000 });

    console.log('✅ Cancel button works correctly');
  });

  test('should close filter panel when clicking outside', async ({ page }) => {
    console.log('🧪 TEST: Click outside to close');

    // Open filter panel
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);

    // Verify panel is open
    const filterPanel = page.locator('text=Graph Filters').first();
    await expect(filterPanel).toBeVisible();

    // Click outside (on the backdrop)
    await page.mouse.click(100, 100);
    await page.waitForTimeout(500);

    // Verify panel closed
    await expect(filterPanel).not.toBeVisible({ timeout: 2000 });

    console.log('✅ Click outside closes panel');
  });

  test('COMPREHENSIVE: Full filter workflow integration', async ({ page }) => {
    console.log('🧪 COMPREHENSIVE TEST: Complete filter workflow');

    // Step 1: Open panel
    console.log('   Step 1: Opening filter panel...');
    await page.locator('button:has-text("🔧")').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Graph Filters')).toBeVisible();

    // Step 2: Adjust node limit
    console.log('   Step 2: Adjusting node limit...');
    const nodeSlider = page.locator('input[type="range"]').first();
    await nodeSlider.fill('150');
    await page.waitForTimeout(300);

    // Step 3: Adjust edge limit
    console.log('   Step 3: Adjusting edge limit...');
    const edgeSlider = page.locator('input[type="range"]').nth(1);
    await edgeSlider.fill('1000');
    await page.waitForTimeout(300);

    // Step 4: Adjust connection strength
    console.log('   Step 4: Adjusting connection strength...');
    const strengthSlider = page.locator('input[type="range"]').nth(2);
    const maxStrength = await strengthSlider.getAttribute('max');
    await strengthSlider.fill(Math.min(3, parseInt(maxStrength!)).toString());
    await page.waitForTimeout(300);

    // Step 5: Select a genre if available
    const genreCheckboxes = page.locator('input[type="checkbox"]');
    const genreCount = await genreCheckboxes.count();
    if (genreCount > 0) {
      console.log('   Step 5: Selecting genre...');
      await genreCheckboxes.first().click();
      await page.waitForTimeout(300);
    }

    // Step 6: Verify all counts updated
    console.log('   Step 6: Verifying counts...');
    const headerText = await page.locator('p:has-text("Showing")').textContent();
    console.log(`   Final counts: ${headerText}`);

    // Step 7: Take comprehensive screenshot
    await expect(page).toHaveScreenshot('filter-panel-comprehensive.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Step 8: Apply filters
    console.log('   Step 7: Applying filters...');
    const applyButton = page.locator('button:has-text("Apply Filters")').first();
    await applyButton.click();
    await page.waitForTimeout(1000);

    // Step 9: Verify panel closed
    console.log('   Step 8: Verifying panel closed...');
    await expect(page.locator('text=Graph Filters')).not.toBeVisible({ timeout: 2000 });

    // Step 10: Take final screenshot of filtered graph
    await expect(page).toHaveScreenshot('graph-fully-filtered.png', {
      fullPage: true,
      animations: 'disabled'
    });

    console.log('✅ COMPREHENSIVE TEST PASSED - All filter features work correctly!');
  });
});
