const puppeteer = require('puppeteer');

async function finalMenubarTest() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });

        console.log('🔍 Final menubar alignment test...');

        await page.goto('http://localhost:3006', { waitUntil: 'networkidle0', timeout: 15000 });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Take screenshot
        await page.screenshot({
            path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/final-menubar-screenshot.png',
            fullPage: false
        });

        // Check for menubar
        const result = await page.evaluate(() => {
            // Find any element containing SongNodes text
            const allElements = Array.from(document.querySelectorAll('*'));
            let menubarElement = null;

            for (const el of allElements) {
                const text = el.textContent;
                if (text && text.includes('SongNodes') && (text.includes('Overview') || text.includes('Legend'))) {
                    menubarElement = el;
                    break;
                }
            }

            if (!menubarElement) {
                // Try finding by common patterns
                menubarElement = document.querySelector('header') ||
                               document.querySelector('nav') ||
                               document.querySelector('[class*="header"]') ||
                               document.querySelector('[class*="nav"]') ||
                               document.querySelector('[class*="menu"]');
            }

            if (menubarElement) {
                const style = window.getComputedStyle(menubarElement);
                const children = Array.from(menubarElement.children);
                const text = menubarElement.textContent?.trim();

                let isHorizontal = false;
                if (children.length > 1) {
                    const rects = children.map(child => child.getBoundingClientRect());
                    const topPositions = rects.map(rect => rect.top);
                    const firstTop = topPositions[0];
                    isHorizontal = topPositions.every(top => Math.abs(top - firstTop) < 5);
                }

                return {
                    found: true,
                    text: text.substring(0, 150),
                    display: style.display,
                    flexDirection: style.flexDirection,
                    childrenCount: children.length,
                    isHorizontal,
                    className: menubarElement.className
                };
            }

            return { found: false, bodyContent: document.body.textContent?.substring(0, 200) };
        });

        console.log('📊 Final Test Result:');
        console.log(JSON.stringify(result, null, 2));

        if (result.found) {
            const answer = result.isHorizontal ? 'YES' : 'NO';
            console.log(`\n🎯 QUICK ANSWER: ${answer} - ${result.isHorizontal ? 'Horizontal alignment is working' : 'Still vertical layout'}`);
            return result.isHorizontal;
        } else {
            console.log('\n❌ QUICK ANSWER: NO - Menubar not found or loaded');
            return false;
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

finalMenubarTest();
