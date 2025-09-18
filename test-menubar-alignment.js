const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testMenubarAlignment() {
    console.log('🧪 Starting SongNodes Menubar Alignment Test');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Navigate to the application
        console.log('📍 Navigating to http://localhost:3006');
        await page.goto('http://localhost:3006', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for the page to load completely
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('🔍 Analyzing menubar layout...');

        // Test 1: Check if all menubar elements exist
        const menubarElements = await page.evaluate(() => {
            // Search for elements by text content
            const allElements = Array.from(document.querySelectorAll('*'));

            const elements = {
                logo: document.querySelector('[data-testid="logo"], .logo') ||
                      allElements.find(el => el.className && typeof el.className === 'string' && el.className.includes('logo')),
                overview: allElements.find(el =>
                    el.textContent && el.textContent.trim().includes('Overview')),
                legend: allElements.find(el =>
                    el.textContent && el.textContent.trim().includes('Legend')),
                search: allElements.find(el =>
                    el.textContent && el.textContent.trim().includes('Search')),
                functions: allElements.find(el =>
                    el.textContent && el.textContent.trim().includes('Functions')),
                liveStatus: allElements.find(el =>
                    el.textContent && el.textContent.trim().includes('Live')),
                songNodes: allElements.find(el =>
                    el.textContent && el.textContent.trim().includes('SongNodes')),
                menubar: document.querySelector('.menubar, [data-testid="menubar"], nav, header') ||
                        document.querySelector('div[style*="display: flex"], div[style*="flex"]')
            };

            return {
                logoExists: !!elements.logo,
                overviewExists: !!elements.overview,
                legendExists: !!elements.legend,
                searchExists: !!elements.search,
                functionsExists: !!elements.functions,
                liveStatusExists: !!elements.liveStatus,
                songNodesExists: !!elements.songNodes,
                menubarExists: !!elements.menubar,
                elements: {
                    logo: elements.logo ? elements.logo.tagName : null,
                    overview: elements.overview ? elements.overview.tagName : null,
                    legend: elements.legend ? elements.legend.tagName : null,
                    search: elements.search ? elements.search.tagName : null,
                    functions: elements.functions ? elements.functions.tagName : null,
                    liveStatus: elements.liveStatus ? elements.liveStatus.tagName : null,
                    songNodes: elements.songNodes ? elements.songNodes.tagName : null,
                    menubar: elements.menubar ? elements.menubar.tagName : null
                }
            };
        });

        console.log('📊 Menubar Elements Check:', menubarElements);

        // Test 2: Check horizontal alignment and positioning
        const alignmentData = await page.evaluate(() => {
            const menubarContainer = document.querySelector('.menubar, [data-testid="menubar"], nav, header') ||
                                   document.querySelector('div[style*="display: flex"], div[style*="flex"]') ||
                                   document.querySelector('div[class*="menu"], div[class*="nav"], div[class*="header"]');

            if (!menubarContainer) {
                return { error: 'Menubar container not found' };
            }

            const containerRect = menubarContainer.getBoundingClientRect();
            const containerStyles = window.getComputedStyle(menubarContainer);

            // Find all menubar items
            const menuItems = Array.from(menubarContainer.querySelectorAll('*')).filter(el => {
                const text = el.textContent?.trim() || '';
                return text.includes('SongNodes') ||
                       text.includes('Overview') ||
                       text.includes('Legend') ||
                       text.includes('Search') ||
                       text.includes('Functions') ||
                       text.includes('Live');
            });

            const itemPositions = menuItems.map(item => {
                const rect = item.getBoundingClientRect();
                return {
                    text: item.textContent?.trim().substring(0, 20),
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    bottom: rect.bottom
                };
            });

            return {
                containerRect: {
                    x: containerRect.x,
                    y: containerRect.y,
                    width: containerRect.width,
                    height: containerRect.height
                },
                containerStyles: {
                    display: containerStyles.display,
                    flexDirection: containerStyles.flexDirection,
                    alignItems: containerStyles.alignItems,
                    justifyContent: containerStyles.justifyContent
                },
                itemPositions,
                horizontallyAligned: itemPositions.length > 1 ?
                    Math.abs(itemPositions[0].y - itemPositions[itemPositions.length - 1].y) < 5 : false
            };
        });

        console.log('📐 Alignment Analysis:', alignmentData);

        // Test 3: Check for separators
        const separatorCheck = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('*'));
            const separators = allElements.filter(el => {
                return (el.className && typeof el.className === 'string' && el.className.includes('separator')) ||
                       (el.style && el.style.border) ||
                       (el.textContent && el.textContent.includes('|'));
            });

            return {
                separatorCount: separators.length,
                separatorsFound: separators.map(s => ({
                    tagName: s.tagName,
                    className: s.className,
                    textContent: s.textContent?.trim().substring(0, 10)
                }))
            };
        });

        console.log('🔗 Separator Check:', separatorCheck);

        // Test 4: Test dropdown functionality
        console.log('🔽 Testing dropdown functionality...');
        let dropdownWorking = false;
        try {
            // Try to find and click a dropdown button
            const dropdownButton = await page.$('button, .dropdown, [class*="dropdown"]');
            if (dropdownButton) {
                await dropdownButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Check if dropdown opened
                const dropdownOpen = await page.evaluate(() => {
                    const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="menu-open"], [style*="display: block"]');
                    return dropdowns.length > 0;
                });

                dropdownWorking = dropdownOpen;
                console.log('✅ Dropdown functionality test:', dropdownWorking ? 'WORKING' : 'NOT WORKING');
            }
        } catch (error) {
            console.log('⚠️ Dropdown test error:', error.message);
        }

        // Take screenshot
        console.log('📸 Taking screenshot...');
        const screenshotPath = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/menubar-alignment-verification.png';
        await page.screenshot({
            path: screenshotPath,
            fullPage: false,
            clip: { x: 0, y: 0, width: 1920, height: 200 } // Focus on top area where menubar should be
        });

        // Generate test report
        const testReport = {
            timestamp: new Date().toISOString(),
            testResults: {
                elementsFound: menubarElements,
                alignmentData: alignmentData,
                separatorCheck: separatorCheck,
                dropdownFunctionality: dropdownWorking,
                screenshot: screenshotPath
            },
            summary: {
                allElementsPresent: Object.values(menubarElements).every(Boolean),
                horizontallyAligned: alignmentData.horizontallyAligned || false,
                hasVisualSeparators: separatorCheck.separatorCount > 0,
                functionalityIntact: dropdownWorking
            }
        };

        // Save test report
        const reportPath = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/menubar-alignment-test-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));

        console.log('📋 Test Report Summary:');
        console.log('  ✓ All Elements Present:', testReport.summary.allElementsPresent);
        console.log('  ✓ Horizontally Aligned:', testReport.summary.horizontallyAligned);
        console.log('  ✓ Has Visual Separators:', testReport.summary.hasVisualSeparators);
        console.log('  ✓ Functionality Intact:', testReport.summary.functionalityIntact);
        console.log('📄 Full report saved to:', reportPath);
        console.log('📸 Screenshot saved to:', screenshotPath);

        return testReport;

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run the test
if (require.main === module) {
    testMenubarAlignment()
        .then(report => {
            console.log('🎉 Test completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Test failed:', error);
            process.exit(1);
        });
}

module.exports = testMenubarAlignment;