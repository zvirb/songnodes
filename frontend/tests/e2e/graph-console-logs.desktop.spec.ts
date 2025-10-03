import { test } from '@playwright/test';

test('capture all console logs', async ({ page }) => {
  const allLogs: string[] = [];

  // Capture ALL console messages
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(`[${msg.type()}] ${text}`);
  });

  await page.goto('http://localhost:3006', { timeout: 15000 });

  // Wait for data to load
  await page.waitForFunction(() => {
    const header = document.querySelector('header');
    const text = header?.textContent || '';
    return text.includes('Tracks Loaded') && !text.includes('0 Tracks');
  }, { timeout: 20000 });

  // Wait for graph to initialize
  await page.waitForTimeout(8000);

  // Print all logs
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📋 ALL CONSOLE LOGS:');
  console.log('═══════════════════════════════════════════════════════\n');

  allLogs.forEach(log => console.log(log));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`📊 Total logs: ${allLogs.length}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Filter important logs
  const pixiLogs = allLogs.filter(log => log.includes('PIXI'));
  const transformLogs = allLogs.filter(log => log.includes('🎯') || log.includes('🚀'));
  const containerLogs = allLogs.filter(log => log.includes('Container') || log.includes('viewport'));
  const nodeLogs = allLogs.filter(log => log.includes('Node') || log.includes('node'));
  const errorLogs = allLogs.filter(log => log.includes('[error]'));

  console.log('🎨 PIXI logs:', pixiLogs.length);
  console.log('🎯 Transform logs:', transformLogs.length);
  console.log('📦 Container/viewport logs:', containerLogs.length);
  console.log('🔵 Node logs:', nodeLogs.length);
  console.log('❌ Error logs:', errorLogs.length);

  if (transformLogs.length > 0) {
    console.log('\n🎯 Transform Details:');
    transformLogs.forEach(log => console.log('  ', log));
  }

  if (errorLogs.length > 0) {
    console.log('\n❌ Errors:');
    errorLogs.forEach(log => console.log('  ', log));
  }

  // Get node count from the page
  const nodeInfo = await page.evaluate(() => {
    const app = (window as any).pixiApp;
    if (!app) return { error: 'No PIXI app' };

    let nodeCount = 0;
    const countNodes = (container: any): number => {
      let total = 0;
      if (container.label === 'sprite') total++;
      if (container.children) {
        container.children.forEach((child: any) => {
          total += countNodes(child);
        });
      }
      return total;
    };

    return {
      stageChildren: app.stage.children.length,
      totalSprites: countNodes(app.stage),
      stagePosition: { x: app.stage.x, y: app.stage.y },
      stageScale: app.stage.scale.x
    };
  });

  console.log('\n🎮 PIXI Stage Info:', JSON.stringify(nodeInfo, null, 2));
});
