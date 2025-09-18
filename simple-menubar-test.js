#!/usr/bin/env node

/**
 * Simple SongNodes Menubar Test
 * Tests the unified menubar design with basic validation
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testMenubar() {
    console.log('🚀 Starting SongNodes Menubar Test...');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1400, height: 900 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });

        console.log('📱 Loading application...');
        await page.goto('http://localhost:3009', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for menubar to load
        await page.waitForSelector('nav.dropdown-container', { timeout: 10000 });
        console.log('✅ Application loaded, menubar found');

        // Take initial screenshot
        const screenshotDir = path.join(__dirname, 'menubar-screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        await page.screenshot({
            path: path.join(screenshotDir, '1-initial-load.png'),
            fullPage: true
        });
        console.log('📸 Initial screenshot taken');

        // Test menubar elements
        const menubarInfo = await page.evaluate(() => {
            const nav = document.querySelector('nav.dropdown-container');
            const menubar = nav?.querySelector('div');

            if (!menubar) return { error: 'Menubar container not found' };

            const logoSection = menubar.querySelector('div:first-child');
            const buttonsSection = menubar.querySelector('div:nth-child(2)');
            const statusSection = menubar.querySelector('div:last-child');

            const buttons = buttonsSection ? Array.from(buttonsSection.querySelectorAll('button')) : [];

            return {
                position: {
                    top: nav.getBoundingClientRect().top,
                    left: nav.getBoundingClientRect().left,
                    width: nav.getBoundingClientRect().width,
                    height: nav.getBoundingClientRect().height
                },
                hasLogo: logoSection?.textContent.includes('🎵') && logoSection?.textContent.includes('SongNodes'),
                logoText: logoSection?.textContent,
                buttonCount: buttons.length,
                buttonTexts: buttons.map(btn => btn.textContent.trim()),
                hasStatus: statusSection?.textContent.includes('Live'),
                statusText: statusSection?.textContent,
                styling: {
                    hasRoundedCorners: menubar.classList.contains('rounded-xl'),
                    hasBackdropBlur: menubar.classList.contains('backdrop-blur-sm'),
                    hasTransparentBg: menubar.classList.contains('bg-gray-900/95'),
                    hasMinWidth: window.getComputedStyle(menubar).minWidth
                }
            };
        });

        console.log('📊 Menubar Analysis:', menubarInfo);

        // Test button interactions
        const buttonTexts = ['Overview', 'Legend', 'Search', 'Functions'];

        for (const buttonText of buttonTexts) {
            console.log(`🔘 Testing ${buttonText} button...`);

            // Get initial position
            const initialPos = await page.evaluate(() => {
                const nav = document.querySelector('nav.dropdown-container');
                return nav.getBoundingClientRect();
            });

            // Find and click button
            const button = await page.evaluate((text) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const targetButton = buttons.find(btn => btn.textContent.trim() === text);
                if (targetButton) {
                    targetButton.click();
                    return { found: true, classes: targetButton.className };
                }
                return { found: false };
            }, buttonText);

            if (!button.found) {
                console.log(`  ❌ ${buttonText} button not found`);
                continue;
            }

            // Wait for dropdown
            await page.waitForTimeout(500);

            // Check position stability
            const newPos = await page.evaluate(() => {
                const nav = document.querySelector('nav.dropdown-container');
                return nav.getBoundingClientRect();
            });

            const positionStable = Math.abs(initialPos.top - newPos.top) < 2 &&
                                 Math.abs(initialPos.left - newPos.left) < 2;

            console.log(`  ${positionStable ? '✅' : '❌'} Position stable: ${positionStable}`);

            // Check for dropdown
            const dropdownVisible = await page.evaluate(() => {
                const dropdown = document.querySelector('.absolute.top-full');
                return dropdown !== null;
            });

            console.log(`  ${dropdownVisible ? '✅' : '❌'} Dropdown visible: ${dropdownVisible}`);

            // Take screenshot
            await page.screenshot({
                path: path.join(screenshotDir, `2-${buttonText.toLowerCase()}-open.png`),
                fullPage: true
            });

            // Close dropdown by clicking elsewhere
            await page.click('body', { position: { x: 100, y: 100 } });
            await page.waitForTimeout(300);
        }

        // Test exclusive dropdown behavior
        console.log('🔒 Testing exclusive dropdown behavior...');

        // Open Overview dropdown
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const overviewBtn = buttons.find(btn => btn.textContent.trim() === 'Overview');
            if (overviewBtn) overviewBtn.click();
        });
        await page.waitForTimeout(300);

        let dropdownCount = await page.evaluate(() => {
            return document.querySelectorAll('.absolute.top-full').length;
        });
        console.log(`  Overview opened - dropdowns visible: ${dropdownCount}`);

        // Open Legend dropdown (should close Overview)
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const legendBtn = buttons.find(btn => btn.textContent.trim() === 'Legend');
            if (legendBtn) legendBtn.click();
        });
        await page.waitForTimeout(300);

        dropdownCount = await page.evaluate(() => {
            return document.querySelectorAll('.absolute.top-full').length;
        });
        console.log(`  Legend opened - dropdowns visible: ${dropdownCount} (should be 1)`);

        // Take final screenshot
        await page.screenshot({
            path: path.join(screenshotDir, '3-final-state.png'),
            fullPage: true
        });

        // Generate simple report
        const report = {
            timestamp: new Date().toISOString(),
            menubarFound: menubarInfo.hasLogo && menubarInfo.hasStatus,
            unifiedDesign: menubarInfo.styling.hasRoundedCorners && menubarInfo.styling.hasBackdropBlur,
            buttonsFound: menubarInfo.buttonCount === 4,
            expectedButtons: buttonTexts.every(btn => menubarInfo.buttonTexts.includes(btn)),
            exclusiveBehavior: dropdownCount === 1,
            screenshotsPath: screenshotDir
        };

        const reportPath = path.join(__dirname, 'menubar-test-summary.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log('\n🎯 Test Summary:');
        console.log(`  ✅ Menubar Found: ${report.menubarFound}`);
        console.log(`  ✅ Unified Design: ${report.unifiedDesign}`);
        console.log(`  ✅ All Buttons Present: ${report.buttonsFound && report.expectedButtons}`);
        console.log(`  ✅ Exclusive Dropdowns: ${report.exclusiveBehavior}`);
        console.log(`  📁 Screenshots: ${screenshotDir}`);
        console.log(`  📄 Report: ${reportPath}`);

        return report;

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run test
if (require.main === module) {
    testMenubar()
        .then(report => {
            console.log('\n🎉 Test completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = testMenubar;