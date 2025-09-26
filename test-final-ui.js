const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept API responses to see what data is being loaded
  let nodeData = null;
  let edgeData = null;

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/graph/nodes')) {
      try {
        nodeData = await response.json();
        console.log('\n=== Nodes API Response ===');
        console.log('URL:', url);
        console.log('Status:', response.status());
        console.log('Total nodes returned:', nodeData.nodes?.length || 0);
        if (nodeData.nodes?.length > 0) {
          console.log('First 3 nodes:');
          nodeData.nodes.slice(0, 3).forEach(node => {
            console.log(`  - ${node.metadata?.artist} - ${node.metadata?.title}`);
          });
        }
      } catch (e) {}
    }
    if (url.includes('/api/graph/edges')) {
      try {
        edgeData = await response.json();
        console.log('\n=== Edges API Response ===');
        console.log('Total edges returned:', edgeData.edges?.length || 0);
      } catch (e) {}
    }
  });

  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('Filtered')) {
      console.log('\n=== Frontend Processing ===');
      console.log(msg.text());
    }
  });

  console.log('Loading http://localhost:3006...');
  await page.goto('http://localhost:3006/');
  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: 'ui-final-state.png' });
  console.log('\n=== Screenshot saved as ui-final-state.png ===');

  // Check what's actually rendered in the DOM
  const graphInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const container = document.querySelector('.graph-canvas');

    // Try to get info from PIXI if available
    let pixiInfo = null;
    if (window.PIXI && canvas && canvas.__pixi_app__) {
      const app = canvas.__pixi_app__;
      pixiInfo = {
        children: app.stage.children.length,
        renderables: app.stage.children.filter(c => c.visible).length
      };
    }

    return {
      hasCanvas: !!canvas,
      canvasVisible: canvas?.offsetParent !== null,
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
      containerSize: container ? `${container.clientWidth}x${container.clientHeight}` : 'N/A',
      pixiInfo
    };
  });

  console.log('\n=== Graph Rendering Info ===');
  console.log('Canvas present:', graphInfo.hasCanvas);
  console.log('Canvas visible:', graphInfo.canvasVisible);
  console.log('Canvas size:', graphInfo.canvasSize);
  console.log('Container size:', graphInfo.containerSize);
  if (graphInfo.pixiInfo) {
    console.log('PIXI stage children:', graphInfo.pixiInfo.children);
    console.log('PIXI visible objects:', graphInfo.pixiInfo.renderables);
  }

  await browser.close();

  console.log('\n=== Summary ===');
  if (nodeData && nodeData.nodes?.length > 0) {
    const hasTestTracks = nodeData.nodes.some(n =>
      n.metadata?.artist === 'Unknown' ||
      n.metadata?.title?.includes('Test') ||
      n.metadata?.title?.includes('Track')
    );
    console.log('Test tracks found:', hasTestTracks ? 'YES ⚠️' : 'NO ✅');
    console.log('Data type:', hasTestTracks ? 'Contains test data' : 'Real music data only');
  }
})();