const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive SongNodes Node Hover Test Automation
 * Tests for the reported node hover reset issue and general app functionality
 */

class SongNodesHoverTester {
    constructor() {
        this.testResults = {
            appLoading: null,
            nodeHoverBehavior: [],
            consoleErrors: [],
            graphFunctionality: null,
            screenshots: [],
            timestamp: new Date().toISOString()
        };
        this.screenshotDir = './test-screenshots/node-hover-test';
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        // Create screenshot directory
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }

        // Launch browser with debugging capabilities
        this.browser = await chromium.launch({
            headless: false, // Run in visible mode to see what's happening
            slowMo: 500,    // Slow down operations for better visibility
            args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        });

        this.page = await this.browser.newPage();

        // Setup console monitoring
        this.page.on('console', msg => {
            const logLevel = msg.type();
            const text = msg.text();
            console.log(`Console ${logLevel}: ${text}`);

            if (logLevel === 'error' || logLevel === 'warning') {
                this.testResults.consoleErrors.push({
                    level: logLevel,
                    message: text,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Setup error monitoring
        this.page.on('pageerror', error => {
            console.log('Page Error:', error.message);
            this.testResults.consoleErrors.push({
                level: 'pageerror',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        });

        console.log('🚀 Test automation initialized');
    }

    async testAppLoading() {
        console.log('📱 Testing app loading...');

        try {
            const startTime = Date.now();

            // Navigate to the application
            await this.page.goto('http://localhost:3006', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            const loadTime = Date.now() - startTime;

            // Wait for the app to fully load and check for key elements
            await this.page.waitForSelector('body', { timeout: 10000 });

            // Take initial screenshot
            const initialScreenshot = path.join(this.screenshotDir, '01-app-loaded.png');
            await this.page.screenshot({
                path: initialScreenshot,
                fullPage: true
            });
            this.testResults.screenshots.push(initialScreenshot);

            // Check for menubar
            const menubarExists = await this.page.locator('[class*="menu"], [class*="navbar"], [class*="header"]').count() > 0;

            // Check for graph canvas
            const graphCanvasExists = await this.page.locator('canvas, svg, [class*="graph"], [class*="canvas"]').count() > 0;

            // Check for loading indicators (should be gone)
            const loadingIndicators = await this.page.locator('[class*="loading"], [class*="spinner"]').count();

            this.testResults.appLoading = {
                success: true,
                loadTime: loadTime,
                menubarExists: menubarExists,
                graphCanvasExists: graphCanvasExists,
                loadingIndicatorsVisible: loadingIndicators > 0,
                url: this.page.url()
            };

            console.log(`✅ App loaded successfully in ${loadTime}ms`);
            console.log(`   Menubar: ${menubarExists ? '✅' : '❌'}`);
            console.log(`   Graph Canvas: ${graphCanvasExists ? '✅' : '❌'}`);
            console.log(`   Loading indicators: ${loadingIndicators > 0 ? '⚠️ Still visible' : '✅ Hidden'}`);

        } catch (error) {
            this.testResults.appLoading = {
                success: false,
                error: error.message,
                loadTime: null
            };
            console.log('❌ App loading failed:', error.message);
        }
    }

    async testNodeHoverInteractions() {
        console.log('🖱️ Testing node hover interactions...');

        try {
            // Wait for graph to be fully rendered
            await this.page.waitForTimeout(3000);

            // Look for nodes in various possible selectors
            const nodeSelectors = [
                'circle',           // SVG circles
                '[class*="node"]',  // Elements with 'node' in class
                '.node',            // Standard node class
                'g circle',         // SVG groups with circles
                'canvas'            // Canvas-based rendering
            ];

            let nodesFound = false;
            let nodeSelector = null;

            // Find which selector has nodes
            for (const selector of nodeSelectors) {
                const nodeCount = await this.page.locator(selector).count();
                if (nodeCount > 0) {
                    nodesFound = true;
                    nodeSelector = selector;
                    console.log(`📍 Found ${nodeCount} nodes using selector: ${selector}`);
                    break;
                }
            }

            if (!nodesFound) {
                console.log('⚠️ No nodes found with standard selectors, checking canvas...');

                // For canvas-based graphs, we'll test mouse interactions on canvas
                const canvasElements = await this.page.locator('canvas').count();
                if (canvasElements > 0) {
                    console.log(`📍 Found ${canvasElements} canvas element(s), testing canvas interactions`);
                    await this.testCanvasHoverInteractions();
                    return;
                }
            }

            if (nodesFound && nodeSelector !== 'canvas') {
                // Test SVG/DOM node interactions
                await this.testDOMNodeHoverInteractions(nodeSelector);
            }

            if (!nodesFound) {
                this.testResults.nodeHoverBehavior.push({
                    test: 'node_detection',
                    success: false,
                    message: 'No nodes found in the graph visualization'
                });
                console.log('❌ No nodes detected for hover testing');
            }

        } catch (error) {
            this.testResults.nodeHoverBehavior.push({
                test: 'hover_interaction_setup',
                success: false,
                error: error.message
            });
            console.log('❌ Node hover test setup failed:', error.message);
        }
    }

    async testDOMNodeHoverInteractions(nodeSelector) {
        console.log(`🖱️ Testing DOM node hover interactions with selector: ${nodeSelector}`);

        const nodes = this.page.locator(nodeSelector);
        const nodeCount = await nodes.count();
        const testNodes = Math.min(5, nodeCount); // Test up to 5 nodes

        for (let i = 0; i < testNodes; i++) {
            try {
                console.log(`   Testing node ${i + 1}/${testNodes}...`);

                // Take screenshot before hover
                const beforeScreenshot = path.join(this.screenshotDir, `02-before-hover-node-${i + 1}.png`);
                await this.page.screenshot({ path: beforeScreenshot });
                this.testResults.screenshots.push(beforeScreenshot);

                // Get initial graph state (node positions, count)
                const initialState = await this.captureGraphState();

                // Hover over the node
                const node = nodes.nth(i);
                await node.hover();

                // Wait a moment for any animations/effects
                await this.page.waitForTimeout(1000);

                // Take screenshot during hover
                const duringScreenshot = path.join(this.screenshotDir, `03-during-hover-node-${i + 1}.png`);
                await this.page.screenshot({ path: duringScreenshot });
                this.testResults.screenshots.push(duringScreenshot);

                // Check if graph state changed (reset behavior)
                const afterHoverState = await this.captureGraphState();

                // Move mouse away from node
                await this.page.mouse.move(100, 100);
                await this.page.waitForTimeout(1000);

                // Take screenshot after hover
                const afterScreenshot = path.join(this.screenshotDir, `04-after-hover-node-${i + 1}.png`);
                await this.page.screenshot({ path: afterScreenshot });
                this.testResults.screenshots.push(afterScreenshot);

                // Final state check
                const finalState = await this.captureGraphState();

                // Analyze behavior
                const hoverResult = this.analyzeHoverBehavior(initialState, afterHoverState, finalState, i + 1);
                this.testResults.nodeHoverBehavior.push(hoverResult);

                console.log(`   Node ${i + 1} hover result: ${hoverResult.resetDetected ? '❌ RESET DETECTED' : '✅ Normal behavior'}`);

            } catch (error) {
                this.testResults.nodeHoverBehavior.push({
                    nodeIndex: i + 1,
                    test: 'dom_node_hover',
                    success: false,
                    error: error.message
                });
                console.log(`   ❌ Error testing node ${i + 1}:`, error.message);
            }
        }
    }

    async testCanvasHoverInteractions() {
        console.log('🖱️ Testing canvas hover interactions...');

        const canvas = this.page.locator('canvas').first();
        const canvasBox = await canvas.boundingBox();

        if (!canvasBox) {
            console.log('❌ Could not get canvas bounding box');
            return;
        }

        // Test multiple points on the canvas (where nodes might be)
        const testPoints = [
            { x: canvasBox.x + canvasBox.width * 0.3, y: canvasBox.y + canvasBox.height * 0.3 },
            { x: canvasBox.x + canvasBox.width * 0.7, y: canvasBox.y + canvasBox.height * 0.3 },
            { x: canvasBox.x + canvasBox.width * 0.5, y: canvasBox.y + canvasBox.height * 0.5 },
            { x: canvasBox.x + canvasBox.width * 0.3, y: canvasBox.y + canvasBox.height * 0.7 },
            { x: canvasBox.x + canvasBox.width * 0.7, y: canvasBox.y + canvasBox.height * 0.7 }
        ];

        for (let i = 0; i < testPoints.length; i++) {
            try {
                const point = testPoints[i];
                console.log(`   Testing canvas point ${i + 1}/${testPoints.length} at (${Math.round(point.x)}, ${Math.round(point.y)})...`);

                // Take screenshot before hover
                const beforeScreenshot = path.join(this.screenshotDir, `05-canvas-before-hover-${i + 1}.png`);
                await this.page.screenshot({ path: beforeScreenshot });
                this.testResults.screenshots.push(beforeScreenshot);

                // Get initial state
                const initialState = await this.captureGraphState();

                // Hover at the point
                await this.page.mouse.move(point.x, point.y);
                await this.page.waitForTimeout(1000);

                // Take screenshot during hover
                const duringScreenshot = path.join(this.screenshotDir, `06-canvas-during-hover-${i + 1}.png`);
                await this.page.screenshot({ path: duringScreenshot });
                this.testResults.screenshots.push(duringScreenshot);

                // Check state after hover
                const afterHoverState = await this.captureGraphState();

                // Move mouse away
                await this.page.mouse.move(50, 50);
                await this.page.waitForTimeout(1000);

                // Take screenshot after hover
                const afterScreenshot = path.join(this.screenshotDir, `07-canvas-after-hover-${i + 1}.png`);
                await this.page.screenshot({ path: afterScreenshot });
                this.testResults.screenshots.push(afterScreenshot);

                // Final state
                const finalState = await this.captureGraphState();

                // Analyze behavior
                const hoverResult = this.analyzeHoverBehavior(initialState, afterHoverState, finalState, `canvas-${i + 1}`);
                this.testResults.nodeHoverBehavior.push(hoverResult);

                console.log(`   Canvas point ${i + 1} hover result: ${hoverResult.resetDetected ? '❌ RESET DETECTED' : '✅ Normal behavior'}`);

            } catch (error) {
                this.testResults.nodeHoverBehavior.push({
                    nodeIndex: `canvas-${i + 1}`,
                    test: 'canvas_hover',
                    success: false,
                    error: error.message
                });
                console.log(`   ❌ Error testing canvas point ${i + 1}:`, error.message);
            }
        }
    }

    async captureGraphState() {
        try {
            // Capture various aspects of graph state that might change on reset
            const state = await this.page.evaluate(() => {
                const canvases = document.querySelectorAll('canvas');
                const svgElements = document.querySelectorAll('svg');
                const nodeElements = document.querySelectorAll('[class*="node"], circle');

                return {
                    canvasCount: canvases.length,
                    svgCount: svgElements.length,
                    nodeCount: nodeElements.length,
                    timestamp: Date.now(),
                    // Try to capture any global graph state from window
                    hasGraphData: typeof window.graphData !== 'undefined',
                    hasD3 : typeof window.d3 !== 'undefined'
                };
            });

            return state;
        } catch (error) {
            console.log('Warning: Could not capture graph state:', error.message);
            return { error: error.message, timestamp: Date.now() };
        }
    }

    analyzeHoverBehavior(initialState, hoverState, finalState, nodeIdentifier) {
        const result = {
            nodeIndex: nodeIdentifier,
            test: 'hover_behavior_analysis',
            success: true,
            resetDetected: false,
            stateChanges: {},
            timestamps: {
                initial: initialState.timestamp,
                hover: hoverState.timestamp,
                final: finalState.timestamp
            }
        };

        // Check for significant state changes that might indicate a reset
        if (initialState.nodeCount !== hoverState.nodeCount) {
            result.resetDetected = true;
            result.stateChanges.nodeCountChanged = {
                initial: initialState.nodeCount,
                hover: hoverState.nodeCount
            };
        }

        if (initialState.canvasCount !== hoverState.canvasCount) {
            result.resetDetected = true;
            result.stateChanges.canvasCountChanged = {
                initial: initialState.canvasCount,
                hover: hoverState.canvasCount
            };
        }

        // Check for rapid state changes (potential re-rendering)
        const hoverTime = hoverState.timestamp - initialState.timestamp;
        const totalTime = finalState.timestamp - initialState.timestamp;

        result.timings = {
            hoverResponseTime: hoverTime,
            totalTestTime: totalTime
        };

        return result;
    }

    async testBasicGraphFunctionality() {
        console.log('🔧 Testing basic graph functionality...');

        try {
            // Test zoom functionality
            await this.testZoomFunctionality();

            // Test pan functionality
            await this.testPanFunctionality();

            // Test resize behavior
            await this.testResizeBehavior();

            this.testResults.graphFunctionality = {
                success: true,
                features: ['zoom', 'pan', 'resize']
            };

        } catch (error) {
            this.testResults.graphFunctionality = {
                success: false,
                error: error.message
            };
            console.log('❌ Graph functionality test failed:', error.message);
        }
    }

    async testZoomFunctionality() {
        console.log('   Testing zoom functionality...');

        // Try wheel zoom on canvas/graph area
        const graphArea = await this.page.locator('canvas, svg').first();
        if (await graphArea.count() > 0) {
            await graphArea.hover();

            // Zoom in
            await this.page.mouse.wheel(0, -100);
            await this.page.waitForTimeout(500);

            const zoomInScreenshot = path.join(this.screenshotDir, '08-zoom-in-test.png');
            await this.page.screenshot({ path: zoomInScreenshot });
            this.testResults.screenshots.push(zoomInScreenshot);

            // Zoom out
            await this.page.mouse.wheel(0, 100);
            await this.page.waitForTimeout(500);

            const zoomOutScreenshot = path.join(this.screenshotDir, '09-zoom-out-test.png');
            await this.page.screenshot({ path: zoomOutScreenshot });
            this.testResults.screenshots.push(zoomOutScreenshot);
        }
    }

    async testPanFunctionality() {
        console.log('   Testing pan functionality...');

        const graphArea = await this.page.locator('canvas, svg').first();
        if (await graphArea.count() > 0) {
            const box = await graphArea.boundingBox();
            if (box) {
                // Pan by dragging
                await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await this.page.mouse.down();
                await this.page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
                await this.page.mouse.up();
                await this.page.waitForTimeout(500);

                const panScreenshot = path.join(this.screenshotDir, '10-pan-test.png');
                await this.page.screenshot({ path: panScreenshot });
                this.testResults.screenshots.push(panScreenshot);
            }
        }
    }

    async testResizeBehavior() {
        console.log('   Testing resize behavior...');

        // Resize viewport to test responsive behavior
        await this.page.setViewportSize({ width: 1200, height: 800 });
        await this.page.waitForTimeout(1000);

        const resizeScreenshot = path.join(this.screenshotDir, '11-resize-test.png');
        await this.page.screenshot({ path: resizeScreenshot });
        this.testResults.screenshots.push(resizeScreenshot);

        // Restore original size
        await this.page.setViewportSize({ width: 1920, height: 1080 });
        await this.page.waitForTimeout(1000);
    }

    async generateReport() {
        console.log('📊 Generating test report...');

        const reportPath = path.join(this.screenshotDir, 'node-hover-test-report.json');

        const report = {
            testSuite: 'SongNodes Node Hover Issue Investigation',
            executionTime: new Date().toISOString(),
            summary: this.generateSummary(),
            detailedResults: this.testResults,
            recommendations: this.generateRecommendations()
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Also create a human-readable summary
        const summaryPath = path.join(this.screenshotDir, 'test-summary.txt');
        fs.writeFileSync(summaryPath, this.generateTextSummary());

        console.log(`📋 Test report saved to: ${reportPath}`);
        console.log(`📋 Test summary saved to: ${summaryPath}`);

        return report;
    }

    generateSummary() {
        const hoverTests = this.testResults.nodeHoverBehavior;
        const resetCount = hoverTests.filter(test => test.resetDetected).length;
        const totalHoverTests = hoverTests.length;

        return {
            appLoaded: this.testResults.appLoading?.success || false,
            totalHoverTests: totalHoverTests,
            resetDetected: resetCount > 0,
            resetCount: resetCount,
            consoleErrors: this.testResults.consoleErrors.length,
            screenshotsTaken: this.testResults.screenshots.length,
            graphFunctionalityWorking: this.testResults.graphFunctionality?.success || false
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const summary = this.generateSummary();

        if (!summary.appLoaded) {
            recommendations.push('CRITICAL: Application failed to load properly. Check console errors and network connectivity.');
        }

        if (summary.resetDetected) {
            recommendations.push(`ISSUE CONFIRMED: Node hover causing graph reset detected in ${summary.resetCount} out of ${summary.totalHoverTests} tests. This needs immediate investigation.`);
            recommendations.push('Examine hover event handlers in graph components for state mutations or re-initialization logic.');
            recommendations.push('Check for React component re-renders triggered by hover events.');
            recommendations.push('Review D3.js force simulation restart conditions.');
        }

        if (summary.consoleErrors > 0) {
            recommendations.push(`Found ${summary.consoleErrors} console errors/warnings. Review these for potential causes of the hover issue.`);
        }

        if (!summary.graphFunctionalityWorking) {
            recommendations.push('Basic graph functionality (zoom/pan) not working properly. This may be related to the hover issue.');
        }

        return recommendations;
    }

    generateTextSummary() {
        const summary = this.generateSummary();

        return `
SongNodes Node Hover Test Results
================================

Execution Time: ${this.testResults.timestamp}

🔍 TEST SUMMARY:
- App Loading: ${summary.appLoaded ? '✅ SUCCESS' : '❌ FAILED'}
- Hover Tests Performed: ${summary.totalHoverTests}
- Graph Reset Detected: ${summary.resetDetected ? '❌ YES (' + summary.resetCount + ' instances)' : '✅ NO'}
- Console Errors: ${summary.consoleErrors}
- Screenshots Captured: ${summary.screenshotsTaken}
- Graph Functionality: ${summary.graphFunctionalityWorking ? '✅ WORKING' : '❌ ISSUES DETECTED'}

🐛 ISSUE STATUS:
${summary.resetDetected ?
    `❌ CONFIRMED: Node hover reset issue detected!
   The graph appears to reset/re-render when hovering over nodes.
   This confirms the user's reported issue.` :
    `✅ NOT REPRODUCED: Could not reproduce the node hover reset issue.
   The graph appears to be working normally.`}

📋 RECOMMENDATIONS:
${this.generateRecommendations().map(rec => `- ${rec}`).join('\n')}

📸 Screenshots saved in: ${this.screenshotDir}
📊 Full report: node-hover-test-report.json
`;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
        console.log('🧹 Test cleanup completed');
    }

    async runFullTest() {
        try {
            console.log('🎵 Starting SongNodes Node Hover Test Automation');
            console.log('================================================');

            await this.initialize();
            await this.testAppLoading();

            if (this.testResults.appLoading?.success) {
                await this.testNodeHoverInteractions();
                await this.testBasicGraphFunctionality();
            }

            const report = await this.generateReport();

            console.log('\n🎯 TEST COMPLETED');
            console.log('================');
            console.log(this.generateTextSummary());

            return report;

        } catch (error) {
            console.log('❌ Test execution failed:', error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Main execution
async function main() {
    const tester = new SongNodesHoverTester();

    try {
        const report = await tester.runFullTest();

        // Exit with appropriate code
        const summary = tester.generateSummary();
        if (summary.resetDetected) {
            console.log('🚨 Exiting with error code - Issue detected!');
            process.exit(1);
        } else {
            console.log('✅ Exiting with success code - No issues detected');
            process.exit(0);
        }

    } catch (error) {
        console.error('💥 Test suite failed:', error.message);
        process.exit(1);
    }
}

// Handle script termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Test interrupted by user');
    process.exit(1);
});

if (require.main === module) {
    main();
}

module.exports = SongNodesHoverTester;