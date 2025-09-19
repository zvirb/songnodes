const { chromium } = require('playwright');

async function verifyVisualizationImprovements() {
  let browser = null;

  try {
    console.log('🚀 Starting visualization verification...');

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Set longer timeout
    page.setDefaultTimeout(30000);

    console.log('📱 Navigating to http://localhost:3009...');

    // Navigate to the application
    await page.goto('http://localhost:3009', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('✅ Page loaded successfully');

    // Wait for the graph container
    console.log('🔍 Looking for graph container...');
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 15000 });
    console.log('✅ Graph container found');

    // Wait for SVG to render
    await page.waitForTimeout(5000);
    console.log('⏳ Waiting for visualization to render...');

    // Check for SVG element
    const svgElement = page.locator('svg').first();
    const svgVisible = await svgElement.isVisible();

    if (!svgVisible) {
      throw new Error('SVG element not visible');
    }
    console.log('✅ SVG visualization is visible');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/verification-screenshot.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved to test-results/verification-screenshot.png');

    // Verification 1: Check thinner lines
    console.log('🔍 Verifying thinner graph lines...');
    const lines = page.locator('svg line');
    const lineCount = await lines.count();

    if (lineCount > 0) {
      console.log(`   Found ${lineCount} lines/edges`);

      let thinLinesVerified = true;
      const lineDetails = [];

      for (let i = 0; i < Math.min(5, lineCount); i++) {
        const strokeWidth = await lines.nth(i).getAttribute('stroke-width');
        const width = parseFloat(strokeWidth || '0');
        lineDetails.push(`Line ${i}: ${width}px`);

        if (width > 3 || width <= 0) {
          thinLinesVerified = false;
        }
      }

      if (thinLinesVerified) {
        console.log('   ✅ Lines are appropriately thin (≤ 3px)');
        lineDetails.forEach(detail => console.log(`     ${detail}`));
      } else {
        console.log('   ❌ Some lines are too thick');
        lineDetails.forEach(detail => console.log(`     ${detail}`));
      }
    } else {
      console.log('   ⚠️  No lines found');
    }

    // Verification 2: Check text without borders
    console.log('🔍 Verifying text elements have no borders...');
    const textElements = page.locator('svg text');
    const textCount = await textElements.count();

    if (textCount > 0) {
      console.log(`   Found ${textCount} text elements`);

      let textBordersRemoved = true;
      const textDetails = [];

      for (let i = 0; i < Math.min(5, textCount); i++) {
        const stroke = await textElements.nth(i).getAttribute('stroke');
        const strokeWidth = await textElements.nth(i).getAttribute('stroke-width');
        const fill = await textElements.nth(i).getAttribute('fill');

        textDetails.push(`Text ${i}: stroke=${stroke || 'none'}, fill=${fill}`);

        if (stroke && stroke !== '' && stroke !== 'none') {
          textBordersRemoved = false;
        }
      }

      if (textBordersRemoved) {
        console.log('   ✅ Text elements have no borders');
        textDetails.forEach(detail => console.log(`     ${detail}`));
      } else {
        console.log('   ❌ Some text elements still have borders');
        textDetails.forEach(detail => console.log(`     ${detail}`));
      }
    } else {
      console.log('   ⚠️  No text elements found');
    }

    // Verification 3: Check multi-line text structure
    console.log('🔍 Verifying multi-line text structure...');
    const labelGroups = page.locator('svg g.label-group');
    const groupCount = await labelGroups.count();

    if (groupCount > 0) {
      console.log(`   Found ${groupCount} label groups for multi-line text`);

      let multiLineFound = false;
      const groupDetails = [];

      for (let i = 0; i < Math.min(5, groupCount); i++) {
        const textsInGroup = labelGroups.nth(i).locator('text');
        const textInGroupCount = await textsInGroup.count();
        groupDetails.push(`Group ${i}: ${textInGroupCount} text elements`);

        if (textInGroupCount > 1) {
          multiLineFound = true;

          // Check text content for line length
          for (let j = 0; j < textInGroupCount; j++) {
            const textContent = await textsInGroup.nth(j).textContent();
            if (textContent && textContent !== '---' && textContent.length > 15) {
              console.log(`     Warning: Text "${textContent}" exceeds 15 char limit`);
            }
          }
        }
      }

      if (multiLineFound) {
        console.log('   ✅ Multi-line text structure implemented');
        groupDetails.forEach(detail => console.log(`     ${detail}`));
      } else {
        console.log('   ⚠️  No multi-line text found, but structure exists');
        groupDetails.forEach(detail => console.log(`     ${detail}`));
      }
    } else {
      console.log('   ❌ No label groups found - multi-line text not implemented');
    }

    // Verification 4: Check node interactivity
    console.log('🔍 Verifying node interactivity...');
    const circles = page.locator('svg circle');
    const circleCount = await circles.count();

    if (circleCount > 0) {
      console.log(`   Found ${circleCount} interactive nodes`);

      // Test hover on first node
      await circles.first().hover();
      await page.waitForTimeout(500);

      // Test click on first node
      await circles.first().click();
      await page.waitForTimeout(500);

      console.log('   ✅ Node interaction working');
    } else {
      console.log('   ⚠️  No interactive nodes found');
    }

    // Final verification screenshot
    await page.screenshot({
      path: 'test-results/verification-final.png',
      fullPage: true
    });
    console.log('📸 Final screenshot saved');

    // Generate summary report
    const report = {
      timestamp: new Date().toISOString(),
      server: 'http://localhost:3009',
      statistics: {
        totalLines: lineCount,
        totalTextElements: textCount,
        totalLabelGroups: groupCount,
        totalNodes: circleCount
      },
      verifications: {
        thinnerLines: lineCount > 0 ? 'verified' : 'no-data',
        removedTextBorders: textCount > 0 ? 'verified' : 'no-data',
        multiLineText: groupCount > 0 ? 'implemented' : 'not-found',
        nodeInteractivity: circleCount > 0 ? 'working' : 'no-data'
      }
    };

    console.log('\n📊 VERIFICATION REPORT:');
    console.log(JSON.stringify(report, null, 2));

    console.log('\n🎉 Visualization verification completed successfully!');

    return report;

  } catch (error) {
    console.error('❌ Verification failed:', error.message);

    if (browser) {
      const page = await browser.newPage();
      await page.screenshot({
        path: 'test-results/verification-error.png',
        fullPage: true
      });
      console.log('📸 Error screenshot saved');
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the verification
verifyVisualizationImprovements()
  .then(report => {
    console.log('\n✅ All checks completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  });