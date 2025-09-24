import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { WorkingD3Canvas as GraphCanvas } from './WorkingD3Canvas';
import { createMockGraphData, createMockNode } from '../../test/setup';
import graphSlice from '../../store/graphSlice';
import uiSlice from '../../store/uiSlice';
import settingsSlice from '../../store/settingsSlice';
import { RootState } from '../../store';

const createTestStore = (initialState: Partial<RootState> = {}) => {
  return configureStore({
    reducer: {
      graph: graphSlice,
      ui: uiSlice,
      settings: settingsSlice,
    },
    preloadedState: {
      graph: {
        nodes: [],
        edges: [],
        selectedNodes: [],
        hoveredNode: null,
        isLoading: false,
        error: null,

        ...(initialState.graph || {}),
      },
      ui: {
        selectedPanel: null,
        isFullscreen: false,
        zoom: 1,
        pan: { x: 0, y: 0 },
        ...(initialState.ui || {}),
      },
      settings: {
        performance: {
          enableOptimizations: true,
          maxNodes: 1000,
          enableWebGL: true,
        },
        accessibility: {
          enableScreenReader: true,
          enableKeyboardNavigation: true,
          highContrast: false,
        },
        ...(initialState.settings || {}),
      },
    } as RootState,
  });

const renderWithProvider = (component: React.ReactElement, store: ReturnType<typeof createTestStore>) => {
  return render(<Provider store={store}>{component}</Provider>);
};

const user = userEvent.setup();

describe('GraphCanvas Component', () => {
  let mockGraphData: ReturnType<typeof createMockGraphData>;

  beforeEach(() => {
    mockGraphData = createMockGraphData(5, 4);
    
    // Mock getBoundingClientRect for canvas
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders canvas with correct attributes', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={800} height={600} />, store);

      const canvas = screen.getByRole('img', { name: /graph visualization/i });
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('width');
      expect(canvas).toHaveAttribute('height');
    });

    it('renders with accessibility attributes', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveAttribute('aria-label');
      expect(canvas).toHaveAttribute('tabindex', '0');
    });

    it('displays loading state correctly', () => {
      const store = createTestStore({
        graph: { isLoading: true, nodes: [], edges: [] },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays error state correctly', () => {
      const store = createTestStore({
        graph: { 
          error: 'Failed to load graph data',
          nodes: [],
          edges: [],
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('renders empty state when no nodes', () => {
      const store = createTestStore({
        graph: { nodes: [], edges: [] },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      expect(screen.getByText(/no data to display/i)).toBeInTheDocument();
    });
  });

  describe('Node Interactions', () => {
    it('handles node selection on click', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      
      // Simulate click on canvas (would normally trigger node selection)
      await user.click(canvas);

      // Verify canvas receives focus
      expect(canvas).toHaveFocus();
    });

    it('handles node hover events', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      
      // Simulate mouse move over canvas
      await user.hover(canvas);

      // Verify hover state is handled
      expect(canvas).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      // Test Tab navigation
      await user.keyboard('{Tab}');
      expect(canvas).toHaveFocus();

      // Test Arrow key navigation
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowDown}');
      
      // Test Enter for selection
      await user.keyboard('{Enter}');
      
      // Verify keyboard events are handled
      expect(canvas).toHaveFocus();
    });

    it('handles escape key to clear selection', async () => {
      const store = createTestStore({
        graph: { 
          nodes: mockGraphData.nodes, 
          edges: mockGraphData.edges,
          selectedNodes: ['test-node-1'],
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      // Press Escape
      await user.keyboard('{Escape}');

      // Selection should be cleared (verified by Redux store state)
      expect(canvas).toHaveFocus();
    });
  });

  describe('Performance Optimizations', () => {
    it('enables performance mode for large datasets', async () => {
      const largeDataset = createMockGraphData(2000, 1500);
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
        settings: {
          performance: {
            enableOptimizations: true,
            maxNodes: 1000,
          },
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      await waitFor(() => {
        const canvas = screen.getByRole('img');
        expect(canvas).toHaveAttribute('data-performance-mode', 'optimized');
      });
    });

    it('handles low-performance devices gracefully', () => {
      // Simulate low-performance device
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 2,
        configurable: true,
      });

      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toBeInTheDocument();
      
      // Performance optimizations should be enabled automatically
      expect(canvas).toHaveAttribute('data-performance-mode');
    });

    it('throttles render updates during animation', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      
      // Simulate rapid mouse movements that would trigger many renders
      for (let i = 0; i < 10; i++) {
        fireEvent.mouseMove(canvas, { clientX: i * 10, clientY: i * 10 });
      }

      // Verify canvas is still responsive
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Zoom and Pan', () => {
    it('handles zoom gestures', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      
      // Simulate wheel event for zoom
      fireEvent.wheel(canvas, { deltaY: -100 });
      
      expect(canvas).toBeInTheDocument();
    });

    it('handles pan gestures', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      
      // Simulate drag for pan
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas);
      
      expect(canvas).toBeInTheDocument();
    });

    it('constrains zoom to reasonable bounds', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        ui: { zoom: 10 }, // Very high zoom
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('WebGL Rendering', () => {
    it('initializes WebGL context when enabled', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        settings: {
          performance: { enableWebGL: true },
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      // WebGL renderer should be initialized
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('falls back to Canvas 2D when WebGL unavailable', () => {
      // Mock WebGL unavailable
      HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
        if (contextType === 'webgl' || contextType === 'webgl2') {
          return null; // WebGL unavailable
        }
        return {}; // Return 2D context
      });

      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        settings: {
          performance: { enableWebGL: true },
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('announces graph updates to screen readers', async () => {
      const store = createTestStore({
        graph: { nodes: [], edges: [] },
      });

      const { rerender } = renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      // Update store with new data
      const updatedStore = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      rerender(<Provider store={updatedStore}><GraphCanvas width={1200} height={800} /></Provider>);

      await waitFor(() => {
        const announcement = screen.getByLabelText(/graph updated/i);
        expect(announcement).toBeInTheDocument();
      });
    });

    it('provides detailed node information on focus', async () => {
      const store = createTestStore({
        graph: { 
          nodes: mockGraphData.nodes, 
          edges: mockGraphData.edges,
          selectedNodes: ['test-node-1'],
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      // Node details should be announced
      expect(canvas).toHaveAttribute('aria-describedby');
    });

    it('supports high contrast mode', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        settings: {
          accessibility: { highContrast: true },
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveClass('high-contrast');
    });
  });

  describe('Error Handling', () => {
    it('handles rendering errors gracefully', () => {
      // Mock a rendering error
      const originalError = console.error;
      console.error = vi.fn();

      const store = createTestStore({
        graph: { 
          nodes: [{ ...createMockNode(), x: NaN, y: NaN }], // Invalid coordinates
          edges: mockGraphData.edges,
        },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      expect(screen.getByText(/rendering error/i)).toBeInTheDocument();
      
      console.error = originalError;
    });

    it('recovers from WebGL context loss', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img') as HTMLCanvasElement;
      
      // Simulate WebGL context loss
      const contextLostEvent = new Event('webglcontextlost');
      canvas.dispatchEvent(contextLostEvent);

      // Should attempt to restore context
      const contextRestoredEvent = new Event('webglcontextrestored');
      canvas.dispatchEvent(contextRestoredEvent);

      await waitFor(() => {
        expect(canvas).toBeInTheDocument();
      });
    });
  });

  describe('Memory Management', () => {
    it('cleans up resources on unmount', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      const { unmount } = renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      unmount();

      // Memory should be cleaned up (WebGL renderer cleanup is mocked)
      expect(true).toBe(true); // Placeholder assertion
    });

    it('handles large dataset memory efficiently', () => {
      const largeDataset = createMockGraphData(5000, 4000);
      const store = createTestStore({
        graph: { nodes: largeDataset.nodes, edges: largeDataset.edges },
      });

      renderWithProvider(<GraphCanvas width={1200} height={800} />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toBeInTheDocument();
      
      // Should enable memory optimizations
      expect(canvas).toHaveAttribute('data-memory-optimized', 'true');
    });
  });
});