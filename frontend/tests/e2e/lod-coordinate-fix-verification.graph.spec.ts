import { test, expect } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * LOD Coordinate Transform Fix Verification Test
 *
 * This test verifies that the critical bug fix in GraphVisualization.tsx lines 120-121
 * correctly implements the world→screen coordinate transformation for viewport culling.
 *
 * BUG: LOD system was missing centering offset and pan offset in screen coordinate calculation
 * FIX: screenX = (node.x * zoom) + (width/2) + viewport.x
 *
 * This test ensures nodes are actually visible after the fix.
 */
test.describe('LOD Coordinate Transform Fix Verification', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('SongNodes DJ', { timeout: 10000 });

    // Wait for graph initialization
    await graphUtils.waitForGraphInitialization();
  });

  test('should render nodes and edges after LOD coordinate fix', async ({ page }) => {
    await test.step('Verify PIXI canvas initialized', async () => {
      const canvas = page.locator('canvas[data-testid="pixi-canvas"]');
      await expect(canvas).toBeVisible({ timeout: 10000 });

      const isInitialized = await graphUtils.isPixiInitialized();
      expect(isInitialized).toBeTruthy();
    });

    await test.step('Verify nodes are loaded', async () => {
      const metrics = await graphUtils.getPerformanceMetrics();

      console.log('📊 Graph Metrics:', metrics);

      // Should have loaded nodes from API
      expect(metrics.nodeCount).toBeGreaterThan(0);
      expect(metrics.nodeCount).toBeGreaterThan(200); // We expect 430+ nodes
    });

    await test.step('Verify nodes are visible (not culled)', async () => {
      // Get LOD debug information
      const lodInfo = await page.evaluate(() => {
        const viewport = (window as any).viewportRef?.current;
        const enhancedNodes = (window as any).enhancedNodesRef?.current;
        const lodSystem = (window as any).lodSystemRef?.current;

        if (!enhancedNodes || !lodSystem || !viewport) {
          return null;
        }

        const samples: any[] = [];
        let visibleCount = 0;
        let totalCount = 0;

        enhancedNodes.forEach((node: any) => {
          totalCount++;
          const lod = lodSystem.getNodeLOD(node);
          const isVisible = lod < 3; // LOD 3 = culled

          if (isVisible) visibleCount++;

          // Sample first 10 nodes for debugging
          if (samples.length < 10) {
            samples.push({
              id: node.id.substring(0, 30),
              worldX: Math.round(node.x || 0),
              worldY: Math.round(node.y || 0),
              lod,
              isVisible,
              pixiNodeExists: !!node.pixiNode,
              pixiVisible: node.pixiNode?.visible
            });
          }
        });

        return {
          viewport: {
            width: viewport.width,
            height: viewport.height,
            zoom: viewport.zoom,
            x: viewport.x,
            y: viewport.y
          },
          totalNodes: totalCount,
          visibleNodes: visibleCount,
          culledNodes: totalCount - visibleCount,
          samples
        };
      });

      console.log('🔍 LOD System Debug Info:', JSON.stringify(lodInfo, null, 2));

      // CRITICAL: After the fix, nodes should be visible (not all culled)
      expect(lodInfo).toBeTruthy();
      expect(lodInfo!.totalNodes).toBeGreaterThan(0);

      // The key assertion: visible nodes should be > 0
      // Before the fix: visibleNodes = 0 (all culled)
      // After the fix: visibleNodes > 0 (proper culling based on viewport)
      expect(lodInfo!.visibleNodes).toBeGreaterThan(0);

      // With default view (centered, zoom=1), most nodes should be visible
      const visibilityRatio = lodInfo!.visibleNodes / lodInfo!.totalNodes;
      console.log(`👁️  Visibility Ratio: ${(visibilityRatio * 100).toFixed(1)}%`);

      // Should have reasonable visibility (at least 20% of nodes visible at default zoom)
      expect(visibilityRatio).toBeGreaterThan(0.2);
    });

    await test.step('Verify edges are visible', async () => {
      const edgeInfo = await page.evaluate(() => {
        const enhancedEdges = (window as any).enhancedEdgesRef?.current;
        const lodSystem = (window as any).lodSystemRef?.current;

        if (!enhancedEdges || !lodSystem) {
          return null;
        }

        let visibleCount = 0;
        let totalCount = 0;

        enhancedEdges.forEach((edge: any) => {
          totalCount++;
          const lod = lodSystem.getEdgeLOD(edge);
          if (lod < 3) visibleCount++;
        });

        return {
          totalEdges: totalCount,
          visibleEdges: visibleCount,
          culledEdges: totalCount - visibleCount
        };
      });

      console.log('🔗 Edge Visibility:', edgeInfo);

      expect(edgeInfo).toBeTruthy();
      expect(edgeInfo!.totalEdges).toBeGreaterThan(0);

      // Edges should be visible if their connected nodes are visible
      expect(edgeInfo!.visibleEdges).toBeGreaterThan(0);
    });

    await test.step('Take screenshot showing visible graph', async () => {
      await graphUtils.takeCanvasScreenshot('lod-fix-verification-initial-view');
    });
  });

  test('should handle panning correctly with fixed LOD system', async ({ page }) => {
    await test.step('Test panning in all directions', async () => {
      const directions = [
        { name: 'right', dx: 300, dy: 0 },
        { name: 'left', dx: -600, dy: 0 },
        { name: 'down', dx: 300, dy: 300 },
        { name: 'up', dx: 0, dy: -600 },
      ];

      for (const dir of directions) {
        await graphUtils.pan(dir.dx, dir.dy);
        await page.waitForTimeout(500);

        const lodInfo = await page.evaluate(() => {
          const enhancedNodes = (window as any).enhancedNodesRef?.current;
          const lodSystem = (window as any).lodSystemRef?.current;

          if (!enhancedNodes || !lodSystem) return null;

          let visibleCount = 0;
          enhancedNodes.forEach((node: any) => {
            if (lodSystem.getNodeLOD(node) < 3) visibleCount++;
          });

          return {
            visibleNodes: visibleCount,
            totalNodes: enhancedNodes.size
          };
        });

        console.log(`🧭 Panned ${dir.name}:`, lodInfo);

        // Should still have visible nodes after panning
        expect(lodInfo!.visibleNodes).toBeGreaterThan(0);

        await graphUtils.takeCanvasScreenshot(`lod-fix-pan-${dir.name}`);
      }
    });

    await test.step('Reset view and verify', async () => {
      await graphUtils.resetView();
      await page.waitForTimeout(500);

      const metrics = await graphUtils.getPerformanceMetrics();
      expect(metrics.nodeCount).toBeGreaterThan(200);

      await graphUtils.takeCanvasScreenshot('lod-fix-after-reset');
    });
  });

  test('should handle zoom levels correctly with fixed LOD system', async ({ page }) => {
    await test.step('Test zoom out (should cull distant nodes)', async () => {
      // Zoom out far
      await graphUtils.zoomOut(10);
      await page.waitForTimeout(500);

      const zoomOutInfo = await page.evaluate(() => {
        const viewport = (window as any).viewportRef?.current;
        const enhancedNodes = (window as any).enhancedNodesRef?.current;
        const lodSystem = (window as any).lodSystemRef?.current;

        if (!enhancedNodes || !lodSystem) return null;

        let visibleCount = 0;
        enhancedNodes.forEach((node: any) => {
          if (lodSystem.getNodeLOD(node) < 3) visibleCount++;
        });

        return {
          zoom: viewport?.zoom,
          visibleNodes: visibleCount,
          totalNodes: enhancedNodes.size
        };
      });

      console.log('🔎 Zoomed Out:', zoomOutInfo);

      // When zoomed out, should still see some nodes (not all culled)
      expect(zoomOutInfo!.visibleNodes).toBeGreaterThan(0);

      await graphUtils.takeCanvasScreenshot('lod-fix-zoomed-out');
    });

    await test.step('Test zoom in (should show more detail)', async () => {
      await graphUtils.resetView();
      await graphUtils.zoomIn(5);
      await page.waitForTimeout(500);

      const zoomInInfo = await page.evaluate(() => {
        const viewport = (window as any).viewportRef?.current;
        const enhancedNodes = (window as any).enhancedNodesRef?.current;
        const lodSystem = (window as any).lodSystemRef?.current;

        if (!enhancedNodes || !lodSystem) return null;

        let visibleCount = 0;
        let lodCounts = { lod0: 0, lod1: 0, lod2: 0, lod3: 0 };

        enhancedNodes.forEach((node: any) => {
          const lod = lodSystem.getNodeLOD(node);
          if (lod < 3) visibleCount++;
          lodCounts[`lod${lod}` as keyof typeof lodCounts]++;
        });

        return {
          zoom: viewport?.zoom,
          visibleNodes: visibleCount,
          totalNodes: enhancedNodes.size,
          lodCounts
        };
      });

      console.log('🔍 Zoomed In:', zoomInInfo);

      // When zoomed in, should have high-detail LOD levels (LOD 0 and 1)
      expect(zoomInInfo!.lodCounts.lod0 + zoomInInfo!.lodCounts.lod1).toBeGreaterThan(0);

      await graphUtils.takeCanvasScreenshot('lod-fix-zoomed-in');
    });
  });

  test('should calculate screen coordinates correctly', async ({ page }) => {
    await test.step('Verify coordinate transformation formula', async () => {
      const coordTest = await page.evaluate(() => {
        const viewport = (window as any).viewportRef?.current;
        const enhancedNodes = (window as any).enhancedNodesRef?.current;
        const lodSystem = (window as any).lodSystemRef?.current;

        if (!enhancedNodes || !lodSystem || !viewport) return null;

        // Get a sample node near origin (0, 0)
        let testNode: any = null;
        let minDistance = Infinity;

        enhancedNodes.forEach((node: any) => {
          const distance = Math.sqrt(node.x * node.x + node.y * node.y);
          if (distance < minDistance) {
            minDistance = distance;
            testNode = node;
          }
        });

        if (!testNode) return null;

        // Calculate expected screen position using the fixed formula
        const expectedScreenX = (testNode.x * viewport.zoom) + (viewport.width / 2) + viewport.x;
        const expectedScreenY = (testNode.y * viewport.zoom) + (viewport.height / 2) + viewport.y;

        // Get LOD (should be 0 or 1 for node near center)
        const lod = lodSystem.getNodeLOD(testNode);

        return {
          node: {
            id: testNode.id.substring(0, 30),
            worldX: testNode.x,
            worldY: testNode.y
          },
          viewport: {
            width: viewport.width,
            height: viewport.height,
            zoom: viewport.zoom,
            panX: viewport.x,
            panY: viewport.y
          },
          expectedScreen: {
            x: expectedScreenX,
            y: expectedScreenY
          },
          lod,
          isVisible: lod < 3,
          formula: `screenX = (${testNode.x.toFixed(1)} * ${viewport.zoom.toFixed(2)}) + (${viewport.width}/2) + ${viewport.x.toFixed(1)} = ${expectedScreenX.toFixed(1)}`
        };
      });

      console.log('📐 Coordinate Transform Test:', JSON.stringify(coordTest, null, 2));

      expect(coordTest).toBeTruthy();

      // Node near center should be visible (LOD < 3)
      expect(coordTest!.isVisible).toBeTruthy();
      expect(coordTest!.lod).toBeLessThan(3);

      // Screen coordinates should be within viewport bounds
      expect(coordTest!.expectedScreen.x).toBeGreaterThan(-200); // Including buffer
      expect(coordTest!.expectedScreen.x).toBeLessThan(coordTest!.viewport.width + 200);
      expect(coordTest!.expectedScreen.y).toBeGreaterThan(-200);
      expect(coordTest!.expectedScreen.y).toBeLessThan(coordTest!.viewport.height + 200);
    });
  });

  test('should maintain good performance with fixed LOD', async ({ page }) => {
    await test.step('Verify FPS with LOD system', async () => {
      await page.waitForTimeout(2000); // Let it stabilize

      const metrics = await graphUtils.getPerformanceMetrics();

      console.log('⚡ Performance Metrics:', metrics);

      // Should maintain good FPS (>25) with properly functioning LOD
      expect(metrics.frameRate).toBeGreaterThan(25);

      // Render time should be reasonable (<50ms)
      expect(metrics.renderTime).toBeLessThan(50);
    });

    await test.step('Stress test: rapid zoom/pan', async () => {
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          await graphUtils.zoomIn(1);
          await graphUtils.pan(50, 50);
        } else {
          await graphUtils.zoomOut(1);
          await graphUtils.pan(-50, -50);
        }
        await page.waitForTimeout(50);
      }

      const finalMetrics = await graphUtils.getPerformanceMetrics();
      console.log('⚡ After Stress Test:', finalMetrics);

      // Should still maintain reasonable performance
      expect(finalMetrics.frameRate).toBeGreaterThan(20);
    });
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    await test.step('Perform various operations', async () => {
      await graphUtils.zoomIn(3);
      await graphUtils.pan(200, 200);
      await graphUtils.zoomOut(5);
      await graphUtils.pan(-100, -100);
      await graphUtils.resetView();

      await page.waitForTimeout(2000);
    });

    await test.step('Verify no critical errors', async () => {
      // Filter out expected warnings/errors
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes('ResizeObserver') &&
        !err.includes('favicon') &&
        !err.includes('Extension')
      );

      console.log('❌ Console Errors:', criticalErrors);
      console.log('⚠️  Console Warnings:', consoleWarnings.slice(0, 5));

      // Should have no critical errors
      expect(criticalErrors.length).toBe(0);
    });
  });
});
