import { test, expect, Page } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Comprehensive Graph Visualization Test Suite
 * Tests the core WebGL/PIXI.js graph rendering functionality
 */
test.describe('SongNodes Graph Visualization', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('SongNodes DJ');

    // Enable performance monitoring for better debugging
    await graphUtils.enablePerformanceMonitor();

    // Wait for graph initialization
    await graphUtils.waitForGraphInitialization();
  });

  test.describe('Core Rendering', () => {
    test('should load and display graph with nodes and edges', async ({ page }) => {
      await test.step('Verify graph container exists', async () => {
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
        await expect(canvas).toHaveCount(1);
      });

      await test.step('Verify WebGL initialization', async () => {
        await graphUtils.verifyWebGLFunctionality();
      });

      await test.step('Verify graph data loaded', async () => {
        const metrics = await graphUtils.getPerformanceMetrics();

        // Verify we have nodes and edges as described in requirements
        expect(metrics.nodeCount).toBeGreaterThan(200); // Should have 240+ nodes
        expect(metrics.edgeCount).toBeGreaterThan(1500); // Should have 1549+ edges

        console.log(`Graph loaded with ${metrics.nodeCount} nodes and ${metrics.edgeCount} edges`);
      });

      await test.step('Take initial graph screenshot', async () => {
        await graphUtils.takeCanvasScreenshot('initial-graph-load');
      });
    });

    test('should render PIXI.js canvas with proper dimensions', async ({ page }) => {
      await test.step('Verify canvas properties', async () => {
        const canvasInfo = await graphUtils.getCanvasInfo();

        expect(canvasInfo).toBeTruthy();
        expect(canvasInfo.width).toBeGreaterThan(0);
        expect(canvasInfo.height).toBeGreaterThan(0);
        expect(canvasInfo.clientWidth).toBeGreaterThan(0);
        expect(canvasInfo.clientHeight).toBeGreaterThan(0);

        console.log('Canvas dimensions:', canvasInfo);
      });

      await test.step('Verify responsive canvas sizing', async () => {
        // Test viewport resize
        await page.setViewportSize({ width: 1600, height: 900 });
        await page.waitForTimeout(500);

        const newCanvasInfo = await graphUtils.getCanvasInfo();
        expect(newCanvasInfo.clientWidth).toBeGreaterThan(1400);
        expect(newCanvasInfo.clientHeight).toBeGreaterThan(700);
      });
    });

    test('should initialize PIXI application correctly', async ({ page }) => {
      await test.step('Verify PIXI initialization', async () => {
        const isInitialized = await graphUtils.isPixiInitialized();
        expect(isInitialized).toBeTruthy();
      });

      await test.step('Verify WebGL context', async () => {
        const webglInfo = await graphUtils.getWebGLInfo();
        expect(webglInfo.vendor).toBeTruthy();
        expect(webglInfo.renderer).toBeTruthy();
        expect(webglInfo.version).toBeTruthy();

        // Verify WebGL 2.0 support (preferred for PIXI.js)
        expect(webglInfo.version).toMatch(/WebGL 2\.0/);
      });
    });

    test('should handle missing or error data gracefully', async ({ page }) => {
      await test.step('Test empty data state', async () => {
        // Simulate API failure by intercepting the request
        await page.route('**/graph/data', route => {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Simulated API error' })
          });
        });

        // Reload the page to trigger the error
        await page.reload();

        // Should show error message instead of crashing
        await expect(page.locator('text=Error Loading')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button:has-text("Retry")')).toBeVisible();
      });
    });
  });

  test.describe('Graph Elements Verification', () => {
    test('should display music track nodes with metadata', async ({ page }) => {
      await test.step('Verify specific track nodes exist', async () => {
        // Look for performance stats that show track data
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(240);

        // Take screenshot showing node distribution
        await graphUtils.takeCanvasScreenshot('track-nodes-display');
      });

      await test.step('Verify node visual properties', async () => {
        // Nodes should be visible as circles on canvas
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        // Canvas should have actual drawn content (not blank)
        const canvasInfo = await graphUtils.getCanvasInfo();
        expect(canvasInfo.width * canvasInfo.height).toBeGreaterThan(100000); // Reasonable canvas size
      });
    });

    test('should display track adjacency edges', async ({ page }) => {
      await test.step('Verify edge relationships', async () => {
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.edgeCount).toBeGreaterThan(1549);

        // Enable edge display if not already visible
        const edgeToggle = page.locator('[title*="Edges"]');
        if (await edgeToggle.isVisible()) {
          await edgeToggle.click();
        }

        await graphUtils.waitForAnimation();
        await graphUtils.takeCanvasScreenshot('track-adjacency-edges');
      });
    });

    test('should support track labels and metadata display', async ({ page }) => {
      await test.step('Toggle label visibility', async () => {
        const labelToggle = page.locator('[title*="Labels"]');
        if (await labelToggle.isVisible()) {
          await labelToggle.click();
          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot('track-labels-enabled');

          // Toggle off
          await labelToggle.click();
          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot('track-labels-disabled');
        }
      });
    });
  });

  test.describe('Level of Detail (LOD) System', () => {
    test('should implement LOD for performance optimization', async ({ page }) => {
      await test.step('Test zoom levels affect detail', async () => {
        // Zoom out far - should reduce detail
        await graphUtils.zoomOut(10);
        await graphUtils.waitForAnimation();

        const zoomedOutMetrics = await graphUtils.getPerformanceMetrics();
        await graphUtils.takeCanvasScreenshot('lod-zoomed-out');

        // Zoom in close - should increase detail
        await graphUtils.resetView();
        await graphUtils.zoomIn(5);
        await graphUtils.waitForAnimation();

        const zoomedInMetrics = await graphUtils.getPerformanceMetrics();
        await graphUtils.takeCanvasScreenshot('lod-zoomed-in');

        console.log('LOD Performance:', { zoomedOut: zoomedOutMetrics, zoomedIn: zoomedInMetrics });
      });

      await test.step('Verify performance with large node count', async () => {
        const metrics = await graphUtils.getPerformanceMetrics();

        // With 240+ nodes and 1549+ edges, should still maintain good performance
        await graphUtils.verifyPerformance(25, 100); // 25 FPS minimum, 100ms max render time
      });
    });

    test('should cull distant objects for performance', async ({ page }) => {
      await test.step('Test object culling at distance', async () => {
        const initialMetrics = await graphUtils.getPerformanceMetrics();

        // Pan to area with fewer visible objects
        await graphUtils.pan(500, 500);
        await graphUtils.waitForAnimation();

        const pannedMetrics = await graphUtils.getPerformanceMetrics();
        await graphUtils.takeCanvasScreenshot('culling-test-panned');

        // Visible objects should potentially be different due to culling
        console.log('Culling test:', { initial: initialMetrics, panned: pannedMetrics });
      });
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle WebGL context loss gracefully', async ({ page }) => {
      await test.step('Simulate WebGL context loss', async () => {
        // Force WebGL context loss
        await page.evaluate(() => {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement;
          const gl = canvas?.getContext('webgl') || canvas?.getContext('experimental-webgl');
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.loseContext();
            }
          }
        });

        await page.waitForTimeout(1000);

        // Application should handle context loss and attempt recovery
        // At minimum, it shouldn't crash
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
      });
    });

    test('should handle memory pressure gracefully', async ({ page }) => {
      await test.step('Monitor memory usage during intense operations', async () => {
        // Perform multiple zoom/pan operations rapidly
        for (let i = 0; i < 10; i++) {
          await graphUtils.zoomIn(2);
          await graphUtils.pan(100, 100);
          await graphUtils.zoomOut(2);
          await graphUtils.pan(-100, -100);
          await page.waitForTimeout(50); // Brief pause
        }

        // Should still be responsive
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThan(15); // Should maintain at least 15 FPS

        await graphUtils.takeCanvasScreenshot('memory-pressure-test');
      });
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should maintain performance with accessibility features enabled', async ({ page }) => {
      await test.step('Enable reduced motion and verify performance', async () => {
        // Set reduced motion preference
        await page.emulateMedia({ reducedMotion: 'reduce' });

        await graphUtils.waitForAnimation();
        const metrics = await graphUtils.getPerformanceMetrics();

        // Should still render properly
        expect(metrics.nodeCount).toBeGreaterThan(200);

        await graphUtils.takeCanvasScreenshot('accessibility-reduced-motion');
      });
    });

    test('should be responsive on different screen sizes', async ({ page }) => {
      const sizes = [
        { width: 1920, height: 1080, name: 'desktop-large' },
        { width: 1280, height: 720, name: 'desktop-medium' },
        { width: 768, height: 1024, name: 'tablet-portrait' },
      ];

      for (const size of sizes) {
        await test.step(`Test ${size.name} viewport`, async () => {
          await page.setViewportSize({ width: size.width, height: size.height });
          await page.waitForTimeout(500);

          await graphUtils.waitForAnimation();
          const metrics = await graphUtils.getPerformanceMetrics();

          expect(metrics.nodeCount).toBeGreaterThan(0);
          await graphUtils.takeCanvasScreenshot(`responsive-${size.name}`);
        });
      }
    });
  });

  test.describe('Data Integrity', () => {
    test('should maintain data consistency during operations', async ({ page }) => {
      await test.step('Verify node/edge counts remain stable', async () => {
        const initialMetrics = await graphUtils.getPerformanceMetrics();

        // Perform various operations
        await graphUtils.zoomIn(3);
        await graphUtils.pan(200, 200);
        await graphUtils.resetView();

        const finalMetrics = await graphUtils.getPerformanceMetrics();

        // Node and edge counts should remain the same
        expect(finalMetrics.nodeCount).toBe(initialMetrics.nodeCount);
        expect(finalMetrics.edgeCount).toBe(initialMetrics.edgeCount);
      });
    });

    test('should handle rapid state changes without corruption', async ({ page }) => {
      await test.step('Rapid tool switching', async () => {
        const tools = ['select', 'path', 'setlist', 'filter'];

        for (let i = 0; i < 5; i++) {
          for (const tool of tools) {
            await page.keyboard.press(`${tools.indexOf(tool) + 1}`);
            await page.waitForTimeout(100);
          }
        }

        // Graph should still be functional
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);

        await graphUtils.takeCanvasScreenshot('rapid-state-changes-test');
      });
    });
  });
});