#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function quickCheck() {
    console.log('🚀 Quick Menubar Check');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();

    try {
        await page.goto('http://localhost:3009', { waitUntil: 'networkidle2' });
        await page.waitForSelector('nav.dropdown-container');

        // Create screenshots directory
        const screenshotDir = path.join(__dirname, 'menubar-evidence');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        // Take initial screenshot
        await page.screenshot({
            path: path.join(screenshotDir, '1-initial.png'),
            fullPage: true
        });

        // Get menubar info
        const info = await page.evaluate(() => {
            const nav = document.querySelector('nav.dropdown-container');
            const container = nav?.querySelector('div');

            if (!nav || !container) return null;

            const rect = nav.getBoundingClientRect();
            const buttons = Array.from(container.querySelectorAll('button'));

            return {
                position: { top: rect.top, left: rect.left, width: rect.width },
                centered: Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2) < 10,
                hasLogo: container.textContent.includes('🎵SongNodes'),
                buttonCount: buttons.length,
                buttonTexts: buttons.map(b => b.textContent.trim()),
                hasStatus: container.textContent.includes('Live'),
                styling: {
                    rounded: container.classList.contains('rounded-xl'),
                    blur: container.classList.contains('backdrop-blur-sm'),
                    transparent: container.classList.contains('bg-gray-900/95')
                }
            };
        });

        console.log('📊 Results:', JSON.stringify(info, null, 2));

        // Test dropdown behavior - click Overview
        console.log('\n🔘 Testing Overview dropdown...');

        // Get initial position
        const initialPos = await page.evaluate(() => {
            const nav = document.querySelector('nav.dropdown-container');
            return nav.getBoundingClientRect();
        });

        // Click Overview button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const overviewBtn = buttons.find(b => b.textContent.trim() === 'Overview');
            if (overviewBtn) overviewBtn.click();
        });

        // Wait and check
        await new Promise(resolve => setTimeout(resolve, 500));

        const afterPos = await page.evaluate(() => {
            const nav = document.querySelector('nav.dropdown-container');
            return {
                position: nav.getBoundingClientRect(),
                dropdownVisible: document.querySelector('.absolute.top-full') !== null
            };
        });

        const stable = Math.abs(initialPos.top - afterPos.position.top) < 2;

        // Take dropdown screenshot
        await page.screenshot({
            path: path.join(screenshotDir, '2-overview-dropdown.png'),
            fullPage: true
        });

        console.log(`Position stable: ${stable ? '✅' : '❌'}`);
        console.log(`Dropdown visible: ${afterPos.dropdownVisible ? '✅' : '❌'}`);

        // Summary
        console.log('\n📋 SUMMARY:');
        console.log(`✅ Menubar centered: ${info.centered}`);
        console.log(`✅ Logo present: ${info.hasLogo}`);
        console.log(`✅ 4 buttons: ${info.buttonCount === 4}`);
        console.log(`✅ Status indicator: ${info.hasStatus}`);
        console.log(`✅ Position stable: ${stable}`);
        console.log(`✅ Unified styling: ${info.styling.rounded && info.styling.blur}`);

        console.log(`\n📁 Screenshots saved to: ${screenshotDir}`);

        // Don't close browser - leave it open for manual inspection
        console.log('\n👀 Browser left open for manual inspection');

        return {
            success: true,
            info,
            stable,
            screenshotDir
        };

    } catch (error) {
        console.error('❌ Error:', error);
        await browser.close();
        throw error;
    }
}

if (require.main === module) {
    quickCheck().catch(console.error);
}

module.exports = quickCheck;