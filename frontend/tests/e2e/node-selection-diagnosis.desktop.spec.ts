import { test, expect, Page } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Diagnostic Test: Node Selection and Edge Visibility
 *
 * This test diagnoses two specific issues:
 * 1. Node clicks not opening track details modal
 * 2. Edges not visible in library mode
 */

test.describe('Node Selection and Edge Visibility Diagnosis', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('SongNodes DJ', { timeout: 10000 });

    // Wait for graph initialization
    await graphUtils.waitForGraphInitialization();

    // Wait a bit for the graph to settle
    await page.waitForTimeout(2000);
  });

  test('DIAGNOSTIC: Node Click Flow Investigation', async ({ page }) => {
    console.log('\n🔍 === DIAGNOSTIC TEST: Node Click Investigation ===\n');

    await test.step('Step 1: Verify graph is initialized', async () => {
      console.log('📊 Checking if PIXI canvas exists...');

      // Check for PIXI canvas
      const canvas = page.locator('canvas[id="songnodes-pixi-canvas"]');
      await expect(canvas).toBeVisible({ timeout: 10000 });
      console.log('✅ PIXI canvas found and visible');

      // Check canvas dimensions
      const box = await canvas.boundingBox();
      console.log('📐 Canvas dimensions:', box);
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    });

    await test.step('Step 2: Check graph data loaded', async () => {
      console.log('📦 Checking if graph data is loaded...');

      // Use window evaluation to check store state
      const graphDataInfo = await page.evaluate(() => {
        const store = (window as any).__ZUSTAND_STORE__;
        if (!store) return null;

        const state = store.getState();
        return {
          nodeCount: state.graphData?.nodes?.length || 0,
          edgeCount: state.graphData?.edges?.length || 0,
          hasNodes: !!state.graphData?.nodes,
          hasEdges: !!state.graphData?.edges,
          sampleNode: state.graphData?.nodes?.[0],
          sampleEdge: state.graphData?.edges?.[0],
          selectedNodes: state.viewState?.selectedNodes?.size || 0,
          showEdges: state.viewState?.showEdges
        };
      });

      console.log('📊 Graph data:', JSON.stringify(graphDataInfo, null, 2));

      if (graphDataInfo) {
        expect(graphDataInfo.nodeCount).toBeGreaterThan(0);
        console.log(`✅ Found ${graphDataInfo.nodeCount} nodes`);
        console.log(`📊 Found ${graphDataInfo.edgeCount} edges`);
        console.log(`🔗 Show edges setting: ${graphDataInfo.showEdges}`);
      }
    });

    await test.step('Step 3: Check node has track data', async () => {
      console.log('🎵 Checking if nodes have track data...');

      const nodeTrackInfo = await page.evaluate(() => {
        // Access enhanced nodes from PIXI
        const pixiApp = (window as any).pixiApp;
        if (!pixiApp) return { hasPixiApp: false };

        // Get store to access nodes
        const store = (window as any).__ZUSTAND_STORE__;
        if (!store) return { hasPixiApp: true, hasStore: false };

        const state = store.getState();
        const firstNode = state.graphData?.nodes?.[0];

        return {
          hasPixiApp: true,
          hasStore: true,
          firstNode: firstNode ? {
            id: firstNode.id,
            title: firstNode.title,
            artist: firstNode.artist,
            hasTrack: !!firstNode.track,
            track: firstNode.track,
            metadata: firstNode.metadata
          } : null
        };
      });

      console.log('🎵 Node track data:', JSON.stringify(nodeTrackInfo, null, 2));
    });

    await test.step('Step 4: Test node click and event propagation', async () => {
      console.log('🖱️ Testing node click event propagation...');

      // Set up console listener for click events
      const clickLogs: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[Event Triggered]') ||
            text.includes('pointerdown') ||
            text.includes('pointerup') ||
            text.includes('Processing click') ||
            text.includes('Opening track modal')) {
          clickLogs.push(text);
          console.log('🔊', text);
        }
      });

      const canvas = page.locator('canvas[id="songnodes-pixi-canvas"]');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();

      // Click in the center where nodes are likely to be
      const centerX = box!.x + box!.width / 2;
      const centerY = box!.y + box!.height / 2;

      console.log(`🎯 Clicking at canvas center: (${centerX}, ${centerY})`);

      // Click on the canvas
      await page.mouse.click(centerX, centerY);

      // Wait for events to propagate
      await page.waitForTimeout(1000);

      console.log(`📝 Captured ${clickLogs.length} click-related console logs`);

      // Check if pointerdown/pointerup events were triggered
      const hasPointerDown = clickLogs.some(log => log.includes('pointerdown'));
      const hasPointerUp = clickLogs.some(log => log.includes('pointerup'));
      const hasProcessing = clickLogs.some(log => log.includes('Processing click'));

      console.log('✅ Event Detection:');
      console.log(`  - Pointerdown: ${hasPointerDown}`);
      console.log(`  - Pointerup: ${hasPointerUp}`);
      console.log(`  - Processing: ${hasProcessing}`);
    });

    await test.step('Step 5: Check if track modal opens', async () => {
      console.log('🔍 Checking for track modal...');

      // Wait a bit more for modal
      await page.waitForTimeout(500);

      // Check for various modal selectors
      const modalSelectors = [
        '[role="dialog"]',
        '.track-modal',
        '.track-details',
        '[data-testid="track-modal"]',
        'div[style*="position: fixed"]' // Catch any fixed position overlays
      ];

      let modalFound = false;
      for (const selector of modalSelectors) {
        const modal = page.locator(selector);
        const count = await modal.count();
        if (count > 0) {
          console.log(`✅ Found modal with selector: ${selector}`);
          modalFound = true;

          // Take screenshot of the modal
          await page.screenshot({ path: 'test-results/diagnostic-modal-found.png' });
          break;
        }
      }

      if (!modalFound) {
        console.log('❌ No track modal found after click');
        console.log('📸 Taking screenshot for debugging...');
        await page.screenshot({ path: 'test-results/diagnostic-no-modal.png' });
      }
    });

    await test.step('Step 6: Debug callback registration', async () => {
      console.log('🔧 Checking onTrackSelect callback registration...');

      const callbackInfo = await page.evaluate(() => {
        const pixiApp = (window as any).pixiApp;
        if (!pixiApp) return { hasPixiApp: false };

        // Try to find nodes with event listeners
        const stage = pixiApp.stage;
        const nodesContainer = stage.children.find((c: any) => c.label === 'nodes');

        if (!nodesContainer) return { hasPixiApp: true, hasNodesContainer: false };

        const firstNode = nodesContainer.children[0];
        if (!firstNode) return { hasPixiApp: true, hasNodesContainer: true, hasNodes: false };

        return {
          hasPixiApp: true,
          hasNodesContainer: true,
          hasNodes: true,
          nodeEventMode: firstNode.eventMode,
          nodeCursor: firstNode.cursor,
          hasHitArea: !!firstNode.hitArea,
          listenerCounts: {
            pointerdown: firstNode.listenerCount('pointerdown'),
            pointerup: firstNode.listenerCount('pointerup'),
            pointermove: firstNode.listenerCount('pointermove'),
            pointerenter: firstNode.listenerCount('pointerenter'),
            pointerleave: firstNode.listenerCount('pointerleave')
          }
        };
      });

      console.log('📊 Callback info:', JSON.stringify(callbackInfo, null, 2));
    });
  });

  test('DIAGNOSTIC: Library Mode Edge Visibility', async ({ page }) => {
    console.log('\n🔍 === DIAGNOSTIC TEST: Library Mode Edges ===\n');

    await test.step('Step 1: Switch to Library Mode', async () => {
      console.log('📚 Switching to Library mode...');

      // Find and click the mode toggle button
      const modeButton = page.locator('button', { hasText: /performer|librarian/i });
      await expect(modeButton).toBeVisible();

      const currentMode = await modeButton.textContent();
      console.log(`Current mode: ${currentMode}`);

      if (currentMode?.toLowerCase().includes('performer')) {
        console.log('Clicking to switch to Librarian mode...');
        await modeButton.click();
        await page.waitForTimeout(1000);
      }

      // Verify we're in library mode
      const newMode = await modeButton.textContent();
      console.log(`New mode: ${newMode}`);

      // Take screenshot
      await page.screenshot({ path: 'test-results/diagnostic-library-mode.png' });
    });

    await test.step('Step 2: Check edge visibility settings', async () => {
      console.log('🔗 Checking edge visibility settings...');

      const edgeInfo = await page.evaluate(() => {
        const store = (window as any).__ZUSTAND_STORE__;
        if (!store) return null;

        const state = store.getState();
        return {
          showEdges: state.viewState?.showEdges,
          edgeCount: state.graphData?.edges?.length || 0,
          edgeOpacity: state.viewState?.edgeOpacity,
          sampleEdges: state.graphData?.edges?.slice(0, 3)
        };
      });

      console.log('🔗 Edge settings:', JSON.stringify(edgeInfo, null, 2));

      if (edgeInfo) {
        if (!edgeInfo.showEdges) {
          console.log('⚠️ showEdges is FALSE - edges are disabled in view settings');
        }
        if (edgeInfo.edgeCount === 0) {
          console.log('⚠️ No edges in graph data');
        }
      }
    });

    await test.step('Step 3: Toggle edges ON if disabled', async () => {
      console.log('🔄 Attempting to enable edges...');

      // Look for edge toggle button
      const edgeToggleSelectors = [
        'button[title*="dge"]',
        'button:has-text("🔗")',
        'button[aria-label*="edge"]'
      ];

      for (const selector of edgeToggleSelectors) {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          console.log(`Found edge toggle: ${selector}`);
          await button.click();
          await page.waitForTimeout(500);
          break;
        }
      }
    });

    await test.step('Step 4: Check PIXI edge rendering', async () => {
      console.log('🎨 Checking PIXI edge rendering...');

      const pixiEdgeInfo = await page.evaluate(() => {
        const pixiApp = (window as any).pixiApp;
        if (!pixiApp) return { hasPixiApp: false };

        const stage = pixiApp.stage;
        const edgesContainer = stage.children.find((c: any) => c.label === 'edges');

        if (!edgesContainer) return { hasPixiApp: true, hasEdgesContainer: false };

        const visibleEdges = edgesContainer.children.filter((e: any) => e.visible);
        const firstEdge = edgesContainer.children[0];

        return {
          hasPixiApp: true,
          hasEdgesContainer: true,
          totalEdgeChildren: edgesContainer.children.length,
          visibleEdges: visibleEdges.length,
          firstEdgeVisible: firstEdge?.visible,
          firstEdgeAlpha: firstEdge?.alpha,
          containerVisible: edgesContainer.visible,
          containerAlpha: edgesContainer.alpha
        };
      });

      console.log('🎨 PIXI edge info:', JSON.stringify(pixiEdgeInfo, null, 2));

      if (pixiEdgeInfo.totalEdgeChildren === 0) {
        console.log('❌ No edge graphics objects created in PIXI');
      } else if (pixiEdgeInfo.visibleEdges === 0) {
        console.log('⚠️ Edge objects exist but are not visible');
      } else {
        console.log(`✅ ${pixiEdgeInfo.visibleEdges} edges are visible in PIXI`);
      }
    });

    await test.step('Step 5: Inspect track nodes for edges', async () => {
      console.log('🔍 Checking if track list items should have edges...');

      // Get all track buttons in library mode
      const trackButtons = page.locator('button').filter({ hasText: /BPM|artist/i });
      const trackCount = await trackButtons.count();

      console.log(`📊 Found ${trackCount} track items in library`);

      if (trackCount > 0) {
        // Click first track to see if it triggers anything
        console.log('🖱️ Clicking first track in library...');
        await trackButtons.first().click();
        await page.waitForTimeout(1000);

        // Check if modal opened
        const modal = page.locator('[role="dialog"]');
        if (await modal.count() > 0) {
          console.log('✅ Track modal opened from library list');
          await page.screenshot({ path: 'test-results/diagnostic-library-track-modal.png' });
        } else {
          console.log('❌ Track modal did NOT open from library list');
        }
      }
    });

    await test.step('Step 6: Take final diagnostic screenshots', async () => {
      console.log('📸 Taking final diagnostic screenshots...');

      // Full page screenshot
      await page.screenshot({
        path: 'test-results/diagnostic-library-final.png',
        fullPage: true
      });

      // Canvas only
      const canvas = page.locator('canvas');
      if (await canvas.count() > 0) {
        await canvas.screenshot({
          path: 'test-results/diagnostic-library-canvas.png'
        });
      }
    });
  });

  test('DIAGNOSTIC: Test Modal Workaround Button', async ({ page }) => {
    console.log('\n🔍 === DIAGNOSTIC TEST: Test Modal Button ===\n');

    await test.step('Click the Test Modal button', async () => {
      console.log('🧪 Looking for Test Modal button...');

      const testButton = page.locator('button', { hasText: /test modal/i });
      if (await testButton.count() > 0) {
        console.log('✅ Found Test Modal button');
        await testButton.click();
        await page.waitForTimeout(1000);

        // Check if modal opens
        const modal = page.locator('[role="dialog"]');
        if (await modal.count() > 0) {
          console.log('✅ Test Modal button successfully opens modal');
          console.log('🎯 This confirms the modal component works');
          console.log('⚠️ Issue is specifically with node click -> modal flow');

          await page.screenshot({ path: 'test-results/diagnostic-test-button-modal.png' });

          // Close modal
          const closeButton = page.locator('button', { hasText: /close/i });
          if (await closeButton.count() > 0) {
            await closeButton.click();
            await page.waitForTimeout(500);
          }
        } else {
          console.log('❌ Test Modal button did NOT open modal');
        }
      } else {
        console.log('⚠️ Test Modal button not found (may not be in production)');
      }
    });
  });
});