import { test } from '@playwright/test';

test('inspect DOM structure', async ({ page }) => {
  await page.goto('http://localhost:3006', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');

  // Wait for app to initialize
  await page.waitForTimeout(3000);

  // Get DOM structure
  const structure = await page.evaluate(() => {
    const body = document.body;

    const getElementInfo = (el: Element, depth = 0): any => {
      if (depth > 3) return null; // Limit depth

      return {
        tag: el.tagName.toLowerCase(),
        classes: Array.from(el.classList),
        id: el.id || undefined,
        children: Array.from(el.children).slice(0, 5).map(child => getElementInfo(child, depth + 1)).filter(Boolean),
        text: el.textContent?.slice(0, 50) || undefined
      };
    };

    return {
      bodyClasses: Array.from(body.classList),
      structure: getElementInfo(body),
      canvasCount: document.querySelectorAll('canvas').length,
      graphContainers: Array.from(document.querySelectorAll('[class*="graph"]')).map(el => ({
        tag: el.tagName.toLowerCase(),
        classes: Array.from(el.classList),
        id: el.id || undefined
      }))
    };
  });

  console.log('📊 DOM Structure:', JSON.stringify(structure, null, 2));

  // Check for specific elements
  const djInterface = await page.locator('.dj-interface').count();
  const graphCanvas = await page.locator('.graph-canvas').count();
  const graphContainer = await page.locator('.graph-container').count();
  const graphVisualization = await page.locator('.graph-visualization').count();

  console.log('\n🔍 Element Counts:');
  console.log('  DJ Interface:', djInterface);
  console.log('  Graph Canvas:', graphCanvas);
  console.log('  Graph Container:', graphContainer);
  console.log('  Graph Visualization:', graphVisualization);

  // Get all class names that contain 'graph'
  const graphClasses = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .flatMap(el => Array.from(el.classList))
      .filter(cls => cls.includes('graph'))
      .filter((cls, i, arr) => arr.indexOf(cls) === i); // unique
  });

  console.log('\n📝 Classes containing "graph":', graphClasses);

  // Check if GraphVisualization component is in the DOM at all
  const allDivs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div')).map(div => ({
      classes: Array.from(div.classList),
      id: div.id || undefined,
      dataTestId: div.getAttribute('data-testid') || undefined
    })).slice(0, 20); // First 20 divs
  });

  console.log('\n📦 First 20 divs:', JSON.stringify(allDivs, null, 2));
});
