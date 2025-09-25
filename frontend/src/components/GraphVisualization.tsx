import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
} from 'd3-force';
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge, DEFAULT_CONFIG, Bounds } from '../types';

// Performance constants
const PERFORMANCE_THRESHOLDS = {
  NODE_COUNT_HIGH: 1000,
  NODE_COUNT_MEDIUM: 500,
  EDGE_COUNT_HIGH: 2000,
  EDGE_COUNT_MEDIUM: 1000,
  CULL_DISTANCE: 2000,
  LOD_DISTANCE_1: 400,
  LOD_DISTANCE_2: 800,
  MIN_NODE_SIZE: 2,
  MAX_NODE_SIZE: 32,
  MIN_EDGE_WIDTH: 0.5,
  MAX_EDGE_WIDTH: 8,
} as const;

// Color schemes
const COLOR_SCHEMES = {
  node: {
    default: 0x4a90e2,
    selected: 0xff6b35,
    hovered: 0x7ed321,
    path: 0x9013fe,
    waypoint: 0xf5a623,
  },
  edge: {
    default: 0x8e8e93,
    selected: 0xff6b35,
    path: 0x9013fe,
    strong: 0x4a90e2,
  },
} as const;

// Enhanced node interface for PIXI and D3 integration
interface EnhancedGraphNode extends GraphNode, SimulationNodeDatum {
  pixiNode?: PIXI.Container;
  pixiCircle?: PIXI.Graphics;
  pixiLabel?: PIXI.Text;
  lodLevel: number;
  lastUpdateFrame: number;
  isVisible: boolean;
  screenRadius: number;
}

// Enhanced edge interface for PIXI rendering
interface EnhancedGraphEdge extends Omit<GraphEdge, 'source' | 'target'>, SimulationLinkDatum<EnhancedGraphNode> {
  pixiEdge?: PIXI.Graphics;
  sourceNode?: EnhancedGraphNode;
  targetNode?: EnhancedGraphNode;
  lodLevel: number;
  lastUpdateFrame: number;
  isVisible: boolean;
  screenWidth: number;
}

// Viewport and camera management
interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  bounds: Bounds;
}

// Level of Detail system for performance optimization
class LODSystem {
  private nodeCount: number = 0;
  private edgeCount: number = 0;
  private viewport: Viewport;

  constructor(viewport: Viewport) {
    this.viewport = viewport;
  }

  updateCounts(nodeCount: number, edgeCount: number): void {
    this.nodeCount = nodeCount;
    this.edgeCount = edgeCount;
  }

  updateViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  getNodeLOD(node: EnhancedGraphNode): number {
    if (!node.x || !node.y) return 3; // Hide if no position

    const dx = node.x - this.viewport.x;
    const dy = node.y - this.viewport.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Performance-based LOD adjustment
    let baseDistance1 = PERFORMANCE_THRESHOLDS.LOD_DISTANCE_1;
    let baseDistance2 = PERFORMANCE_THRESHOLDS.LOD_DISTANCE_2;

    if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_HIGH) {
      baseDistance1 *= 0.6;
      baseDistance2 *= 0.6;
    } else if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_MEDIUM) {
      baseDistance1 *= 0.8;
      baseDistance2 *= 0.8;
    }

    if (distance > PERFORMANCE_THRESHOLDS.CULL_DISTANCE / this.viewport.zoom) {
      return 3; // Cull completely
    } else if (distance > baseDistance2 / this.viewport.zoom) {
      return 2; // Minimal detail
    } else if (distance > baseDistance1 / this.viewport.zoom) {
      return 1; // Reduced detail
    } else {
      return 0; // Full detail
    }
  }

  getEdgeLOD(edge: EnhancedGraphEdge): number {
    if (!edge.sourceNode || !edge.targetNode) return 3;

    const sourceLOD = this.getNodeLOD(edge.sourceNode);
    const targetLOD = this.getNodeLOD(edge.targetNode);

    // Edge LOD is determined by the worst node LOD
    const maxLOD = Math.max(sourceLOD, targetLOD);

    // Additional edge-specific culling
    if (this.edgeCount > PERFORMANCE_THRESHOLDS.EDGE_COUNT_HIGH && maxLOD > 0) {
      return 3; // Cull edges aggressively on high edge counts
    }

    return maxLOD;
  }

  shouldRenderNode(node: EnhancedGraphNode): boolean {
    return this.getNodeLOD(node) < 3;
  }

  shouldRenderEdge(edge: EnhancedGraphEdge): boolean {
    return this.getEdgeLOD(edge) < 3;
  }
}

// Spatial index for efficient collision detection and nearest neighbor queries
class SpatialIndex {
  private gridSize: number = 100;
  private grid: Map<string, EnhancedGraphNode[]> = new Map();

  clear(): void {
    this.grid.clear();
  }

  add(node: EnhancedGraphNode): void {
    if (!node.x || !node.y) return;

    const cellX = Math.floor(node.x / this.gridSize);
    const cellY = Math.floor(node.y / this.gridSize);
    const key = `${cellX},${cellY}`;

    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(node);
  }

  findNearby(x: number, y: number, radius: number): EnhancedGraphNode[] {
    const cellRadius = Math.ceil(radius / this.gridSize);
    const centerX = Math.floor(x / this.gridSize);
    const centerY = Math.floor(y / this.gridSize);
    const nearby: EnhancedGraphNode[] = [];

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${centerX + dx},${centerY + dy}`;
        const nodes = this.grid.get(key);
        if (nodes) {
          nearby.push(...nodes);
        }
      }
    }

    return nearby.filter(node => {
      if (!node.x || !node.y) return false;
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  findNearest(x: number, y: number): EnhancedGraphNode | null {
    const cellX = Math.floor(x / this.gridSize);
    const cellY = Math.floor(y / this.gridSize);
    let nearest: EnhancedGraphNode | null = null;
    let minDistance = Infinity;

    // Check expanding rings of cells
    for (let radius = 0; radius <= 5; radius++) {
      const candidates: EnhancedGraphNode[] = [];

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius && radius > 0) continue;

          const key = `${cellX + dx},${cellY + dy}`;
          const nodes = this.grid.get(key);
          if (nodes) {
            candidates.push(...nodes);
          }
        }
      }

      for (const node of candidates) {
        if (!node.x || !node.y) continue;
        const dx = node.x - x;
        const dy = node.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          nearest = node;
        }
      }

      if (nearest && minDistance < this.gridSize * radius) break;
    }

    return nearest;
  }

  rebuild(nodes: EnhancedGraphNode[]): void {
    this.clear();
    nodes.forEach(node => this.add(node));
  }
}

// Performance monitor for runtime optimization
class PerformanceMonitor {
  private frameTime: number = 0;
  private frameCount: number = 0;
  private lastUpdate: number = performance.now();
  private targetFPS: number = DEFAULT_CONFIG.performance.targetFPS;

  update(): { frameRate: number; renderTime: number; shouldOptimize: boolean } {
    const now = performance.now();
    this.frameTime = now - this.lastUpdate;
    this.lastUpdate = now;
    this.frameCount++;

    const frameRate = 1000 / this.frameTime;
    const shouldOptimize = frameRate < this.targetFPS * 0.8;

    return {
      frameRate,
      renderTime: this.frameTime,
      shouldOptimize,
    };
  }

  reset(): void {
    this.frameCount = 0;
    this.lastUpdate = performance.now();
  }
}

export const GraphVisualization: React.FC = () => {
  // Store hooks
  const {
    graphData,
    viewState,
    pathfindingState,
    graph,
    view,
    pathfinding,
    performance,
  } = useStore();

  // Refs for PIXI and D3
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const simulationRef = useRef<Simulation<EnhancedGraphNode, EnhancedGraphEdge> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const currentTransformRef = useRef<ZoomTransform>(zoomIdentity);

  // Performance optimization refs
  const lodSystemRef = useRef<LODSystem | null>(null);
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());
  const performanceMonitorRef = useRef<PerformanceMonitor>(new PerformanceMonitor());

  // Render state
  const [isInitialized, setIsInitialized] = useState(false);
  const frameRef = useRef<number>(0);
  const lastRenderFrame = useRef<number>(0);

  // PIXI containers
  const edgesContainerRef = useRef<PIXI.Container | null>(null);
  const nodesContainerRef = useRef<PIXI.Container | null>(null);
  const labelsContainerRef = useRef<PIXI.Container | null>(null);
  const interactionContainerRef = useRef<PIXI.Container | null>(null);

  // Enhanced data with PIXI objects
  const enhancedNodesRef = useRef<Map<string, EnhancedGraphNode>>(new Map());
  const enhancedEdgesRef = useRef<Map<string, EnhancedGraphEdge>>(new Map());

  // Current viewport state
  const viewportRef = useRef<Viewport>({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    zoom: 1,
    bounds: { x: -1000, y: -1000, width: 2000, height: 2000 },
  });

  // Memoized color functions
  const getNodeColor = useCallback((node: EnhancedGraphNode): number => {
    if (pathfindingState.currentPath?.path.some(p => p.id === node.id)) {
      return COLOR_SCHEMES.node.path;
    }
    if (pathfindingState.selectedWaypoints.has(node.id)) {
      return COLOR_SCHEMES.node.waypoint;
    }
    if (viewState.selectedNodes.has(node.id)) {
      return COLOR_SCHEMES.node.selected;
    }
    if (viewState.hoveredNode === node.id) {
      return COLOR_SCHEMES.node.hovered;
    }
    return COLOR_SCHEMES.node.default;
  }, [viewState.selectedNodes, viewState.hoveredNode, pathfindingState]);

  const getEdgeColor = useCallback((edge: EnhancedGraphEdge): number => {
    if (pathfindingState.currentPath?.path.some((p, i) => {
      const next = pathfindingState.currentPath!.path[i + 1];
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
      return next && (
        (p.id === sourceId && next.id === targetId) ||
        (p.id === targetId && next.id === sourceId)
      );
    })) {
      return COLOR_SCHEMES.edge.path;
    }
    if (edge.weight > 0.7) {
      return COLOR_SCHEMES.edge.strong;
    }
    return COLOR_SCHEMES.edge.default;
  }, [pathfindingState]);

  // Initialize PIXI application
  const initializePixi = useCallback(async () => {
    if (!containerRef.current || pixiAppRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Create PIXI application with WebGL
    const app = new PIXI.Application();
    await app.init({
      width: rect.width,
      height: rect.height,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      powerPreference: 'high-performance',
    });

    // Add canvas to container
    container.appendChild(app.canvas as HTMLCanvasElement);
    pixiAppRef.current = app;

    // Create container hierarchy for proper layering
    const edgesContainer = new PIXI.Container();
    const nodesContainer = new PIXI.Container();
    const labelsContainer = new PIXI.Container();
    const interactionContainer = new PIXI.Container();

    // Add containers in rendering order (bottom to top)
    app.stage.addChild(edgesContainer);
    app.stage.addChild(nodesContainer);
    app.stage.addChild(labelsContainer);
    app.stage.addChild(interactionContainer);

    // Store container references
    edgesContainerRef.current = edgesContainer;
    nodesContainerRef.current = nodesContainer;
    labelsContainerRef.current = labelsContainer;
    interactionContainerRef.current = interactionContainer;

    // Update viewport dimensions
    viewportRef.current.width = rect.width;
    viewportRef.current.height = rect.height;

    // Initialize LOD system
    lodSystemRef.current = new LODSystem(viewportRef.current);

    // Start render loop
    app.ticker.add(renderFrame);

    setIsInitialized(true);
  }, []);

  // Initialize D3 force simulation
  const initializeSimulation = useCallback(() => {
    const simulation = forceSimulation<EnhancedGraphNode, EnhancedGraphEdge>()
      .force('link', forceLink<EnhancedGraphNode, EnhancedGraphEdge>()
        .id(d => d.id)
        .distance(d => 50 + (1 - d.weight) * 100)
        .strength(d => Math.max(0.1, d.weight))
      )
      .force('charge', forceManyBody<EnhancedGraphNode>()
        .strength(-100)
        .distanceMax(500)
      )
      .force('center', forceCenter<EnhancedGraphNode>(0, 0))
      .force('collision', forceCollide<EnhancedGraphNode>()
        .radius(d => (d.radius || DEFAULT_CONFIG.graph.defaultRadius) + 2)
        .strength(0.7)
      )
      .velocityDecay(0.3)
      .alphaDecay(0.02)
      .alphaMin(0.01);

    simulation.on('tick', handleSimulationTick);
    simulation.on('end', handleSimulationEnd);

    simulationRef.current = simulation;
    return simulation;
  }, []);

  // Initialize D3 zoom behavior
  const initializeZoom = useCallback(() => {
    if (!containerRef.current) return;

    const zoomHandler = zoom<HTMLDivElement, unknown>()
      .scaleExtent([DEFAULT_CONFIG.ui.minZoom, DEFAULT_CONFIG.ui.maxZoom])
      .on('zoom', handleZoom);

    const selection = select(containerRef.current);
    selection.call(zoomHandler);

    // Set initial transform
    const initialTransform = zoomIdentity
      .translate(viewportRef.current.width / 2, viewportRef.current.height / 2)
      .scale(viewState.zoom)
      .translate(viewState.pan.x, viewState.pan.y);

    selection.call(zoomHandler.transform, initialTransform);

    zoomBehaviorRef.current = zoomHandler;
  }, [viewState.zoom, viewState.pan]);

  // Handle D3 simulation tick
  const handleSimulationTick = useCallback(() => {
    const nodes = enhancedNodesRef.current;

    // Update node positions from simulation
    const positions: Array<{ id: string; x: number; y: number }> = [];

    nodes.forEach((node, id) => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        positions.push({ id, x: node.x, y: node.y });
      }
    });

    if (positions.length > 0) {
      graph.updateNodePositions(positions);
    }

    // Rebuild spatial index
    spatialIndexRef.current.rebuild(Array.from(nodes.values()));

    // Mark for re-render
    frameRef.current++;
  }, [graph]);

  // Handle simulation end
  const handleSimulationEnd = useCallback(() => {
    console.log('Force simulation completed');
  }, []);

  // Handle zoom events
  const handleZoom = useCallback((event: any) => {
    const transform: ZoomTransform = event.transform;
    currentTransformRef.current = transform;

    // Update viewport
    viewportRef.current.x = -transform.x;
    viewportRef.current.y = -transform.y;
    viewportRef.current.zoom = transform.k;

    // Update store
    view.updateViewport(transform.k, { x: -transform.x, y: -transform.y });

    // Update LOD system
    if (lodSystemRef.current) {
      lodSystemRef.current.updateViewport(viewportRef.current);
    }

    // Apply transform to PIXI stage
    if (pixiAppRef.current) {
      const stage = pixiAppRef.current.stage;
      stage.position.set(transform.x, transform.y);
      stage.scale.set(transform.k);
    }

    frameRef.current++;
  }, [view]);

  // Create enhanced node from graph node
  const createEnhancedNode = useCallback((node: GraphNode): EnhancedGraphNode => {
    const enhanced: EnhancedGraphNode = {
      ...node,
      x: node.x || 0,
      y: node.y || 0,
      vx: node.vx || 0,
      vy: node.vy || 0,
      fx: node.fx,
      fy: node.fy,
      lodLevel: 0,
      lastUpdateFrame: 0,
      isVisible: true,
      screenRadius: node.radius || viewState.nodeSize,
    };

    return enhanced;
  }, [viewState.nodeSize]);

  // Create enhanced edge from graph edge
  const createEnhancedEdge = useCallback((edge: GraphEdge, nodes: Map<string, EnhancedGraphNode>): EnhancedGraphEdge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target;
    const sourceNode = nodes.get(sourceId);
    const targetNode = nodes.get(targetId);

    const enhanced: EnhancedGraphEdge = {
      id: edge.id,
      weight: edge.weight,
      type: edge.type,
      strength: edge.strength,
      color: edge.color,
      opacity: edge.opacity,
      distance: edge.distance,
      source: sourceNode!,
      target: targetNode!,
      sourceNode,
      targetNode,
      lodLevel: 0,
      lastUpdateFrame: 0,
      isVisible: true,
      screenWidth: Math.max(PERFORMANCE_THRESHOLDS.MIN_EDGE_WIDTH, edge.weight * PERFORMANCE_THRESHOLDS.MAX_EDGE_WIDTH),
    };

    return enhanced;
  }, []);

  // Create PIXI node graphics
  const createPixiNode = useCallback((node: EnhancedGraphNode): PIXI.Container => {
    const container = new PIXI.Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // Main circle
    const circle = new PIXI.Graphics();
    container.addChild(circle);

    // Label (created but initially hidden for performance)
    const label = new PIXI.Text({
      text: node.label,
      style: {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xffffff,
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.visible = false; // Hidden by default
    container.addChild(label);

    // Store references
    node.pixiNode = container;
    node.pixiCircle = circle;
    node.pixiLabel = label;

    // Add interaction handlers
    container.on('pointerover', () => handleNodeHover(node.id, true));
    container.on('pointerout', () => handleNodeHover(node.id, false));
    container.on('pointerdown', () => handleNodeClick(node.id));
    container.on('rightclick', (event) => handleNodeRightClick(node.id, event));

    return container;
  }, []);

  // Create PIXI edge graphics
  const createPixiEdge = useCallback((edge: EnhancedGraphEdge): PIXI.Graphics => {
    const graphics = new PIXI.Graphics();
    edge.pixiEdge = graphics;
    return graphics;
  }, []);

  // Update node visual appearance
  const updateNodeVisuals = useCallback((node: EnhancedGraphNode, lodLevel: number) => {
    if (!node.pixiNode || !node.pixiCircle || !node.pixiLabel) return;

    const transform = currentTransformRef.current;
    const screenRadius = Math.max(
      PERFORMANCE_THRESHOLDS.MIN_NODE_SIZE,
      Math.min(
        PERFORMANCE_THRESHOLDS.MAX_NODE_SIZE,
        (node.screenRadius * transform.k)
      )
    );

    const color = getNodeColor(node);
    const alpha = lodLevel > 1 ? 0.5 : node.opacity || 1;

    // Update position
    node.pixiNode.position.set(node.x || 0, node.y || 0);

    // Update circle
    node.pixiCircle.clear();

    if (viewState.selectedNodes.has(node.id)) {
      // Selected node outline
      node.pixiCircle.circle(0, 0, screenRadius + 2).stroke({ width: 2, color: COLOR_SCHEMES.node.selected, alpha });
    }

    node.pixiCircle.circle(0, 0, screenRadius).fill({ color, alpha });

    // Update label visibility and content
    const shouldShowLabel = viewState.showLabels && lodLevel === 0 && transform.k > 1.5;
    node.pixiLabel.visible = shouldShowLabel;

    if (shouldShowLabel) {
      node.pixiLabel.style.fontSize = Math.max(8, Math.min(16, 12 * transform.k));
      node.pixiLabel.position.set(0, screenRadius + 8);
    }

    // Update container alpha
    node.pixiNode.alpha = alpha;
    node.lodLevel = lodLevel;
    node.lastUpdateFrame = frameRef.current;
  }, [getNodeColor, viewState]);

  // Update edge visual appearance
  const updateEdgeVisuals = useCallback((edge: EnhancedGraphEdge, lodLevel: number) => {
    if (!edge.pixiEdge || !edge.sourceNode || !edge.targetNode) return;
    if (!edge.sourceNode.x || !edge.sourceNode.y || !edge.targetNode.x || !edge.targetNode.y) return;

    const transform = currentTransformRef.current;
    const screenWidth = Math.max(
      PERFORMANCE_THRESHOLDS.MIN_EDGE_WIDTH,
      Math.min(
        PERFORMANCE_THRESHOLDS.MAX_EDGE_WIDTH,
        edge.screenWidth * transform.k
      )
    );

    const color = getEdgeColor(edge);
    const alpha = (lodLevel > 1 ? 0.3 : viewState.edgeOpacity) * (edge.opacity || 1);

    // Update graphics
    edge.pixiEdge.clear();
    edge.pixiEdge.moveTo(edge.sourceNode.x, edge.sourceNode.y);
    edge.pixiEdge.lineTo(edge.targetNode.x, edge.targetNode.y);
    edge.pixiEdge.stroke({ width: screenWidth, color, alpha });

    edge.lodLevel = lodLevel;
    edge.lastUpdateFrame = frameRef.current;
  }, [getEdgeColor, viewState]);

  // Main render frame function
  const renderFrame = useCallback(() => {
    if (!lodSystemRef.current || !pixiAppRef.current) return;

    const currentFrame = frameRef.current;
    const { frameRate, renderTime, shouldOptimize } = performanceMonitorRef.current.update();

    // Update performance metrics
    const visibleNodes = Array.from(enhancedNodesRef.current.values()).filter(n => n.isVisible).length;
    const visibleEdges = Array.from(enhancedEdgesRef.current.values()).filter(e => e.isVisible).length;

    performance.updatePerformanceMetrics({
      frameRate,
      renderTime,
      visibleNodes,
      visibleEdges,
      nodeCount: enhancedNodesRef.current.size,
      edgeCount: enhancedEdgesRef.current.size,
    });

    // Skip frame if no updates needed
    if (currentFrame === lastRenderFrame.current) return;
    lastRenderFrame.current = currentFrame;

    const lodSystem = lodSystemRef.current;
    lodSystem.updateCounts(enhancedNodesRef.current.size, enhancedEdgesRef.current.size);

    // Render edges first (bottom layer)
    if (viewState.showEdges && edgesContainerRef.current) {
      enhancedEdgesRef.current.forEach(edge => {
        const lodLevel = lodSystem.getEdgeLOD(edge);
        const shouldRender = lodLevel < 3;

        if (edge.pixiEdge) {
          edge.pixiEdge.visible = shouldRender;
          edge.isVisible = shouldRender;

          if (shouldRender && (edge.lastUpdateFrame < currentFrame || shouldOptimize)) {
            updateEdgeVisuals(edge, lodLevel);
          }
        }
      });
    }

    // Render nodes (middle layer)
    if (nodesContainerRef.current) {
      enhancedNodesRef.current.forEach(node => {
        const lodLevel = lodSystem.getNodeLOD(node);
        const shouldRender = lodLevel < 3;

        if (node.pixiNode) {
          node.pixiNode.visible = shouldRender;
          node.isVisible = shouldRender;

          if (shouldRender && (node.lastUpdateFrame < currentFrame || shouldOptimize)) {
            updateNodeVisuals(node, lodLevel);
          }
        }
      });
    }

  }, [viewState, updateNodeVisuals, updateEdgeVisuals, performance]);

  // Handle node interactions
  const handleNodeClick = useCallback((nodeId: string) => {
    const tool = viewState.selectedTool;

    switch (tool) {
      case 'select':
        graph.toggleNodeSelection(nodeId);
        break;
      case 'path':
        if (!pathfindingState.startTrackId) {
          pathfinding.setStartTrack(nodeId);
        } else if (!pathfindingState.endTrackId && nodeId !== pathfindingState.startTrackId) {
          pathfinding.setEndTrack(nodeId);
        } else {
          pathfinding.addWaypoint(nodeId);
        }
        break;
      case 'setlist':
        const node = enhancedNodesRef.current.get(nodeId);
        if (node?.track) {
          // TODO: Add to setlist functionality
        }
        break;
    }
  }, [viewState.selectedTool, pathfindingState, graph, pathfinding]);

  const handleNodeHover = useCallback((nodeId: string, isHovering: boolean) => {
    graph.setHoveredNode(isHovering ? nodeId : null);
  }, [graph]);

  const handleNodeRightClick = useCallback((nodeId: string, event: PIXI.FederatedPointerEvent) => {
    event.preventDefault();
    // TODO: Show context menu
    console.log('Right click on node:', nodeId);
  }, []);

  // Handle window resize
  const handleResize = useCallback(() => {
    if (!pixiAppRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    pixiAppRef.current.renderer.resize(rect.width, rect.height);

    viewportRef.current.width = rect.width;
    viewportRef.current.height = rect.height;

    if (lodSystemRef.current) {
      lodSystemRef.current.updateViewport(viewportRef.current);
    }

    frameRef.current++;
  }, []);

  // Update graph data
  const updateGraphData = useCallback(() => {
    if (!simulationRef.current || !nodesContainerRef.current || !edgesContainerRef.current) return;

    const simulation = simulationRef.current;

    // Clear existing PIXI objects
    nodesContainerRef.current.removeChildren();
    edgesContainerRef.current.removeChildren();

    // Clear enhanced data
    enhancedNodesRef.current.clear();
    enhancedEdgesRef.current.clear();

    // Create enhanced nodes
    const nodeMap = new Map<string, EnhancedGraphNode>();

    graphData.nodes.forEach(nodeData => {
      const node = createEnhancedNode(nodeData);
      const pixiContainer = createPixiNode(node);

      nodesContainerRef.current!.addChild(pixiContainer);
      nodeMap.set(node.id, node);
      enhancedNodesRef.current.set(node.id, node);
    });

    // Create enhanced edges
    graphData.edges.forEach(edgeData => {
      const edge = createEnhancedEdge(edgeData, nodeMap);
      const pixiGraphics = createPixiEdge(edge);

      edgesContainerRef.current!.addChild(pixiGraphics);
      enhancedEdgesRef.current.set(edge.id, edge);
    });

    // Update simulation
    simulation
      .nodes(Array.from(nodeMap.values()))
      .force('link', forceLink<EnhancedGraphNode, EnhancedGraphEdge>(Array.from(enhancedEdgesRef.current.values()))
        .id(d => d.id)
        .distance(d => 50 + (1 - d.weight) * 100)
        .strength(d => Math.max(0.1, d.weight))
      );

    // Restart simulation
    simulation.alpha(0.3).restart();

    // Rebuild spatial index
    spatialIndexRef.current.rebuild(Array.from(nodeMap.values()));

    frameRef.current++;
  }, [graphData, createEnhancedNode, createPixiNode, createEnhancedEdge, createPixiEdge]);


  // Effects

  // Initialize on mount
  useEffect(() => {
    initializePixi();

    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true);
        pixiAppRef.current = null;
      }
    };
  }, [initializePixi]);

  // Initialize simulation and zoom after PIXI is ready
  useEffect(() => {
    if (isInitialized) {
      initializeSimulation();
      initializeZoom();
    }
  }, [isInitialized, initializeSimulation, initializeZoom]);

  // Update graph data when it changes
  useEffect(() => {
    if (isInitialized && graphData.nodes.length > 0) {
      updateGraphData();
    }
  }, [isInitialized, graphData, updateGraphData]);

  // Handle window resize
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Handle view state changes
  useEffect(() => {
    frameRef.current++;
  }, [viewState.showLabels, viewState.showEdges, viewState.nodeSize, viewState.edgeOpacity]);

  // Handle selected nodes changes
  useEffect(() => {
    frameRef.current++;
  }, [viewState.selectedNodes]);

  // Handle hovered node changes
  useEffect(() => {
    frameRef.current++;
  }, [viewState.hoveredNode]);

  // Handle pathfinding state changes
  useEffect(() => {
    frameRef.current++;
  }, [pathfindingState.currentPath, pathfindingState.selectedWaypoints]);


  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-gray-900 relative"
      style={{ touchAction: 'none' }}
    >
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p>Initializing visualization...</p>
          </div>
        </div>
      )}

      {isInitialized && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/60">
          <div className="text-center">
            <p className="text-lg mb-2">No graph data available</p>
            <p className="text-sm">Load some tracks to see the visualization</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphVisualization;