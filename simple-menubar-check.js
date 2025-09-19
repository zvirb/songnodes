const puppeteer = require('puppeteer');

async function quickMenubarCheck() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });

        console.log('🔍 Quick menubar check at http://localhost:3006...');

        // Navigate and wait longer
        await page.goto('http://localhost:3006', { waitUntil: 'networkidle0', timeout: 15000 });

        // Wait for React app to load
        await page.waitForTimeout(3000);

        // Take screenshot first
        await page.screenshot({
            path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/current-menubar-check.png',
            fullPage: false
        });

        // Look for any navigation or header elements
        const menubarCheck = await page.evaluate(() => {
            // Look for common navigation patterns
            const selectors = [
                '.menubar', '[class*="menubar"]', '[class*="nav"]',
                'header', 'nav', '[class*="header"]', '[class*="top"]',
                '[data-testid*="nav"]', '[data-testid*="menu"]'
            ];

            let foundElement = null;
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    foundElement = el;
                    break;
                }
            }

            if (!foundElement) {
                // Look for text that might be the menubar
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    const text = el.textContent?.trim();
                    if (text && text.includes('SongNodes') && text.includes('Overview')) {
                        foundElement = el;
                        break;
                    }
                }
            }

            if (foundElement) {
                const rect = foundElement.getBoundingClientRect();
                const style = window.getComputedStyle(foundElement);
                const children = Array.from(foundElement.children);

                const childPositions = children.map(child => {
                    const childRect = child.getBoundingClientRect();
                    return {
                        text: child.textContent?.trim().substring(0, 30),
                        top: childRect.top,
                        left: childRect.left
                    };
                });

                // Check if horizontal
                const isHorizontal = children.length > 1 ?
                    childPositions.every(pos => Math.abs(pos.top - childPositions[0].top) < 10) : false;

                return {
                    found: true,
                    text: foundElement.textContent?.trim().substring(0, 100),
                    display: style.display,
                    flexDirection: style.flexDirection,
                    children: childPositions.length,
                    isHorizontal,
                    className: foundElement.className
                };
            }

            return { found: false };
        });

        console.log('📊 Menubar Check Result:');
        console.log(JSON.stringify(menubarCheck, null, 2));

        if (menubarCheck.found) {
            console.log(`\n✅ RESULT: ${menubarCheck.isHorizontal ? 'HORIZONTAL ✓' : 'VERTICAL ✗'}`);
            return menubarCheck.isHorizontal;
        } else {
            console.log('\n❌ No menubar found');
            return false;
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

quickMenubarCheck().then(result => {
    console.log(`\n🏁 QUICK ANSWER: ${result ? 'YES - Horizontal alignment working' : 'NO - Still vertical or not found'}`);
    process.exit(0);
});