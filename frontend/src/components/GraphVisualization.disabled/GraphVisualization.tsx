/**
 * GraphVisualization Component - Main Orchestrator
 * Integrates all Phase 1-3 components into a cohesive graph visualization
 *
 * Phase Integration:
 * - Phase 1: Infrastructure (Quadtree, FrustumCuller, LODManager, TextureAtlas, Worker)
 * - Phase 2: Rendering (NodeRenderer, EdgeRenderer, Helpers)
 * - Phase 3: Hooks (useGraphData, useViewport, useNodeSelection, useGraphSimulation)
 *
 * Performance Targets:
 * - 10,000 nodes @ 60 FPS
 * - < 200MB memory usage
 * - Smooth animations and interactions
 * - Non-blocking physics simulation
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant
 * - Keyboard navigation
 * - Screen reader support
 * - Focus management
 */

import React, {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { Application } from 'pixi.js';
import type { Container, IApplicationOptions } from 'pixi.js';
import { GraphControls } from './GraphControls';
import { Minimap } from './Minimap';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { NodeRenderer } from './rendering/NodeRenderer';
import { EdgeRenderer } from './rendering/EdgeRenderer';
import { LODManager } from './rendering/LODManager';
import { TextureAtlas } from './rendering/TextureAtlas';
import { Quadtree } from './spatial/Quadtree';
import { FrustumCuller } from './spatial/FrustumCuller';
import {
  useGraphData,
  useViewport,
  useNodeSelection,
  useGraphSimulation,
  type UseGraphDataOptions,
  type ViewportControls,
  type SimulationControls,
} from './hooks';
import type {
  GraphData,
  EnhancedGraphNode,
  NodeClickEvent,
  ViewportChangeEvent,
  RenderStats,
} from './types';
import styles from './GraphVisualization.module.css';

/* ============================================
   TYPES
   ============================================ */

/**
 * GraphVisualization component props
 */
export interface GraphVisualizationProps {
  /** API endpoint to fetch graph data */
  endpoint?: string;

  /** Optional pre-loaded graph data (alternative to endpoint) */
  data?: GraphData;

  /** Data filters */
  filters?: UseGraphDataOptions['filters'];

  /** Canvas width */
  width?: number;

  /** Canvas height */
  height?: number;

  /** Enable debug mode */
  debug?: boolean;

  /** Node click handler */
  onNodeClick?: (event: NodeClickEvent) => void;

  /** Node hover handler */
  onNodeHover?: (node: EnhancedGraphNode | null) => void;

  /** Edge click handler */
  onEdgeClick?: (edgeId: string) => void;

  /** Selection change handler */
  onSelectionChange?: (selectedIds: Set<string>) => void;

  /** Viewport change handler */
  onViewportChange?: (event: ViewportChangeEvent) => void;

  /** Custom CSS class */
  className?: string;

  /** Custom inline styles */
  style?: React.CSSProperties;

  /** Show controls UI */
  showControls?: boolean;

  /** Show minimap */
  showMinimap?: boolean;

  /** Show node details panel */
  showDetailsPanel?: boolean;

  /** Auto-start physics simulation */
  autoStartSimulation?: boolean;

  /** Initial zoom level */
  initialZoom?: number;
}

/**
 * Imperative handle for programmatic control
 */
export interface GraphVisualizationHandle {
  /** Fit all nodes to screen */
  fitToScreen: () => void;

  /** Reset view to origin */
  resetView: () => void;

  /** Zoom to specific node */
  zoomToNode: (nodeId: string, duration?: number) => void;

  /** Export canvas as base64 image */
  exportImage: () => string | undefined;

  /** Get current statistics */
  getStats: () => RenderStats;

  /** Pause physics simulation */
  pauseSimulation: () => void;

  /** Resume physics simulation */
  resumeSimulation: () => void;

  /** Restart physics simulation */
  restartSimulation: () => void;

  /** Get viewport controls */
  getViewportControls: () => ViewportControls | null;

  /** Get simulation controls */
  getSimulationControls: () => SimulationControls | null;

  /** Clear selection */
  clearSelection: () => void;

  /** Select node(s) */
  selectNodes: (nodeIds: string[]) => void;
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

/**
 * GraphVisualization Component
 * High-performance force-directed graph visualization with PIXI.js
 */
export const GraphVisualization = forwardRef<
  GraphVisualizationHandle,
  GraphVisualizationProps
>((props, ref) => {
  const {
    endpoint = '/api/graph-data',
    data: externalData,
    filters,
    width = 1920,
    height = 1080,
    debug = false,
    onNodeClick,
    onNodeHover,
    onEdgeClick,
    onSelectionChange,
    onViewportChange,
    className,
    style,
    showControls = true,
    showMinimap = true,
    showDetailsPanel = true,
    autoStartSimulation = true,
    initialZoom = 1.0,
  } = props;

  /* ============================================
     REFS
     ============================================ */

  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const nodeRendererRef = useRef<NodeRenderer | null>(null);
  const edgeRendererRef = useRef<EdgeRenderer | null>(null);
  const lodManagerRef = useRef<LODManager | null>(null);
  const textureAtlasRef = useRef<TextureAtlas | null>(null);
  const frustumCullerRef = useRef<FrustumCuller | null>(null);
  const quadtreeRef = useRef<Quadtree | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());

  /* ============================================
     STATE
     ============================================ */

  const [isInitialized, setIsInitialized] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [renderStats, setRenderStats] = useState<RenderStats>({
    fps: 0,
    frameTime: 0,
    visibleNodes: 0,
    visibleEdges: 0,
    drawCalls: 0,
    triangles: 0,
  });

  /* ============================================
     PHASE 3 HOOKS INTEGRATION
     ============================================ */

  // Hook 1: Data fetching with artist validation
  const {
    data: fetchedData,
    nodes,
    edges,
    isLoading,
    error,
    stats: dataStats,
    refetch,
  } = useGraphData({
    endpoint,
    autoFetch: !externalData,
    filters,
    retryAttempts: 3,
    retryDelay: 1000,
  });

  // Use external data if provided, otherwise use fetched data
  const graphData = externalData || fetchedData;
  const activeNodes = externalData?.nodes || nodes;
  const activeEdges = externalData?.edges || edges;

  // Hook 2: Physics simulation
  const {
    positions,
    controls: simControls,
    state: simState,
    isReady: simReady,
  } = useGraphSimulation({
    nodes: activeNodes,
    edges: activeEdges,
    config: {
      charge: -300,
      linkDistance: 100,
      linkStrength: 0.5,
      centerStrength: 0.05,
      collideRadius: 20,
      alphaDecay: 0.0228,
      velocityDecay: 0.4,
      alphaMin: 0.001,
    },
    autoStart: autoStartSimulation,
    adaptive: true,
    adaptiveThreshold: 0.01,
  });

  // Hook 3: Viewport management
  const {
    viewport,
    controls: viewportControls,
    currentZoom,
    currentCenter,
    isReady: viewportReady,
  } = useViewport(appRef.current, {
    worldWidth: 4000,
    worldHeight: 4000,
    minZoom: 0.1,
    maxZoom: 5,
    wheelZoomSpeed: 0.1,
    enableDrag: true,
    enablePinch: true,
    enableWheel: true,
    friction: 0.9,
    nodes: activeNodes,
  });

  // Hook 4: Node selection
  const {
    selectedIds,
    focusedId,
    selectNode,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedNodes,
  } = useNodeSelection({
    nodes: activeNodes,
    maxSelection: 100,
    enableKeyboard: true,
    onSelectionChange,
  });

  /* ============================================
     PIXI APPLICATION INITIALIZATION
     ============================================ */

  useEffect(() => {
    if (!canvasRef.current) return;

    const appOptions: Partial<IApplicationOptions> = {
      width,
      height,
      backgroundColor: 0x121212,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      powerPreference: 'high-performance',
    };

    const app = new Application(appOptions);

    // Wait for PIXI to initialize
    (async () => {
      await app.init(appOptions);

      canvasRef.current?.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // Initialize infrastructure
      lodManagerRef.current = new LODManager();
      textureAtlasRef.current = new TextureAtlas(app);
      frustumCullerRef.current = new FrustumCuller();
      quadtreeRef.current = new Quadtree({
        x: 0,
        y: 0,
        width: 4000,
        height: 4000,
      });

      // Initialize renderers
      nodeRendererRef.current = new NodeRenderer(
        app,
        textureAtlasRef.current,
        lodManagerRef.current,
        frustumCullerRef.current,
        {
          baseNodeSize: 16,
          enableGlow: true,
          enableLabels: true,
          labelFontSize: 12,
          labelFontFamily: 'var(--font-sans, Arial, sans-serif)',
          labelOffset: 20,
          transitionDuration: 300,
          particleContainerSize: 15000,
        }
      );

      edgeRendererRef.current = new EdgeRenderer(
        app,
        lodManagerRef.current,
        frustumCullerRef.current,
        {
          baseEdgeWidth: 2,
          enableArrows: false,
          enableCurves: true,
          curveStrength: 0.2,
          transitionDuration: 300,
        }
      );

      setIsInitialized(true);
    })();

    return () => {
      // Cleanup
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      nodeRendererRef.current?.cleanup();
      edgeRendererRef.current?.cleanup();
      textureAtlasRef.current?.cleanup();

      if (appRef.current) {
        appRef.current.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
        });
        appRef.current = null;
      }
    };
  }, [width, height]);

  /* ============================================
     MAIN RENDER LOOP
     ============================================ */

  useEffect(() => {
    if (
      !isInitialized ||
      !viewport ||
      !nodeRendererRef.current ||
      !edgeRendererRef.current ||
      activeNodes.length === 0
    ) {
      return;
    }

    let lastFrameTime = performance.now();

    const render = () => {
      const now = performance.now();
      const deltaTime = now - lastFrameTime;
      lastFrameTime = now;

      // FPS calculation
      frameCountRef.current++;
      if (now - lastFpsUpdateRef.current >= 1000) {
        fpsRef.current = Math.round(
          (frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)
        );
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      // Update node positions from simulation
      const enhancedNodes: EnhancedGraphNode[] = activeNodes.map((node) => {
        const simPos = positions.get(node.id);
        return {
          ...node,
          x: simPos?.x ?? node.x ?? 0,
          y: simPos?.y ?? node.y ?? 0,
          vx: simPos?.vx ?? 0,
          vy: simPos?.vy ?? 0,
          isSelected: selectedIds.has(node.id),
          isHovered: hoveredNode === node.id,
          isFocused: focusedId === node.id,
          lodLevel: 0,
          lastUpdateFrame: frameCountRef.current,
          isVisible: true,
          screenRadius: 16,
          hitBoxRadius: 20,
        } as EnhancedGraphNode;
      });

      // Build node map for edge rendering
      const nodeMap = new Map(enhancedNodes.map((n) => [n.id, n]));

      // Update quadtree for spatial queries
      if (quadtreeRef.current) {
        quadtreeRef.current.clear();
        enhancedNodes.forEach((node) => {
          quadtreeRef.current!.insert({
            id: node.id,
            x: node.x!,
            y: node.y!,
            width: node.screenRadius * 2,
            height: node.screenRadius * 2,
          });
        });
      }

      // Render edges first (background layer)
      const edgeStats = edgeRendererRef.current!.render(
        activeEdges,
        nodeMap,
        viewport,
        currentZoom
      );

      // Render nodes (foreground layer)
      const nodeStats = nodeRendererRef.current!.render(
        enhancedNodes,
        viewport,
        currentZoom
      );

      // Update render statistics
      setRenderStats({
        fps: fpsRef.current,
        frameTime: deltaTime,
        visibleNodes: nodeStats.visibleNodes,
        visibleEdges: edgeStats.visibleEdges,
        drawCalls: nodeStats.drawCalls + edgeStats.drawCalls,
        triangles: nodeStats.triangles + edgeStats.triangles,
        memoryUsage: nodeStats.memoryUsageMB + edgeStats.memoryUsageMB,
      });

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    isInitialized,
    viewport,
    activeNodes,
    activeEdges,
    positions,
    selectedIds,
    hoveredNode,
    focusedId,
    currentZoom,
  ]);

  /* ============================================
     INTERACTION HANDLERS
     ============================================ */

  const handleNodeClick = useCallback(
    (nodeId: string, event: PointerEvent) => {
      const node = activeNodes.find((n) => n.id === nodeId);
      if (!node) return;

      const enhancedNode: EnhancedGraphNode = {
        ...node,
        lodLevel: 0,
        lastUpdateFrame: 0,
        isVisible: true,
        screenRadius: 16,
        hitBoxRadius: 20,
      } as EnhancedGraphNode;

      // Handle selection
      if (event.ctrlKey || event.metaKey) {
        selectNode(nodeId, 'toggle');
      } else if (event.shiftKey) {
        selectNode(nodeId, 'range');
      } else {
        selectNode(nodeId, 'single');
      }

      // Call external handler
      if (onNodeClick) {
        onNodeClick({
          node: enhancedNode,
          originalEvent: event,
          modifiers: {
            ctrl: event.ctrlKey || event.metaKey,
            shift: event.shiftKey,
            alt: event.altKey,
          },
        });
      }
    },
    [activeNodes, selectNode, onNodeClick]
  );

  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNode(nodeId);

      if (onNodeHover && nodeId) {
        const node = activeNodes.find((n) => n.id === nodeId);
        if (node) {
          const enhancedNode: EnhancedGraphNode = {
            ...node,
            lodLevel: 0,
            lastUpdateFrame: 0,
            isVisible: true,
            screenRadius: 16,
            hitBoxRadius: 20,
          } as EnhancedGraphNode;
          onNodeHover(enhancedNode);
        }
      } else if (onNodeHover && !nodeId) {
        onNodeHover(null);
      }
    },
    [activeNodes, onNodeHover]
  );

  /* ============================================
     IMPERATIVE HANDLE
     ============================================ */

  useImperativeHandle(
    ref,
    () => ({
      fitToScreen: () => viewportControls?.fitToScreen(),
      resetView: () => viewportControls?.resetView(),
      zoomToNode: (nodeId: string, duration?: number) =>
        viewportControls?.zoomToNode(nodeId, duration),
      exportImage: () => {
        if (!appRef.current) return undefined;
        return appRef.current.renderer.extract.base64(appRef.current.stage);
      },
      getStats: () => renderStats,
      pauseSimulation: () => simControls.pause(),
      resumeSimulation: () => simControls.resume(),
      restartSimulation: () => simControls.restart(),
      getViewportControls: () => viewportControls,
      getSimulationControls: () => simControls,
      clearSelection,
      selectNodes: (nodeIds: string[]) => {
        nodeIds.forEach((id) => selectNode(id, 'toggle'));
      },
    }),
    [
      viewportControls,
      simControls,
      renderStats,
      clearSelection,
      selectNode,
    ]
  );

  /* ============================================
     RENDER
     ============================================ */

  if (error) {
    return (
      <div className={`${styles.container} ${className || ''}`} style={style}>
        <div className={styles.error}>
          <h3>Error Loading Graph</h3>
          <p>{error.message}</p>
          <button onClick={refetch} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.container} ${className || ''}`}
      style={style}
      role="application"
      aria-label="Graph Visualization"
      data-testid="graph-container"
    >
      {/* Canvas Container */}
      <div
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label={`Graph with ${activeNodes.length} nodes and ${activeEdges.length} edges`}
      />

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading graph data...</p>
        </div>
      )}

      {/* Graph Controls */}
      {showControls && isInitialized && viewportControls && simControls && (
        <GraphControls
          viewportControls={viewportControls}
          simControls={simControls}
          simState={simState}
          stats={{
            ...renderStats,
            ...dataStats,
          }}
          debug={debug}
        />
      )}

      {/* Minimap */}
      {showMinimap && isInitialized && viewport && activeNodes.length > 0 && (
        <Minimap
          nodes={activeNodes}
          viewport={viewport}
          currentZoom={currentZoom}
          onViewportChange={(x, y) => {
            viewportControls?.panTo(x, y, 300);
          }}
          width={200}
          height={150}
        />
      )}

      {/* Node Details Panel */}
      {showDetailsPanel && selectedIds.size > 0 && (
        <NodeDetailsPanel
          nodes={getSelectedNodes()}
          onClose={clearSelection}
          onNodeClick={(nodeId) => {
            viewportControls?.zoomToNode(nodeId, 500);
          }}
        />
      )}

      {/* Debug Info */}
      {debug && (
        <div className={styles.debug}>
          <h4>Debug Info</h4>
          <ul>
            <li>FPS: {renderStats.fps}</li>
            <li>Frame Time: {renderStats.frameTime.toFixed(2)}ms</li>
            <li>Visible Nodes: {renderStats.visibleNodes}</li>
            <li>Visible Edges: {renderStats.visibleEdges}</li>
            <li>Draw Calls: {renderStats.drawCalls}</li>
            <li>Memory: {renderStats.memoryUsage?.toFixed(2)}MB</li>
            <li>Zoom: {currentZoom.toFixed(2)}</li>
            <li>Simulation Alpha: {simState.alpha.toFixed(3)}</li>
            <li>Selected: {selectedIds.size}</li>
          </ul>
        </div>
      )}
    </div>
  );
});

GraphVisualization.displayName = 'GraphVisualization';
