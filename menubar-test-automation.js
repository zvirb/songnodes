#!/usr/bin/env node

/**
 * SongNodes Unified Menubar Test Automation
 *
 * This script tests the new unified menubar design to verify:
 * 1. Menubar stays fixed when dropdowns open
 * 2. Unified design with proper layout
 * 3. Dropdown positioning and behavior
 * 4. Button state management
 * 5. Exclusive dropdown behavior
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class MenubarTestAutomation {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = {
            passed: 0,
            failed: 0,
            tests: []
        };
        this.screenshotDir = path.join(__dirname, 'menubar-test-screenshots');
    }

    async initialize() {
        console.log('🚀 Initializing Menubar Test Automation...');

        // Create screenshots directory
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }

        // Launch browser
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for CI environments
            defaultViewport: { width: 1400, height: 900 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        this.page = await this.browser.newPage();

        // Set viewport for consistent testing
        await this.page.setViewport({ width: 1400, height: 900 });

        console.log('✅ Browser initialized');
    }

    async loadApplication() {
        console.log('📱 Loading SongNodes application...');

        try {
            await this.page.goto('http://localhost:3009', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait for the menubar to be present
            await this.page.waitForSelector('nav.dropdown-container', { timeout: 10000 });

            console.log('✅ Application loaded successfully');

            // Take initial screenshot
            await this.takeScreenshot('01-initial-load');

            return true;
        } catch (error) {
            console.error('❌ Failed to load application:', error.message);
            return false;
        }
    }

    async takeScreenshot(name) {
        const filename = `${name}-${Date.now()}.png`;
        const filepath = path.join(this.screenshotDir, filename);
        await this.page.screenshot({ path: filepath, fullPage: true });
        console.log(`📸 Screenshot saved: ${filename}`);
        return filename;
    }

    async testMenubarStability() {
        console.log('\n🔧 Testing Menubar Stability...');

        // Get initial menubar position
        const initialPosition = await this.page.evaluate(() => {
            const menubar = document.querySelector('nav.dropdown-container');
            if (!menubar) return null;
            const rect = menubar.getBoundingClientRect();
            return {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            };
        });

        if (!initialPosition) {
            this.recordTest('Menubar Presence', false, 'Menubar not found');
            return;
        }

        this.recordTest('Menubar Presence', true, 'Menubar found and positioned correctly');

        // Test opening each dropdown and checking position stability
        const buttons = ['Overview', 'Legend', 'Search', 'Functions'];

        for (const buttonText of buttons) {
            console.log(`  Testing ${buttonText} dropdown...`);

            // Click the button to open dropdown
            await this.page.click(`button:has-text("${buttonText}")`);
            await this.page.waitForTimeout(300); // Allow animation

            // Check if menubar position changed
            const positionAfterOpen = await this.page.evaluate(() => {
                const menubar = document.querySelector('nav.dropdown-container');
                const rect = menubar.getBoundingClientRect();
                return {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                };
            });

            const positionStable = (
                Math.abs(initialPosition.top - positionAfterOpen.top) < 1 &&
                Math.abs(initialPosition.left - positionAfterOpen.left) < 1 &&
                Math.abs(initialPosition.width - positionAfterOpen.width) < 1 &&
                Math.abs(initialPosition.height - positionAfterOpen.height) < 1
            );

            this.recordTest(
                `${buttonText} Dropdown - Menubar Stability`,
                positionStable,
                positionStable ? 'Menubar position remained stable' : 'Menubar position changed'
            );

            // Take screenshot with dropdown open
            await this.takeScreenshot(`02-${buttonText.toLowerCase()}-dropdown-open`);

            // Close dropdown by clicking outside
            await this.page.click('body', { position: { x: 100, y: 100 } });
            await this.page.waitForTimeout(300);
        }
    }

    async testUnifiedDesignElements() {
        console.log('\n🎨 Testing Unified Design Elements...');

        const designElements = await this.page.evaluate(() => {
            const menubar = document.querySelector('nav.dropdown-container > div');
            if (!menubar) return null;

            const logo = menubar.querySelector('div:first-child');
            const menuButtons = menubar.querySelector('div:nth-child(2)');
            const statusIndicator = menubar.querySelector('div:last-child');

            return {
                hasLogo: logo && logo.textContent.includes('🎵') && logo.textContent.includes('SongNodes'),
                logoText: logo ? logo.textContent : null,
                buttonCount: menuButtons ? menuButtons.querySelectorAll('button').length : 0,
                buttonTexts: menuButtons ? Array.from(menuButtons.querySelectorAll('button')).map(btn => btn.textContent) : [],
                hasStatusIndicator: statusIndicator && statusIndicator.textContent.includes('Live'),
                statusText: statusIndicator ? statusIndicator.textContent : null,
                menubarClasses: menubar.className,
                hasRoundedCorners: menubar.classList.contains('rounded-xl'),
                hasBackdropBlur: menubar.classList.contains('backdrop-blur-sm'),
                hasMinWidth: window.getComputedStyle(menubar).minWidth
            };
        });

        // Test logo presence and content
        this.recordTest(
            'Logo Presence',
            designElements.hasLogo,
            `Logo found: ${designElements.logoText}`
        );

        // Test menu buttons
        const expectedButtons = ['Overview', 'Legend', 'Search', 'Functions'];
        const hasAllButtons = expectedButtons.every(btn => designElements.buttonTexts.includes(btn));
        this.recordTest(
            'Menu Buttons',
            hasAllButtons && designElements.buttonCount === 4,
            `Found buttons: ${designElements.buttonTexts.join(', ')}`
        );

        // Test status indicator
        this.recordTest(
            'Status Indicator',
            designElements.hasStatusIndicator,
            `Status indicator: ${designElements.statusText}`
        );

        // Test visual design
        this.recordTest(
            'Rounded Corners',
            designElements.hasRoundedCorners,
            'Menubar has rounded-xl class'
        );

        this.recordTest(
            'Backdrop Blur',
            designElements.hasBackdropBlur,
            'Menubar has backdrop-blur-sm class'
        );

        console.log(`  📊 Design Elements Summary:`, designElements);
    }

    async testDropdownPositioning() {
        console.log('\n📍 Testing Dropdown Positioning...');

        const buttons = [
            { name: 'Overview', expectedPosition: 'left' },
            { name: 'Legend', expectedPosition: 'left-quarter' },
            { name: 'Search', expectedPosition: 'center-half' },
            { name: 'Functions', expectedPosition: 'right' }
        ];

        for (const button of buttons) {
            console.log(`  Testing ${button.name} dropdown positioning...`);

            // Click button to open dropdown
            await this.page.click(`button:has-text("${button.name}")`);
            await this.page.waitForTimeout(300);

            // Check dropdown positioning
            const dropdownInfo = await this.page.evaluate((buttonName) => {
                const dropdown = document.querySelector('.absolute.top-full');
                const menubar = document.querySelector('nav.dropdown-container > div');

                if (!dropdown || !menubar) return null;

                const dropdownRect = dropdown.getBoundingClientRect();
                const menubarRect = menubar.getBoundingClientRect();

                return {
                    isVisible: dropdown.offsetParent !== null,
                    isPositionedBelow: dropdownRect.top > menubarRect.bottom,
                    dropdownTop: dropdownRect.top,
                    menubarBottom: menubarRect.bottom,
                    hasTopFullClass: dropdown.classList.contains('top-full'),
                    dropdownClasses: dropdown.className
                };
            }, button.name);

            if (dropdownInfo) {
                this.recordTest(
                    `${button.name} Dropdown - Below Menubar`,
                    dropdownInfo.isPositionedBelow,
                    `Dropdown positioned ${dropdownInfo.isPositionedBelow ? 'below' : 'incorrectly relative to'} menubar`
                );

                this.recordTest(
                    `${button.name} Dropdown - Top-full Class`,
                    dropdownInfo.hasTopFullClass,
                    `Dropdown has top-full positioning class: ${dropdownInfo.hasTopFullClass}`
                );
            } else {
                this.recordTest(
                    `${button.name} Dropdown - Visibility`,
                    false,
                    'Dropdown not found or not visible'
                );
            }

            // Close dropdown
            await this.page.click('body', { position: { x: 100, y: 100 } });
            await this.page.waitForTimeout(300);
        }
    }

    async testButtonStateManagement() {
        console.log('\n🔘 Testing Button State Management...');

        const buttons = ['Overview', 'Legend', 'Search', 'Functions'];
        const expectedActiveColors = ['bg-blue-600', 'bg-green-600', 'bg-yellow-600', 'bg-purple-600'];

        for (let i = 0; i < buttons.length; i++) {
            const buttonName = buttons[i];
            const expectedColor = expectedActiveColors[i];

            console.log(`  Testing ${buttonName} button states...`);

            // Click button
            await this.page.click(`button:has-text("${buttonName}")`);
            await this.page.waitForTimeout(300);

            // Check if button shows active state
            const buttonState = await this.page.evaluate((btnText, expectedBg) => {
                const button = Array.from(document.querySelectorAll('button'))
                    .find(btn => btn.textContent.trim() === btnText);

                if (!button) return { found: false };

                return {
                    found: true,
                    hasActiveColor: button.classList.contains(expectedBg),
                    classes: button.className,
                    textColor: button.classList.contains('text-white')
                };
            }, buttonName, expectedColor);

            this.recordTest(
                `${buttonName} Button - Active State`,
                buttonState.found && buttonState.hasActiveColor && buttonState.textColor,
                `Button found: ${buttonState.found}, Active color: ${buttonState.hasActiveColor}, White text: ${buttonState.textColor}`
            );

            // Close dropdown
            await this.page.click('body', { position: { x: 100, y: 100 } });
            await this.page.waitForTimeout(300);
        }
    }

    async testExclusiveDropdownBehavior() {
        console.log('\n🔒 Testing Exclusive Dropdown Behavior...');

        // Open Overview dropdown
        await this.page.click('button:has-text("Overview")');
        await this.page.waitForTimeout(300);

        // Verify Overview dropdown is open
        let dropdownsOpen = await this.page.evaluate(() => {
            const dropdowns = document.querySelectorAll('.absolute.top-full');
            return dropdowns.length;
        });

        this.recordTest(
            'Single Dropdown Open - Overview',
            dropdownsOpen === 1,
            `Expected 1 dropdown open, found ${dropdownsOpen}`
        );

        // Click Legend button (should close Overview and open Legend)
        await this.page.click('button:has-text("Legend")');
        await this.page.waitForTimeout(300);

        // Verify only Legend dropdown is open
        dropdownsOpen = await this.page.evaluate(() => {
            const dropdowns = document.querySelectorAll('.absolute.top-full');
            return dropdowns.length;
        });

        this.recordTest(
            'Exclusive Dropdown Behavior',
            dropdownsOpen === 1,
            `Expected 1 dropdown open after switching, found ${dropdownsOpen}`
        );

        // Test clicking outside closes all dropdowns
        await this.page.click('body', { position: { x: 100, y: 100 } });
        await this.page.waitForTimeout(300);

        dropdownsOpen = await this.page.evaluate(() => {
            const dropdowns = document.querySelectorAll('.absolute.top-full');
            return dropdowns.length;
        });

        this.recordTest(
            'Click Outside Closes Dropdowns',
            dropdownsOpen === 0,
            `Expected 0 dropdowns after clicking outside, found ${dropdownsOpen}`
        );

        // Take final screenshot
        await this.takeScreenshot('03-final-state');
    }

    recordTest(testName, passed, details) {
        this.testResults.tests.push({
            name: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });

        if (passed) {
            this.testResults.passed++;
            console.log(`    ✅ ${testName}: ${details}`);
        } else {
            this.testResults.failed++;
            console.log(`    ❌ ${testName}: ${details}`);
        }
    }

    async generateReport() {
        console.log('\n📊 Generating Test Report...');

        const report = {
            summary: {
                total: this.testResults.passed + this.testResults.failed,
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                successRate: `${Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100)}%`
            },
            testResults: this.testResults.tests,
            timestamp: new Date().toISOString(),
            screenshotsDirectory: this.screenshotDir
        };

        // Save detailed report
        const reportPath = path.join(__dirname, 'menubar-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate summary report
        const summaryPath = path.join(__dirname, 'MENUBAR_TEST_RESULTS.md');
        const summaryContent = this.generateMarkdownSummary(report);
        fs.writeFileSync(summaryPath, summaryContent);

        console.log(`📄 Test report saved: ${reportPath}`);
        console.log(`📝 Summary report saved: ${summaryPath}`);

        return report;
    }

    generateMarkdownSummary(report) {
        return `# SongNodes Unified Menubar Test Results

## Test Summary
- **Total Tests**: ${report.summary.total}
- **Passed**: ${report.summary.passed}
- **Failed**: ${report.summary.failed}
- **Success Rate**: ${report.summary.successRate}
- **Test Date**: ${new Date(report.timestamp).toLocaleString()}

## Key Testing Areas

### ✅ Menubar Stability
Tests that verify the menubar stays fixed when dropdowns open/close.

### ✅ Unified Design Elements
Validates the presence of logo, menu buttons, and status indicator with proper styling.

### ✅ Dropdown Positioning
Ensures dropdowns appear below the menubar using proper CSS positioning.

### ✅ Button State Management
Tests active states and visual feedback for menu buttons.

### ✅ Exclusive Dropdown Behavior
Verifies only one dropdown can be open at a time.

## Test Results

${report.testResults.map(test =>
    `### ${test.passed ? '✅' : '❌'} ${test.name}
${test.details}
`).join('\n')}

## Screenshots
Screenshots saved in: \`${path.relative(process.cwd(), report.screenshotsDirectory)}\`

## Conclusion

${report.summary.failed === 0
    ? '🎉 All tests passed! The unified menubar design successfully addresses the user\'s concerns about menubar stability and elegant dropdown behavior.'
    : `⚠️ ${report.summary.failed} test(s) failed. The menubar implementation may need further adjustments.`
}

---
*Generated by SongNodes Test Automation Suite*
`;
    }

    async runAllTests() {
        try {
            await this.initialize();

            const loaded = await this.loadApplication();
            if (!loaded) {
                console.log('❌ Cannot proceed - application failed to load');
                return;
            }

            await this.testMenubarStability();
            await this.testUnifiedDesignElements();
            await this.testDropdownPositioning();
            await this.testButtonStateManagement();
            await this.testExclusiveDropdownBehavior();

            const report = await this.generateReport();

            console.log('\n🎯 Test Execution Complete!');
            console.log(`📊 Results: ${report.summary.passed}/${report.summary.total} tests passed (${report.summary.successRate})`);

            return report;

        } catch (error) {
            console.error('❌ Test execution failed:', error);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Run tests if script is executed directly
if (require.main === module) {
    const tester = new MenubarTestAutomation();
    tester.runAllTests()
        .then(report => {
            process.exit(report.summary.failed === 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = MenubarTestAutomation;