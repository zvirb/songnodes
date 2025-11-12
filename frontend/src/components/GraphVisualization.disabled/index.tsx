/**
 * GraphVisualization - Public API
 * Barrel export for the complete graph visualization system
 *
 * This is the ONLY file that should be imported by external consumers.
 * All internal implementation details are encapsulated.
 *
 * Usage:
 * ```tsx
 * import { GraphVisualization, useGraphData } from '@/components/GraphVisualization';
 *
 * function MyApp() {
 *   const graphRef = useRef<GraphVisualizationHandle>(null);
 *
 *   return (
 *     <GraphVisualization
 *       ref={graphRef}
 *       endpoint="/api/graph-data"
 *       filters={{ maxNodes: 10000 }}
 *       onNodeClick={(event) => console.log(event.node)}
 *     />
 *   );
 * }
 * ```
 */

/* ============================================
   MAIN COMPONENT
   ============================================ */

export {
  GraphVisualization,
  type GraphVisualizationProps,
  type GraphVisualizationHandle,
} from './GraphVisualization';

/* ============================================
   UI COMPONENTS (Optional - for custom layouts)
   ============================================ */

export { GraphControls } from './GraphControls';
export { Minimap } from './Minimap';
export { NodeDetailsPanel } from './NodeDetailsPanel';

/* ============================================
   CUSTOM HOOKS (Advanced usage)
   ============================================ */

export {
  useGraphData,
  useViewport,
  useNodeSelection,
  useGraphSimulation,
  type UseGraphDataOptions,
  type UseGraphDataReturn,
  type UseViewportOptions,
  type UseViewportReturn,
  type UseNodeSelectionOptions,
  type UseNodeSelectionReturn,
  type UseGraphSimulationOptions,
  type UseGraphSimulationReturn,
  type ViewportControls,
  type SimulationControls,
  type SimulationState,
  type GraphFilters,
  type SelectionMode,
  type CameraBookmark,
} from './hooks';

/* ============================================
   TYPE EXPORTS
   ============================================ */

export type {
  GraphData,
  GraphNode,
  GraphEdge,
  Track,
  EnhancedGraphNode,
  EnhancedGraphEdge,
  Viewport,
  Bounds,
  Rectangle,
  Point,
  LODLevel,
  LODConfig,
  SimulationConfig,
  RenderStats,
  NodeClickEvent,
  EdgeClickEvent,
  ViewportChangeEvent,
  SelectionState,
  InteractionMode,
  KeyboardAction,
  GraphConfig,
  ColorSchemes,
  NodeColorScheme,
  EdgeColorScheme,
} from './types';

/* ============================================
   RENDERING COMPONENTS (Advanced - internal use)
   ============================================ */

export { NodeRenderer, type NodeRendererConfig } from './rendering/NodeRenderer';
export { EdgeRenderer, type EdgeRendererConfig } from './rendering/EdgeRenderer';
export { LODManager } from './rendering/LODManager';
export { TextureAtlas } from './rendering/TextureAtlas';

/* ============================================
   SPATIAL INFRASTRUCTURE (Advanced - internal use)
   ============================================ */

export { Quadtree } from './spatial/Quadtree';
export { FrustumCuller } from './spatial/FrustumCuller';

/* ============================================
   UTILITIES (Advanced - internal use)
   ============================================ */

export { getNodeState, getNodeTint } from './rendering/nodeStateHelpers';
export { getEdgeColor, getEdgeAlpha } from './rendering/edgeColorHelpers';
