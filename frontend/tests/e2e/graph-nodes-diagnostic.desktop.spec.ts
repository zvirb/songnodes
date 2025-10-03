import { test } from '@playwright/test';

test('diagnose node positioning and visibility', async ({ page }) => {
  await page.goto('http://localhost:3006', { timeout: 15000 });

  // Wait for data to load
  console.log('⏳ Waiting for data to load...');
  await page.waitForFunction(() => {
    const header = document.querySelector('header');
    const text = header?.textContent || '';
    return text.includes('Tracks Loaded') && !text.includes('0 Tracks');
  }, { timeout: 20000 });
  console.log('✅ Data loaded!');

  // Wait for graph to initialize
  await page.waitForTimeout(8000);

  // Get detailed node information
  const nodeInfo = await page.evaluate(() => {
    const app = (window as any).pixiApp;
    if (!app) return { error: 'No PIXI app' };

    // Find the nodesContainer
    const nodesContainer = app.stage.children.find((child: any) => child.label === 'nodes');
    if (!nodesContainer) return { error: 'No nodes container found' };

    // Get all node positions
    const nodePositions = nodesContainer.children.map((child: any, index: number) => ({
      index,
      x: child.x,
      y: child.y,
      position: child.position ? { x: child.position.x, y: child.position.y } : null,
      visible: child.visible,
      alpha: child.alpha,
      childrenCount: child.children?.length || 0,
      hasCircle: child.children?.some((c: any) => c.constructor.name === 'Graphics') || false
    })).slice(0, 20); // First 20 nodes

    // Count nodes at (0,0)
    const nodesAtOrigin = nodesContainer.children.filter((child: any) =>
      child.x === 0 && child.y === 0
    ).length;

    // Count nodes with non-zero positions
    const nodesWithPositions = nodesContainer.children.filter((child: any) =>
      child.x !== 0 || child.y !== 0
    ).length;

    // Get unique positions
    const positionMap = new Map<string, number>();
    nodesContainer.children.forEach((child: any) => {
      const key = `${child.x},${child.y}`;
      positionMap.set(key, (positionMap.get(key) || 0) + 1);
    });

    const uniquePositions = Array.from(positionMap.entries()).map(([pos, count]) => ({
      position: pos,
      count
    })).slice(0, 10); // Top 10 most common positions

    return {
      totalNodes: nodesContainer.children.length,
      nodesAtOrigin,
      nodesWithPositions,
      samplePositions: nodePositions,
      uniquePositions,
      stagePosition: { x: app.stage.x, y: app.stage.y },
      stageScale: app.stage.scale.x,
      canvasSize: { width: app.canvas.width, height: app.canvas.height }
    };
  });

  console.log('\n📊 Node Diagnostic Info:');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(JSON.stringify(nodeInfo, null, 2));
  console.log('\n═══════════════════════════════════════════════════════');

  // Get simulation state
  const simInfo = await page.evaluate(() => {
    const nodes = (window as any).enhancedNodesRef?.current || new Map();
    const sampleNodes = Array.from(nodes.entries()).slice(0, 5).map(([id, node]: [string, any]) => ({
      id,
      x: node.x,
      y: node.y,
      vx: node.vx,
      vy: node.vy,
      hasPixiNode: !!node.pixiNode,
      pixiNodePosition: node.pixiNode ? { x: node.pixiNode.x, y: node.pixiNode.y } : null
    }));

    return {
      totalEnhancedNodes: nodes.size,
      sampleNodes
    };
  });

  console.log('\n🔬 Enhanced Nodes Ref State:');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(JSON.stringify(simInfo, null, 2));
  console.log('\n═══════════════════════════════════════════════════════');
});
