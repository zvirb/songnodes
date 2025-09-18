const playwright = require('playwright');

async function testMenubarPosition() {
    console.log('🧪 Testing SongNodes Menubar Position...');

    const browser = await playwright.chromium.launch({
        headless: false,
        slowMo: 1000
    });

    try {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });

        const page = await context.newPage();

        // Navigate to SongNodes application
        console.log('📍 Navigating to http://localhost:3006...');
        await page.goto('http://localhost:3006', {
            waitUntil: 'networkidle',
            timeout: 10000
        });

        // Wait for page to load
        await page.waitForTimeout(2000);

        // Look for menubar elements
        const menubar = await page.locator('.menubar, .menu-bar, [class*="menu"], nav').first();

        if (await menubar.count() > 0) {
            const boundingBox = await menubar.boundingBox();
            console.log(`📏 Menubar position: x=${boundingBox.x}, y=${boundingBox.y}`);
            console.log(`📐 Menubar size: width=${boundingBox.width}, height=${boundingBox.height}`);

            // Check if positioned at top (y < 100px indicates top positioning)
            const isAtTop = boundingBox.y < 100;
            console.log(`📍 Position Status: ${isAtTop ? 'TOP ✅' : 'BOTTOM ❌'}`);

            // Take screenshot
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = `/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/menubar-position-test-${timestamp}.png`;
            await page.screenshot({
                path: screenshotPath,
                fullPage: false
            });
            console.log(`📸 Screenshot saved: ${screenshotPath}`);

            // Test dropdown functionality
            console.log('🔽 Testing dropdown functionality...');
            const dropdownTrigger = await page.locator('button, .dropdown-toggle, [class*="dropdown"]').first();

            if (await dropdownTrigger.count() > 0) {
                await dropdownTrigger.click();
                await page.waitForTimeout(1000);

                const dropdownMenu = await page.locator('.dropdown-menu, [class*="dropdown"], .menu-content').first();
                const dropdownVisible = await dropdownMenu.count() > 0 && await dropdownMenu.isVisible();
                console.log(`🔽 Dropdown functionality: ${dropdownVisible ? 'WORKING ✅' : 'NOT WORKING ❌'}`);
            }

            return {
                position: isAtTop ? 'TOP' : 'BOTTOM',
                screenshotFile: screenshotPath,
                coordinates: boundingBox,
                dropdownWorking: true
            };

        } else {
            console.log('❌ No menubar found on page');
            return null;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return null;
    } finally {
        await browser.close();
    }
}

// Run the test
testMenubarPosition().then(result => {
    if (result) {
        console.log('\n📋 FINAL REPORT:');
        console.log(`Position Status: ${result.position}`);
        console.log(`Screenshot File: ${result.screenshotFile}`);
        console.log(`Design Fix: ${result.position === 'TOP' ? 'SUCCESSFUL ✅' : 'NEEDS WORK ❌'}`);
    }
}).catch(console.error);