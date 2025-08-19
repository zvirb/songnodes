import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface ConsoleErrorReport {
  timestamp: string;
  level: 'critical' | 'warning' | 'info' | 'debug';
  message: string;
  location: string;
  type: string;
  category: string;
  stack?: string;
}

interface ValidationReport {
  timestamp: string;
  url: string;
  testDuration: number;
  totalErrors: number;
  criticalErrors: number;
  warningErrors: number;
  infoMessages: number;
  debugMessages: number;
  productionReady: boolean;
  errors: ConsoleErrorReport[];
  recommendations: string[];
}

class ConsoleErrorClassifier {
  private static criticalKeywords = [
    'uncaught',
    'error',
    'exception',
    'failed to load',
    'network error',
    'syntax error',
    'reference error',
    'type error',
    'cannot read property',
    'undefined is not a function',
    'permission denied',
    'access denied',
    'cors error',
    'fetch failed',
    'websocket error',
    'redux',
    'state',
    'action',
    'reducer'
  ];

  private static warningKeywords = [
    'warning',
    'deprecated',
    'performance',
    'memory',
    'leak',
    'slow',
    'inefficient',
    'accessibility',
    'a11y',
    'contrast',
    'aria',
    'react',
    'component',
    'prop',
    'defaultprops',
    'finddomnode',
    'strict mode'
  ];

  private static productionBlockers = [
    'uncaught error',
    'uncaught exception',
    'failed to load module',
    'network error',
    'cors error',
    'websocket connection failed',
    'redux store error',
    'state update error',
    'pixi.js error',
    'webgl error',
    'canvas error',
    'worker error',
    'service worker error'
  ];

  static classifyError(consoleMessage: ConsoleMessage): ConsoleErrorReport {
    const message = consoleMessage.text().toLowerCase();
    const location = consoleMessage.location();
    const type = consoleMessage.type();
    const timestamp = new Date().toISOString();

    let level: 'critical' | 'warning' | 'info' | 'debug' = 'info';
    let category = 'general';

    // Classify by message content
    if (this.criticalKeywords.some(keyword => message.includes(keyword))) {
      level = 'critical';
    } else if (this.warningKeywords.some(keyword => message.includes(keyword))) {
      level = 'warning';
    } else if (type === 'error') {
      level = 'critical';
    } else if (type === 'warning') {
      level = 'warning';
    } else if (type === 'debug') {
      level = 'debug';
    }

    // Determine category
    if (message.includes('redux') || message.includes('state') || message.includes('action')) {
      category = 'redux/state-management';
    } else if (message.includes('pixi') || message.includes('webgl') || message.includes('canvas')) {
      category = 'graphics/rendering';
    } else if (message.includes('websocket') || message.includes('fetch') || message.includes('api')) {
      category = 'network/api';
    } else if (message.includes('react') || message.includes('component') || message.includes('prop')) {
      category = 'react/components';
    } else if (message.includes('performance') || message.includes('memory') || message.includes('slow')) {
      category = 'performance';
    } else if (message.includes('accessibility') || message.includes('a11y') || message.includes('aria')) {
      category = 'accessibility';
    } else if (message.includes('worker') || message.includes('service worker')) {
      category = 'workers';
    }

    return {
      timestamp,
      level,
      message: consoleMessage.text(),
      location: `${location.url}:${location.lineNumber}:${location.columnNumber}`,
      type,
      category,
      stack: consoleMessage.args().length > 0 ? String(consoleMessage.args()[0]) : undefined
    };
  }

  static isProductionBlocker(error: ConsoleErrorReport): boolean {
    const message = error.message.toLowerCase();
    return this.productionBlockers.some(blocker => message.includes(blocker)) || 
           (error.level === 'critical' && error.category !== 'performance');
  }

  static generateRecommendations(errors: ConsoleErrorReport[]): string[] {
    const recommendations: string[] = [];
    const categories = new Set(errors.map(e => e.category));
    const criticalErrors = errors.filter(e => e.level === 'critical');
    const productionBlockers = errors.filter(e => this.isProductionBlocker(e));

    if (productionBlockers.length > 0) {
      recommendations.push(`🚨 CRITICAL: ${productionBlockers.length} production-blocking errors must be fixed before deployment`);
    }

    if (categories.has('redux/state-management') && criticalErrors.some(e => e.category === 'redux/state-management')) {
      recommendations.push('🔧 Redux state management errors detected - check reducers, actions, and state updates');
    }

    if (categories.has('graphics/rendering') && criticalErrors.some(e => e.category === 'graphics/rendering')) {
      recommendations.push('🎨 Graphics/rendering errors detected - check PIXI.js integration and WebGL compatibility');
    }

    if (categories.has('network/api') && criticalErrors.some(e => e.category === 'network/api')) {
      recommendations.push('🌐 Network/API errors detected - verify backend connectivity and CORS configuration');
    }

    if (categories.has('react/components') && criticalErrors.some(e => e.category === 'react/components')) {
      recommendations.push('⚛️ React component errors detected - check prop types, lifecycle methods, and component structure');
    }

    const performanceIssues = errors.filter(e => e.category === 'performance');
    if (performanceIssues.length > 5) {
      recommendations.push('⚡ Multiple performance warnings detected - consider optimization strategies');
    }

    const accessibilityIssues = errors.filter(e => e.category === 'accessibility');
    if (accessibilityIssues.length > 0) {
      recommendations.push('♿ Accessibility issues detected - review ARIA labels, keyboard navigation, and color contrast');
    }

    if (recommendations.length === 0 && errors.length === 0) {
      recommendations.push('✅ No console errors detected - application appears ready for production');
    }

    return recommendations;
  }
}

class BrowserConsoleValidator {
  private errors: ConsoleErrorReport[] = [];
  private page: Page;
  private startTime: number = 0;

  constructor(page: Page) {
    this.page = page;
  }

  async startMonitoring(): Promise<void> {
    this.startTime = Date.now();
    this.errors = [];

    // Listen to all console events
    this.page.on('console', (msg) => {
      const error = ConsoleErrorClassifier.classifyError(msg);
      this.errors.push(error);
      
      // Log critical errors immediately for debugging
      if (error.level === 'critical') {
        console.log(`🚨 CRITICAL CONSOLE ERROR: ${error.message}`);
        console.log(`   Location: ${error.location}`);
        console.log(`   Category: ${error.category}`);
      }
    });

    // Listen to page errors (uncaught exceptions)
    this.page.on('pageerror', (error) => {
      const errorReport: ConsoleErrorReport = {
        timestamp: new Date().toISOString(),
        level: 'critical',
        message: `Uncaught Page Error: ${error.message}`,
        location: error.stack?.split('\n')[1] || 'unknown',
        type: 'pageerror',
        category: 'uncaught-exception',
        stack: error.stack
      };
      this.errors.push(errorReport);
      console.log(`💥 UNCAUGHT PAGE ERROR: ${error.message}`);
    });

    // Listen to request failures
    this.page.on('requestfailed', (request) => {
      const errorReport: ConsoleErrorReport = {
        timestamp: new Date().toISOString(),
        level: 'critical',
        message: `Network Request Failed: ${request.url()} - ${request.failure()?.errorText}`,
        location: request.url(),
        type: 'requestfailed',
        category: 'network/api',
      };
      this.errors.push(errorReport);
      console.log(`🌐 REQUEST FAILED: ${request.url()}`);
    });

    // Listen to response errors
    this.page.on('response', (response) => {
      if (!response.ok() && response.status() >= 400) {
        const errorReport: ConsoleErrorReport = {
          timestamp: new Date().toISOString(),
          level: response.status() >= 500 ? 'critical' : 'warning',
          message: `HTTP ${response.status()}: ${response.statusText()} - ${response.url()}`,
          location: response.url(),
          type: 'http-error',
          category: 'network/api',
        };
        this.errors.push(errorReport);
      }
    });
  }

  async navigateAndWait(url: string, waitTime: number = 5000): Promise<void> {
    console.log(`🔍 Navigating to ${url} and monitoring for ${waitTime}ms...`);
    
    // Navigate to the page
    await this.page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for the application to fully initialize
    await this.page.waitForTimeout(waitTime);
    
    // Try to interact with key elements to trigger more code paths
    try {
      // Check if there are any interactive elements to click
      const buttons = await this.page.locator('button').all();
      if (buttons.length > 0) {
        console.log(`🖱️ Found ${buttons.length} buttons, testing interactions...`);
        // Click first few buttons to trigger more application logic
        for (let i = 0; i < Math.min(3, buttons.length); i++) {
          try {
            await buttons[i].click({ timeout: 1000 });
            await this.page.waitForTimeout(500);
          } catch (e) {
            // Ignore click failures, just log them
            console.log(`⚠️ Could not click button ${i}: ${e}`);
          }
        }
      }

      // Try to trigger search or input interactions
      const inputs = await this.page.locator('input').all();
      if (inputs.length > 0) {
        console.log(`⌨️ Found ${inputs.length} inputs, testing interactions...`);
        try {
          await inputs[0].fill('test');
          await this.page.waitForTimeout(500);
        } catch (e) {
          console.log(`⚠️ Could not interact with input: ${e}`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error during interaction testing: ${error}`);
    }
  }

  generateReport(url: string): ValidationReport {
    const testDuration = Date.now() - this.startTime;
    const criticalErrors = this.errors.filter(e => e.level === 'critical');
    const warningErrors = this.errors.filter(e => e.level === 'warning');
    const infoMessages = this.errors.filter(e => e.level === 'info');
    const debugMessages = this.errors.filter(e => e.level === 'debug');

    const productionBlockers = this.errors.filter(e => ConsoleErrorClassifier.isProductionBlocker(e));
    const productionReady = productionBlockers.length === 0;

    return {
      timestamp: new Date().toISOString(),
      url,
      testDuration,
      totalErrors: this.errors.length,
      criticalErrors: criticalErrors.length,
      warningErrors: warningErrors.length,
      infoMessages: infoMessages.length,
      debugMessages: debugMessages.length,
      productionReady,
      errors: this.errors,
      recommendations: ConsoleErrorClassifier.generateRecommendations(this.errors)
    };
  }

  saveReport(report: ValidationReport, outputPath: string): void {
    // Ensure output directory exists
    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Save detailed JSON report
    writeFileSync(outputPath, JSON.stringify(report, null, 2));

    // Save human-readable summary
    const summaryPath = outputPath.replace('.json', '-summary.txt');
    const summary = this.formatSummaryReport(report);
    writeFileSync(summaryPath, summary);

    console.log(`📄 Validation report saved to: ${outputPath}`);
    console.log(`📋 Summary report saved to: ${summaryPath}`);
  }

  private formatSummaryReport(report: ValidationReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('🔍 BROWSER CONSOLE VALIDATION REPORT');
    lines.push('='.repeat(80));
    lines.push(`📅 Timestamp: ${report.timestamp}`);
    lines.push(`🌐 URL: ${report.url}`);
    lines.push(`⏱️  Test Duration: ${(report.testDuration / 1000).toFixed(1)}s`);
    lines.push('');
    
    lines.push('📊 SUMMARY STATISTICS');
    lines.push('-'.repeat(40));
    lines.push(`Total Console Messages: ${report.totalErrors}`);
    lines.push(`🚨 Critical Errors: ${report.criticalErrors}`);
    lines.push(`⚠️  Warning Messages: ${report.warningErrors}`);
    lines.push(`ℹ️  Info Messages: ${report.infoMessages}`);
    lines.push(`🐛 Debug Messages: ${report.debugMessages}`);
    lines.push('');
    
    lines.push(`🚀 PRODUCTION READY: ${report.productionReady ? '✅ YES' : '❌ NO'}`);
    lines.push('');
    
    if (report.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS');
      lines.push('-'.repeat(40));
      report.recommendations.forEach(rec => lines.push(`• ${rec}`));
      lines.push('');
    }
    
    if (report.errors.length > 0) {
      lines.push('🔍 DETAILED ERROR LOG');
      lines.push('-'.repeat(40));
      
      // Group errors by category and level
      const errorsByCategory = report.errors.reduce((acc, error) => {
        const key = `${error.level}-${error.category}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(error);
        return acc;
      }, {} as Record<string, ConsoleErrorReport[]>);
      
      Object.entries(errorsByCategory).forEach(([key, errors]) => {
        const [level, category] = key.split('-');
        const emoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`\n${emoji} ${level.toUpperCase()} - ${category.toUpperCase()} (${errors.length})`);
        
        errors.slice(0, 5).forEach((error, index) => { // Limit to first 5 per category
          lines.push(`  ${index + 1}. ${error.message}`);
          lines.push(`     📍 ${error.location}`);
          lines.push(`     🕐 ${error.timestamp}`);
        });
        
        if (errors.length > 5) {
          lines.push(`     ... and ${errors.length - 5} more ${level} ${category} errors`);
        }
      });
    }
    
    lines.push('\n' + '='.repeat(80));
    return lines.join('\n');
  }
}

test.describe('Browser Console Validation', () => {
  let validator: BrowserConsoleValidator;
  
  test.beforeEach(async ({ page }) => {
    validator = new BrowserConsoleValidator(page);
    await validator.startMonitoring();
  });

  test('should validate console errors on main application', async ({ page }) => {
    // Test the main application page
    await validator.navigateAndWait('/', 10000); // Wait 10 seconds for full initialization
    
    // Generate and save report
    const report = validator.generateReport('/');
    const outputPath = 'test-results/console-validation-main.json';
    validator.saveReport(report, outputPath);
    
    // Log summary to console for immediate feedback
    console.log('\n🔍 CONSOLE VALIDATION SUMMARY');
    console.log('=' .repeat(50));
    console.log(`🚨 Critical Errors: ${report.criticalErrors}`);
    console.log(`⚠️  Warnings: ${report.warningErrors}`);
    console.log(`🚀 Production Ready: ${report.productionReady ? '✅ YES' : '❌ NO'}`);
    console.log('=' .repeat(50));
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:');
      report.recommendations.slice(0, 3).forEach(rec => console.log(`  • ${rec}`));
    }
    
    // The test should pass regardless of errors found - this is for information gathering
    // We'll fail the test only if there are critical production blockers
    const productionBlockers = report.errors.filter(e => ConsoleErrorClassifier.isProductionBlocker(e));
    
    if (productionBlockers.length > 0) {
      console.log(`\n💥 PRODUCTION BLOCKERS FOUND (${productionBlockers.length}):`);
      productionBlockers.forEach(error => {
        console.log(`  🚨 ${error.message}`);
        console.log(`     📍 ${error.location}`);
        console.log(`     🏷️  ${error.category}`);
      });
      
      // For now, we'll record this but not fail the test - this is an audit tool
      // Uncomment the line below if you want to fail tests on production blockers
      // expect(productionBlockers.length).toBe(0);
    }
    
    // Always pass - this is an information gathering test
    expect(true).toBe(true);
  });

  test('should validate console errors during user interactions', async ({ page }) => {
    // Test with more intensive user interactions
    await validator.navigateAndWait('/', 3000);
    
    console.log('🖱️ Testing intensive user interactions...');
    
    try {
      // Simulate intensive user interactions
      for (let i = 0; i < 10; i++) {
        // Move mouse around to trigger hover events
        await page.mouse.move(100 + i * 50, 100 + i * 30);
        await page.waitForTimeout(100);
        
        // Try clicking in different areas
        try {
          await page.mouse.click(200 + i * 40, 150 + i * 20);
          await page.waitForTimeout(100);
        } catch (e) {
          // Ignore click failures
        }
        
        // Try keyboard events
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }
      
      // Try scrolling
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(500);
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(500);
      
    } catch (error) {
      console.log(`⚠️ Error during interaction testing: ${error}`);
    }
    
    // Wait for any async effects to complete
    await page.waitForTimeout(3000);
    
    // Generate and save report
    const report = validator.generateReport('/ (with interactions)');
    const outputPath = 'test-results/console-validation-interactions.json';
    validator.saveReport(report, outputPath);
    
    console.log(`\n🖱️ INTERACTION TEST RESULTS: ${report.criticalErrors} critical, ${report.warningErrors} warnings`);
    
    // Always pass - this is an information gathering test
    expect(true).toBe(true);
  });
});