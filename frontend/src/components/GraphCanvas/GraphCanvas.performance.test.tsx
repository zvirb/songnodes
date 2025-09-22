import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { WorkingD3Canvas as GraphCanvas } from './WorkingD3Canvas';
import { createMockGraphData } from '../../test/setup';
import { 
  measureRenderTime,
  measureMemoryUsage,
  simulateSlowDevice,
  restoreNormalDevice,
  checkPerformanceThresholds,
  simulateLargeDataset,
  measureFrameRate,
  PerformanceThresholds
} from '../../test/performance-setup';
import { configureStore } from '@reduxjs/toolkit';
import graphSlice from '../../store/graphSlice';
import uiSlice from '../../store/uiSlice';
import settingsSlice from '../../store/settingsSlice';

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      graph: graphSlice.reducer,
      ui: uiSlice.reducer,
      settings: settingsSlice.reducer,
    },
    preloadedState: {
      graph: {
        nodes: [],
        edges: [],
        selectedNodes: [],
        hoveredNode: null,
        isLoading: false,
        error: null,
        metadata: {},
        ...initialState.graph,
      },
      ui: {
        selectedPanel: null,
        isFullscreen: false,
        zoom: 1,
        pan: { x: 0, y: 0 },
        ...initialState.ui,
      },
      settings: {
        performance: {
          enableOptimizations: true,
          maxNodes: 1000,
          enableWebGL: true,
          enableVirtualization: true,
          throttleUpdates: true,
        },
        ...initialState.settings,
      },
    },
  });
};

const renderWithProvider = (component: React.ReactElement, store = createTestStore()) => {
  return render(<Provider store={store}>{component}</Provider>);
};

describe('GraphCanvas Performance Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    // Reset performance API
    performance.clearMarks();
    performance.clearMeasures();
  });

  afterEach(() => {
    restoreNormalDevice();
    vi.clearAllMocks();
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('Rendering Performance', () => {
    it('renders small datasets within performance budget', async () => {
      const thresholds: PerformanceThresholds = {
        renderTime: 16, // 60fps = 16.67ms per frame
        memoryUsage: 1024 * 1024, // 1MB
      };

      const mockData = createMockGraphData(50, 40);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
      });

      const memoryBefore = measureMemoryUsage();
      
      const renderTime = await measureRenderTime(async () => {
        renderWithProvider(<GraphCanvas />, store);
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
      });

      const memoryAfter = measureMemoryUsage();
      const memoryDelta = memoryAfter.delta;

      const metrics = {
        renderTime,
        memoryUsage: memoryDelta,
        interactionTime: 0,
        fps: 60,
      };

      const result = checkPerformanceThresholds(metrics, thresholds);
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('renders medium datasets with optimizations', async () => {
      const thresholds: PerformanceThresholds = {
        renderTime: 33, // 30fps = 33.33ms per frame
        memoryUsage: 5 * 1024 * 1024, // 5MB
      };

      const mockData = createMockGraphData(500, 400);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
        settings: {
          performance: {
            enableOptimizations: true,
            enableWebGL: true,
          },
        },
      });

      const renderTime = await measureRenderTime(async () => {
        renderWithProvider(<GraphCanvas />, store);
        await waitFor(() => {
          const canvas = screen.getByRole('img');
          expect(canvas).toHaveAttribute('data-performance-mode', 'optimized');
        });
      });

      const metrics = {
        renderTime,
        memoryUsage: 0,
        interactionTime: 0,
        fps: 30,
      };

      const result = checkPerformanceThresholds(metrics, thresholds);
      expect(result.passed).toBe(true);
    });

    it('handles large datasets with virtualization', async () => {
      const thresholds: PerformanceThresholds = {
        renderTime: 100, // Allow more time for large datasets
        memoryUsage: 20 * 1024 * 1024, // 20MB
      };

      const largeDataset = simulateLargeDataset(2000);
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
        settings: {
          performance: {
            enableOptimizations: true,
            enableVirtualization: true,
            maxNodes: 1000,
          },
        },
      });

      const renderTime = await measureRenderTime(async () => {
        renderWithProvider(<GraphCanvas />, store);
        await waitFor(() => {
          const canvas = screen.getByRole('img');
          expect(canvas).toHaveAttribute('data-virtualization', 'enabled');
        });
      });

      const metrics = {
        renderTime,
        memoryUsage: 0,
        interactionTime: 0,
        fps: 30,
      };

      const result = checkPerformanceThresholds(metrics, thresholds);
      expect(result.passed).toBe(true);
    });
  });

  describe('Interaction Performance', () => {
    it('maintains responsive interactions during zoom', async () => {
      const mockData = createMockGraphData(200, 150);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);
      const canvas = screen.getByRole('img');

      // Measure interaction response time
      performance.mark('zoom-start');
      
      await user.pointer([
        { keys: '[MouseLeft>]', target: canvas },
        { coords: { x: 100, y: 100 } },
        { coords: { x: 150, y: 150 } },
        { keys: '[/MouseLeft]' },
      ]);

      performance.mark('zoom-end');
      performance.measure('zoom-interaction', 'zoom-start', 'zoom-end');

      const measures = performance.getEntriesByName('zoom-interaction');
      expect(measures[0].duration).toBeLessThan(100); // < 100ms interaction time
    });

    it('maintains responsive interactions during pan', async () => {
      const mockData = createMockGraphData(200, 150);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);
      const canvas = screen.getByRole('img');

      performance.mark('pan-start');
      
      await user.pointer([
        { keys: '[MouseLeft>]', target: canvas, coords: { x: 100, y: 100 } },
        { coords: { x: 200, y: 200 } },
        { keys: '[/MouseLeft]' },
      ]);

      performance.mark('pan-end');
      performance.measure('pan-interaction', 'pan-start', 'pan-end');

      const measures = performance.getEntriesByName('pan-interaction');
      expect(measures[0].duration).toBeLessThan(50); // < 50ms pan response
    });

    it('throttles updates during rapid interactions', async () => {
      const mockData = createMockGraphData(1000, 800);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
        settings: {
          performance: {
            throttleUpdates: true,
          },
        },
      });

      renderWithProvider(<GraphCanvas />, store);
      const canvas = screen.getByRole('img');

      let updateCount = 0;
      const originalRequestAnimationFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = vi.fn((callback) => {
        updateCount++;
        return originalRequestAnimationFrame(callback);
      });

      // Simulate rapid mouse movements
      for (let i = 0; i < 50; i++) {
        await user.pointer({ coords: { x: i * 2, y: i * 2 }, target: canvas });
      }

      await waitFor(() => {
        // Should throttle to reasonable number of updates
        expect(updateCount).toBeLessThan(20);
      });

      window.requestAnimationFrame = originalRequestAnimationFrame;
    });
  });

  describe('Memory Management', () => {
    it('manages memory efficiently with large datasets', () => {
      const initialMemory = measureMemoryUsage();
      
      const largeDataset = simulateLargeDataset(5000);
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
        settings: {
          performance: {
            enableOptimizations: true,
            enableVirtualization: true,
          },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const afterRenderMemory = measureMemoryUsage();
      const memoryGrowth = afterRenderMemory.after - initialMemory.before;

      // Memory growth should be reasonable for large dataset
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // < 50MB
    });

    it('cleans up memory on unmount', () => {
      const mockData = createMockGraphData(1000, 800);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
      });

      const beforeMemory = measureMemoryUsage();
      
      const { unmount } = renderWithProvider(<GraphCanvas />, store);
      
      const afterMountMemory = measureMemoryUsage();
      
      unmount();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterUnmountMemory = measureMemoryUsage();
      
      // Memory should not grow significantly after unmount
      const memoryLeak = afterUnmountMemory.after - beforeMemory.before;
      expect(memoryLeak).toBeLessThan(5 * 1024 * 1024); // < 5MB potential leak
    });

    it('handles memory pressure gracefully', async () => {
      // Simulate low memory condition
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 80 * 1024 * 1024, // 80MB used
          totalJSHeapSize: 100 * 1024 * 1024, // 100MB total
          jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB limit
        },
        configurable: true,
      });

      const largeDataset = simulateLargeDataset(3000);
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      await waitFor(() => {
        const canvas = screen.getByRole('img');
        expect(canvas).toHaveAttribute('data-memory-optimized', 'true');
      });
    });
  });

  describe('Frame Rate Performance', () => {
    it('maintains 60fps with small datasets', async () => {
      const mockData = createMockGraphData(100, 80);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const fps = await measureFrameRate(1000); // Measure for 1 second
      expect(fps).toBeGreaterThanOrEqual(55); // Allow some variance from 60fps
    });

    it('maintains 30fps minimum with large datasets', async () => {
      const largeDataset = simulateLargeDataset(2000);
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
        settings: {
          performance: {
            enableOptimizations: true,
          },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const fps = await measureFrameRate(1000);
      expect(fps).toBeGreaterThanOrEqual(25); // Minimum acceptable fps
    });

    it('adapts frame rate on slow devices', async () => {
      simulateSlowDevice();

      const mockData = createMockGraphData(500, 400);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
        settings: {
          performance: {
            enableOptimizations: true,
            adaptivePerformance: true,
          },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      await waitFor(() => {
        const canvas = screen.getByRole('img');
        expect(canvas).toHaveAttribute('data-adaptive-performance', 'true');
      });

      const fps = await measureFrameRate(1000);
      expect(fps).toBeGreaterThanOrEqual(20); // Lower but acceptable fps on slow devices
    });
  });

  describe('WebGL Performance', () => {
    it('uses WebGL for large datasets when available', () => {
      const largeDataset = simulateLargeDataset(1500);
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
        settings: {
          performance: {
            enableWebGL: true,
          },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveAttribute('data-renderer', 'webgl');
    });

    it('falls back to Canvas 2D gracefully when WebGL unavailable', () => {
      // Mock WebGL unavailable
      HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
        if (contextType === 'webgl' || contextType === 'webgl2') {
          return null; // WebGL unavailable
        }
        return {}; // Return 2D context
      });

      const mockData = createMockGraphData(1000, 800);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
        settings: {
          performance: {
            enableWebGL: true,
          },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveAttribute('data-renderer', 'canvas2d');
    });

    it('handles WebGL context loss gracefully', async () => {
      const mockData = createMockGraphData(1000, 800);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
        settings: {
          performance: {
            enableWebGL: true,
          },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img') as HTMLCanvasElement;

      // Simulate WebGL context loss
      const contextLostEvent = new Event('webglcontextlost');
      canvas.dispatchEvent(contextLostEvent);

      await waitFor(() => {
        expect(canvas).toHaveAttribute('data-context-lost', 'true');
      });

      // Simulate context restoration
      const contextRestoredEvent = new Event('webglcontextrestored');
      canvas.dispatchEvent(contextRestoredEvent);

      await waitFor(() => {
        expect(canvas).toHaveAttribute('data-context-lost', 'false');
      });
    });
  });

  describe('Benchmarking and Regression Detection', () => {
    it('benchmarks node positioning algorithm performance', async () => {
      const nodeCount = 1000;
      const largeDataset = simulateLargeDataset(nodeCount);
      
      performance.mark('positioning-start');
      
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      await waitFor(() => {
        const canvas = screen.getByRole('img');
        expect(canvas).toBeInTheDocument();
      });

      performance.mark('positioning-end');
      performance.measure('node-positioning', 'positioning-start', 'positioning-end');

      const measures = performance.getEntriesByName('node-positioning');
      const positioningTime = measures[0].duration;

      // Should position 1000 nodes in reasonable time
      expect(positioningTime).toBeLessThan(100); // < 100ms for positioning

      // Calculate nodes per second for benchmarking
      const nodesPerSecond = (nodeCount / positioningTime) * 1000;
      expect(nodesPerSecond).toBeGreaterThan(10000); // > 10k nodes/second
    });

    it('benchmarks edge rendering performance', async () => {
      const edgeCount = 2000;
      const largeDataset = simulateLargeDataset(1000);
      largeDataset.edges = Array.from({ length: edgeCount }, (_, i) => ({
        source: `perf-node-${i % 1000}`,
        target: `perf-node-${(i + 1) % 1000}`,
        weight: Math.random(),
        type: 'similarity',
      }));

      performance.mark('edge-rendering-start');

      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      await waitFor(() => {
        const canvas = screen.getByRole('img');
        expect(canvas).toBeInTheDocument();
      });

      performance.mark('edge-rendering-end');
      performance.measure('edge-rendering', 'edge-rendering-start', 'edge-rendering-end');

      const measures = performance.getEntriesByName('edge-rendering');
      const renderingTime = measures[0].duration;

      // Should render 2000 edges in reasonable time
      expect(renderingTime).toBeLessThan(50); // < 50ms for edge rendering

      const edgesPerSecond = (edgeCount / renderingTime) * 1000;
      expect(edgesPerSecond).toBeGreaterThan(40000); // > 40k edges/second
    });

    it('detects performance regressions', async () => {
      const baselinePerformance = {
        renderTime: 30,
        memoryUsage: 10 * 1024 * 1024,
        fps: 45,
      };

      const mockData = createMockGraphData(500, 400);
      const store = createTestStore({
        graph: { nodes: mockData.nodes, edges: mockData.edges },
      });

      const currentRenderTime = await measureRenderTime(async () => {
        renderWithProvider(<GraphCanvas />, store);
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
      });

      const currentFps = await measureFrameRate(500);

      // Check for regression (>20% slower)
      const regressionThreshold = 1.2;
      
      expect(currentRenderTime).toBeLessThan(baselinePerformance.renderTime * regressionThreshold);
      expect(currentFps).toBeGreaterThan(baselinePerformance.fps / regressionThreshold);
    });
  });
});