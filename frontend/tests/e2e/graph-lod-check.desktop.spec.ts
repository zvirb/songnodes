import { test } from '@playwright/test';

test('check LOD system and node rendering', async ({ page }) => {
  const consoleLogs: string[] = [];

  // Capture all console logs
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
  });

  await page.goto('http://localhost:3006', { timeout: 15000 });

  // Wait for data to load
  await page.waitForFunction(() => {
    const header = document.querySelector('header');
    const text = header?.textContent || '';
    return text.includes('Tracks Loaded') && !text.includes('0 Tracks');
  }, { timeout: 20000 });

  // Wait for graph to render
  await page.waitForTimeout(10000);

  // Get LOD data directly from the page
  const lodInfo = await page.evaluate(() => {
    const nodes = (window as any).enhancedNodesRef?.current;
    if (!nodes) return { error: 'No nodes ref' };

    const lodSystem = (window as any).pixiApp?.__lodSystem;
    if (!lodSystem) return { error: 'No LOD system' };

    const samples: any[] = [];
    let count = 0;
    nodes.forEach((node: any) => {
      if (count < 10) {
        // Manually calculate LOD to see what's happening
        const viewport = { width: 1390, height: 800, x: 0, y: 0, zoom: 1 };

        // Check if node is in viewport
        const nodeX = node.x || 0;
        const nodeY = node.y || 0;

        samples.push({
          id: node.id.substring(0, 25),
          x: Math.round(nodeX),
          y: Math.round(nodeY),
          pixiVisible: node.pixiNode?.visible || false,
          pixiX: Math.round(node.pixiNode?.x || 0),
          pixiY: Math.round(node.pixiNode?.y || 0),
          isVisible: node.isVisible || false,
          lodLevel: node.lodLevel,
          lastUpdateFrame: node.lastUpdateFrame
        });
        count++;
      }
    });

    return {
      totalNodes: nodes.size,
      samples,
      viewport: {
        width: (window as any).pixiApp.canvas.width,
        height: (window as any).pixiApp.canvas.height,
        stageX: (window as any).pixiApp.stage.x,
        stageY: (window as any).pixiApp.stage.y
      }
    };
  });

  console.log('\n📊 LOD Analysis:');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(JSON.stringify(lodInfo, null, 2));
  console.log('\n═══════════════════════════════════════════════════════');

  // Filter for render check logs
  const renderLogs = consoleLogs.filter(log => log.includes('Render check') || log.includes('LOD samples'));
  console.log('\n🎨 Render Loop Logs:');
  renderLogs.forEach(log => console.log(' ', log));
});
