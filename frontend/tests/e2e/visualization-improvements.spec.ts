import { test, expect } from '@playwright/test';

test.describe('Graph Visualization Improvements Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await page.waitForLoadState('networkidle');

    // Wait for the graph container to be present
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 15000 });

    // Wait additional time for graph to render
    await page.waitForTimeout(3000);
  });

  test('should have thinner graph edges (lines)', async ({ page }) => {
    // Wait for SVG elements to be present (D3.js creates SVG)
    const svgElement = page.locator('svg').first();
    await expect(svgElement).toBeVisible();

    // Look for line elements (edges/links in D3.js)
    const lines = page.locator('svg line');

    // Verify lines exist
    const lineCount = await lines.count();
    expect(lineCount).toBeGreaterThan(0);
    console.log(`Found ${lineCount} graph edges/lines`);

    // Check stroke-width of the first few lines
    for (let i = 0; i < Math.min(5, lineCount); i++) {
      const line = lines.nth(i);
      const strokeWidth = await line.getAttribute('stroke-width');

      // Parse stroke width and verify it's thin (should be <= 3px based on our changes)
      const width = parseFloat(strokeWidth || '0');
      expect(width).toBeLessThanOrEqual(3);
      expect(width).toBeGreaterThan(0);

      console.log(`Line ${i}: stroke-width = ${strokeWidth}px`);
    }

    // Take screenshot to visually verify thin lines
    await page.screenshot({
      path: 'test-results/thin-lines-verification.png',
      fullPage: true
    });
  });

  test('should have text labels without borders (no stroke)', async ({ page }) => {
    // Wait for SVG elements
    const svgElement = page.locator('svg').first();
    await expect(svgElement).toBeVisible();

    // Look for text elements (node labels)
    const textElements = page.locator('svg text');

    // Verify text elements exist
    const textCount = await textElements.count();
    expect(textCount).toBeGreaterThan(0);
    console.log(`Found ${textCount} text labels`);

    // Check that text elements do NOT have stroke attributes
    for (let i = 0; i < Math.min(10, textCount); i++) {
      const textElement = textElements.nth(i);
      const stroke = await textElement.getAttribute('stroke');
      const strokeWidth = await textElement.getAttribute('stroke-width');

      // Text should not have stroke (borders) - should be null or empty
      expect(stroke).toBeOneOf([null, '', 'none']);
      expect(strokeWidth).toBeOneOf([null, '', '0']);

      // Verify text has fill color (should be white based on our code)
      const fill = await textElement.getAttribute('fill');
      expect(fill).toBeTruthy();

      console.log(`Text ${i}: stroke=${stroke}, stroke-width=${strokeWidth}, fill=${fill}`);
    }

    // Take screenshot to verify clean text appearance
    await page.screenshot({
      path: 'test-results/text-no-borders-verification.png',
      fullPage: true
    });
  });

  test('should display multi-line text with song titles and artists', async ({ page }) => {
    // Wait for SVG elements
    const svgElement = page.locator('svg').first();
    await expect(svgElement).toBeVisible();

    // Look for label groups (our new multi-line structure)
    const labelGroups = page.locator('svg g.label-group');

    // Verify label groups exist
    const groupCount = await labelGroups.count();
    expect(groupCount).toBeGreaterThan(0);
    console.log(`Found ${groupCount} label groups for multi-line text`);

    // Check a few label groups for multi-line text structure
    for (let i = 0; i < Math.min(5, groupCount); i++) {
      const group = labelGroups.nth(i);

      // Count text elements within this group
      const textsInGroup = group.locator('text');
      const textCount = await textsInGroup.count();

      console.log(`Label group ${i}: contains ${textCount} text elements`);

      // Verify each text element has proper positioning
      for (let j = 0; j < textCount; j++) {
        const textEl = textsInGroup.nth(j);
        const dy = await textEl.getAttribute('dy');
        const textContent = await textEl.textContent();
        const fontWeight = await textEl.getAttribute('font-weight');

        expect(dy).toBeTruthy(); // Should have vertical positioning
        expect(textContent).toBeTruthy(); // Should have content

        // Verify text length doesn't exceed 15 characters (our line wrap limit)
        if (textContent && textContent !== '---') {
          expect(textContent.length).toBeLessThanOrEqual(15);
        }

        console.log(`  Text ${j}: "${textContent}" (dy=${dy}, font-weight=${fontWeight})`);
      }
    }

    // Verify that some nodes show both title and artist information
    // by checking for the separator "---"
    const separatorTexts = page.locator('svg text', { hasText: '---' });
    const separatorCount = await separatorTexts.count();

    if (separatorCount > 0) {
      console.log(`Found ${separatorCount} nodes with title/artist separation`);
    }

    // Take screenshot to verify multi-line text display
    await page.screenshot({
      path: 'test-results/multi-line-text-verification.png',
      fullPage: true
    });
  });

  test('should verify text readability and line wrapping', async ({ page }) => {
    // Wait for the graph to load
    const svgElement = page.locator('svg').first();
    await expect(svgElement).toBeVisible();

    // Check for proper text attributes
    const textElements = page.locator('svg text');
    const textCount = await textElements.count();
    expect(textCount).toBeGreaterThan(0);

    // Verify font properties for readability
    for (let i = 0; i < Math.min(10, textCount); i++) {
      const textElement = textElements.nth(i);
      const fontSize = await textElement.getAttribute('font-size');
      const textAnchor = await textElement.getAttribute('text-anchor');
      const fill = await textElement.getAttribute('fill');
      const textContent = await textElement.textContent();

      // Verify font size is readable (should be 10px)
      expect(fontSize).toBe('10px');

      // Verify text is centered
      expect(textAnchor).toBe('middle');

      // Verify text has white color for visibility on dark background
      expect(fill).toBe('#FFFFFF');

      // Verify text content exists and respects line length limits
      if (textContent && textContent !== '---') {
        expect(textContent.length).toBeGreaterThan(0);
        expect(textContent.length).toBeLessThanOrEqual(15);
      }

      console.log(`Text readability check ${i}: "${textContent}" (${fontSize}, ${fill})`);
    }

    // Take final verification screenshot
    await page.screenshot({
      path: 'test-results/text-readability-verification.png',
      fullPage: true
    });
  });

  test('should maintain graph interactivity with improved visuals', async ({ page }) => {
    // Wait for the graph to load
    const svgElement = page.locator('svg').first();
    await expect(svgElement).toBeVisible();

    // Look for interactive elements (circles for nodes)
    const circles = page.locator('svg circle');
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThan(0);
    console.log(`Found ${circleCount} interactive nodes`);

    // Test hover interaction on a node
    if (circleCount > 0) {
      const firstCircle = circles.first();

      // Record initial state
      const initialStroke = await firstCircle.getAttribute('stroke');
      const initialStrokeWidth = await firstCircle.getAttribute('stroke-width');

      // Hover over the node
      await firstCircle.hover();
      await page.waitForTimeout(500);

      // Check if hover effects are applied
      const hoverStroke = await firstCircle.getAttribute('stroke');
      const hoverStrokeWidth = await firstCircle.getAttribute('stroke-width');

      console.log(`Hover effect: stroke changed from "${initialStroke}" to "${hoverStroke}"`);
      console.log(`Hover effect: stroke-width changed from "${initialStrokeWidth}" to "${hoverStrokeWidth}"`);

      // Click on the node
      await firstCircle.click();
      await page.waitForTimeout(500);

      // Take screenshot showing interaction
      await page.screenshot({
        path: 'test-results/interaction-with-improvements.png',
        fullPage: true
      });
    }
  });

  test('should generate comprehensive verification report', async ({ page }) => {
    const verificationResults = {
      timestamp: new Date().toISOString(),
      improvements: {
        thinnerLines: { verified: false, details: [] as string[] },
        removedTextBorders: { verified: false, details: [] as string[] },
        multiLineText: { verified: false, details: [] as string[] }
      },
      statistics: {
        totalNodes: 0,
        totalEdges: 0,
        totalTextElements: 0,
        totalLabelGroups: 0
      }
    };

    try {
      // Wait for graph to load
      const svgElement = page.locator('svg').first();
      await expect(svgElement).toBeVisible();

      // Check lines (edges)
      const lines = page.locator('svg line');
      const lineCount = await lines.count();
      verificationResults.statistics.totalEdges = lineCount;

      let thinLinesVerified = true;
      const lineDetails: string[] = [];

      for (let i = 0; i < Math.min(10, lineCount); i++) {
        const strokeWidth = await lines.nth(i).getAttribute('stroke-width');
        const width = parseFloat(strokeWidth || '0');
        lineDetails.push(`Line ${i}: ${width}px`);
        if (width > 3) thinLinesVerified = false;
      }

      verificationResults.improvements.thinnerLines.verified = thinLinesVerified;
      verificationResults.improvements.thinnerLines.details = lineDetails;

      // Check text elements
      const textElements = page.locator('svg text');
      const textCount = await textElements.count();
      verificationResults.statistics.totalTextElements = textCount;

      let textBordersRemoved = true;
      const textDetails: string[] = [];

      for (let i = 0; i < Math.min(10, textCount); i++) {
        const stroke = await textElements.nth(i).getAttribute('stroke');
        const strokeWidth = await textElements.nth(i).getAttribute('stroke-width');
        textDetails.push(`Text ${i}: stroke=${stroke}, stroke-width=${strokeWidth}`);
        if (stroke && stroke !== '' && stroke !== 'none') textBordersRemoved = false;
      }

      verificationResults.improvements.removedTextBorders.verified = textBordersRemoved;
      verificationResults.improvements.removedTextBorders.details = textDetails;

      // Check label groups
      const labelGroups = page.locator('svg g.label-group');
      const groupCount = await labelGroups.count();
      verificationResults.statistics.totalLabelGroups = groupCount;

      const multiLineDetails: string[] = [];
      const multiLineImplemented = groupCount > 0;

      for (let i = 0; i < Math.min(5, groupCount); i++) {
        const textsInGroup = labelGroups.nth(i).locator('text');
        const textCountInGroup = await textsInGroup.count();
        multiLineDetails.push(`Group ${i}: ${textCountInGroup} text elements`);
      }

      verificationResults.improvements.multiLineText.verified = multiLineImplemented;
      verificationResults.improvements.multiLineText.details = multiLineDetails;

      // Count total nodes (circles)
      const circles = page.locator('svg circle');
      verificationResults.statistics.totalNodes = await circles.count();

      // Save verification report
      await page.evaluate((results) => {
        console.log('📊 VERIFICATION REPORT:', JSON.stringify(results, null, 2));
      }, verificationResults);

      // Take final comprehensive screenshot
      await page.screenshot({
        path: 'test-results/comprehensive-verification.png',
        fullPage: true
      });

      // Verify all improvements are working
      expect(verificationResults.improvements.thinnerLines.verified).toBe(true);
      expect(verificationResults.improvements.removedTextBorders.verified).toBe(true);
      expect(verificationResults.improvements.multiLineText.verified).toBe(true);

      console.log('✅ All visualization improvements verified successfully!');

    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  });
});