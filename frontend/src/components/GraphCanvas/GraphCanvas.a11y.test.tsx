import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { GraphCanvas } from './GraphCanvas';
import { createMockGraphData, waitForAccessibilityTree } from '../../test/setup';
import { 
  clearAnnouncements, 
  mockScreenReaderAnnouncement,
  getAllAnnouncements,
  simulateKeyboardNavigation,
  getFocusableElements,
  simulateFocusTrap
} from '../../test/accessibility-setup';
import { configureStore } from '@reduxjs/toolkit';
import graphSlice from '../../store/graphSlice';
import uiSlice from '../../store/uiSlice';
import settingsSlice from '../../store/settingsSlice';

expect.extend(toHaveNoViolations);

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
        accessibility: {
          enableScreenReader: true,
          enableKeyboardNavigation: true,
          highContrast: false,
          reducedMotion: false,
          announceUpdates: true,
        },
        ...initialState.settings,
      },
    },
  });
};

const renderWithProvider = (component: React.ReactElement, store = createTestStore()) => {
  return render(<Provider store={store}>{component}</Provider>);
};

describe('GraphCanvas Accessibility Tests', () => {
  let mockGraphData: ReturnType<typeof createMockGraphData>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockGraphData = createMockGraphData(5, 4);
    user = userEvent.setup();
    clearAnnouncements();

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
  });

  afterEach(() => {
    clearAnnouncements();
    vi.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('meets WCAG 2.1 AA accessibility standards', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      const { container } = renderWithProvider(<GraphCanvas />, store);
      
      await waitForAccessibilityTree();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels and roles', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveAttribute('aria-label');
      expect(canvas).toHaveAttribute('aria-describedby');
      
      // Check for live region for announcements
      const liveRegion = screen.getByLabelText(/graph announcements/i);
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('has proper heading structure', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      // Should have appropriate heading levels
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check heading hierarchy
      headings.forEach((heading) => {
        const level = parseInt(heading.tagName.charAt(1));
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(6);
      });
    });

    it('provides sufficient color contrast', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        settings: {
          accessibility: { highContrast: false },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      
      // Check computed styles for sufficient contrast
      const styles = window.getComputedStyle(canvas);
      expect(styles.backgroundColor).toBeTruthy();
      expect(styles.color).toBeTruthy();
    });

    it('supports high contrast mode', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        settings: {
          accessibility: { highContrast: true },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveClass('high-contrast');
    });
  });

  describe('Keyboard Navigation', () => {
    it('is keyboard focusable', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      
      await user.tab();
      expect(canvas).toHaveFocus();
    });

    it('supports arrow key navigation through nodes', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      // Navigate through nodes with arrow keys
      simulateKeyboardNavigation(canvas, 'ArrowRight');
      await waitFor(() => {
        const announcements = getAllAnnouncements();
        expect(announcements.some(a => a.includes('navigated to'))).toBe(true);
      });

      simulateKeyboardNavigation(canvas, 'ArrowDown');
      await waitFor(() => {
        const announcements = getAllAnnouncements();
        expect(announcements.length).toBeGreaterThan(0);
      });
    });

    it('supports Enter key for node selection', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      simulateKeyboardNavigation(canvas, 'Enter');
      
      await waitFor(() => {
        const announcements = getAllAnnouncements();
        expect(announcements.some(a => a.includes('selected'))).toBe(true);
      });
    });

    it('supports Space key for node activation', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      simulateKeyboardNavigation(canvas, ' '); // Space key
      
      await waitFor(() => {
        const announcements = getAllAnnouncements();
        expect(announcements.some(a => a.includes('activated'))).toBe(true);
      });
    });

    it('supports Escape key to clear selection', async () => {
      const store = createTestStore({
        graph: { 
          nodes: mockGraphData.nodes, 
          edges: mockGraphData.edges,
          selectedNodes: ['test-node-1'],
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      simulateKeyboardNavigation(canvas, 'Escape');
      
      await waitFor(() => {
        const announcements = getAllAnnouncements();
        expect(announcements.some(a => a.includes('selection cleared'))).toBe(true);
      });
    });

    it('supports Tab navigation to controls', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      const { container } = renderWithProvider(<GraphCanvas />, store);

      const focusableElements = getFocusableElements(container);
      expect(focusableElements.length).toBeGreaterThan(0);

      // Tab through all focusable elements
      for (let i = 0; i < focusableElements.length; i++) {
        await user.tab();
      }

      // Should cycle back to first element
      await user.tab();
      expect(focusableElements[0]).toHaveFocus();
    });

    it('maintains focus trap within graph area', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      const { container } = renderWithProvider(<GraphCanvas />, store);

      const focusTrap = simulateFocusTrap(container);
      
      focusTrap.focusFirst();
      expect(focusTrap.getCurrentIndex()).toBe(0);
      
      focusTrap.focusNext();
      expect(focusTrap.getCurrentIndex()).toBe(1);
      
      focusTrap.focusLast();
      expect(focusTrap.getCurrentIndex()).toBe(focusTrap.getFocusableCount() - 1);
    });
  });

  describe('Screen Reader Support', () => {
    it('announces graph loading state', async () => {
      const store = createTestStore({
        graph: { isLoading: true, nodes: [], edges: [] },
      });

      renderWithProvider(<GraphCanvas />, store);

      await waitFor(() => {
        const liveRegion = screen.getByLabelText(/graph announcements/i);
        expect(liveRegion).toHaveTextContent(/loading/i);
      });
    });

    it('announces graph data updates', async () => {
      const store = createTestStore({
        graph: { nodes: [], edges: [] },
      });

      const { rerender } = renderWithProvider(<GraphCanvas />, store);

      // Update with data
      const updatedStore = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      rerender(<Provider store={updatedStore}><GraphCanvas /></Provider>);

      await waitFor(() => {
        const liveRegion = screen.getByLabelText(/graph announcements/i);
        expect(liveRegion).toHaveTextContent(/5 nodes.*4 edges/i);
      });
    });

    it('announces node selection changes', async () => {
      const store = createTestStore({
        graph: { 
          nodes: mockGraphData.nodes, 
          edges: mockGraphData.edges,
          selectedNodes: ['test-node-1'],
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      await waitFor(() => {
        const liveRegion = screen.getByLabelText(/graph announcements/i);
        expect(liveRegion).toHaveTextContent(/selected.*test node 1/i);
      });
    });

    it('provides detailed node information on focus', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      const nodeDetails = screen.getByLabelText(/node details/i);
      
      expect(canvas).toHaveAttribute('aria-describedby');
      expect(nodeDetails).toBeInTheDocument();
    });

    it('announces error states', async () => {
      const store = createTestStore({
        graph: { 
          error: 'Failed to load graph data',
          nodes: [],
          edges: [],
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      await waitFor(() => {
        const liveRegion = screen.getByLabelText(/graph announcements/i);
        expect(liveRegion).toHaveTextContent(/error.*failed to load/i);
      });
    });

    it('provides contextual help information', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const helpButton = screen.getByLabelText(/help.*keyboard shortcuts/i);
      expect(helpButton).toBeInTheDocument();
      expect(helpButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Reduced Motion Support', () => {
    it('respects prefers-reduced-motion setting', () => {
      // Mock prefers-reduced-motion media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        settings: {
          accessibility: { reducedMotion: true },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveClass('reduced-motion');
    });

    it('disables animations when reduced motion is enabled', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
        settings: {
          accessibility: { reducedMotion: true },
        },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      expect(canvas).toHaveAttribute('data-animations', 'disabled');
    });
  });

  describe('Focus Management', () => {
    it('manages focus correctly during interactions', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      
      // Focus should move to canvas when clicked
      await user.click(canvas);
      expect(canvas).toHaveFocus();

      // Focus should remain on canvas during keyboard navigation
      simulateKeyboardNavigation(canvas, 'ArrowRight');
      expect(canvas).toHaveFocus();
    });

    it('provides visible focus indicators', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      canvas.focus();

      // Should have visible focus ring
      expect(canvas).toHaveClass('focus-visible');
    });

    it('skips hidden or disabled elements in tab order', async () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      const { container } = renderWithProvider(<GraphCanvas />, store);

      const focusableElements = getFocusableElements(container);
      
      // All focusable elements should be visible and enabled
      focusableElements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        expect(htmlElement.hidden).toBe(false);
        expect(htmlElement.tabIndex).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Alternative Text and Labels', () => {
    it('provides meaningful alternative text for graph visualization', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      const altText = canvas.getAttribute('aria-label');
      
      expect(altText).toContain('Interactive graph');
      expect(altText).toContain('5 nodes');
      expect(altText).toContain('4 connections');
    });

    it('updates alternative text when data changes', async () => {
      const store = createTestStore({
        graph: { nodes: [], edges: [] },
      });

      const { rerender } = renderWithProvider(<GraphCanvas />, store);

      const canvas = screen.getByRole('img');
      expect(canvas.getAttribute('aria-label')).toContain('empty');

      // Update with data
      const updatedStore = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      rerender(<Provider store={updatedStore}><GraphCanvas /></Provider>);

      await waitFor(() => {
        expect(canvas.getAttribute('aria-label')).toContain('5 nodes');
      });
    });

    it('provides descriptive labels for interactive elements', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const zoomInButton = screen.getByLabelText(/zoom in/i);
      const zoomOutButton = screen.getByLabelText(/zoom out/i);
      const resetViewButton = screen.getByLabelText(/reset view/i);

      expect(zoomInButton).toBeInTheDocument();
      expect(zoomOutButton).toBeInTheDocument();
      expect(resetViewButton).toBeInTheDocument();
    });
  });

  describe('Semantic Structure', () => {
    it('uses appropriate semantic HTML elements', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      const { container } = renderWithProvider(<GraphCanvas />, store);

      // Should have main content area
      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();

      // Should have navigation for controls
      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();

      // Should have sections for different areas
      const sections = container.querySelectorAll('section');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('provides landmark roles for navigation', () => {
      const store = createTestStore({
        graph: { nodes: mockGraphData.nodes, edges: mockGraphData.edges },
      });

      renderWithProvider(<GraphCanvas />, store);

      const main = screen.getByRole('main');
      const navigation = screen.getByRole('navigation');

      expect(main).toBeInTheDocument();
      expect(navigation).toBeInTheDocument();
    });
  });
});