#!/usr/bin/env node

/**
 * Automated Browser Console Error Validation Script
 * 
 * This script uses Playwright to load the application and capture all console
 * errors, warnings, and other messages. It provides a production readiness
 * assessment based on the severity and type of errors found.
 * 
 * Usage:
 *   node scripts/validate-console-errors.js [url] [duration]
 *   
 * Examples:
 *   node scripts/validate-console-errors.js
 *   node scripts/validate-console-errors.js http://localhost:3006 15000
 *   node scripts/validate-console-errors.js https://production-app.com 20000
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_URL = 'http://localhost:3006';
const DEFAULT_DURATION = 10000; // 10 seconds
const OUTPUT_DIR = 'test-results';

class ConsoleErrorClassifier {
  static criticalKeywords = [
    'uncaught', 'error', 'exception', 'failed to load', 'network error',
    'syntax error', 'reference error', 'type error', 'cannot read property',
    'undefined is not a function', 'permission denied', 'access denied',
    'cors error', 'fetch failed', 'websocket error', 'redux', 'state',
    'action', 'reducer', 'pixi error', 'webgl error', 'canvas error'
  ];

  static warningKeywords = [
    'warning', 'deprecated', 'performance', 'memory', 'leak', 'slow',
    'inefficient', 'accessibility', 'a11y', 'contrast', 'aria',
    'react', 'component', 'prop', 'defaultprops', 'finddomnode', 'strict mode'
  ];

  static productionBlockers = [
    'uncaught error', 'uncaught exception', 'failed to load module',
    'network error', 'cors error', 'websocket connection failed',
    'redux store error', 'state update error', 'pixi.js error',
    'webgl error', 'canvas error', 'worker error', 'service worker error'
  ];

  static classifyMessage(type, text, url, lineNumber, columnNumber) {
    const message = text.toLowerCase();
    const timestamp = new Date().toISOString();

    let level = 'info';
    let category = 'general';

    // Classify by message content and console type
    if (type === 'error' || this.criticalKeywords.some(keyword => message.includes(keyword))) {
      level = 'critical';
    } else if (type === 'warning' || this.warningKeywords.some(keyword => message.includes(keyword))) {
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
      message: text,
      location: `${url}:${lineNumber}:${columnNumber}`,
      type,
      category
    };
  }

  static isProductionBlocker(error) {
    const message = error.message.toLowerCase();
    return this.productionBlockers.some(blocker => message.includes(blocker)) || 
           (error.level === 'critical' && error.category !== 'performance');
  }

  static generateRecommendations(errors) {
    const recommendations = [];
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
  constructor() {
    this.errors = [];
    this.startTime = 0;
  }

  async validateApplication(url = DEFAULT_URL, duration = DEFAULT_DURATION) {
    console.log(`🚀 Starting browser console validation...`);
    console.log(`📍 URL: ${url}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('=' .repeat(60));

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    this.startTime = Date.now();
    this.errors = [];

    // Set up console monitoring
    page.on('console', (msg) => {
      const args = msg.args();
      const location = msg.location();
      const error = ConsoleErrorClassifier.classifyMessage(
        msg.type(),
        msg.text(),
        location.url,
        location.lineNumber,
        location.columnNumber
      );
      this.errors.push(error);
      
      // Log critical errors immediately
      if (error.level === 'critical') {
        console.log(`🚨 CRITICAL: ${error.message}`);
      }
    });

    // Set up page error monitoring
    page.on('pageerror', (error) => {
      const errorReport = {
        timestamp: new Date().toISOString(),
        level: 'critical',
        message: `Uncaught Page Error: ${error.message}`,
        location: error.stack?.split('\n')[1] || 'unknown',
        type: 'pageerror',
        category: 'uncaught-exception',
        stack: error.stack
      };
      this.errors.push(errorReport);
      console.log(`💥 PAGE ERROR: ${error.message}`);
    });

    // Set up request failure monitoring
    page.on('requestfailed', (request) => {
      const errorReport = {
        timestamp: new Date().toISOString(),
        level: 'critical',
        message: `Request Failed: ${request.url()} - ${request.failure()?.errorText}`,
        location: request.url(),
        type: 'requestfailed',
        category: 'network/api'
      };
      this.errors.push(errorReport);
      console.log(`🌐 REQUEST FAILED: ${request.url()}`);
    });

    // Set up HTTP error monitoring
    page.on('response', (response) => {
      if (!response.ok() && response.status() >= 400) {
        const errorReport = {
          timestamp: new Date().toISOString(),
          level: response.status() >= 500 ? 'critical' : 'warning',
          message: `HTTP ${response.status()}: ${response.statusText()} - ${response.url()}`,
          location: response.url(),
          type: 'http-error',
          category: 'network/api'
        };
        this.errors.push(errorReport);
        console.log(`❌ HTTP ${response.status()}: ${response.url()}`);
      }
    });

    try {
      console.log(`🔍 Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle' });
      console.log('✅ Page loaded, monitoring console...');

      // Wait for the specified duration
      await page.waitForTimeout(duration);

      // Perform some basic interactions to trigger more code paths
      console.log('🖱️ Testing basic interactions...');
      try {
        // Try to click some buttons
        const buttons = await page.locator('button').all();
        for (let i = 0; i < Math.min(3, buttons.length); i++) {
          try {
            await buttons[i].click({ timeout: 1000 });
            await page.waitForTimeout(500);
          } catch (e) {
            // Ignore click failures
          }
        }

        // Try to interact with inputs
        const inputs = await page.locator('input').all();
        if (inputs.length > 0) {
          try {
            await inputs[0].fill('test input');
            await page.waitForTimeout(500);
          } catch (e) {
            // Ignore input failures
          }
        }

        // Scroll the page
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(1000);
        await page.mouse.wheel(0, -500);
        await page.waitForTimeout(1000);

      } catch (error) {
        console.log(`⚠️ Interaction testing error: ${error.message}`);
      }

      // Final wait for any async operations
      await page.waitForTimeout(2000);

    } catch (error) {
      console.log(`❌ Error during validation: ${error.message}`);
      const errorReport = {
        timestamp: new Date().toISOString(),
        level: 'critical',
        message: `Validation Error: ${error.message}`,
        location: 'validation-script',
        type: 'validation-error',
        category: 'validation'
      };
      this.errors.push(errorReport);
    } finally {
      await browser.close();
    }

    return this.generateReport(url);
  }

  generateReport(url) {
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
      productionBlockers: productionBlockers.length,
      errors: this.errors,
      recommendations: ConsoleErrorClassifier.generateRecommendations(this.errors)
    };
  }

  saveReport(report) {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(OUTPUT_DIR, `console-validation-${timestamp}.json`);
    const summaryPath = path.join(OUTPUT_DIR, `console-validation-${timestamp}-summary.txt`);

    // Save JSON report
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Save human-readable summary
    const summary = this.formatSummaryReport(report);
    fs.writeFileSync(summaryPath, summary);

    console.log(`\n📄 Reports saved:`);
    console.log(`   📋 JSON: ${jsonPath}`);
    console.log(`   📄 Summary: ${summaryPath}`);

    return { jsonPath, summaryPath };
  }

  formatSummaryReport(report) {
    const lines = [];
    
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
    lines.push(`🚫 Production Blockers: ${report.productionBlockers}`);
    lines.push('');
    
    const readinessIcon = report.productionReady ? '✅' : '❌';
    const readinessText = report.productionReady ? 'YES' : 'NO';
    lines.push(`🚀 PRODUCTION READY: ${readinessIcon} ${readinessText}`);
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
      }, {});
      
      Object.entries(errorsByCategory).forEach(([key, errors]) => {
        const [level, category] = key.split('-');
        const emoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`\n${emoji} ${level.toUpperCase()} - ${category.toUpperCase()} (${errors.length})`);
        
        errors.slice(0, 5).forEach((error, index) => {
          lines.push(`  ${index + 1}. ${error.message}`);
          lines.push(`     📍 ${error.location}`);
        });
        
        if (errors.length > 5) {
          lines.push(`     ... and ${errors.length - 5} more ${level} ${category} errors`);
        }
      });
    }
    
    lines.push('\n' + '='.repeat(80));
    return lines.join('\n');
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`📊 Total Messages: ${report.totalErrors}`);
    console.log(`🚨 Critical Errors: ${report.criticalErrors}`);
    console.log(`⚠️  Warnings: ${report.warningErrors}`);
    console.log(`🚫 Production Blockers: ${report.productionBlockers}`);
    
    const readinessIcon = report.productionReady ? '✅' : '❌';
    const readinessText = report.productionReady ? 'YES' : 'NO';
    console.log(`🚀 Production Ready: ${readinessIcon} ${readinessText}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      report.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    console.log('='.repeat(60));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const url = args[0] || DEFAULT_URL;
  const duration = parseInt(args[1]) || DEFAULT_DURATION;
  
  const validator = new BrowserConsoleValidator();
  
  try {
    const report = await validator.validateApplication(url, duration);
    
    // Print summary to console
    validator.printSummary(report);
    
    // Save detailed reports
    validator.saveReport(report);
    
    // Set exit code based on production readiness
    const exitCode = report.productionReady ? 0 : 1;
    
    if (!report.productionReady) {
      console.log('\n❌ Validation failed - application not ready for production');
      console.log(`🚫 Found ${report.productionBlockers} production-blocking errors`);
    } else {
      console.log('\n✅ Validation passed - application appears ready for production');
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error(`💥 Validation failed with error: ${error.message}`);
    process.exit(1);
  }
}

// Run main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}