const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Unified Menubar Validation Test Suite
 * Tests the SongNodes unified menubar design implementation
 */

class MenubarTestSuite {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      timestamp: new Date().toISOString(),
      testResults: {},
      screenshots: [],
      errors: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  async initialize() {
    console.log('🚀 Initializing Unified Menubar Test Suite...');

    // Launch browser with viewport settings
    this.browser = await chromium.launch({
      headless: false, // Set to true for CI/CD
      slowMo: 100 // Slow down for better observation
    });

    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });

    // Set up console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.results.errors.push(`Console Error: ${msg.text()}`);
      }
    });

    // Create screenshots directory
    const screenshotDir = path.join(__dirname, 'menubar-test-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  }

  async takeScreenshot(name, description) {
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(__dirname, 'menubar-test-screenshots', filename);

    await this.page.screenshot({
      path: filepath,
      fullPage: true
    });

    this.results.screenshots.push({
      name,
      description,
      filename,
      filepath
    });

    console.log(`📸 Screenshot captured: ${name}`);
  }

  async runTest(testName, testFn) {
    console.log(`\n🧪 Running test: ${testName}`);
    this.results.summary.totalTests++;

    try {
      const result = await testFn();
      this.results.testResults[testName] = {
        status: 'PASSED',
        result,
        timestamp: new Date().toISOString()
      };
      this.results.summary.passed++;
      console.log(`✅ ${testName}: PASSED`);
      return result;
    } catch (error) {
      this.results.testResults[testName] = {
        status: 'FAILED',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      this.results.summary.failed++;
      console.log(`❌ ${testName}: FAILED - ${error.message}`);
      return null;
    }
  }

  async addWarning(testName, message) {
    if (!this.results.testResults[testName]) {
      this.results.testResults[testName] = { warnings: [] };
    }
    if (!this.results.testResults[testName].warnings) {
      this.results.testResults[testName].warnings = [];
    }
    this.results.testResults[testName].warnings.push(message);
    this.results.summary.warnings++;
    console.log(`⚠️ ${testName}: WARNING - ${message}`);
  }

  async testPageLoad() {
    return this.runTest('Page Load', async () => {
      console.log('Navigating to http://localhost:3006...');
      await this.page.goto('http://localhost:3006', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for the main container to be present
      await this.page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

      // Take initial screenshot
      await this.takeScreenshot('01-page-loaded', 'Initial page load with unified menubar');

      return 'Page loaded successfully';
    });
  }

  async testMenubarStructure() {
    return this.runTest('Menubar Structure', async () => {
      // Check if menubar exists
      const menubar = await this.page.locator('nav.fixed.top-6').first();
      await menubar.waitFor({ timeout: 5000 });

      // Verify menubar container has proper styling
      const menubarContainer = menubar.locator('div.bg-gray-900\\/95').first();
      await menubarContainer.waitFor();

      // Check for rounded corners and proper styling
      const hasRoundedCorners = await menubarContainer.evaluate(el =>
        getComputedStyle(el).borderRadius !== '0px'
      );

      if (!hasRoundedCorners) {
        await this.addWarning('Menubar Structure', 'Menubar may not have rounded corners');
      }

      // Verify three main sections: logo, menu items, status
      const logoSection = await menubar.locator('div:has-text("SongNodes")').count();
      const menuButtons = await menubar.locator('button').count();
      const statusSection = await menubar.locator('div:has-text("Live")').count();

      if (logoSection === 0) throw new Error('Logo section not found');
      if (menuButtons < 4) throw new Error(`Expected 4 menu buttons, found ${menuButtons}`);
      if (statusSection === 0) throw new Error('Status section not found');

      await this.takeScreenshot('02-menubar-structure', 'Unified menubar structure verification');

      return {
        hasLogo: logoSection > 0,
        menuButtonCount: menuButtons,
        hasStatus: statusSection > 0,
        hasRoundedCorners
      };
    });
  }

  async testMenubarPositioning() {
    return this.runTest('Menubar Positioning', async () => {
      const menubar = await this.page.locator('nav.fixed.top-6').first();

      // Get initial position
      const initialBoundingBox = await menubar.boundingBox();
      if (!initialBoundingBox) throw new Error('Could not get menubar bounding box');

      // Verify menubar is centered horizontally
      const viewport = this.page.viewportSize();
      const menubarCenter = initialBoundingBox.x + (initialBoundingBox.width / 2);
      const viewportCenter = viewport.width / 2;
      const centerOffset = Math.abs(menubarCenter - viewportCenter);

      if (centerOffset > 10) {
        await this.addWarning('Menubar Positioning', `Menubar may not be perfectly centered (offset: ${centerOffset}px)`);
      }

      // Verify fixed positioning at top
      if (initialBoundingBox.y < 20 || initialBoundingBox.y > 30) {
        await this.addWarning('Menubar Positioning', `Menubar vertical position unexpected (y: ${initialBoundingBox.y}px)`);
      }

      await this.takeScreenshot('03-menubar-positioning', 'Menubar positioning verification');

      return {
        position: initialBoundingBox,
        isHorizontallyCentered: centerOffset <= 10,
        isProperlyPositioned: initialBoundingBox.y >= 20 && initialBoundingBox.y <= 30
      };
    });
  }

  async testDropdownBehavior() {
    return this.runTest('Dropdown Behavior', async () => {
      const menubar = await this.page.locator('nav.fixed.top-6').first();
      const results = {};

      // Test each dropdown button
      const buttons = [
        { name: 'Overview', color: 'blue', testId: 'overview' },
        { name: 'Legend', color: 'green', testId: 'legend' },
        { name: 'Search', color: 'yellow', testId: 'search' },
        { name: 'Functions', color: 'purple', testId: 'functions' }
      ];

      for (const button of buttons) {
        console.log(`Testing ${button.name} dropdown...`);

        // Get initial menubar position
        const initialPosition = await menubar.boundingBox();

        // Click the button
        const buttonElement = this.page.locator(`button:has-text("${button.name}")`);
        await buttonElement.click();

        // Wait for dropdown to appear
        await this.page.waitForTimeout(300);

        // Verify button highlight color
        const buttonBg = await buttonElement.evaluate(el =>
          getComputedStyle(el).backgroundColor
        );

        // Check if dropdown is visible
        const dropdowns = await this.page.locator('div.absolute.top-full').count();

        // Verify menubar position hasn't changed
        const newPosition = await menubar.boundingBox();
        const positionChanged = Math.abs(newPosition.x - initialPosition.x) > 2 ||
                               Math.abs(newPosition.y - initialPosition.y) > 2;

        // Take screenshot with dropdown open
        await this.takeScreenshot(
          `04-dropdown-${button.testId}`,
          `${button.name} dropdown open with highlighted button`
        );

        // Verify only one dropdown is open
        if (dropdowns !== 1) {
          await this.addWarning('Dropdown Behavior', `Expected 1 dropdown, found ${dropdowns} when ${button.name} clicked`);
        }

        if (positionChanged) {
          throw new Error(`Menubar position changed when ${button.name} dropdown opened`);
        }

        results[button.name] = {
          dropdownAppeared: dropdowns === 1,
          buttonHighlighted: buttonBg !== 'rgba(0, 0, 0, 0)',
          menubarStable: !positionChanged,
          backgroundColor: buttonBg
        };

        // Close dropdown by clicking outside
        await this.page.locator('body').click({ position: { x: 100, y: 100 } });
        await this.page.waitForTimeout(200);
      }

      return results;
    });
  }

  async testDropdownExclusivity() {
    return this.runTest('Dropdown Exclusivity', async () => {
      // Open Overview dropdown
      await this.page.locator('button:has-text("Overview")').click();
      await this.page.waitForTimeout(200);

      let dropdownCount = await this.page.locator('div.absolute.top-full').count();
      if (dropdownCount !== 1) {
        throw new Error(`Expected 1 dropdown after opening Overview, found ${dropdownCount}`);
      }

      // Click Legend button - should close Overview and open Legend
      await this.page.locator('button:has-text("Legend")').click();
      await this.page.waitForTimeout(200);

      dropdownCount = await this.page.locator('div.absolute.top-full').count();
      if (dropdownCount !== 1) {
        throw new Error(`Expected 1 dropdown after switching to Legend, found ${dropdownCount}`);
      }

      // Verify it's the Legend dropdown by checking content
      const legendContent = await this.page.locator('div.absolute.top-full:has-text("Node Types")').count();
      if (legendContent !== 1) {
        throw new Error('Legend dropdown content not found when Legend button clicked');
      }

      await this.takeScreenshot('05-dropdown-exclusivity', 'Only Legend dropdown open after switching');

      // Close by clicking outside
      await this.page.locator('body').click({ position: { x: 100, y: 100 } });
      await this.page.waitForTimeout(200);

      dropdownCount = await this.page.locator('div.absolute.top-full').count();
      if (dropdownCount !== 0) {
        throw new Error(`Expected 0 dropdowns after clicking outside, found ${dropdownCount}`);
      }

      return {
        exclusivityWorking: true,
        clickOutsideCloses: true
      };
    });
  }

  async testVisualFeedback() {
    return this.runTest('Visual Feedback', async () => {
      const results = {};
      const expectedColors = {
        'Overview': 'rgb(37, 99, 235)', // blue-600
        'Legend': 'rgb(22, 163, 74)',   // green-600
        'Search': 'rgb(202, 138, 4)',   // yellow-600
        'Functions': 'rgb(147, 51, 234)' // purple-600
      };

      for (const [buttonName, expectedColor] of Object.entries(expectedColors)) {
        // Click button
        const button = this.page.locator(`button:has-text("${buttonName}")`);
        await button.click();
        await this.page.waitForTimeout(200);

        // Get background color
        const actualColor = await button.evaluate(el =>
          getComputedStyle(el).backgroundColor
        );

        // Take screenshot
        await this.takeScreenshot(
          `06-visual-feedback-${buttonName.toLowerCase()}`,
          `${buttonName} button highlighted with ${expectedColor}`
        );

        results[buttonName] = {
          expectedColor,
          actualColor,
          colorMatches: actualColor === expectedColor
        };

        if (actualColor !== expectedColor) {
          await this.addWarning('Visual Feedback',
            `${buttonName} button color mismatch: expected ${expectedColor}, got ${actualColor}`);
        }

        // Close dropdown
        await this.page.locator('body').click({ position: { x: 100, y: 100 } });
        await this.page.waitForTimeout(200);
      }

      return results;
    });
  }

  async testProfessionalAppearance() {
    return this.runTest('Professional Appearance', async () => {
      const menubar = await this.page.locator('nav.fixed.top-6').first();
      const menubarContainer = menubar.locator('div.bg-gray-900\\/95').first();

      // Check styling properties
      const styles = await menubarContainer.evaluate(el => {
        const computed = getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          borderRadius: computed.borderRadius,
          backdropFilter: computed.backdropFilter,
          boxShadow: computed.boxShadow,
          border: computed.border
        };
      });

      // Check layout properties
      const layout = await menubarContainer.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const flexContainer = el.querySelector('.flex.items-center.justify-between');
        return {
          width: rect.width,
          height: rect.height,
          hasFlexLayout: !!flexContainer,
          minWidth: getComputedStyle(el).minWidth
        };
      });

      // Verify minimum width
      if (layout.width < 600) {
        await this.addWarning('Professional Appearance', `Menubar width ${layout.width}px may be too narrow`);
      }

      // Verify backdrop blur
      if (!styles.backdropFilter.includes('blur')) {
        await this.addWarning('Professional Appearance', 'Backdrop blur may not be applied');
      }

      await this.takeScreenshot('07-professional-appearance', 'Menubar professional appearance verification');

      return {
        styles,
        layout,
        hasProperStyling: styles.borderRadius !== '0px' && styles.backgroundColor.includes('rgba'),
        hasProperLayout: layout.hasFlexLayout && layout.width >= 600
      };
    });
  }

  async testResponsiveness() {
    return this.runTest('Responsiveness', async () => {
      const results = {};
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 1366, height: 768, name: 'Laptop' },
        { width: 1024, height: 768, name: 'Tablet' }
      ];

      for (const viewport of viewports) {
        await this.page.setViewportSize(viewport);
        await this.page.waitForTimeout(500);

        const menubar = await this.page.locator('nav.fixed.top-6').first();
        const boundingBox = await menubar.boundingBox();

        // Check if menubar is still centered
        const menubarCenter = boundingBox.x + (boundingBox.width / 2);
        const viewportCenter = viewport.width / 2;
        const centerOffset = Math.abs(menubarCenter - viewportCenter);

        await this.takeScreenshot(
          `08-responsive-${viewport.name.toLowerCase()}`,
          `Menubar on ${viewport.name} (${viewport.width}x${viewport.height})`
        );

        results[viewport.name] = {
          viewport,
          menubarPosition: boundingBox,
          isCentered: centerOffset <= 10,
          centerOffset
        };

        if (centerOffset > 10) {
          await this.addWarning('Responsiveness',
            `Menubar not centered on ${viewport.name} (offset: ${centerOffset}px)`);
        }
      }

      // Reset to original viewport
      await this.page.setViewportSize({ width: 1920, height: 1080 });

      return results;
    });
  }

  async testDataIntegration() {
    return this.runTest('Data Integration', async () => {
      // Open Overview dropdown
      await this.page.locator('button:has-text("Overview")').click();
      await this.page.waitForTimeout(500);

      // Check if node and edge counts are displayed
      const nodeCountElement = await this.page.locator('[data-testid="node-count"]');
      const edgeCountElement = await this.page.locator('[data-testid="edge-count"]');

      const nodeCount = await nodeCountElement.textContent();
      const edgeCount = await edgeCountElement.textContent();

      // Verify counts are numbers
      const nodeNum = parseInt(nodeCount.replace(/,/g, ''));
      const edgeNum = parseInt(edgeCount.replace(/,/g, ''));

      if (isNaN(nodeNum) || nodeNum < 0) {
        throw new Error(`Invalid node count: ${nodeCount}`);
      }

      if (isNaN(edgeNum) || edgeNum < 0) {
        throw new Error(`Invalid edge count: ${edgeCount}`);
      }

      await this.takeScreenshot('09-data-integration', 'Overview dropdown showing data counts');

      // Close dropdown
      await this.page.locator('body').click({ position: { x: 100, y: 100 } });

      return {
        nodeCount: nodeNum,
        edgeCount: edgeNum,
        hasValidData: nodeNum >= 0 && edgeNum >= 0
      };
    });
  }

  async generateReport() {
    console.log('\n📊 Generating comprehensive test report...');

    const report = {
      ...this.results,
      testSummary: {
        overallStatus: this.results.summary.failed === 0 ? 'PASSED' : 'FAILED',
        successRate: `${((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(1)}%`,
        ...this.results.summary
      },
      recommendations: [],
      criticalIssues: [],
      warnings: []
    };

    // Analyze results and generate recommendations
    Object.entries(this.results.testResults).forEach(([testName, result]) => {
      if (result.status === 'FAILED') {
        report.criticalIssues.push({
          test: testName,
          issue: result.error
        });
      }

      if (result.warnings) {
        result.warnings.forEach(warning => {
          report.warnings.push({
            test: testName,
            warning
          });
        });
      }
    });

    // Add specific recommendations based on test results
    if (report.criticalIssues.length === 0) {
      report.recommendations.push('✅ Unified menubar implementation meets all critical requirements');
    }

    if (report.warnings.length === 0) {
      report.recommendations.push('✅ No visual or functional warnings detected');
    } else {
      report.recommendations.push(`⚠️ Consider addressing ${report.warnings.length} warning(s) for optimal user experience`);
    }

    // Save report
    const reportPath = path.join(__dirname, 'unified-menubar-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📄 Test report saved to: ${reportPath}`);
    console.log(`📸 Screenshots saved to: ${path.join(__dirname, 'menubar-test-screenshots')}`);

    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAllTests() {
    try {
      await this.initialize();

      console.log('\n🎯 Starting Unified Menubar Validation Tests...\n');

      // Run all tests in sequence
      await this.testPageLoad();
      await this.testMenubarStructure();
      await this.testMenubarPositioning();
      await this.testDropdownBehavior();
      await this.testDropdownExclusivity();
      await this.testVisualFeedback();
      await this.testProfessionalAppearance();
      await this.testResponsiveness();
      await this.testDataIntegration();

      // Generate comprehensive report
      const report = await this.generateReport();

      // Print summary
      console.log('\n' + '='.repeat(80));
      console.log('🏁 UNIFIED MENUBAR TEST SUITE COMPLETE');
      console.log('='.repeat(80));
      console.log(`📊 Overall Status: ${report.testSummary.overallStatus}`);
      console.log(`✅ Tests Passed: ${report.testSummary.passed}/${report.testSummary.totalTests}`);
      console.log(`❌ Tests Failed: ${report.testSummary.failed}`);
      console.log(`⚠️ Warnings: ${report.testSummary.warnings}`);
      console.log(`📈 Success Rate: ${report.testSummary.successRate}`);

      if (report.criticalIssues.length > 0) {
        console.log('\n🚨 CRITICAL ISSUES:');
        report.criticalIssues.forEach(issue => {
          console.log(`   • ${issue.test}: ${issue.issue}`);
        });
      }

      if (report.warnings.length > 0) {
        console.log('\n⚠️ WARNINGS:');
        report.warnings.forEach(warning => {
          console.log(`   • ${warning.test}: ${warning.warning}`);
        });
      }

      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => {
        console.log(`   ${rec}`);
      });

      console.log('\n' + '='.repeat(80));

      return report;

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test suite
if (require.main === module) {
  const testSuite = new MenubarTestSuite();
  testSuite.runAllTests()
    .then(report => {
      process.exit(report.testSummary.overallStatus === 'PASSED' ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = MenubarTestSuite;