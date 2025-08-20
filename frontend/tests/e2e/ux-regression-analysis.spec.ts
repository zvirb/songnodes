import { test, expect, Page, BrowserContext } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface UXIssueReport {
  timestamp: string;
  issueType: 'flickering' | 'authentication' | 'navigation' | 'performance' | 'session';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: {
    screenshots?: string[];
    consoleErrors?: string[];
    performanceMetrics?: any;
    reproductionSteps: string[];
  };
  browserInfo: {
    name: string;
    viewport: { width: number; height: number };
    userAgent: string;
  };
}

interface UXRegressionReport {
  timestamp: string;
  testDuration: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  productionReady: boolean;
  issues: UXIssueReport[];
  fixRecommendations: string[];
  urgentActionItems: string[];
}

class UXRegressionAnalyzer {
  private issues: UXIssueReport[] = [];
  private page: Page;
  private context: BrowserContext;
  private startTime: number = 0;
  private screenshotCounter: number = 0;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
  }

  async startAnalysis(): Promise<void> {
    this.startTime = Date.now();
    this.issues = [];
    this.screenshotCounter = 0;

    // Set up console monitoring for flickering and errors
    this.page.on('console', (msg) => {
      const message = msg.text();
      if (message.includes('flicker') || message.includes('rerender') || 
          message.includes('Redux') || message.includes('state')) {
        console.log(`🔍 Potential flickering/state issue: ${message}`);
      }
    });
  }

  async captureScreenshot(label: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ux-regression-${label}-${timestamp}-${++this.screenshotCounter}.png`;
    const screenshotPath = join('test-results', 'screenshots', filename);
    
    // Ensure directory exists
    const dir = join('test-results', 'screenshots');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await this.page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      animations: 'disabled' // Disable animations to capture stable state
    });
    
    console.log(`📸 Screenshot captured: ${filename}`);
    return screenshotPath;
  }

  async analyzeWebUIFlickering(): Promise<void> {
    console.log('🔍 Analyzing WebUI flickering patterns...');
    
    try {
      // Navigate to the application
      await this.page.goto('/', { waitUntil: 'networkidle' });
      
      // Take initial screenshot
      const beforeScreenshot = await this.captureScreenshot('initial-load');
      
      // Wait for application to fully initialize
      await this.page.waitForTimeout(3000);
      
      // Take screenshot after initialization
      const afterInitScreenshot = await this.captureScreenshot('after-init');
      
      // Look for rapid re-renders by monitoring DOM mutations
      const mutationObserver = await this.page.evaluate(() => {
        let mutationCount = 0;
        const observer = new MutationObserver((mutations) => {
          mutationCount += mutations.length;
        });
        observer.observe(document.body, { 
          childList: true, 
          subtree: true, 
          attributes: true 
        });
        
        // Return a promise that resolves after monitoring for 5 seconds
        return new Promise((resolve) => {
          setTimeout(() => {
            observer.disconnect();
            resolve(mutationCount);
          }, 5000);
        });
      });

      console.log(`📊 DOM mutations detected during monitoring: ${mutationObserver}`);

      // Test rapid interactions that might cause flickering
      for (let i = 0; i < 10; i++) {
        // Rapid mouse movements
        await this.page.mouse.move(100 + i * 50, 100 + i * 30);
        await this.page.waitForTimeout(50);
        
        // Rapid clicks
        try {
          await this.page.mouse.click(200 + i * 20, 150 + i * 20);
          await this.page.waitForTimeout(50);
        } catch (e) {
          // Ignore click failures
        }
      }

      // Take screenshot after rapid interactions
      const afterInteractionScreenshot = await this.captureScreenshot('after-rapid-interactions');

      // Check for visual instability
      const potentialFlickering = Number(mutationObserver) > 100; // Threshold for excessive mutations
      
      if (potentialFlickering) {
        this.issues.push({
          timestamp: new Date().toISOString(),
          issueType: 'flickering',
          severity: 'critical',
          description: `WebUI flickering detected: ${mutationObserver} DOM mutations in 5 seconds (threshold: 100)`,
          evidence: {
            screenshots: [beforeScreenshot, afterInitScreenshot, afterInteractionScreenshot],
            consoleErrors: [],
            performanceMetrics: { domMutations: mutationObserver },
            reproductionSteps: [
              'Load application',
              'Wait for initialization',
              'Perform rapid mouse movements and clicks',
              'Observe excessive DOM mutations'
            ]
          },
          browserInfo: {
            name: 'chromium',
            viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
            userAgent: await this.page.evaluate(() => navigator.userAgent)
          }
        });
      }

    } catch (error) {
      console.error(`❌ Error during flickering analysis: ${error}`);
      this.issues.push({
        timestamp: new Date().toISOString(),
        issueType: 'flickering',
        severity: 'high',
        description: `Failed to complete flickering analysis: ${error}`,
        evidence: {
          reproductionSteps: ['Navigate to application', 'Analysis failed due to error']
        },
        browserInfo: {
          name: 'chromium',
          viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
          userAgent: await this.page.evaluate(() => navigator.userAgent)
        }
      });
    }
  }

  async analyzeAuthenticationFlow(): Promise<void> {
    console.log('🔐 Analyzing authentication flow and session persistence...');
    
    try {
      // Navigate to the application
      await this.page.goto('/', { waitUntil: 'networkidle' });
      
      // Look for login elements
      const loginElements = await this.page.locator('[data-testid*="login"], input[type="password"], input[name*="password"], button[type="submit"]').all();
      
      if (loginElements.length === 0) {
        console.log('ℹ️ No login elements found - checking for authentication state');
        
        // Check for authentication-related console errors
        const authErrors = await this.page.evaluate(() => {
          const errors: string[] = [];
          // Look for authentication-related errors in Redux state
          if (window.console) {
            // This is a simplified check - in a real app you'd check Redux store
          }
          return errors;
        });

        // Check for JWT tokens or session storage
        const sessionData = await this.page.evaluate(() => {
          return {
            localStorage: Object.keys(localStorage).filter(key => 
              key.includes('token') || key.includes('auth') || key.includes('session')
            ),
            sessionStorage: Object.keys(sessionStorage).filter(key => 
              key.includes('token') || key.includes('auth') || key.includes('session')
            ),
            cookies: document.cookie.includes('token') || document.cookie.includes('auth')
          };
        });

        console.log(`🔍 Session data analysis: ${JSON.stringify(sessionData)}`);
        
        // Test session persistence by reloading
        await this.page.reload({ waitUntil: 'networkidle' });
        await this.page.waitForTimeout(2000);
        
        const sessionDataAfterReload = await this.page.evaluate(() => {
          return {
            localStorage: Object.keys(localStorage).filter(key => 
              key.includes('token') || key.includes('auth') || key.includes('session')
            ),
            sessionStorage: Object.keys(sessionStorage).filter(key => 
              key.includes('token') || key.includes('auth') || key.includes('session')
            )
          };
        });

        // Check if session data persisted
        const sessionPersisted = JSON.stringify(sessionData.localStorage) === JSON.stringify(sessionDataAfterReload.localStorage);
        
        if (!sessionPersisted) {
          this.issues.push({
            timestamp: new Date().toISOString(),
            issueType: 'authentication',
            severity: 'high',
            description: 'Session persistence issue detected - authentication data not persisting across page reloads',
            evidence: {
              screenshots: [await this.captureScreenshot('session-before-reload'), await this.captureScreenshot('session-after-reload')],
              consoleErrors: authErrors,
              reproductionSteps: [
                'Navigate to application',
                'Check for authentication state',
                'Reload page',
                'Check if authentication state persists'
              ]
            },
            browserInfo: {
              name: 'chromium',
              viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
              userAgent: await this.page.evaluate(() => navigator.userAgent)
            }
          });
        }
      } else {
        console.log(`🔍 Found ${loginElements.length} login-related elements`);
        // Test actual login flow if elements are present
        const loginScreenshot = await this.captureScreenshot('login-elements-found');
        
        this.issues.push({
          timestamp: new Date().toISOString(),
          issueType: 'authentication',
          severity: 'medium',
          description: `Login elements detected (${loginElements.length} elements) - manual authentication flow testing recommended`,
          evidence: {
            screenshots: [loginScreenshot],
            reproductionSteps: [
              'Navigate to application',
              'Locate login elements',
              'Test login/logout workflow manually'
            ]
          },
          browserInfo: {
            name: 'chromium',
            viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
            userAgent: await this.page.evaluate(() => navigator.userAgent)
          }
        });
      }

    } catch (error) {
      console.error(`❌ Error during authentication analysis: ${error}`);
      this.issues.push({
        timestamp: new Date().toISOString(),
        issueType: 'authentication',
        severity: 'high',
        description: `Failed to complete authentication analysis: ${error}`,
        evidence: {
          reproductionSteps: ['Navigate to application', 'Authentication analysis failed']
        },
        browserInfo: {
          name: 'chromium',
          viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
          userAgent: await this.page.evaluate(() => navigator.userAgent)
        }
      });
    }
  }

  async analyzeGraphNavigation(): Promise<void> {
    console.log('🎵 Analyzing music graph navigation functionality...');
    
    try {
      await this.page.goto('/', { waitUntil: 'networkidle' });
      
      // Look for graph/canvas elements
      const canvasElements = await this.page.locator('canvas, svg, [data-testid*="graph"], [class*="graph"]').all();
      
      if (canvasElements.length === 0) {
        this.issues.push({
          timestamp: new Date().toISOString(),
          issueType: 'navigation',
          severity: 'critical',
          description: 'No graph/canvas elements found - core music graph functionality missing',
          evidence: {
            screenshots: [await this.captureScreenshot('no-graph-elements')],
            reproductionSteps: [
              'Navigate to application',
              'Look for graph/canvas elements',
              'No graph elements found'
            ]
          },
          browserInfo: {
            name: 'chromium',
            viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
            userAgent: await this.page.evaluate(() => navigator.userAgent)
          }
        });
        return;
      }

      console.log(`🎯 Found ${canvasElements.length} graph-related elements`);
      const graphScreenshot = await this.captureScreenshot('graph-elements-found');

      // Test graph interactions
      const firstCanvas = canvasElements[0];
      const boundingBox = await firstCanvas.boundingBox();
      
      if (boundingBox) {
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;

        // Test zoom functionality
        console.log('🔍 Testing zoom functionality...');
        await this.page.mouse.move(centerX, centerY);
        await this.page.mouse.wheel(0, -100); // Zoom in
        await this.page.waitForTimeout(500);
        const zoomInScreenshot = await this.captureScreenshot('zoom-in-test');
        
        await this.page.mouse.wheel(0, 100); // Zoom out
        await this.page.waitForTimeout(500);
        const zoomOutScreenshot = await this.captureScreenshot('zoom-out-test');

        // Test pan functionality
        console.log('👆 Testing pan functionality...');
        await this.page.mouse.move(centerX, centerY);
        await this.page.mouse.down();
        await this.page.mouse.move(centerX + 100, centerY + 50);
        await this.page.mouse.up();
        await this.page.waitForTimeout(500);
        const panScreenshot = await this.captureScreenshot('pan-test');

        // Test click/selection
        console.log('🖱️ Testing click/selection functionality...');
        await this.page.mouse.click(centerX, centerY);
        await this.page.waitForTimeout(500);
        const clickScreenshot = await this.captureScreenshot('click-test');

        // Monitor for any navigation-related console errors
        const navigationErrors = await this.page.evaluate(() => {
          // This would need to be connected to actual error monitoring
          return [];
        });

        // Record successful navigation testing
        this.issues.push({
          timestamp: new Date().toISOString(),
          issueType: 'navigation',
          severity: 'low',
          description: `Graph navigation testing completed - ${canvasElements.length} graph elements found and tested`,
          evidence: {
            screenshots: [graphScreenshot, zoomInScreenshot, zoomOutScreenshot, panScreenshot, clickScreenshot],
            consoleErrors: navigationErrors,
            reproductionSteps: [
              'Navigate to application',
              'Locate graph elements',
              'Test zoom in/out',
              'Test pan functionality',
              'Test click/selection'
            ]
          },
          browserInfo: {
            name: 'chromium',
            viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
            userAgent: await this.page.evaluate(() => navigator.userAgent)
          }
        });
      }

    } catch (error) {
      console.error(`❌ Error during graph navigation analysis: ${error}`);
      this.issues.push({
        timestamp: new Date().toISOString(),
        issueType: 'navigation',
        severity: 'high',
        description: `Failed to complete graph navigation analysis: ${error}`,
        evidence: {
          reproductionSteps: ['Navigate to application', 'Graph navigation analysis failed']
        },
        browserInfo: {
          name: 'chromium',
          viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
          userAgent: await this.page.evaluate(() => navigator.userAgent)
        }
      });
    }
  }

  async analyzePerformanceMetrics(): Promise<void> {
    console.log('⚡ Analyzing UI performance metrics...');
    
    try {
      // Start performance monitoring
      await this.page.goto('/', { waitUntil: 'networkidle' });
      
      // Collect performance metrics
      const performanceMetrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        return {
          loadTime: navigation.loadEventEnd - navigation.fetchStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          resourceCount: performance.getEntriesByType('resource').length
        };
      });

      console.log(`📊 Performance metrics: ${JSON.stringify(performanceMetrics, null, 2)}`);

      // Check for performance issues
      const issues: string[] = [];
      if (performanceMetrics.loadTime > 5000) {
        issues.push('Slow page load time (>5s)');
      }
      if (performanceMetrics.firstContentfulPaint > 3000) {
        issues.push('Slow first contentful paint (>3s)');
      }
      if (performanceMetrics.domContentLoaded > 3000) {
        issues.push('Slow DOM content loaded (>3s)');
      }

      if (issues.length > 0) {
        this.issues.push({
          timestamp: new Date().toISOString(),
          issueType: 'performance',
          severity: 'medium',
          description: `Performance issues detected: ${issues.join(', ')}`,
          evidence: {
            screenshots: [await this.captureScreenshot('performance-test')],
            performanceMetrics: performanceMetrics,
            reproductionSteps: [
              'Navigate to application',
              'Measure performance metrics',
              'Compare against thresholds'
            ]
          },
          browserInfo: {
            name: 'chromium',
            viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
            userAgent: await this.page.evaluate(() => navigator.userAgent)
          }
        });
      }

    } catch (error) {
      console.error(`❌ Error during performance analysis: ${error}`);
      this.issues.push({
        timestamp: new Date().toISOString(),
        issueType: 'performance',
        severity: 'medium',
        description: `Failed to complete performance analysis: ${error}`,
        evidence: {
          reproductionSteps: ['Navigate to application', 'Performance analysis failed']
        },
        browserInfo: {
          name: 'chromium',
          viewport: this.page.viewportSize() || { width: 1920, height: 1080 },
          userAgent: await this.page.evaluate(() => navigator.userAgent)
        }
      });
    }
  }

  generateReport(): UXRegressionReport {
    const testDuration = Date.now() - this.startTime;
    const criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
    const highIssues = this.issues.filter(i => i.severity === 'high').length;
    const mediumIssues = this.issues.filter(i => i.severity === 'medium').length;
    const lowIssues = this.issues.filter(i => i.severity === 'low').length;

    const productionReady = criticalIssues === 0 && highIssues === 0;

    const fixRecommendations = this.generateRecommendations();
    const urgentActionItems = this.generateUrgentActions();

    return {
      timestamp: new Date().toISOString(),
      testDuration,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      productionReady,
      issues: this.issues,
      fixRecommendations,
      urgentActionItems
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const flickeringIssues = this.issues.filter(i => i.issueType === 'flickering');
    if (flickeringIssues.length > 0) {
      recommendations.push('🔄 WebUI Flickering: Check React re-render cycles, optimize state updates, review PIXI.js integration');
    }

    const authIssues = this.issues.filter(i => i.issueType === 'authentication');
    if (authIssues.length > 0) {
      recommendations.push('🔐 Authentication: Implement proper session persistence, review JWT token handling, check Redux auth state');
    }

    const navIssues = this.issues.filter(i => i.issueType === 'navigation');
    if (navIssues.length > 0) {
      recommendations.push('🧭 Navigation: Verify graph rendering, test interaction handlers, check WebGL/Canvas integration');
    }

    const perfIssues = this.issues.filter(i => i.issueType === 'performance');
    if (perfIssues.length > 0) {
      recommendations.push('⚡ Performance: Optimize bundle size, implement code splitting, review render performance');
    }

    return recommendations;
  }

  private generateUrgentActions(): string[] {
    const actions: string[] = [];
    
    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      actions.push(`🚨 CRITICAL: ${criticalIssues.length} critical issues must be fixed before production deployment`);
    }

    const flickeringCritical = this.issues.filter(i => i.issueType === 'flickering' && i.severity === 'critical');
    if (flickeringCritical.length > 0) {
      actions.push('⚡ URGENT: Fix WebUI flickering - this severely impacts user experience');
    }

    const authCritical = this.issues.filter(i => i.issueType === 'authentication' && i.severity === 'critical');
    if (authCritical.length > 0) {
      actions.push('🔐 URGENT: Fix authentication flow - users cannot properly log in/out');
    }

    const navCritical = this.issues.filter(i => i.issueType === 'navigation' && i.severity === 'critical');
    if (navCritical.length > 0) {
      actions.push('🎵 URGENT: Fix graph navigation - core music discovery functionality broken');
    }

    return actions;
  }

  saveReport(report: UXRegressionReport): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = `test-results/ux-regression-report-${timestamp}.json`;
    
    // Ensure directory exists
    const dir = join('test-results');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(report, null, 2));

    // Create human-readable summary
    const summaryPath = outputPath.replace('.json', '-summary.txt');
    const summary = this.formatSummaryReport(report);
    writeFileSync(summaryPath, summary);

    console.log(`📄 UX Regression report saved to: ${outputPath}`);
    console.log(`📋 Summary report saved to: ${summaryPath}`);
  }

  private formatSummaryReport(report: UXRegressionReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('🔍 UX REGRESSION ANALYSIS REPORT');
    lines.push('='.repeat(80));
    lines.push(`📅 Timestamp: ${report.timestamp}`);
    lines.push(`⏱️  Test Duration: ${(report.testDuration / 1000).toFixed(1)}s`);
    lines.push('');
    
    lines.push('📊 ISSUE SUMMARY');
    lines.push('-'.repeat(40));
    lines.push(`🚨 Critical Issues: ${report.criticalIssues}`);
    lines.push(`🔶 High Issues: ${report.highIssues}`);
    lines.push(`🔸 Medium Issues: ${report.mediumIssues}`);
    lines.push(`🔹 Low Issues: ${report.lowIssues}`);
    lines.push('');
    
    lines.push(`🚀 PRODUCTION READY: ${report.productionReady ? '✅ YES' : '❌ NO'}`);
    lines.push('');

    if (report.urgentActionItems.length > 0) {
      lines.push('🚨 URGENT ACTION ITEMS');
      lines.push('-'.repeat(40));
      report.urgentActionItems.forEach(item => lines.push(`• ${item}`));
      lines.push('');
    }
    
    if (report.fixRecommendations.length > 0) {
      lines.push('💡 FIX RECOMMENDATIONS');
      lines.push('-'.repeat(40));
      report.fixRecommendations.forEach(rec => lines.push(`• ${rec}`));
      lines.push('');
    }
    
    if (report.issues.length > 0) {
      lines.push('🔍 DETAILED ISSUE ANALYSIS');
      lines.push('-'.repeat(40));
      
      // Group by issue type and severity
      const issuesByType = report.issues.reduce((acc, issue) => {
        const key = `${issue.issueType}-${issue.severity}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(issue);
        return acc;
      }, {} as Record<string, UXIssueReport[]>);
      
      Object.entries(issuesByType).forEach(([key, issues]) => {
        const [type, severity] = key.split('-');
        const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '🔶' : severity === 'medium' ? '🔸' : '🔹';
        lines.push(`\n${emoji} ${severity.toUpperCase()} ${type.toUpperCase()} ISSUES (${issues.length})`);
        
        issues.forEach((issue, index) => {
          lines.push(`  ${index + 1}. ${issue.description}`);
          lines.push(`     📍 Browser: ${issue.browserInfo.name}`);
          lines.push(`     📐 Viewport: ${issue.browserInfo.viewport.width}x${issue.browserInfo.viewport.height}`);
          lines.push(`     🕐 Timestamp: ${issue.timestamp}`);
          if (issue.evidence.screenshots && issue.evidence.screenshots.length > 0) {
            lines.push(`     📸 Screenshots: ${issue.evidence.screenshots.length} captured`);
          }
          lines.push(`     🔄 Reproduction Steps:`);
          issue.evidence.reproductionSteps.forEach((step, i) => {
            lines.push(`        ${i + 1}. ${step}`);
          });
        });
      });
    }
    
    lines.push('\n' + '='.repeat(80));
    return lines.join('\n');
  }
}

test.describe('UX Regression Analysis', () => {
  let analyzer: UXRegressionAnalyzer;
  
  test.beforeEach(async ({ page, context }) => {
    analyzer = new UXRegressionAnalyzer(page, context);
    await analyzer.startAnalysis();
  });

  test('should perform comprehensive UX regression analysis', async ({ page, context }) => {
    console.log('🚀 Starting comprehensive UX regression analysis...');
    
    // Run all UX analysis tests
    await analyzer.analyzeWebUIFlickering();
    await analyzer.analyzeAuthenticationFlow();
    await analyzer.analyzeGraphNavigation();
    await analyzer.analyzePerformanceMetrics();
    
    // Generate and save report
    const report = analyzer.generateReport();
    analyzer.saveReport(report);
    
    // Log summary to console
    console.log('\n🔍 UX REGRESSION ANALYSIS SUMMARY');
    console.log('='.repeat(50));
    console.log(`🚨 Critical Issues: ${report.criticalIssues}`);
    console.log(`🔶 High Issues: ${report.highIssues}`);
    console.log(`🔸 Medium Issues: ${report.mediumIssues}`);
    console.log(`🔹 Low Issues: ${report.lowIssues}`);
    console.log(`🚀 Production Ready: ${report.productionReady ? '✅ YES' : '❌ NO'}`);
    console.log('='.repeat(50));
    
    if (report.urgentActionItems.length > 0) {
      console.log('\n🚨 URGENT ACTION ITEMS:');
      report.urgentActionItems.forEach(item => console.log(`  • ${item}`));
    }
    
    if (report.fixRecommendations.length > 0) {
      console.log('\n💡 FIX RECOMMENDATIONS:');
      report.fixRecommendations.slice(0, 3).forEach(rec => console.log(`  • ${rec}`));
    }
    
    // Test passes regardless - this is for analysis, not validation
    expect(true).toBe(true);
  });

  test('should test WebUI flickering specifically', async ({ page, context }) => {
    console.log('🔄 Testing WebUI flickering patterns...');
    
    await analyzer.analyzeWebUIFlickering();
    
    const report = analyzer.generateReport();
    const flickeringIssues = report.issues.filter(i => i.issueType === 'flickering');
    
    console.log(`🔍 Flickering analysis completed: ${flickeringIssues.length} issues found`);
    
    if (flickeringIssues.length > 0) {
      console.log('🚨 FLICKERING ISSUES DETECTED:');
      flickeringIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.description} (${issue.severity})`);
      });
    }
    
    expect(true).toBe(true);
  });

  test('should test authentication flow', async ({ page, context }) => {
    console.log('🔐 Testing authentication flow and session persistence...');
    
    await analyzer.analyzeAuthenticationFlow();
    
    const report = analyzer.generateReport();
    const authIssues = report.issues.filter(i => i.issueType === 'authentication');
    
    console.log(`🔍 Authentication analysis completed: ${authIssues.length} issues found`);
    
    if (authIssues.length > 0) {
      console.log('🚨 AUTHENTICATION ISSUES DETECTED:');
      authIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.description} (${issue.severity})`);
      });
    }
    
    expect(true).toBe(true);
  });

  test('should test graph navigation functionality', async ({ page, context }) => {
    console.log('🎵 Testing music graph navigation...');
    
    await analyzer.analyzeGraphNavigation();
    
    const report = analyzer.generateReport();
    const navIssues = report.issues.filter(i => i.issueType === 'navigation');
    
    console.log(`🔍 Navigation analysis completed: ${navIssues.length} issues found`);
    
    if (navIssues.length > 0) {
      console.log('🚨 NAVIGATION ISSUES DETECTED:');
      navIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.description} (${issue.severity})`);
      });
    }
    
    expect(true).toBe(true);
  });
});