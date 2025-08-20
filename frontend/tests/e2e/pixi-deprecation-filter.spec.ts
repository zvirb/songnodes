import { test, expect } from '@playwright/test';

test.describe('PIXI Deprecation Filter', () => {
  test('should filter out known PIXI deprecation warnings but preserve legitimate console messages', async ({ page }) => {
    // Array to capture console messages
    const consoleMessages: Array<{ type: string; text: string }> = [];
    
    // Listen to all console events
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load - use a more generic selector
    await page.waitForSelector('canvas', { timeout: 15000 });
    
    // Wait for PIXI to initialize and potential deprecation warnings
    await page.waitForTimeout(3000);
    
    // Check that the filter was initialized
    const filterInitMessage = consoleMessages.find(msg => 
      msg.text.includes('[PixiDeprecationFilter] Initialized')
    );
    expect(filterInitMessage).toBeTruthy();
    
    // Verify that specific PIXI deprecation warnings are NOT present
    const pixiDeprecationWarnings = consoleMessages.filter(msg =>
      msg.text.includes('renderer.plugins.interaction has been deprecated') ||
      msg.text.includes('Setting interactive is deprecated, use eventMode')
    );
    
    expect(pixiDeprecationWarnings).toHaveLength(0);
    
    // Test that legitimate console messages still work by triggering a manual test
    await page.evaluate(() => {
      console.warn('Test warning - should appear');
      console.log('Test log - should appear');
      console.error('Test error - should appear');
    });
    
    // Wait for the messages to be captured
    await page.waitForTimeout(500);
    
    // Verify legitimate messages are still captured
    const testWarning = consoleMessages.find(msg => 
      msg.text.includes('Test warning - should appear') && msg.type === 'warning'
    );
    const testLog = consoleMessages.find(msg => 
      msg.text.includes('Test log - should appear') && msg.type === 'log'
    );
    const testError = consoleMessages.find(msg => 
      msg.text.includes('Test error - should appear') && msg.type === 'error'
    );
    
    expect(testWarning).toBeTruthy();
    expect(testLog).toBeTruthy();
    expect(testError).toBeTruthy();
  });

  test('should not suppress unknown warnings or errors', async ({ page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    await page.goto('/');
    
    // Simulate a non-PIXI deprecation warning
    await page.evaluate(() => {
      console.warn('Some other library deprecation warning');
      console.warn('Unknown warning that should not be filtered');
    });
    
    await page.waitForTimeout(500);
    
    // These should NOT be filtered out
    const otherWarnings = consoleMessages.filter(msg =>
      msg.text.includes('Some other library deprecation warning') ||
      msg.text.includes('Unknown warning that should not be filtered')
    );
    
    expect(otherWarnings).toHaveLength(2);
  });

  test('should handle production environment correctly', async ({ page }) => {
    // Test that the filter is properly configured for production
    const consoleMessages: Array<{ type: string; text: string }> = [];
    
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Check filter initialization message shows environment mode
    const filterMessage = consoleMessages.find(msg => 
      msg.text.includes('[PixiDeprecationFilter] Initialized')
    );
    
    expect(filterMessage).toBeTruthy();
    expect(filterMessage?.text).toMatch(/development|production|forced/);
  });
});