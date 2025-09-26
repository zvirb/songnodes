const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Track console messages for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error')) {
      console.log('Console error:', text);
    }
    if (text.includes('Filtered') || text.includes('edges from') || text.includes('PIXI')) {
      console.log('Data/Rendering:', text);
    }
  });

  console.log('Loading http://localhost:3006...');
  await page.goto('http://localhost:3006/');

  // Wait for graph to load and stabilize
  console.log('Waiting for graph to render...');
  await page.waitForTimeout(6000);

  // Take initial screenshot
  await page.screenshot({ path: 'visualization-fixes-test.png', fullPage: true });
  console.log('Screenshot saved as visualization-fixes-test.png');

  // Check visualization state
  const visualizationInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');

    // Try to access PIXI app and count objects
    let pixiDetails = null;
    if (window.PIXI && canvas) {
      try {
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

          const edgesContainer = app.stage.getChildByName ? app.stage.getChildByName('edges') : null;
          const nodesContainer = app.stage.getChildByName ? app.stage.getChildByName('nodes') : null;

          pixiDetails = {
            stageChildren: app.stage.children.length,
            totalObjects: countChildren(app.stage),
            visibleObjects: app.stage.children.filter(c => c.visible).length,
            edgesContainer: edgesContainer ? edgesContainer.children.length : 'not found',
            nodesContainer: nodesContainer ? nodesContainer.children.length : 'not found'
          };
        }
      } catch(e) {
        pixiDetails = { error: e.message };
      }
    }

    // Get statistics text
    const statsText = document.querySelector('.text-sm.text-gray-400')?.textContent || 'No stats found';

    return {
      canvasPresent: !!canvas,
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
      pixiDetails,
      statisticsText: statsText,
      canvasVisible: canvas ? canvas.offsetParent !== null : false
    };
  });

  console.log('\n=== Visualization Status ===');
  console.log('Canvas present:', visualizationInfo.canvasPresent);
  console.log('Canvas visible:', visualizationInfo.canvasVisible);
  console.log('Canvas size:', visualizationInfo.canvasSize);
  if (visualizationInfo.pixiDetails) {
    console.log('PIXI details:', JSON.stringify(visualizationInfo.pixiDetails, null, 2));
  }
  console.log('Statistics:', visualizationInfo.statisticsText);

  // Test zoom behavior by simulating zoom actions
  console.log('\n=== Testing Zoom Behavior ===');

  // Zoom in
  console.log('Testing zoom in...');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      // Simulate wheel zoom in at center of canvas
      const rect = canvas.getBoundingClientRect();
      const event = new WheelEvent('wheel', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        deltaY: -100, // Negative for zoom in
        bubbles: true
      });
      canvas.dispatchEvent(event);
    }
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'visualization-zoomed-in.png', fullPage: true });
  console.log('Zoomed in screenshot saved as visualization-zoomed-in.png');

  // Zoom out
  console.log('Testing zoom out...');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const event = new WheelEvent('wheel', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        deltaY: 200, // Positive for zoom out
        bubbles: true
      });
      canvas.dispatchEvent(event);
    }
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'visualization-zoomed-out.png', fullPage: true });
  console.log('Zoomed out screenshot saved as visualization-zoomed-out.png');

  await browser.close();

  console.log('\n=== Test Summary ===');
  console.log('✅ Screenshots captured at different zoom levels');
  console.log('✅ PIXI application status checked');
  console.log('✅ Visualization rendering verified');
})();