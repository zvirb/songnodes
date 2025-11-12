import { test, expect } from '@playwright/test';

test('Debug graph visualization data flow', async ({ page }) => {
  // Enable console logging
  const consoleLogs: any[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    console.log(`[${msg.type().toUpperCase()}]`, text);
  });

  // Navigate to the application
  console.log('\n=== NAVIGATING TO APPLICATION ===');
  await page.goto('http://localhost:30006');

  // Wait for React to hydrate
  await page.waitForTimeout(2000);

  console.log('\n=== CHECKING API RESPONSE ===');
  // Intercept the API call
  const apiResponse = await page.waitForResponse(
    response => response.url().includes('/api/graph/data'),
    { timeout: 10000 }
  );

  const apiData = await apiResponse.json();
  console.log('API Response:', {
    nodes: apiData.nodes.length,
    edges: apiData.edges.length,
    firstNode: apiData.nodes[0]
  });

  console.log('\n=== CHECKING ZUSTAND STORE ===');
  // Check Zustand store state
  const storeState = await page.evaluate(() => {
    // @ts-ignore - accessing debug utility
    return window.debugZustand?.getState();
  });

  console.log('Zustand Store graphData:', {
    nodes: storeState?.graphData?.nodes?.length || 0,
    edges: storeState?.graphData?.edges?.length || 0,
    isLoading: storeState?.isLoading,
    error: storeState?.error
  });

  console.log('\n=== CHECKING PERFORMANCE METRICS ===');
  const performanceMetrics = await page.evaluate(() => {
    // @ts-ignore
    return window.debugZustand?.getState()?.performanceMetrics;
  });

  console.log('Performance Metrics:', performanceMetrics);

  console.log('\n=== CHECKING GRAPH VISUALIZATION LOGS ===');
  const graphLogs = consoleLogs.filter(log =>
    log.text.includes('[GraphVisualization]')
  );
  console.log('GraphVisualization Debug Logs:', graphLogs);

  console.log('\n=== CHECKING DOM FOR CANVAS ===');
  const canvasExists = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { exists: false };

    return {
      exists: true,
      width: canvas.width,
      height: canvas.height,
      style: canvas.style.cssText
    };
  });
  console.log('Canvas Element:', canvasExists);

  console.log('\n=== CHECKING PIXI APPLICATION ===');
  const pixiInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { initialized: false };

    // Check if PIXI is rendering anything
    return {
      initialized: true,
      canvasContext: !!canvas.getContext('2d'),
      // Try to get PIXI app from global scope (if exposed)
      hasPixiApp: typeof (window as any).PIXI !== 'undefined'
    };
  });
  console.log('PIXI Info:', pixiInfo);

  console.log('\n=== CHECKING useDataLoader EXECUTION ===');
  const dataLoaderLogs = consoleLogs.filter(log =>
    log.text.includes('Graph ready') ||
    log.text.includes('Failed to load') ||
    log.text.includes('Fallback loaded')
  );
  console.log('useDataLoader Logs:', dataLoaderLogs);

  console.log('\n=== FINAL STATE CHECK ===');
  // Wait a bit more for rendering
  await page.waitForTimeout(3000);

  const finalState = await page.evaluate(() => {
    // @ts-ignore
    const state = window.debugZustand?.getState();
    return {
      graphDataNodes: state?.graphData?.nodes?.length || 0,
      graphDataEdges: state?.graphData?.edges?.length || 0,
      metricsNodeCount: state?.performanceMetrics?.nodeCount || 0,
      metricsEdgeCount: state?.performanceMetrics?.edgeCount || 0,
      isLoading: state?.isLoading,
      error: state?.error,
      originalGraphData: state?.originalGraphData ? {
        nodes: state.originalGraphData.nodes.length,
        edges: state.originalGraphData.edges.length
      } : null
    };
  });
  console.log('Final Store State:', finalState);

  console.log('\n=== ALL CONSOLE LOGS ===');
  consoleLogs.forEach(log => {
    console.log(`[${log.type}] ${log.text}`);
  });

  // Take a screenshot
  await page.screenshot({ path: '/tmp/graph-debug.png', fullPage: true });
  console.log('\n=== Screenshot saved to /tmp/graph-debug.png ===');
});
