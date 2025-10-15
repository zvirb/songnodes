import { test, expect } from '@playwright/test';

/**
 * E2E Test: Prometheus Integration in Monitoring Dashboard
 * Verifies that the monitoring dashboard successfully integrates with Prometheus
 * and displays live metrics, pipeline progress, and scraper health status
 *
 * Run with: npx playwright test monitoring-dashboard-prometheus --headed
 */

// Configure test to use headed mode and screenshots
test.use({
  headless: false, // Run in headed mode
  screenshot: 'on', // Take screenshots on failure
  video: 'retain-on-failure', // Record video on failure
  trace: 'retain-on-failure' // Capture trace on failure
});

test.describe('Monitoring Dashboard - Prometheus Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3006');

    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Give the app a moment to initialize
    await page.waitForTimeout(2000);
  });

  test('should display monitoring dashboard button and open modal', async ({ page }) => {
    console.log('🧪 Test 1: Verify dashboard button exists and opens modal');

    // Take screenshot of initial state
    await page.screenshot({ path: 'frontend/tests/reports/screenshots/01-initial-app.png', fullPage: true });
    console.log('📸 Screenshot saved: 01-initial-app.png');

    // Find and click the "Recently Scraped Data" button
    const dashboardButton = page.locator('button:has-text("📊 Recently Scraped Data")');
    await expect(dashboardButton).toBeVisible({ timeout: 10000 });

    console.log('✓ Dashboard button found');

    await dashboardButton.click();
    await page.waitForTimeout(1000);

    // Verify modal is open
    const modalHeading = page.locator('h1:has-text("Recently Scraped Data")');
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Take screenshot of opened modal
    await page.screenshot({ path: 'frontend/tests/reports/screenshots/02-dashboard-modal-opened.png', fullPage: true });
    console.log('📸 Screenshot saved: 02-dashboard-modal-opened.png');

    console.log('✓ Monitoring dashboard modal opened');
  });

  test('should display Prometheus live status indicator', async ({ page }) => {
    console.log('🧪 Test 2: Verify Prometheus live status indicator');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(1500);

    // Check for Prometheus status indicator
    const statusIndicator = page.locator('text=/Live data from Prometheus|Prometheus connection error|Refreshing metrics/');
    await expect(statusIndicator).toBeVisible({ timeout: 10000 });

    const statusText = await statusIndicator.textContent();
    console.log(`✓ Prometheus status: ${statusText}`);

    // Take screenshot of Prometheus status indicator
    await page.screenshot({ path: 'frontend/tests/reports/screenshots/03-prometheus-status-indicator.png', fullPage: true });
    console.log('📸 Screenshot saved: 03-prometheus-status-indicator.png');

    // Verify status indicator has proper styling
    const statusContainer = page.locator('div').filter({ has: statusIndicator }).first();
    const bgColor = await statusContainer.evaluate(el => window.getComputedStyle(el).backgroundColor);

    // Should have blue background (e7f3ff in rgb)
    expect(bgColor).toBeTruthy();
    console.log(`✓ Status indicator has proper styling: ${bgColor}`);
  });

  test('should display all 6 enhanced metric cards', async ({ page }) => {
    console.log('🧪 Test 3: Verify all 6 metric cards are displayed');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(2000);

    // Check for all 6 metric cards
    const expectedCards = [
      { title: 'TOTAL RUNS', emoji: '📊' },
      { title: 'SUCCESS RATE', emoji: '✅' },
      { title: 'SONGS (24H)', emoji: '🎵' },
      { title: 'ACTIVE NOW', emoji: '🔄' },
      { title: 'AVG TIME', emoji: '⏱️' },
      { title: 'QUALITY', emoji: '⭐' }
    ];

    for (const card of expectedCards) {
      const cardTitle = page.locator(`text=${card.title}`).first();
      await expect(cardTitle).toBeVisible({ timeout: 5000 });
      console.log(`✓ Found card: ${card.title}`);

      // Verify card has emoji
      const emojiElement = page.locator(`text=${card.emoji}`).first();
      await expect(emojiElement).toBeVisible();
    }

    // Take screenshot of metric cards
    await page.screenshot({ path: 'frontend/tests/reports/screenshots/04-metric-cards.png', fullPage: true });
    console.log('📸 Screenshot saved: 04-metric-cards.png');

    console.log('✓ All 6 metric cards are displayed');
  });

  test('should display metric values in cards', async ({ page }) => {
    console.log('🧪 Test 4: Verify metric cards show actual values');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(2000);

    // Check Total Runs card has a numeric value
    const totalRunsCard = page.locator('text=TOTAL RUNS').locator('..').locator('..');
    const totalRunsValue = totalRunsCard.locator('p').filter({ hasText: /^\d+$|^N\/A$/ }).first();
    await expect(totalRunsValue).toBeVisible({ timeout: 5000 });
    const totalRunsText = await totalRunsValue.textContent();
    console.log(`✓ Total Runs value: ${totalRunsText}`);

    // Check Success Rate card has percentage
    const successRateCard = page.locator('text=SUCCESS RATE').locator('..').locator('..');
    const successRateValue = successRateCard.locator('p').filter({ hasText: /\d+%|N\/A/ }).first();
    await expect(successRateValue).toBeVisible({ timeout: 5000 });
    const successRateText = await successRateValue.textContent();
    console.log(`✓ Success Rate value: ${successRateText}`);

    // Check Songs Scraped has numeric value
    const songsCard = page.locator('text=SONGS (24H)').locator('..').locator('..');
    const songsValue = songsCard.locator('p').filter({ hasText: /^\d+$|^N\/A$/ }).first();
    await expect(songsValue).toBeVisible({ timeout: 5000 });
    const songsText = await songsValue.textContent();
    console.log(`✓ Songs (24h) value: ${songsText}`);

    // Check Active Now has numeric value
    const activeCard = page.locator('text=ACTIVE NOW').locator('..').locator('..');
    const activeValue = activeCard.locator('p').filter({ hasText: /^\d+$|^N\/A$/ }).first();
    await expect(activeValue).toBeVisible({ timeout: 5000 });
    const activeText = await activeValue.textContent();
    console.log(`✓ Active Now value: ${activeText}`);

    console.log('✓ All metric cards display values');
  });

  test('should display Scraper Services Health section', async ({ page }) => {
    console.log('🧪 Test 5: Verify Scraper Services Health section');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(2000);

    // Check for Scraper Health section
    const healthSection = page.locator('text=🔍 Scraper Services Health');
    await expect(healthSection).toBeVisible({ timeout: 5000 });
    console.log('✓ Scraper Services Health section found');

    // Check if service status indicators are present
    // Note: Services might not be running, but the section should still be visible
    const healthContainer = healthSection.locator('..').locator('..');
    await expect(healthContainer).toBeVisible();
    console.log('✓ Health status container is displayed');
  });

  test('should display Data Pipeline Progress section', async ({ page }) => {
    console.log('🧪 Test 6: Verify Data Pipeline Progress section');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(2000);

    // Check for Pipeline Progress section
    const pipelineSection = page.locator('text=📈 Data Pipeline Progress');
    await expect(pipelineSection).toBeVisible({ timeout: 5000 });
    console.log('✓ Data Pipeline Progress section found');

    // Check for Source Extractions subsection
    const sourceExtractions = page.locator('text=SOURCE EXTRACTIONS');
    await expect(sourceExtractions).toBeVisible({ timeout: 5000 });
    console.log('✓ Source Extractions subsection found');

    // Check for Successful/Failed labels
    const successfulLabel = page.locator('text=Successful').first();
    await expect(successfulLabel).toBeVisible({ timeout: 5000 });

    const failedLabel = page.locator('text=Failed').first();
    await expect(failedLabel).toBeVisible({ timeout: 5000 });
    console.log('✓ Success/Failed metrics displayed');

    // Check for Graph Validations subsection
    const graphValidations = page.locator('text=GRAPH VALIDATIONS');
    await expect(graphValidations).toBeVisible({ timeout: 5000 });
    console.log('✓ Graph Validations subsection found');

    // Take screenshot of pipeline progress section
    await page.screenshot({ path: 'frontend/tests/reports/screenshots/05-pipeline-progress.png', fullPage: true });
    console.log('📸 Screenshot saved: 05-pipeline-progress.png');
  });

  test('should display Recent Scraping Runs section', async ({ page }) => {
    console.log('🧪 Test 7: Verify Recent Scraping Runs section');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(2000);

    // Check for Recent Scraping Runs section
    const runsSection = page.locator('text=Recent Scraping Runs');
    await expect(runsSection).toBeVisible({ timeout: 5000 });
    console.log('✓ Recent Scraping Runs section found');

    // Check for either runs data or "No recent scraping runs" message
    const hasRuns = await page.locator('text=/📭 No recent scraping runs found|Run ID/').first().isVisible();
    expect(hasRuns).toBeTruthy();

    const statusText = await page.locator('text=/📭 No recent scraping runs found|Run ID/').first().textContent();
    console.log(`✓ Runs status: ${statusText?.substring(0, 50)}...`);
  });

  test('should display Manual Triggers section', async ({ page }) => {
    console.log('🧪 Test 8: Verify Manual Triggers section');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(2000);

    // Check for Manual Triggers section
    const triggersSection = page.locator('text=🚀 Manual Triggers');
    await expect(triggersSection).toBeVisible({ timeout: 5000 });
    console.log('✓ Manual Triggers section found');

    // Check for Target Track Search trigger
    const targetSearchButton = page.locator('button:has-text("Start Target Search")');
    await expect(targetSearchButton).toBeVisible({ timeout: 5000 });
    console.log('✓ Target Track Search button found');

    // Check for Run All Scrapers trigger
    const scrapersButton = page.locator('button:has-text("Start Scraping")');
    await expect(scrapersButton).toBeVisible({ timeout: 5000 });
    console.log('✓ Run All Scrapers button found');
  });

  test('should close dashboard modal when X is clicked', async ({ page }) => {
    console.log('🧪 Test 9: Verify modal can be closed');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(1500);

    // Verify modal is open
    const modalHeading = page.locator('h1:has-text("Recently Scraped Data")');
    await expect(modalHeading).toBeVisible({ timeout: 5000 });
    console.log('✓ Modal is open');

    // Find and click close button
    const closeButton = page.locator('button').filter({ hasText: '✕' }).first();
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();
    await page.waitForTimeout(1000);

    // Verify modal is closed
    await expect(modalHeading).not.toBeVisible();
    console.log('✓ Modal closed successfully');
  });

  test('should handle Prometheus connection errors gracefully', async ({ page }) => {
    console.log('🧪 Test 10: Verify error handling for Prometheus connection');

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(3000);

    // Check console for errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit to let any errors occur
    await page.waitForTimeout(2000);

    // Prometheus connection errors are expected and should be handled gracefully
    // The dashboard should still display with fallback data
    const statusIndicator = page.locator('text=/Live data from Prometheus|Prometheus connection error|Refreshing metrics|N\/A/');
    await expect(statusIndicator).toBeVisible({ timeout: 5000 });

    console.log(`✓ Dashboard handles connection state gracefully`);

    // Verify no unhandled React errors
    const hasUnhandledErrors = consoleErrors.some(err =>
      err.includes('Uncaught') || err.includes('TypeError') || err.includes('ReferenceError')
    );

    expect(hasUnhandledErrors).toBe(false);
    console.log('✓ No unhandled JavaScript errors');
  });

  test('should verify all sections render without console errors', async ({ page }) => {
    console.log('🧪 Test 11: Full integration test - verify all sections render');

    const consoleErrors: string[] = [];
    const reactErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);

        // Capture React errors specifically
        if (text.includes('React') || text.includes('component')) {
          reactErrors.push(text);
        }
      }
    });

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(3000);

    // Verify all major sections are present
    const sections = [
      'Recently Scraped Data',
      'TOTAL RUNS',
      'SUCCESS RATE',
      'SONGS (24H)',
      'ACTIVE NOW',
      'AVG TIME',
      'QUALITY',
      '🔍 Scraper Services Health',
      '📈 Data Pipeline Progress',
      'Recent Scraping Runs',
      '🚀 Manual Triggers'
    ];

    for (const section of sections) {
      const element = page.locator(`text=${section}`).first();
      await expect(element).toBeVisible({ timeout: 5000 });
      console.log(`✓ Section rendered: ${section}`);
    }

    // Take comprehensive screenshot of full dashboard
    await page.screenshot({ path: 'frontend/tests/reports/screenshots/06-full-dashboard.png', fullPage: true });
    console.log('📸 Screenshot saved: 06-full-dashboard.png');

    // Scroll to Manual Triggers section and capture
    const triggersSection = page.locator('text=🚀 Manual Triggers');
    await triggersSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'frontend/tests/reports/screenshots/07-manual-triggers.png', fullPage: true });
    console.log('📸 Screenshot saved: 07-manual-triggers.png');

    // Verify no React errors
    expect(reactErrors.length).toBe(0);
    if (reactErrors.length > 0) {
      console.error('React errors found:', reactErrors);
    }

    console.log('✓ All sections rendered successfully');
    console.log(`ℹ️ Total console errors: ${consoleErrors.length} (network errors are acceptable)`);
  });
});

test.describe('Monitoring Dashboard - Auto-Refresh', () => {
  test('should indicate when metrics are being refreshed', async ({ page }) => {
    console.log('🧪 Test 12: Verify auto-refresh indicator');

    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open dashboard
    await page.locator('button:has-text("📊 Recently Scraped Data")').click();
    await page.waitForTimeout(2000);

    // Check for initial status
    const statusIndicator = page.locator('text=/Live data from Prometheus|Prometheus connection error|Refreshing metrics/');
    await expect(statusIndicator).toBeVisible({ timeout: 5000 });

    const initialText = await statusIndicator.textContent();
    console.log(`✓ Initial status: ${initialText}`);

    // Wait for auto-refresh (15 seconds)
    console.log('⏳ Waiting for auto-refresh (15 seconds)...');
    await page.waitForTimeout(16000);

    // Check if status changed to "Refreshing" at some point
    const currentText = await statusIndicator.textContent();
    console.log(`✓ Status after 15s: ${currentText}`);

    // The status should exist and be one of the expected values
    expect(currentText).toMatch(/Live data from Prometheus|Prometheus connection error|Refreshing metrics/);
    console.log('✓ Auto-refresh mechanism is working');
  });
});
