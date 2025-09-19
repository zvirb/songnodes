const { chromium } = require('playwright');
const fs = require('fs');

/**
 * Detailed Analysis of SongNodes Hover Reset Issue
 * This script focuses specifically on detecting graph re-initialization patterns
 */

class DetailedHoverAnalysis {
    constructor() {
        this.consoleMessages = [];
        this.hoverEventLogs = [];
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 1000
        });

        this.page = await this.browser.newPage();

        // Capture ALL console messages with more detail
        this.page.on('console', msg => {
            const logEntry = {
                level: msg.type(),
                text: msg.text(),
                timestamp: Date.now(),
                args: msg.args().length
            };

            this.consoleMessages.push(logEntry);

            // Show real-time console output with analysis
            console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.text}`);
        });

        await this.page.goto('http://localhost:3006', { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(3000); // Wait for app to fully load
    }

    async analyzeHoverBehavior() {
        console.log('\n🔍 DETAILED HOVER ANALYSIS STARTING');
        console.log('==========================================');

        // Clear previous console messages to focus on hover events
        this.consoleMessages = [];

        // Find nodes
        const nodes = this.page.locator('circle');
        const nodeCount = await nodes.count();

        console.log(`\n📍 Found ${nodeCount} nodes for testing`);

        for (let i = 0; i < Math.min(3, nodeCount); i++) {
            console.log(`\n🖱️ TESTING NODE ${i + 1}`);
            console.log('====================');

            // Clear console log for this specific test
            const preHoverConsoleCount = this.consoleMessages.length;

            console.log('📝 Console messages before hover:', preHoverConsoleCount);

            // Perform hover
            await nodes.nth(i).hover();
            await this.page.waitForTimeout(2000); // Wait for any re-rendering

            // Analyze what happened
            const postHoverConsoleCount = this.consoleMessages.length;
            const newMessages = this.consoleMessages.slice(preHoverConsoleCount);

            console.log('📝 Console messages after hover:', postHoverConsoleCount);
            console.log('📝 New messages triggered by hover:', newMessages.length);

            // Look for specific patterns that indicate re-initialization
            const reinitializationPatterns = [
                '🎨 Creating D3 visualization',
                'positioned at',
                'Canvas dimensions',
                'Redux State Update',
                'App useEffect'
            ];

            const reinitMessages = newMessages.filter(msg =>
                reinitializationPatterns.some(pattern => msg.text.includes(pattern))
            );

            if (reinitMessages.length > 0) {
                console.log('🚨 RESET DETECTED! Re-initialization messages found:');
                reinitMessages.forEach(msg => {
                    console.log(`   • ${msg.text}`);
                });

                this.hoverEventLogs.push({
                    nodeIndex: i + 1,
                    resetDetected: true,
                    reinitMessageCount: reinitMessages.length,
                    totalNewMessages: newMessages.length,
                    reinitPatterns: reinitMessages.map(m => m.text)
                });
            } else {
                console.log('✅ No re-initialization detected for this hover');
                this.hoverEventLogs.push({
                    nodeIndex: i + 1,
                    resetDetected: false,
                    reinitMessageCount: 0,
                    totalNewMessages: newMessages.length
                });
            }

            // Move mouse away
            await this.page.mouse.move(100, 100);
            await this.page.waitForTimeout(1000);
        }
    }

    generateDetailedReport() {
        const resetsDetected = this.hoverEventLogs.filter(log => log.resetDetected).length;
        const totalTests = this.hoverEventLogs.length;

        const report = {
            testName: 'Detailed Hover Reset Analysis',
            timestamp: new Date().toISOString(),
            summary: {
                totalNodesTested: totalTests,
                resetsDetected: resetsDetected,
                resetPercentage: totalTests > 0 ? (resetsDetected / totalTests * 100).toFixed(1) : 0,
                issueConfirmed: resetsDetected > 0
            },
            hoverEvents: this.hoverEventLogs,
            totalConsoleMessages: this.consoleMessages.length,
            findings: this.generateFindings()
        };

        // Save detailed report
        fs.writeFileSync('./detailed-hover-analysis-report.json', JSON.stringify(report, null, 2));

        console.log('\n📊 DETAILED ANALYSIS REPORT');
        console.log('============================');
        console.log(`Total nodes tested: ${totalTests}`);
        console.log(`Resets detected: ${resetsDetected}/${totalTests} (${report.summary.resetPercentage}%)`);
        console.log(`Issue confirmed: ${report.summary.issueConfirmed ? '🚨 YES' : '✅ NO'}`);

        if (report.summary.issueConfirmed) {
            console.log('\n🐛 ISSUE ANALYSIS:');
            console.log('The graph IS resetting/re-initializing on hover events!');
            console.log('This confirms the user\'s reported issue.');
        }

        console.log('\n💾 Detailed report saved to: detailed-hover-analysis-report.json');

        return report;
    }

    generateFindings() {
        const findings = [];

        if (this.hoverEventLogs.some(log => log.resetDetected)) {
            findings.push('CRITICAL: Graph re-initialization detected on hover events');
            findings.push('The D3 visualization is being completely recreated on each hover');
            findings.push('This causes the graph to reset its position and state');
            findings.push('Root cause likely in hover event handlers triggering component re-renders');
        }

        // Analyze console patterns for specific technical insights
        const d3CreationCount = this.consoleMessages.filter(msg =>
            msg.text.includes('🎨 Creating D3 visualization')).length;

        if (d3CreationCount > 1) {
            findings.push(`D3 visualization created ${d3CreationCount} times during testing`);
            findings.push('Multiple D3 creation indicates unnecessary re-rendering');
        }

        const reduxUpdates = this.consoleMessages.filter(msg =>
            msg.text.includes('Redux State Update')).length;

        if (reduxUpdates > 1) {
            findings.push(`Redux state updated ${reduxUpdates} times during testing`);
            findings.push('Frequent Redux updates may trigger unnecessary re-renders');
        }

        return findings;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async run() {
        try {
            await this.initialize();
            await this.analyzeHoverBehavior();
            const report = this.generateDetailedReport();

            // Exit with appropriate code based on findings
            if (report.summary.issueConfirmed) {
                console.log('\n🚨 EXITING WITH ERROR - Issue confirmed!');
                process.exit(1);
            } else {
                console.log('\n✅ EXITING WITH SUCCESS - No issue detected');
                process.exit(0);
            }
        } catch (error) {
            console.error('Analysis failed:', error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Run the analysis
if (require.main === module) {
    const analysis = new DetailedHoverAnalysis();
    analysis.run();
}

module.exports = DetailedHoverAnalysis;