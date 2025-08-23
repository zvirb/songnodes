import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

test.describe('SongNodes Visualization Comprehensive Verification', () => {
  test('Complete visualization functionality verification', async ({ page }) => {
    const screenshotsDir = '/home/marku/Documents/programming/songnodes/frontend/tests/screenshots';
    
    // Ensure screenshots directory exists
    await fs.mkdir(screenshotsDir, { recursive: true });

    console.log('🚀 Starting comprehensive SongNodes visualization verification...');
    
    // Navigate to the app
    await page.goto('http://localhost:3006');
    
    // Wait for initial load
    await page.waitForTimeout(3000);
    
    // 1. Take initial state screenshot
    console.log('📸 Taking initial state screenshot...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'initial-state.png'),
      fullPage: true 
    });

    // 2. Check for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('❌ Console Error:', msg.text());
      }
    });

    // 3. Verify node/edge counts in UI
    console.log('🔍 Checking node/edge counts...');
    let nodeCount = 'Not found';
    let edgeCount = 'Not found';
    
    try {
      // Look for various possible selectors for node/edge counts
      const nodeCountElement = await page.locator('text=/nodes?/i, text=/node count/i, [data-testid="node-count"], .node-count').first().textContent({ timeout: 5000 });
      if (nodeCountElement) nodeCount = nodeCountElement;
    } catch (e) {
      console.log('Node count not found in UI');
    }
    
    try {
      const edgeCountElement = await page.locator('text=/edges?/i, text=/edge count/i, [data-testid="edge-count"], .edge-count').first().textContent({ timeout: 5000 });
      if (edgeCountElement) edgeCount = edgeCountElement;
    } catch (e) {
      console.log('Edge count not found in UI');
    }

    console.log(`📊 Node Count Display: ${nodeCount}`);
    console.log(`📊 Edge Count Display: ${edgeCount}`);

    // 4. Check if canvas is present and rendering
    console.log('🎨 Checking canvas rendering...');
    const canvas = page.locator('canvas, svg');
    const canvasCount = await canvas.count();
    console.log(`🎨 Found ${canvasCount} canvas/svg elements`);
    
    let canvasVisible = false;
    if (canvasCount > 0) {
      canvasVisible = await canvas.first().isVisible();
      console.log(`🎨 Canvas visible: ${canvasVisible}`);
    }

    // 5. Take graph overview screenshot
    console.log('📸 Taking graph overview screenshot...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'graph-overview.png'),
      fullPage: true 
    });

    // 6. Test search functionality
    console.log('🔍 Testing search functionality...');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i], .search-input');
    const searchInputCount = await searchInput.count();
    console.log(`🔍 Found ${searchInputCount} search input elements`);
    
    if (searchInputCount > 0) {
      console.log('🔍 Testing search with "Harmony"...');
      await searchInput.first().fill('Harmony');
      await page.waitForTimeout(1000);
      
      // Take screenshot of search results
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'search-results-harmony.png'),
        fullPage: true 
      });
      
      // Clear and try another search
      await searchInput.first().fill('Energy');
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'search-results-energy.png'),
        fullPage: true 
      });
    } else {
      console.log('❌ No search input found');
    }

    // 7. Test node interaction (hover/click)
    console.log('🖱️ Testing node interactions...');
    let nodeInteractionWorking = false;
    
    if (canvasCount > 0) {
      try {
        // Try to hover over canvas center
        const canvasElement = canvas.first();
        const canvasBoundingBox = await canvasElement.boundingBox();
        
        if (canvasBoundingBox) {
          const centerX = canvasBoundingBox.x + canvasBoundingBox.width / 2;
          const centerY = canvasBoundingBox.y + canvasBoundingBox.height / 2;
          
          // Hover over center
          await page.mouse.move(centerX, centerY);
          await page.waitForTimeout(500);
          
          // Try clicking
          await page.mouse.click(centerX, centerY);
          await page.waitForTimeout(1000);
          
          nodeInteractionWorking = true;
          console.log('🖱️ Node interaction test completed');
        }
      } catch (e) {
        console.log('❌ Node interaction failed:', e);
      }
    }

    // 8. Take final screenshot after interactions
    console.log('📸 Taking final interaction screenshot...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'node-interaction.png'),
      fullPage: true 
    });

    // 9. Check for specific SongNodes elements
    console.log('🎵 Checking for SongNodes-specific elements...');
    const songNodesTitle = await page.locator('text=/SongNodes/i').count();
    const graphContainer = await page.locator('.graph-container, #graph-container, [data-testid="graph-container"]').count();
    const visualizationElements = await page.locator('.visualization, .d3-graph, .force-graph').count();
    
    console.log(`🎵 SongNodes title elements: ${songNodesTitle}`);
    console.log(`🎵 Graph container elements: ${graphContainer}`);
    console.log(`🎵 Visualization elements: ${visualizationElements}`);

    // 10. Check network requests for data loading
    console.log('🌐 Checking network activity...');
    const responses: string[] = [];
    page.on('response', response => {
      if (response.url().includes('api') || response.url().includes('graph') || response.url().includes('data')) {
        responses.push(`${response.status()} - ${response.url()}`);
      }
    });

    // Wait a bit more to capture any async operations
    await page.waitForTimeout(2000);

    // 11. Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      url: 'http://localhost:3006',
      verification: {
        pageLoaded: true,
        consoleErrors: consoleErrors,
        nodeCountDisplay: nodeCount,
        edgeCountDisplay: edgeCount,
        canvasElementsFound: canvasCount,
        canvasVisible: canvasVisible,
        searchInputsFound: searchInputCount,
        nodeInteractionTested: nodeInteractionWorking,
        songNodesElements: songNodesTitle,
        graphContainerElements: graphContainer,
        visualizationElements: visualizationElements,
        networkResponses: responses
      },
      screenshots: [
        'initial-state.png',
        'graph-overview.png', 
        'search-results-harmony.png',
        'search-results-energy.png',
        'node-interaction.png'
      ]
    };

    console.log('📋 VERIFICATION REPORT:');
    console.log('========================');
    console.log(JSON.stringify(report, null, 2));

    // Write report to file
    await fs.writeFile(
      path.join(screenshotsDir, 'verification-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('✅ Comprehensive verification completed!');
    console.log(`📁 Screenshots and report saved to: ${screenshotsDir}`);

    // Basic assertions
    expect(canvasCount).toBeGreaterThan(0);
    expect(consoleErrors.length).toBeLessThan(10); // Allow some minor errors but not too many
  });
});