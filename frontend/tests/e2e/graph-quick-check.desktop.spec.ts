import { test, expect } from '@playwright/test';

test.describe('Graph Quick Check', () => {
  test('should load page and capture current state', async ({ page }) => {
    console.log('🚀 Navigating to app...');
    await page.goto('http://localhost:3006', { timeout: 15000 });

    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    console.log('📦 Checking for graph container...');
    const container = page.locator('.graph-canvas, .graph-container, .graph-visualization').first();
    const containerExists = await container.count() > 0;
    console.log('Container exists:', containerExists);

    if (containerExists) {
      const box = await container.boundingBox();
      console.log('📐 Container dimensions:', box);
    }

    console.log('🎨 Checking for canvas...');
    const canvas = page.locator('canvas').first();
    const canvasExists = await canvas.count() > 0;
    console.log('Canvas exists:', canvasExists);

    if (canvasExists) {
      const canvasBox = await canvas.boundingBox();
      console.log('🎨 Canvas dimensions:', canvasBox);
    }

    // Collect console logs
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      console.log('📝 Console:', text);
    });

    // Wait a bit for initialization
    await page.waitForTimeout(5000);

    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({
      path: 'tests/e2e/screenshots/graph-current-state.png',
      fullPage: false
    });

    console.log('✅ Test complete');
    console.log('📊 Total console logs captured:', logs.length);

    // Print summary of important logs
    const importantLogs = logs.filter(log =>
      log.includes('PIXI') ||
      log.includes('Container') ||
      log.includes('Zoom') ||
      log.includes('viewport') ||
      log.includes('🎯') ||
      log.includes('🚀')
    );
    console.log('\n📋 Important logs:');
    importantLogs.forEach(log => console.log('  ', log));

    expect(true).toBe(true); // Always pass to see the logs
  });
});
