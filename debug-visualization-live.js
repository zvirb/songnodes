const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Enable detailed console logging
  page.on('console', msg => {
    console.log('[CONSOLE]', msg.text());
  });

  console.log('Loading http://localhost:3006...');
  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(3000);

  // Take initial screenshot
  await page.screenshot({ path: 'debug-initial.png', fullPage: true });

  // Get detailed information about what's actually rendered
  const debugInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');

    let pixiDebug = { error: 'No PIXI found' };
    if (window.PIXI && canvas) {
      try {
        const app = canvas.__pixi_app__ || window.__PIXI_APP__;
        if (app && app.stage) {
          const stage = app.stage;

          // Find containers
          const containers = {};
          stage.children.forEach((child, i) => {
            containers[`child_${i}`] = {
              name: child.name || 'unnamed',
              visible: child.visible,
              childCount: child.children ? child.children.length : 0,
              alpha: child.alpha,
              scale: child.scale ? { x: child.scale.x, y: child.scale.y } : 'no scale'
            };
          });

          // Try to find specific containers by name
          const edgesContainer = stage.children.find(c => c.name === 'edges');
          const nodesContainer = stage.children.find(c => c.name === 'nodes');

          pixiDebug = {
            stageChildren: stage.children.length,
            stageVisible: stage.visible,
            stageAlpha: stage.alpha,
            stageScale: { x: stage.scale.x, y: stage.scale.y },
            stagePosition: { x: stage.x, y: stage.y },
            containers,
            edgesContainer: edgesContainer ? {
              visible: edgesContainer.visible,
              children: edgesContainer.children.length,
              alpha: edgesContainer.alpha,
              firstChildType: edgesContainer.children[0] ? edgesContainer.children[0].constructor.name : 'none'
            } : 'not found',
            nodesContainer: nodesContainer ? {
              visible: nodesContainer.visible,
              children: nodesContainer.children.length,
              alpha: nodesContainer.alpha,
              firstChildType: nodesContainer.children[0] ? nodesContainer.children[0].constructor.name : 'none'
            } : 'not found'
          };
        }
      } catch (e) {
        pixiDebug = { error: e.message, stack: e.stack };
      }
    }

    return {
      canvasExists: !!canvas,
      canvasVisible: canvas ? canvas.offsetParent !== null : false,
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
      canvasStyle: canvas ? {
        display: canvas.style.display,
        visibility: canvas.style.visibility,
        opacity: canvas.style.opacity
      } : null,
      pixiDebug
    };
  });

  console.log('\n=== DETAILED DEBUG INFO ===');
  console.log(JSON.stringify(debugInfo, null, 2));

  // Test zoom behavior and see what happens
  console.log('\n=== TESTING ZOOM ===');

  // Zoom in
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const wheelEvent = new WheelEvent('wheel', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        deltaY: -500, // Strong zoom in
        bubbles: true,
        cancelable: true
      });
      canvas.dispatchEvent(wheelEvent);
    }
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'debug-zoomed-in.png', fullPage: true });

  // Check state after zoom
  const afterZoomInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');

    let zoomDebug = { error: 'No PIXI found' };
    if (window.PIXI && canvas) {
      try {
        const app = canvas.__pixi_app__ || window.__PIXI_APP__;
        if (app && app.stage) {
          const stage = app.stage;

          const nodesContainer = stage.children.find(c => c.name === 'nodes');
          const edgesContainer = stage.children.find(c => c.name === 'edges');

          zoomDebug = {
            stageScale: { x: stage.scale.x, y: stage.scale.y },
            stagePosition: { x: stage.x, y: stage.y },
            nodesVisible: nodesContainer ? nodesContainer.visible : 'not found',
            nodesChildren: nodesContainer ? nodesContainer.children.length : 0,
            edgesVisible: edgesContainer ? edgesContainer.visible : 'not found',
            edgesChildren: edgesContainer ? edgesContainer.children.length : 0,
            visibleNodeDetails: nodesContainer && nodesContainer.children.length > 0 ? {
              firstNodeVisible: nodesContainer.children[0].visible,
              firstNodeAlpha: nodesContainer.children[0].alpha,
              firstNodeScale: nodesContainer.children[0].scale ?
                { x: nodesContainer.children[0].scale.x, y: nodesContainer.children[0].scale.y } : 'no scale'
            } : 'no nodes'
          };
        }
      } catch (e) {
        zoomDebug = { error: e.message };
      }
    }

    return zoomDebug;
  });

  console.log('\n=== AFTER ZOOM DEBUG ===');
  console.log(JSON.stringify(afterZoomInfo, null, 2));

  await browser.close();
})();