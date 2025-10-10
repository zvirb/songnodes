/**
 * @file Visual Encoding Integration Guide
 * @description Code snippets and examples for integrating visual encoding,
 * LOD rendering, and edge bundling into GraphVisualization component
 *
 * This file provides ready-to-use code for enhancing the graph visualization
 * with advanced visual encoding techniques.
 */

import * as PIXI from 'pixi.js';
import {
  calculateNodeVisualProperties,
  calculateEdgeVisualProperties,
  getVisualEncodingStats,
  type NodeVisualProperties,
  type EdgeVisualProperties,
} from './visualEncoding';
import {
  batchCalculateNodeLOD,
  applyNodeLOD,
  applyEdgeLOD,
  calculateLODStats,
  shouldUseAggressiveLOD,
  type LODViewport,
  type LODLevel,
} from './lodRenderer';
import {
  performEdgeBundling,
  getEdgeBundlingStats,
  type EdgeControlPoints,
} from './edgeBundling';
import { GraphNode, GraphEdge } from '../types';

/**
 * INTEGRATION STEP 1: Add refs to GraphVisualization component
 * Place these with other refs in the component
 */
export const INTEGRATION_REFS = `
// Visual encoding refs
const nodeVisualPropsRef = useRef<Map<string, NodeVisualProperties>>(new Map());
const edgeVisualPropsRef = useRef<Map<string, EdgeVisualProperties>>(new Map());
const edgeControlPointsRef = useRef<Map<string, EdgeControlPoints>>(new Map());
const nodeLODMapRef = useRef<Map<string, LODLevel>>(new Map());

// Visual encoding options
const [enableCentralitySizing, setEnableCentralitySizing] = useState(true);
const [enableEnergyColors, setEnableEnergyColors] = useState(true);
const [enableEdgeBundling, setEnableEdgeBundling] = useState(true);
const [enableLOD, setEnableLOD] = useState(true);
`;

/**
 * INTEGRATION STEP 2: Calculate visual properties when data changes
 * Add this useEffect to recalculate when nodes/edges change
 */
export function calculateVisualPropertiesEffect(
  nodes: GraphNode[],
  edges: GraphEdge[],
  enableCentralitySizing: boolean,
  enableEnergyColors: boolean
): {
  nodeProps: Map<string, NodeVisualProperties>;
  edgeProps: Map<string, EdgeVisualProperties>;
} {
  // Calculate node visual properties
  const nodeProps = calculateNodeVisualProperties(nodes, edges, {
    enableCentralitySizing,
    enableEnergyColors,
  });

  // Calculate edge visual properties
  const edgeProps = calculateEdgeVisualProperties(edges);

  // Log statistics for monitoring
  const stats = getVisualEncodingStats(nodes, edges, nodeProps, edgeProps);
  console.log('Visual Encoding Stats:', stats);

  return { nodeProps, edgeProps };
}

/**
 * INTEGRATION STEP 3: Calculate edge bundling when data changes
 */
export function calculateEdgeBundlingEffect(
  edges: GraphEdge[],
  nodes: GraphNode[],
  enableEdgeBundling: boolean
): Map<string, EdgeControlPoints> {
  if (!enableEdgeBundling || edges.length < 50) {
    return new Map(); // Skip bundling for small graphs
  }

  // Build node position map
  const nodePositions = new Map<string, { x: number; y: number }>();
  nodes.forEach(node => {
    if (node.x !== undefined && node.y !== undefined) {
      nodePositions.set(node.id, { x: node.x, y: node.y });
    }
  });

  // Perform edge bundling
  const controlPoints = performEdgeBundling(edges, nodePositions);

  // Log statistics
  const stats = getEdgeBundlingStats(controlPoints);
  console.log('Edge Bundling Stats:', stats);

  return controlPoints;
}

/**
 * INTEGRATION STEP 4: Enhanced updateNodeVisuals with visual encoding
 * Replace the existing updateNodeVisuals function
 */
export function enhancedUpdateNodeVisuals(
  node: any, // EnhancedGraphNode
  lodLevel: LODLevel,
  nodeVisualProps: Map<string, NodeVisualProperties>,
  enableCentralitySizing: boolean,
  enableEnergyColors: boolean,
  getNodeColor: (node: any) => number,
  viewState: any,
  DEFAULT_CONFIG: any
) {
  if (!node.pixiNode || !node.pixiCircle || !node.pixiLabel) return;

  // Get visual properties from encoding
  const visualProps = nodeVisualProps.get(node.id);

  // Determine size (with override options)
  const screenRadius = enableCentralitySizing && visualProps
    ? visualProps.size
    : (node.screenRadius || viewState.nodeSize || DEFAULT_CONFIG.graph.defaultRadius);

  // Update node screenRadius
  node.screenRadius = screenRadius;

  // Determine color (with override options)
  const color = enableEnergyColors && visualProps
    ? visualProps.color
    : getNodeColor(node);

  // Apply color based on rendering mode
  if (node.pixiCircle instanceof PIXI.Sprite) {
    // Sprite mode: use tint
    node.pixiCircle.tint = color;
  } else if (node.pixiCircle instanceof PIXI.Graphics) {
    // Graphics mode: redraw
    node.pixiCircle.clear();
    node.pixiCircle.circle(0, 0, screenRadius);
    node.pixiCircle.fill(color);
  }

  // Apply LOD-based styling
  applyNodeLOD(
    node.pixiNode,
    node.pixiCircle,
    node.pixiLabel,
    lodLevel,
    screenRadius
  );

  // Update label visibility based on LOD and view state
  const shouldShowLabel = viewState.showLabels && lodLevel <= 1;
  if (node.pixiLabel) {
    node.pixiLabel.visible = shouldShowLabel;
    if (shouldShowLabel) {
      node.pixiLabel.position.set(screenRadius + 4, -screenRadius * 0.3);
    }
  }

  // Update opacity from visual encoding
  if (visualProps) {
    node.pixiNode.alpha = visualProps.opacity;
  }
}

/**
 * INTEGRATION STEP 5: Enhanced updateEdgeVisuals with edge bundling
 * Replace the existing updateEdgeVisuals function
 */
export function enhancedUpdateEdgeVisuals(
  edge: any, // EnhancedGraphEdge
  lodLevel: LODLevel,
  edgeVisualProps: Map<string, EdgeVisualProperties>,
  edgeControlPoints: Map<string, EdgeControlPoints>,
  enableEdgeBundling: boolean,
  getEdgeColor: (edge: any) => number,
  viewState: any
) {
  if (!edge.pixiEdge || !edge.sourceNode || !edge.targetNode) return;
  if (typeof edge.sourceNode.x !== 'number' || typeof edge.sourceNode.y !== 'number' ||
      typeof edge.targetNode.x !== 'number' || typeof edge.targetNode.y !== 'number') {
    return;
  }

  // Get visual properties
  const visualProps = edgeVisualProps.get(edge.id);
  const controlPoints = enableEdgeBundling ? edgeControlPoints.get(edge.id) : null;

  // Determine edge thickness
  const thickness = visualProps?.thickness || 1.5;

  // Determine edge color
  const color = getEdgeColor(edge);

  // Clear and redraw edge
  edge.pixiEdge.clear();

  if (controlPoints && controlPoints.isBundled) {
    // Draw bundled edge with curves
    edge.pixiEdge.moveTo(controlPoints.sourceX, controlPoints.sourceY);

    if (controlPoints.controlX2 !== undefined && controlPoints.controlY2 !== undefined) {
      // Cubic Bezier curve (two control points)
      edge.pixiEdge.bezierCurveTo(
        controlPoints.controlX1,
        controlPoints.controlY1,
        controlPoints.controlX2,
        controlPoints.controlY2,
        controlPoints.targetX,
        controlPoints.targetY
      );
    } else {
      // Quadratic curve (one control point)
      edge.pixiEdge.quadraticCurveTo(
        controlPoints.controlX1,
        controlPoints.controlY1,
        controlPoints.targetX,
        controlPoints.targetY
      );
    }

    edge.pixiEdge.stroke({ width: thickness, color, alpha: visualProps?.opacity || 0.6 });
  } else {
    // Draw straight edge
    edge.pixiEdge.moveTo(edge.sourceNode.x, edge.sourceNode.y);
    edge.pixiEdge.lineTo(edge.targetNode.x, edge.targetNode.y);
    edge.pixiEdge.stroke({ width: thickness, color, alpha: visualProps?.opacity || 0.6 });
  }

  // Apply LOD-based styling
  applyEdgeLOD(edge.pixiEdge, lodLevel, thickness);
}

/**
 * INTEGRATION STEP 6: Enhanced renderFrame with LOD calculation
 * Replace the renderFrame function
 */
export function enhancedRenderFrame(
  lodSystemRef: any,
  pixiAppRef: any,
  enhancedNodesRef: any,
  enhancedEdgesRef: any,
  viewportRef: any,
  viewState: any,
  nodeLODMapRef: any,
  enableLOD: boolean,
  updateNodeVisuals: (node: any, lodLevel: number) => void,
  updateEdgeVisuals: (edge: any, lodLevel: number) => void,
  frameRef: any
) {
  if (!lodSystemRef.current || !pixiAppRef.current) return;

  const currentFrame = frameRef.current++;

  // Calculate LOD for all nodes
  if (enableLOD) {
    const nodes = Array.from(enhancedNodesRef.current.values());
    const viewport = viewportRef.current;

    // Create LOD viewport
    const lodViewport = {
      x: viewport.x,
      y: viewport.y,
      width: viewport.width,
      height: viewport.height,
      zoom: viewport.zoom,
      centerX: viewport.width / 2,
      centerY: viewport.height / 2,
    };

    // Batch calculate LOD levels
    const lodMap = batchCalculateNodeLOD(
      nodes,
      lodViewport,
      viewState.selectedNodes,
      viewState.hoveredNode
    );

    nodeLODMapRef.current = lodMap;

    // Log LOD stats periodically
    if (currentFrame % 60 === 0) {
      const stats = calculateLODStats(lodMap);
      console.log('LOD Stats:', stats);
    }
  }

  // Update edge visuals
  if (viewState.showEdges) {
    enhancedEdgesRef.current.forEach((edge: any) => {
      const lodLevel = enableLOD
        ? Math.max(
            nodeLODMapRef.current.get(edge.source.id) || 0,
            nodeLODMapRef.current.get(edge.target.id) || 0
          )
        : 0;

      const shouldRender = lodLevel < 3;

      if (edge.pixiEdge) {
        edge.pixiEdge.visible = shouldRender;
        edge.isVisible = shouldRender;

        if (shouldRender) {
          updateEdgeVisuals(edge, lodLevel);
        }
      }
    });
  }

  // Update node visuals
  enhancedNodesRef.current.forEach((node: any) => {
    const lodLevel = enableLOD ? (nodeLODMapRef.current.get(node.id) || 0) : 0;
    const shouldRender = lodLevel < 3;

    if (node.pixiNode) {
      node.pixiNode.visible = shouldRender;
      node.isVisible = shouldRender;

      if (shouldRender) {
        updateNodeVisuals(node, lodLevel);
      }
    }
  });
}

/**
 * INTEGRATION STEP 7: Add UI controls for visual encoding
 * Add these to the settings panel or debug panel
 */
export const VISUAL_ENCODING_UI = `
<div className="visual-encoding-controls">
  <label>
    <input
      type="checkbox"
      checked={enableCentralitySizing}
      onChange={(e) => setEnableCentralitySizing(e.target.checked)}
    />
    Node Size by Centrality
  </label>

  <label>
    <input
      type="checkbox"
      checked={enableEnergyColors}
      onChange={(e) => setEnableEnergyColors(e.target.checked)}
    />
    Energy-based Colors
  </label>

  <label>
    <input
      type="checkbox"
      checked={enableEdgeBundling}
      onChange={(e) => setEnableEdgeBundling(e.target.checked)}
    />
    Edge Bundling
  </label>

  <label>
    <input
      type="checkbox"
      checked={enableLOD}
      onChange={(e) => setEnableLOD(e.target.checked)}
    />
    LOD Rendering
  </label>
</div>
`;

/**
 * Complete integration example - useEffect hooks
 */
export const INTEGRATION_USE_EFFECTS = `
// Calculate visual properties when data changes
useEffect(() => {
  if (!graphData.nodes.length) return;

  const { nodeProps, edgeProps } = calculateVisualPropertiesEffect(
    graphData.nodes,
    graphData.edges,
    enableCentralitySizing,
    enableEnergyColors
  );

  nodeVisualPropsRef.current = nodeProps;
  edgeVisualPropsRef.current = edgeProps;

  scheduleFrameUpdate();
}, [graphData.nodes, graphData.edges, enableCentralitySizing, enableEnergyColors]);

// Calculate edge bundling when data or positions change
useEffect(() => {
  if (!graphData.edges.length) return;

  const controlPoints = calculateEdgeBundlingEffect(
    graphData.edges,
    graphData.nodes,
    enableEdgeBundling
  );

  edgeControlPointsRef.current = controlPoints;

  scheduleFrameUpdate();
}, [graphData.nodes, graphData.edges, enableEdgeBundling]);
`;

/**
 * Performance monitoring utility
 */
export interface VisualEncodingPerformance {
  fps: number;
  renderTime: number;
  nodeUpdateTime: number;
  edgeUpdateTime: number;
  lodCalculationTime: number;
  visibleNodes: number;
  visibleEdges: number;
}

export function monitorVisualEncodingPerformance(
  startTime: number,
  endTime: number,
  visibleNodes: number,
  visibleEdges: number
): VisualEncodingPerformance {
  const renderTime = endTime - startTime;
  const fps = 1000 / renderTime;

  return {
    fps,
    renderTime,
    nodeUpdateTime: 0, // Measure separately
    edgeUpdateTime: 0, // Measure separately
    lodCalculationTime: 0, // Measure separately
    visibleNodes,
    visibleEdges,
  };
}
