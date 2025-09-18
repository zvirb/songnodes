const puppeteer = require('puppeteer');
const fs = require('fs');

async function testMenubarAlignment() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });

        console.log('🔍 Testing menubar alignment at http://localhost:3006...');

        // Navigate to the app
        await page.goto('http://localhost:3006', { waitUntil: 'networkidle0', timeout: 10000 });

        // Wait for menubar to load
        await page.waitForSelector('.menubar, [class*="menubar"], header, nav', { timeout: 5000 });

        // Take screenshot
        await page.screenshot({
            path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/menubar-alignment-test.png',
            fullPage: false
        });

        // Check if elements are horizontally aligned
        const menubarInfo = await page.evaluate(() => {
            // Find the menubar container
            const menubar = document.querySelector('.menubar') ||
                           document.querySelector('[class*="menubar"]') ||
                           document.querySelector('header') ||
                           document.querySelector('nav') ||
                           document.querySelector('[class*="header"]');

            if (!menubar) {
                return { found: false, message: 'No menubar found' };
            }

            const rect = menubar.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(menubar);

            // Get all child elements
            const children = Array.from(menubar.children);
            const childrenInfo = children.map(child => {
                const childRect = child.getBoundingClientRect();
                return {
                    tagName: child.tagName,
                    className: child.className,
                    text: child.textContent?.trim().substring(0, 50),
                    top: childRect.top,
                    left: childRect.left,
                    height: childRect.height,
                    width: childRect.width
                };
            });

            return {
                found: true,
                className: menubar.className,
                display: computedStyle.display,
                flexDirection: computedStyle.flexDirection,
                justifyContent: computedStyle.justifyContent,
                alignItems: computedStyle.alignItems,
                position: computedStyle.position,
                top: computedStyle.top,
                left: computedStyle.left,
                width: rect.width,
                height: rect.height,
                children: childrenInfo
            };
        });

        console.log('📊 Menubar Analysis:');
        console.log(JSON.stringify(menubarInfo, null, 2));

        // Check if elements are horizontally aligned (same top position)
        if (menubarInfo.found && menubarInfo.children.length > 1) {
            const firstChildTop = menubarInfo.children[0].top;
            const isHorizontal = menubarInfo.children.every(child =>
                Math.abs(child.top - firstChildTop) < 5 // Allow 5px tolerance
            );

            console.log(`\n✅ RESULT: Menubar is ${isHorizontal ? 'HORIZONTALLY' : 'VERTICALLY'} aligned`);

            if (isHorizontal) {
                console.log('🎉 SUCCESS: Elements appear in a single horizontal line');
            } else {
                console.log('❌ ISSUE: Elements are still vertically stacked');
            }

            return isHorizontal;
        } else {
            console.log('❌ Could not determine alignment - insufficient elements found');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

testMenubarAlignment().then(result => {
    console.log(`\n🏁 Final Result: ${result ? 'PASS' : 'FAIL'}`);
    process.exit(result ? 0 : 1);
});