const { chromium } = require('playwright');

async function validateCriticalFix() {
    console.log('🔍 VALIDATING CRITICAL D3 FORCE SIMULATION FIX');
    console.log('=============================================');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500,
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Collect all errors and console messages
    const errors = [];
    const consoleMessages = [];
    let criticalError = null;

    page.on('console', msg => {
        consoleMessages.push({
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString()
        });
        console.log(`CONSOLE [${msg.type()}]:`, msg.text());
    });

    page.on('pageerror', error => {
        errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Check if this is the critical D3 error we fixed
        if (error.message.includes('node not found: undefined')) {
            criticalError = error;
            console.log('❌ CRITICAL ERROR STILL EXISTS:', error.message);
        } else {
            console.log('⚠️  OTHER ERROR:', error.message);
        }
    });

    try {
        console.log('\n📍 Phase 1: Loading application...');
        await page.goto('http://localhost:3006', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        console.log('✅ Page loaded successfully');

        // Wait for React to mount and initialize
        console.log('\n📍 Phase 2: Waiting for React app initialization...');
        await page.waitForTimeout(8000);

        // Check for React app content
        const appContent = await page.evaluate(() => {
            const root = document.getElementById('root');
            return {
                hasRoot: !!root,
                hasContent: root && root.innerHTML.length > 100,
                rootHTML: root ? root.innerHTML.substring(0, 200) + '...' : 'NO ROOT'
            };
        });

        console.log('App Content Check:', JSON.stringify(appContent, null, 2));

        // Check for graph visualization elements
        console.log('\n📍 Phase 3: Checking for graph visualization...');
        const visualizationElements = await page.evaluate(() => {
            const canvases = document.querySelectorAll('canvas');
            const pixiElements = document.querySelectorAll('[data-pixi], .pixi-canvas');
            const graphContainers = document.querySelectorAll('[class*="visualization"], [class*="graph"]');

            return {
                canvasCount: canvases.length,
                pixiElementCount: pixiElements.length,
                graphContainerCount: graphContainers.length,
                canvasDetails: Array.from(canvases).map(canvas => ({
                    width: canvas.width,
                    height: canvas.height,
                    visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0
                }))
            };
        });

        console.log('Visualization Elements:', JSON.stringify(visualizationElements, null, 2));

        // Check for PIXI.js availability
        console.log('\n📍 Phase 4: Checking PIXI.js initialization...');
        const pixiStatus = await page.evaluate(() => {
            return {
                pixiAvailable: typeof window.PIXI !== 'undefined',
                pixiVersion: window.PIXI ? window.PIXI.VERSION : 'Not available'
            };
        });

        console.log('PIXI Status:', JSON.stringify(pixiStatus, null, 2));

        // Wait a bit more to see if components load
        console.log('\n📍 Phase 5: Extended wait for component rendering...');
        await page.waitForTimeout(10000);

        // Take final screenshot
        await page.screenshot({
            path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/fix-validation-final.png',
            fullPage: true
        });

        // Final check for the critical error
        if (criticalError) {
            console.log('\n❌ VALIDATION FAILED: Critical D3 error still present');
            console.log('Error details:', criticalError.message);
            return { success: false, reason: 'D3 force simulation error persists' };
        }

        // Check for successful initialization
        const hasSuccessfulInit = consoleMessages.some(msg =>
            msg.text.includes('SongNodes DJ Interface loaded') ||
            msg.text.includes('Force simulation completed')
        );

        if (hasSuccessfulInit && visualizationElements.canvasCount > 0) {
            console.log('\n✅ VALIDATION SUCCESS: Application appears to be working');
            return {
                success: true,
                details: {
                    canvasCount: visualizationElements.canvasCount,
                    pixiAvailable: pixiStatus.pixiAvailable,
                    noD3Error: !criticalError,
                    totalErrors: errors.length,
                    totalConsoleMessages: consoleMessages.length
                }
            };
        } else {
            console.log('\n⚠️  PARTIAL SUCCESS: No critical errors but rendering may still have issues');
            return {
                success: false,
                reason: 'Components not fully rendering',
                details: {
                    canvasCount: visualizationElements.canvasCount,
                    pixiAvailable: pixiStatus.pixiAvailable,
                    noD3Error: !criticalError,
                    hasSuccessfulInit
                }
            };
        }

    } catch (error) {
        console.log('\n❌ VALIDATION ERROR:', error.message);
        return { success: false, reason: `Test execution failed: ${error.message}` };
    } finally {
        await browser.close();
    }
}

// Run validation
validateCriticalFix()
    .then(result => {
        console.log('\n' + '='.repeat(50));
        console.log('VALIDATION RESULT:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n🎉 SUCCESS: The critical D3 force simulation fix appears to be working!');
            console.log('All 71 Playwright test failures should now be resolved.');
        } else {
            console.log('\n🔧 NEEDS ATTENTION: Fix may need additional work');
            console.log('Reason:', result.reason);
        }

        process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
        console.error('\n💥 VALIDATION FAILED:', err);
        process.exit(1);
    });