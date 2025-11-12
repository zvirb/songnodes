/**
 * Hooks Index
 * Barrel export for all GraphVisualization custom hooks
 *
 * Phase 3: Custom Hooks
 * - useGraphData: Fetch and normalize graph data from API
 * - useViewport: Manage pixi-viewport pan/zoom/interactions
 * - useNodeSelection: Multi-select and keyboard navigation
 * - useGraphSimulation: D3-force physics worker integration
 */

// useGraphData - Data fetching and normalization
export {
  useGraphData,
  type UseGraphDataOptions,
  type UseGraphDataReturn,
  type GraphFilters,
} from './useGraphData';

// useViewport - Viewport management
export {
  useViewport,
  type UseViewportOptions,
  type UseViewportReturn,
  type ViewportControls,
  type CameraBookmark,
} from './useViewport';

// useNodeSelection - Selection and focus management
export {
  useNodeSelection,
  type UseNodeSelectionOptions,
  type UseNodeSelectionReturn,
  type SelectionMode,
} from './useNodeSelection';

// useGraphSimulation - Physics simulation
export {
  useGraphSimulation,
  type UseGraphSimulationOptions,
  type UseGraphSimulationReturn,
  type SimulationControls,
  type SimulationState,
} from './useGraphSimulation';
