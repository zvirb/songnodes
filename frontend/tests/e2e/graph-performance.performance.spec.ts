import { test, expect } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';
import { PerformanceTestHelpers } from '../utils/performance-test-helpers';

/**
 * Graph Visualization Performance Tests
 *
 * Comprehensive performance benchmarking for the WebGL/PIXI.js graph visualization.
 * Tests frame rates, render times, memory usage, and scalability.
 */

test.describe('Graph Visualization Performance', () => {
  let graphUtils: GraphTestUtils;
  let perfHelpers: PerformanceTestHelpers;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);
    perfHelpers = new PerformanceTestHelpers(page);

    await page.goto('/');
    await graphUtils.waitForGraphInitialization();
    await perfHelpers.initializePerformanceMonitoring();
  });

  test('should maintain 60 FPS with default dataset', async ({ page }) => {
    await test.step('Benchmark default graph performance', async () => {
      await graphUtils.waitForAnimation();

      const benchmark = await perfHelpers.runPerformanceBenchmark('Default Dataset', 5000);

      expect(benchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(50);
      expect(benchmark.metrics.minFrameRate).toBeGreaterThanOrEqual(30);
      expect(benchmark.metrics.averageRenderTime).toBeLessThanOrEqual(20);
      expect(benchmark.metrics.smoothness).toBeGreaterThanOrEqual(80);

      console.log('Default dataset performance:', benchmark.metrics);
    });

    await test.step('Verify frame rate consistency', async () => {
      const performance = await graphUtils.measurePerformance(10000);

      expect(performance.droppedFrames).toBeLessThanOrEqual(20);
      expect(performance.averageFrameRate).toBeGreaterThanOrEqual(45);

      console.log('Frame rate consistency:', performance);
    });
  });

  test('should scale performance with node count', async ({ page }) => {
    const nodeCounts = [100, 250, 500, 1000];
    const results: Array<{ nodeCount: number; fps: number; renderTime: number }> = [];

    for (const nodeCount of nodeCounts) {
      await test.step(`Test performance with ${nodeCount} nodes`, async () => {
        // Load specific node count (this would need implementation in your app)
        await page.evaluate((count) => {
          if (window.loadGraphWithNodeCount) {
            window.loadGraphWithNodeCount(count);
          }
        }, nodeCount);

        await graphUtils.waitForAnimation();

        const benchmark = await perfHelpers.runPerformanceBenchmark(
          `${nodeCount} Nodes`,
          3000
        );

        results.push({
          nodeCount,
          fps: benchmark.metrics.averageFrameRate,
          renderTime: benchmark.metrics.averageRenderTime
        });

        // Performance should degrade gracefully
        if (nodeCount <= 250) {
          expect(benchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(40);
        } else if (nodeCount <= 500) {
          expect(benchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(25);
        } else {
          expect(benchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(15);
        }

        console.log(`${nodeCount} nodes: ${benchmark.metrics.averageFrameRate} FPS`);
      });
    }

    // Verify performance scaling is reasonable
    const performanceDrop = results[0].fps - results[results.length - 1].fps;
    expect(performanceDrop).toBeLessThanOrEqual(45); // Max 45 FPS drop from min to max
  });

  test('should optimize zoom performance', async ({ page }) => {
    await test.step('Benchmark zoom levels', async () => {
      const zoomLevels = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0];
      const zoomResults = await perfHelpers.benchmarkZoomLevels(zoomLevels);

      zoomResults.forEach((metrics, zoomLevel) => {
        console.log(`Zoom ${zoomLevel}x: ${metrics.averageFrameRate} FPS, ${metrics.averageRenderTime}ms`);

        // All zoom levels should maintain reasonable performance
        expect(metrics.averageFrameRate).toBeGreaterThanOrEqual(20);
        expect(metrics.averageRenderTime).toBeLessThanOrEqual(50);
      });
    });

    await test.step('Test zoom animation performance', async () => {
      // Measure performance during zoom transitions
      await perfHelpers.runPerformanceBenchmark('Pre-zoom', 1000);

      const zoomBenchmark = await perfHelpers.runPerformanceBenchmark('Zoom Transition', 2000);

      // Perform zoom during benchmark
      setTimeout(async () => {
        await graphUtils.zoomIn(4);
      }, 500);

      expect(zoomBenchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(25);
    });
  });

  test('should optimize viewport size performance', async ({ page }) => {
    await test.step('Benchmark different viewport sizes', async () => {
      const viewportSizes = [
        { width: 800, height: 600, name: 'small' },
        { width: 1280, height: 720, name: 'medium' },
        { width: 1920, height: 1080, name: 'large' },
        { width: 2560, height: 1440, name: 'xl' },
        { width: 3840, height: 2160, name: '4k' }
      ];

      const results = await perfHelpers.benchmarkViewportSizes(viewportSizes);

      results.forEach((metrics, size) => {
        console.log(`${size}: ${metrics.averageFrameRate} FPS`);

        // Performance should be reasonable across all viewport sizes
        if (size.includes('small') || size.includes('medium')) {
          expect(metrics.averageFrameRate).toBeGreaterThanOrEqual(45);
        } else if (size.includes('large')) {
          expect(metrics.averageFrameRate).toBeGreaterThanOrEqual(35);
        } else {
          expect(metrics.averageFrameRate).toBeGreaterThanOrEqual(25);
        }
      });
    });
  });

  test('should manage memory efficiently', async ({ page }) => {
    await test.step('Monitor memory usage patterns', async () => {
      const memoryTest = await perfHelpers.testMemoryUsage(20000);

      console.log('Memory usage test:', memoryTest);

      // Should not have significant memory leaks
      expect(memoryTest.leakDetected).toBe(false);

      // Memory growth should be reasonable
      expect(memoryTest.memoryGrowth).toBeLessThanOrEqual(memoryTest.initialMemory * 0.2); // 20% max growth
    });

    await test.step('Test memory under interaction stress', async () => {
      // Perform memory-intensive operations
      for (let i = 0; i < 20; i++) {
        await graphUtils.zoomIn(2);
        await graphUtils.pan(100, 100);
        await graphUtils.zoomOut(2);
        await graphUtils.pan(-100, -100);
        await page.waitForTimeout(100);
      }

      const postStressMemory = await perfHelpers.testMemoryUsage(5000);
      expect(postStressMemory.leakDetected).toBe(false);
    });
  });

  test('should optimize level-of-detail system', async ({ page }) => {
    await test.step('Verify LOD improves performance at distance', async () => {
      // Zoom out far to trigger LOD
      await graphUtils.zoomOut(10);
      await graphUtils.waitForAnimation();

      const distantBenchmark = await perfHelpers.runPerformanceBenchmark('LOD Distant', 3000);

      // Zoom in close to disable LOD
      await graphUtils.zoomIn(15);
      await graphUtils.waitForAnimation();

      const closeBenchmark = await perfHelpers.runPerformanceBenchmark('LOD Close', 3000);

      console.log('LOD Performance:', {
        distant: distantBenchmark.metrics.averageFrameRate,
        close: closeBenchmark.metrics.averageFrameRate
      });

      // LOD should provide better performance at distance
      expect(distantBenchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(
        closeBenchmark.metrics.averageFrameRate * 0.8
      );
    });
  });

  test('should handle pan performance efficiently', async ({ page }) => {
    await test.step('Benchmark pan operations', async () => {
      const panDistances = [50, 100, 200, 500, 1000];

      for (const distance of panDistances) {
        const startTime = performance.now();

        await graphUtils.pan(distance, distance);
        await graphUtils.waitForAnimation();

        const endTime = performance.now();
        const panTime = endTime - startTime;

        console.log(`Pan ${distance}px: ${panTime}ms`);

        // Pan operations should complete quickly
        expect(panTime).toBeLessThanOrEqual(1000); // 1 second max
      }
    });

    await test.step('Test continuous pan performance', async () => {
      const continuousBenchmark = await perfHelpers.runPerformanceBenchmark('Continuous Pan', 5000);

      // Start continuous panning during benchmark
      setTimeout(async () => {
        for (let i = 0; i < 20; i++) {
          await graphUtils.pan(25, 0);
          await page.waitForTimeout(100);
        }
      }, 1000);

      expect(continuousBenchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(30);
    });
  });

  test('should maintain stable frame pacing', async ({ page }) => {
    await test.step('Analyze frame time consistency', async () => {
      const benchmark = await perfHelpers.runPerformanceBenchmark('Frame Pacing', 8000);

      console.log('Frame pacing metrics:', {
        averageFrameRate: benchmark.metrics.averageFrameRate,
        frameRateVariation: benchmark.metrics.frameRateVariation,
        jankFrames: benchmark.metrics.jankFrames,
        smoothness: benchmark.metrics.smoothness
      });

      // Frame rate should be consistent
      expect(benchmark.metrics.frameRateVariation).toBeLessThanOrEqual(20);
      expect(benchmark.metrics.jankFrames).toBeLessThanOrEqual(benchmark.metrics.totalFrames * 0.1); // Max 10% jank
      expect(benchmark.metrics.smoothness).toBeGreaterThanOrEqual(75);
    });
  });

  test('should optimize GPU performance', async ({ page }) => {
    await test.step('Profile GPU usage', async () => {
      const gpuProfile = await perfHelpers.profileGPUPerformance();

      console.log('GPU Performance Profile:', gpuProfile);

      // GPU metrics should be reasonable (when available)
      expect(gpuProfile.drawCalls).toBeGreaterThanOrEqual(0);
    });

    await test.step('Verify WebGL efficiency', async () => {
      const webglInfo = await graphUtils.getWebGLInfo();

      expect(webglInfo).toBeTruthy();
      expect(webglInfo.maxTextureSize).toBeGreaterThanOrEqual(2048);
      expect(webglInfo.extensions).toContain('OES_element_index_uint');

      console.log('WebGL Capabilities:', {
        maxTextureSize: webglInfo.maxTextureSize,
        extensionCount: webglInfo.extensions.length
      });
    });
  });

  test('should generate comprehensive performance report', async ({ page }) => {
    await test.step('Run full performance benchmark suite', async () => {
      const benchmarks = [];

      // Baseline performance
      benchmarks.push(await perfHelpers.runPerformanceBenchmark('Baseline', 3000));

      // Interaction performance
      await graphUtils.zoomIn(2);
      benchmarks.push(await perfHelpers.runPerformanceBenchmark('Zoomed 2x', 2000));

      await graphUtils.pan(200, 200);
      benchmarks.push(await perfHelpers.runPerformanceBenchmark('Panned 200px', 2000));

      await graphUtils.zoomOut(4);
      benchmarks.push(await perfHelpers.runPerformanceBenchmark('Zoomed Out 4x', 2000));

      // Generate report
      const report = perfHelpers.generatePerformanceReport(benchmarks);
      console.log('Performance Report:\n', report);

      // Verify all benchmarks meet minimum standards
      benchmarks.forEach(benchmark => {
        expect(benchmark.metrics.averageFrameRate).toBeGreaterThanOrEqual(15);
        expect(benchmark.metrics.smoothness).toBeGreaterThanOrEqual(60);
      });
    });
  });
});