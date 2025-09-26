const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Track console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error')) {
      console.log('Console error:', text);
    }
    if (text.includes('Filtered') || text.includes('edges from')) {
      console.log('Data loading:', text);
    }
  });

  console.log('Loading http://localhost:3006...');
  await page.goto('http://localhost:3006/');

  // Wait for graph to stabilize
  console.log('Waiting for graph to render and stabilize...');
  await page.waitForTimeout(8000);

  // Take screenshot
  await page.screenshot({ path: 'ui-visualization-fixed.png', fullPage: true });
  console.log('Screenshot saved as ui-visualization-fixed.png');

  // Check visualization state
  const visualizationInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');

    // Try to access PIXI app
    let pixiDetails = null;
    if (window.PIXI && canvas) {
      try {
        // Look for the PIXI app stored on canvas
        const app = canvas.__pixi_app__ || window.__PIXI_APP__;
        if (app && app.stage) {
          const countChildren = (container) => {
            let count = 0;
            container.children.forEach(child => {
              count++;
              if (child.children && child.children.length > 0) {
                count += countChildren(child);
              }
            });
            return count;
          };

          pixiDetails = {
            stageChildren: app.stage.children.length,
            totalObjects: countChildren(app.stage),
            visibleObjects: app.stage.children.filter(c => c.visible).length
          };
        }
      } catch(e) {
        pixiDetails = { error: e.message };
      }
    }

    // Check for any visible nodes/edges in DOM (fallback)
    const svgNodes = document.querySelectorAll('circle').length;
    const svgEdges = document.querySelectorAll('line').length;

    return {
      canvasPresent: !!canvas,
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
      pixiDetails,
      svgElements: { nodes: svgNodes, edges: svgEdges },
      statisticsText: document.querySelector('.text-sm.text-gray-400')?.textContent || 'No stats found'
    };
  });

  console.log('\n=== Visualization Status ===');
  console.log('Canvas present:', visualizationInfo.canvasPresent);
  console.log('Canvas size:', visualizationInfo.canvasSize);
  if (visualizationInfo.pixiDetails) {
    console.log('PIXI details:', visualizationInfo.pixiDetails);
  }
  console.log('Statistics:', visualizationInfo.statisticsText);

  await browser.close();
})();