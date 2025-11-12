import { test, expect } from '@playwright/test';

test('Check if GraphVisualization component is mounted', async ({ page }) => {
  const consoleLogs: string[] = [];

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  console.log('\n=== LOADING APPLICATION ===');
  await page.goto('http://localhost:30006', { waitUntil: 'networkidle' });

  console.log('\n=== CHECKING DOM STRUCTURE ===');

  // Check if onboarding modal is present
  const hasOnboarding = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid*="onboarding"]') ||
                  document.querySelector('.onboarding-modal') ||
                  document.querySelector('.modal');
    return {
      exists: !!modal,
      text: modal?.textContent?.substring(0, 100)
    };
  });
  console.log('Onboarding Modal:', hasOnboarding);

  // Check if canvas exists
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      exists: !!canvas,
      count: document.querySelectorAll('canvas').length,
      visible: canvas ? window.getComputedStyle(canvas).display !== 'none' : false,
      dimensions: canvas ? { width: canvas.width, height: canvas.height } : null
    };
  });
  console.log('Canvas Info:', canvasInfo);

  // Check if GraphVisualization wrapper exists
  const graphVizInfo = await page.evaluate(() => {
    const selectors = [
      '[data-testid="graph-visualization"]',
      '.graph-visualization',
      '[class*="GraphVisualization"]',
      'div[class*="graph"]'
    ];

    const results = selectors.map(sel => ({
      selector: sel,
      count: document.querySelectorAll(sel).length
    }));

    return results.filter(r => r.count > 0);
  });
  console.log('GraphVisualization DOM elements:', graphVizInfo);

  console.log('\n=== CHECKING CONSOLE LOGS ===');
  const graphLogs = consoleLogs.filter(log =>
    log.includes('GraphVisualization') ||
    log.includes('PIXI') ||
    log.includes('Store subscription')
  );
  console.log('Relevant logs:', graphLogs.length);
  graphLogs.forEach(log => console.log(log));

  console.log('\n=== CLICKING START EXPLORING ===');
  // Try to find and click the "Start exploring" or similar button
  const buttonSelectors = [
    'button:has-text("Start exploring")',
    'button:has-text("Get started")',
    'button:has-text("Close")',
    'button:has-text("Don\'t show again")'
  ];

  for (const selector of buttonSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1000 })) {
        console.log(`Found button: ${selector}`);
        await button.click();
        console.log('Clicked button, waiting for modal to close...');
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) {
      // Try next selector
    }
  }

  console.log('\n=== AFTER DISMISSING MODAL ===');
  await page.waitForTimeout(3000);

  // Check console logs again
  const newLogs = consoleLogs.filter(log =>
    log.includes('GraphVisualization') ||
    log.includes('Store subscription')
  );
  console.log('New console logs:', newLogs.length);
  newLogs.slice(-10).forEach(log => console.log(log));

  // Check Zustand store
  const storeState = await page.evaluate(() => {
    // @ts-ignore
    const state = window.debugZustand?.getState();
    return {
      graphDataNodes: state?.graphData?.nodes?.length || 0,
      graphDataEdges: state?.graphData?.edges?.length || 0,
      performanceNodeCount: state?.performanceMetrics?.nodeCount || 0,
      performanceEdgeCount: state?.performanceMetrics?.edgeCount || 0
    };
  });
  console.log('\n=== ZUSTAND STORE ===');
  console.log(JSON.stringify(storeState, null, 2));

  // Take final screenshot
  await page.screenshot({ path: '/tmp/after-onboarding.png', fullPage: true });
  console.log('\n=== Screenshot saved to /tmp/after-onboarding.png ===');
});
