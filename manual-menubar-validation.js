#!/usr/bin/env node

/**
 * Manual Menubar Validation Script
 * Quick validation of menubar functionality for SongNodes
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function validateMenubar() {
    console.log('🔍 SongNodes Menubar Validation');
    console.log('================================');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1400, height: 900 }
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });

        console.log('\n📱 Loading SongNodes at http://localhost:3009...');
        await page.goto('http://localhost:3009', { waitUntil: 'networkidle2' });

        // Wait for menubar
        await page.waitForSelector('nav.dropdown-container');

        console.log('✅ Application loaded successfully');

        // Analyze menubar structure
        const analysis = await page.evaluate(() => {
            const nav = document.querySelector('nav.dropdown-container');
            const menubarContainer = nav?.querySelector('div');

            if (!nav || !menubarContainer) {
                return { error: 'Menubar not found' };
            }

            // Get position info
            const rect = nav.getBoundingClientRect();

            // Analyze sections
            const leftSection = menubarContainer.querySelector('div:first-child');
            const centerSection = menubarContainer.querySelector('div:nth-child(2)');
            const rightSection = menubarContainer.querySelector('div:last-child');

            const buttons = centerSection ? Array.from(centerSection.querySelectorAll('button')) : [];

            return {
                position: {
                    top: rect.top,
                    left: rect.left,
                    centerX: rect.left + rect.width / 2,
                    width: rect.width,
                    height: rect.height,
                    isTopCentered: Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2) < 10
                },
                structure: {
                    hasLogo: leftSection?.textContent.includes('🎵') && leftSection?.textContent.includes('SongNodes'),
                    logoContent: leftSection?.textContent.trim(),
                    buttonCount: buttons.length,
                    buttonNames: buttons.map(btn => btn.textContent.trim()),
                    hasStatus: rightSection?.textContent.includes('Live'),
                    statusContent: rightSection?.textContent.trim()
                },
                styling: {
                    hasRoundedCorners: menubarContainer.classList.contains('rounded-xl'),
                    hasTransparentBg: menubarContainer.classList.contains('bg-gray-900/95'),
                    hasBackdropBlur: menubarContainer.classList.contains('backdrop-blur-sm'),
                    hasBorder: menubarContainer.classList.contains('border'),
                    hasShadow: menubarContainer.classList.contains('shadow-2xl'),
                    minWidth: window.getComputedStyle(menubarContainer).minWidth,
                    className: menubarContainer.className
                }
            };
        });

        console.log('\n📊 MENUBAR ANALYSIS');
        console.log('==================');
        console.log(`Position: Top=${analysis.position.top}px, Centered=${analysis.position.isTopCentered}`);
        console.log(`Dimensions: ${analysis.position.width}x${analysis.position.height}px`);
        console.log(`Logo: ${analysis.structure.hasLogo ? '✅' : '❌'} "${analysis.structure.logoContent}"`);
        console.log(`Buttons: ${analysis.structure.buttonCount} found - ${analysis.structure.buttonNames.join(', ')}`);
        console.log(`Status: ${analysis.structure.hasStatus ? '✅' : '❌'} "${analysis.structure.statusContent}"`);
        console.log(`Styling: Rounded=${analysis.styling.hasRoundedCorners}, Blur=${analysis.styling.hasBackdropBlur}, Transparent=${analysis.styling.hasTransparentBg}`);

        // Test stability by clicking buttons
        console.log('\n🔧 STABILITY TEST');
        console.log('================');

        const initialPosition = analysis.position;

        for (const buttonName of analysis.structure.buttonNames) {
            console.log(`\nTesting ${buttonName} button:`);

            // Click button
            await page.evaluate((name) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const button = buttons.find(btn => btn.textContent.trim() === name);
                if (button) button.click();
            }, buttonName);

            // Wait a moment for dropdown
            await page.waitForTimeout(300);

            // Check position
            const newPosition = await page.evaluate(() => {
                const nav = document.querySelector('nav.dropdown-container');
                const rect = nav.getBoundingClientRect();
                return {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                };
            });

            // Check for dropdown
            const dropdownVisible = await page.evaluate(() => {
                return document.querySelector('.absolute.top-full') !== null;
            });

            const stable = Math.abs(initialPosition.top - newPosition.top) < 2 &&
                          Math.abs(initialPosition.left - newPosition.left) < 2;

            console.log(`  Position stable: ${stable ? '✅' : '❌'}`);
            console.log(`  Dropdown visible: ${dropdownVisible ? '✅' : '❌'}`);

            // Close dropdown
            await page.click('body', { position: { x: 100, y: 100 } });
            await page.waitForTimeout(200);
        }

        // Create screenshots directory
        const screenshotDir = path.join(__dirname, 'validation-screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        // Take final screenshot
        await page.screenshot({
            path: path.join(screenshotDir, 'menubar-validation.png'),
            fullPage: true
        });

        console.log('\n📸 Screenshot saved to:', path.join(screenshotDir, 'menubar-validation.png'));

        // Overall assessment
        const allTestsPassed =
            analysis.position.isTopCentered &&
            analysis.structure.hasLogo &&
            analysis.structure.buttonCount === 4 &&
            analysis.structure.hasStatus &&
            analysis.styling.hasRoundedCorners &&
            analysis.styling.hasBackdropBlur &&
            analysis.styling.hasTransparentBg;

        console.log('\n🎯 VALIDATION SUMMARY');
        console.log('====================');
        console.log(`Overall Result: ${allTestsPassed ? '✅ PASS' : '❌ NEEDS WORK'}`);
        console.log(`Unified Design: ${analysis.structure.hasLogo && analysis.structure.hasStatus ? '✅' : '❌'}`);
        console.log(`Proper Positioning: ${analysis.position.isTopCentered ? '✅' : '❌'}`);
        console.log(`Visual Styling: ${analysis.styling.hasRoundedCorners && analysis.styling.hasBackdropBlur ? '✅' : '❌'}`);

        return {
            success: allTestsPassed,
            analysis,
            screenshotPath: path.join(screenshotDir, 'menubar-validation.png')
        };

    } catch (error) {
        console.error('❌ Validation failed:', error);
        throw error;
    } finally {
        // Keep browser open for manual inspection
        console.log('\n👀 Browser kept open for manual inspection...');
        console.log('Press Ctrl+C to close when done');

        // Don't close browser automatically
        // await browser.close();
    }
}

if (require.main === module) {
    validateMenubar().catch(console.error);
}

module.exports = validateMenubar;