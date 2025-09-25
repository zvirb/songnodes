const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function comprehensiveFailureAnalysis() {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000,
        args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Collect all console messages and errors
    const consoleMessages = [];
    const errors = [];

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
        console.log('PAGE ERROR:', error.message);
    });

    // Monitor network requests
    const networkRequests = [];
    page.on('request', request => {
        networkRequests.push({
            url: request.url(),
            method: request.method(),
            timestamp: new Date().toISOString()
        });
    });

    page.on('response', response => {
        if (response.status() >= 400) {
            console.log(`NETWORK ERROR: ${response.status()} - ${response.url()}`);
        }
    });

    console.log('=== COMPREHENSIVE SONGNODES FAILURE ANALYSIS ===');
    console.log('Starting analysis at:', new Date().toISOString());

    const analysis = {
        timestamp: new Date().toISOString(),
        phases: {},
        errors: [],
        consoleMessages: [],
        networkRequests: [],
        screenshots: {}
    };

    try {
        // Phase 1: Initial Load Analysis
        console.log('\n🔍 PHASE 1: Initial Application Load');
        const startTime = Date.now();

        await page.goto('http://localhost:3006', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        const loadTime = Date.now() - startTime;
        console.log(`✅ Page loaded in ${loadTime}ms`);

        // Take initial screenshot
        await page.screenshot({
            path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/analysis-01-initial-load.png',
            fullPage: true
        });

        analysis.phases.initialLoad = {
            success: true,
            loadTime: loadTime,
            timestamp: new Date().toISOString()
        };

        // Phase 2: DOM Structure Analysis
        console.log('\n🔍 PHASE 2: DOM Structure Analysis');

        const domStructure = await page.evaluate(() => {
            const app = document.getElementById('root');
            const canvasElements = document.querySelectorAll('canvas');
            const pixiElements = document.querySelectorAll('[data-pixi], .pixi-canvas');
            const graphElements = document.querySelectorAll('[class*="graph"], [id*="graph"]');

            return {
                hasRoot: !!app,
                rootContent: app ? app.innerHTML.length > 100 : false,
                canvasCount: canvasElements.length,
                pixiElementCount: pixiElements.length,
                graphElementCount: graphElements.length,
                bodyClasses: document.body.className,
                title: document.title
            };
        });

        console.log('DOM Structure:', JSON.stringify(domStructure, null, 2));
        analysis.phases.domStructure = domStructure;

        // Phase 3: React Component Mounting Analysis
        console.log('\n🔍 PHASE 3: React Component Analysis');

        // Wait for React components to potentially mount
        await page.waitForTimeout(5000);

        const reactAnalysis = await page.evaluate(() => {
            // Check for React DevTools
            const hasReact = !!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__);

            // Check for common SongNodes components
            const componentSelectors = [
                '[class*="App"]',
                '[class*="graph"]',
                '[class*="canvas"]',
                '[class*="visualization"]',
                '[class*="pixi"]',
                'canvas'
            ];

            const componentStatus = {};
            componentSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                componentStatus[selector] = {
                    count: elements.length,
                    visible: Array.from(elements).some(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0;
                    })
                };
            });

            return {
                hasReact,
                componentStatus,
                errors: window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__ || null
            };
        });

        console.log('React Analysis:', JSON.stringify(reactAnalysis, null, 2));
        analysis.phases.reactAnalysis = reactAnalysis;

        // Phase 4: PIXI.js WebGL Analysis
        console.log('\n🔍 PHASE 4: PIXI.js WebGL Analysis');

        const pixiAnalysis = await page.evaluate(() => {
            const pixiGlobal = window.PIXI;

            if (!pixiGlobal) {
                return { error: 'PIXI.js not loaded' };
            }

            try {
                // Test WebGL support
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

                const webglInfo = {
                    supported: !!gl,
                    vendor: gl ? gl.getParameter(gl.VENDOR) : null,
                    renderer: gl ? gl.getParameter(gl.RENDERER) : null,
                    version: gl ? gl.getParameter(gl.VERSION) : null
                };

                // Test PIXI Application creation
                let pixiAppTest = null;
                try {
                    pixiAppTest = new pixiGlobal.Application({
                        width: 100,
                        height: 100,
                        backgroundColor: 0x000000
                    });

                    return {
                        pixiLoaded: true,
                        pixiVersion: pixiGlobal.VERSION,
                        webgl: webglInfo,
                        appCreation: 'success',
                        rendererType: pixiAppTest.renderer.type
                    };
                } catch (e) {
                    return {
                        pixiLoaded: true,
                        pixiVersion: pixiGlobal.VERSION,
                        webgl: webglInfo,
                        appCreation: 'failed',
                        appError: e.message
                    };
                }
            } catch (e) {
                return {
                    pixiLoaded: true,
                    error: e.message
                };
            }
        });

        console.log('PIXI Analysis:', JSON.stringify(pixiAnalysis, null, 2));
        analysis.phases.pixiAnalysis = pixiAnalysis;

        // Phase 5: API Data Loading Analysis
        console.log('\n🔍 PHASE 5: API Data Loading Analysis');

        // Check for API calls and data
        const apiAnalysis = await page.evaluate(() => {
            // Check for common data loading indicators
            const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"]');
            const errorElements = document.querySelectorAll('[class*="error"]');

            // Check for data in Redux store or global state
            let storeData = null;
            if (window.__REDUX_DEVTOOLS_EXTENSION__) {
                try {
                    const state = window.__REDUX_DEVTOOLS_EXTENSION__.getState();
                    storeData = state;
                } catch (e) {
                    storeData = { error: e.message };
                }
            }

            return {
                loadingElements: loadingElements.length,
                errorElements: errorElements.length,
                reduxStore: storeData,
                localStorage: Object.keys(localStorage),
                sessionStorage: Object.keys(sessionStorage)
            };
        });

        console.log('API Analysis:', JSON.stringify(apiAnalysis, null, 2));
        analysis.phases.apiAnalysis = apiAnalysis;

        // Phase 6: Graph Visualization Specific Analysis
        console.log('\n🔍 PHASE 6: Graph Visualization Analysis');

        // Wait longer for graph to potentially load
        await page.waitForTimeout(10000);

        const graphAnalysis = await page.evaluate(() => {
            const canvases = document.querySelectorAll('canvas');
            const canvasInfo = Array.from(canvases).map((canvas, index) => {
                const rect = canvas.getBoundingClientRect();
                const context2d = canvas.getContext('2d');
                const contextWebGL = canvas.getContext('webgl');

                return {
                    index,
                    width: canvas.width,
                    height: canvas.height,
                    displayWidth: rect.width,
                    displayHeight: rect.height,
                    visible: rect.width > 0 && rect.height > 0,
                    has2DContext: !!context2d,
                    hasWebGLContext: !!contextWebGL,
                    parentClasses: canvas.parentElement ? canvas.parentElement.className : '',
                    id: canvas.id || 'no-id'
                };
            });

            // Check for D3 elements
            const d3Elements = document.querySelectorAll('svg, [class*="d3"]');

            return {
                canvases: canvasInfo,
                d3ElementCount: d3Elements.length,
                totalCanvases: canvases.length
            };
        });

        console.log('Graph Analysis:', JSON.stringify(graphAnalysis, null, 2));
        analysis.phases.graphAnalysis = graphAnalysis;

        // Take final screenshot
        await page.screenshot({
            path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/analysis-02-final-state.png',
            fullPage: true
        });

    } catch (error) {
        console.log('❌ CRITICAL ERROR during analysis:', error.message);
        analysis.errors.push({
            phase: 'main_analysis',
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Take error screenshot
        try {
            await page.screenshot({
                path: '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/analysis-error.png',
                fullPage: true
            });
        } catch (screenshotError) {
            console.log('Failed to take error screenshot:', screenshotError.message);
        }
    }

    // Collect final data
    analysis.errors = analysis.errors.concat(errors);
    analysis.consoleMessages = consoleMessages;
    analysis.networkRequests = networkRequests;

    // Save comprehensive analysis
    const analysisPath = '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend/comprehensive-analysis.json';
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));

    console.log('\n📊 ANALYSIS COMPLETE');
    console.log('===================');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Total errors: ${errors.length}`);
    console.log(`Total network requests: ${networkRequests.length}`);
    console.log(`Analysis saved to: ${analysisPath}`);

    // Generate summary
    const summary = generateSummary(analysis);
    console.log('\n📋 SUMMARY OF FINDINGS:');
    console.log(summary);

    await browser.close();
    return analysis;
}

function generateSummary(analysis) {
    let summary = '';

    // Check critical failures
    const criticalIssues = [];

    if (!analysis.phases.initialLoad?.success) {
        criticalIssues.push('❌ Initial page load failed');
    }

    if (!analysis.phases.domStructure?.hasRoot) {
        criticalIssues.push('❌ React root element missing');
    }

    if (!analysis.phases.domStructure?.rootContent) {
        criticalIssues.push('❌ React app content not rendered');
    }

    if (analysis.phases.pixiAnalysis?.error || analysis.phases.pixiAnalysis?.appCreation === 'failed') {
        criticalIssues.push('❌ PIXI.js initialization failed');
    }

    if (analysis.phases.graphAnalysis?.totalCanvases === 0) {
        criticalIssues.push('❌ No canvas elements found for graph rendering');
    }

    if (analysis.errors.length > 5) {
        criticalIssues.push(`❌ High error count: ${analysis.errors.length} errors`);
    }

    if (criticalIssues.length > 0) {
        summary += 'CRITICAL ISSUES FOUND:\n';
        criticalIssues.forEach(issue => summary += `  ${issue}\n`);
    } else {
        summary += '✅ No critical initialization issues detected\n';
    }

    return summary;
}

// Run the analysis
comprehensiveFailureAnalysis().catch(console.error);