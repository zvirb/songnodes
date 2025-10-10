/**
 * @file GraphVisualization Enhanced Example
 * @description Complete example showing how to integrate visual encoding and LOD rendering
 *
 * This is a reference implementation showing the key integration points.
 * Use this as a guide when modifying the actual GraphVisualization.tsx component.
 *
 * NOT A WORKING COMPONENT - REFERENCE ONLY
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import {
  calculateNodeVisualProperties,
  calculateEdgeVisualProperties,
  getVisualEncodingStats,
  type NodeVisualProperties,
  type EdgeVisualProperties,
} from '../utils/visualEncoding';
import {
  batchCalculateNodeLOD,
  applyNodeLOD,
  applyEdgeLOD,
  calculateLODStats,
  type LODViewport,
  type LODLevel,
} from '../utils/lodRenderer';
import {
  performEdgeBundling,
  getEdgeBundlingStats,
  type EdgeControlPoints,
} from '../utils/edgeBundling';

// Example component showing integration points
export function GraphVisualizationEnhancedExample() {
  // ============================================================================
  // STEP 1: Add Visual Encoding Refs
  // ============================================================================
  const nodeVisualPropsRef = useRef<Map<string, NodeVisualProperties>>(new Map());
  const edgeVisualPropsRef = useRef<Map<string, EdgeVisualProperties>>(new Map());
  const edgeControlPointsRef = useRef<Map<string, EdgeControlPoints>>(new Map());
  const nodeLODMapRef = useRef<Map<string, LODLevel>>(new Map());

  // Visual encoding options (add to UI controls)
  const [enableCentralitySizing, setEnableCentralitySizing] = useState(true);
  const [enableEnergyColors, setEnableEnergyColors] = useState(true);
  const [enableEdgeBundling, setEnableEdgeBundling] = useState(true);
  const [enableLOD, setEnableLOD] = useState(true);

  // Existing refs (from original component)
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const enhancedNodesRef = useRef<Map<string, any>>(new Map());
  const enhancedEdgesRef = useRef<Map<string, any>>(new Map());
  const viewportRef = useRef<any>(null);
  const frameRef = useRef<number>(0);

  // Mock data - replace with actual graphData from useStore
  const graphData = {
    nodes: [] as any[],
    edges: [] as any[],
  };
  const viewState = {
    showLabels: true,
    showEdges: true,
    selectedNodes: new Set<string>(),
    hoveredNode: null as string | null,
    nodeSize: 8,
  };

  // ============================================================================
  // STEP 2: Calculate Visual Properties When Data Changes
  // ============================================================================
  useEffect(() => {
    if (!graphData.nodes.length) return;

    console.log('📊 Calculating visual encoding properties...');

    // Calculate node visual properties
    const nodeProps = calculateNodeVisualProperties(graphData.nodes, graphData.edges, {
      enableCentralitySizing,
      enableEnergyColors,
    });

    // Calculate edge visual properties
    const edgeProps = calculateEdgeVisualProperties(graphData.edges);

    // Store in refs
    nodeVisualPropsRef.current = nodeProps;
    edgeVisualPropsRef.current = edgeProps;

    // Log statistics for monitoring
    const stats = getVisualEncodingStats(graphData.nodes, graphData.edges, nodeProps, edgeProps);
    console.log('Visual Encoding Stats:', {
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      avgDegree: stats.avgDegree.toFixed(2),
      maxDegree: stats.maxDegree,
      avgNodeSize: stats.avgNodeSize.toFixed(2),
      avgEdgeThickness: stats.avgEdgeThickness.toFixed(2),
      degreeDistribution: stats.degreeDistribution,
    });

    // Trigger re-render (replace with your scheduleFrameUpdate)
    // scheduleFrameUpdate();
  }, [graphData.nodes, graphData.edges, enableCentralitySizing, enableEnergyColors]);

  // ============================================================================
  // STEP 3: Calculate Edge Bundling When Data Changes
  // ============================================================================
  useEffect(() => {
    if (!graphData.edges.length || !enableEdgeBundling) {
      edgeControlPointsRef.current = new Map();
      return;
    }

    console.log('🔗 Calculating edge bundling...');

    // Build node position map
    const nodePositions = new Map<string, { x: number; y: number }>();
    graphData.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        nodePositions.set(node.id, { x: node.x, y: node.y });
      }
    });

    // Perform edge bundling
    const controlPoints = performEdgeBundling(graphData.edges, nodePositions);
    edgeControlPointsRef.current = controlPoints;

    // Log statistics
    const stats = getEdgeBundlingStats(controlPoints);
    console.log('Edge Bundling Stats:', {
      totalEdges: stats.totalEdges,
      bundledEdges: stats.bundledEdges,
      unbundledEdges: stats.unbundledEdges,
      bundleCount: stats.bundleCount,
      avgEdgesPerBundle: stats.avgEdgesPerBundle.toFixed(2),
    });

    // Trigger re-render
    // scheduleFrameUpdate();
  }, [graphData.nodes, graphData.edges, enableEdgeBundling]);

  // ============================================================================
  // STEP 4: Enhanced updateNodeVisuals with Visual Encoding
  // ============================================================================
  const updateNodeVisuals = useCallback((node: any, lodLevel: number) => {
    if (!node.pixiNode || !node.pixiCircle || !node.pixiLabel) return;

    // Get visual properties from encoding
    const visualProps = nodeVisualPropsRef.current.get(node.id);

    // Determine size (with override options)
    const screenRadius = enableCentralitySizing && visualProps
      ? visualProps.size
      : (node.screenRadius || viewState.nodeSize || 8);

    // Update node screenRadius
    node.screenRadius = screenRadius;

    // Determine color (with override options)
    const color = enableEnergyColors && visualProps
      ? visualProps.color
      : 0x4a90e2; // Default blue (replace with getNodeColor(node))

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
    if (enableLOD) {
      applyNodeLOD(
        node.pixiNode,
        node.pixiCircle,
        node.pixiLabel,
        lodLevel,
        screenRadius
      );
    }

    // Update label visibility based on LOD and view state
    const shouldShowLabel = viewState.showLabels && lodLevel <= 1;
    if (node.pixiLabel) {
      node.pixiLabel.visible = shouldShowLabel;
      if (shouldShowLabel) {
        node.pixiLabel.position.set(screenRadius + 4, -screenRadius * 0.3);
      }
    }

    // Apply opacity from visual encoding
    if (visualProps) {
      node.pixiNode.alpha = visualProps.opacity;
    }

    // Update frame tracking
    node.lodLevel = lodLevel;
    node.lastUpdateFrame = frameRef.current;
  }, [viewState, enableCentralitySizing, enableEnergyColors, enableLOD]);

  // ============================================================================
  // STEP 5: Enhanced updateEdgeVisuals with Edge Bundling
  // ============================================================================
  const updateEdgeVisuals = useCallback((edge: any, lodLevel: number) => {
    if (!edge.pixiEdge || !edge.sourceNode || !edge.targetNode) return;
    if (typeof edge.sourceNode.x !== 'number' || typeof edge.sourceNode.y !== 'number' ||
        typeof edge.targetNode.x !== 'number' || typeof edge.targetNode.y !== 'number') {
      return;
    }

    // Get visual properties
    const visualProps = edgeVisualPropsRef.current.get(edge.id);
    const controlPoints = enableEdgeBundling ? edgeControlPointsRef.current.get(edge.id) : null;

    // Determine edge thickness
    const thickness = visualProps?.thickness || 1.5;

    // Determine edge color (replace with getEdgeColor(edge))
    const color = 0x8e8e93; // Default gray

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
    if (enableLOD) {
      applyEdgeLOD(edge.pixiEdge, lodLevel, thickness);
    }

    // Update frame tracking
    edge.lodLevel = lodLevel;
    edge.lastUpdateFrame = frameRef.current;
  }, [viewState, enableEdgeBundling, enableLOD]);

  // ============================================================================
  // STEP 6: Enhanced renderFrame with LOD Calculation
  // ============================================================================
  const renderFrame = useCallback(() => {
    if (!pixiAppRef.current) return;

    const currentFrame = frameRef.current++;

    // Calculate LOD for all nodes
    if (enableLOD) {
      const nodes = Array.from(enhancedNodesRef.current.values());
      const viewport = viewportRef.current;

      if (!viewport) return;

      // Create LOD viewport
      const lodViewport: LODViewport = {
        x: viewport.x || 0,
        y: viewport.y || 0,
        width: viewport.width || 800,
        height: viewport.height || 600,
        zoom: viewport.zoom || 1,
        centerX: (viewport.width || 800) / 2,
        centerY: (viewport.height || 600) / 2,
      };

      // Batch calculate LOD levels
      const lodMap = batchCalculateNodeLOD(
        nodes,
        lodViewport,
        viewState.selectedNodes,
        viewState.hoveredNode
      );

      nodeLODMapRef.current = lodMap;

      // Log LOD stats periodically (every 60 frames)
      if (currentFrame % 60 === 0) {
        const stats = calculateLODStats(lodMap);
        console.log('LOD Stats:', {
          level0: stats.level0Count,
          level1: stats.level1Count,
          level2: stats.level2Count,
          level3: stats.level3Count,
          visible: stats.visibleNodes,
          culled: stats.culledNodes,
          avgLevel: stats.averageLevel.toFixed(2),
        });
      }
    }

    // Update edge visuals
    if (viewState.showEdges) {
      enhancedEdgesRef.current.forEach(edge => {
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
    enhancedNodesRef.current.forEach(node => {
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
  }, [viewState, updateNodeVisuals, updateEdgeVisuals, enableLOD]);

  // ============================================================================
  // STEP 7: UI Controls for Visual Encoding
  // ============================================================================
  return (
    <div className="graph-visualization-enhanced">
      {/* Settings Panel */}
      <div className="settings-panel">
        <h3>Visual Encoding</h3>

        <div className="control-group">
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

        {/* Statistics Display */}
        <div className="stats-display">
          <p>Nodes: {nodeVisualPropsRef.current.size}</p>
          <p>Edges: {edgeVisualPropsRef.current.size}</p>
          <p>Bundled Edges: {Array.from(edgeControlPointsRef.current.values()).filter(cp => cp.isBundled).length}</p>
          <p>Visible Nodes: {Array.from(nodeLODMapRef.current.values()).filter(lod => lod < 3).length}</p>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="canvas-container">
        {/* PIXI canvas goes here */}
      </div>
    </div>
  );
}

/**
 * INTEGRATION CHECKLIST
 *
 * ✅ Step 1: Add refs for visual encoding
 * ✅ Step 2: Calculate visual properties on data change
 * ✅ Step 3: Calculate edge bundling on data change
 * ✅ Step 4: Enhance updateNodeVisuals
 * ✅ Step 5: Enhance updateEdgeVisuals
 * ✅ Step 6: Enhance renderFrame with LOD
 * ✅ Step 7: Add UI controls
 *
 * PERFORMANCE TIPS:
 * - Use refs to avoid recalculation on every render
 * - Batch calculate LOD in renderFrame
 * - Only recalculate visual props when data changes
 * - Edge bundling is expensive - only recalculate when positions change
 * - Monitor FPS and adjust LOD thresholds if needed
 */
