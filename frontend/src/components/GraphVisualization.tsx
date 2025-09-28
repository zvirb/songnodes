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
  ForceLink,
} from 'd3-force';
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import useStore from '../store/useStore';
import { GraphNode, GraphEdge, DEFAULT_CONFIG, Bounds } from '../types';

// Performance constants - updated for 2025 best practices
const PERFORMANCE_THRESHOLDS = {
  NODE_COUNT_HIGH: 1000,
  NODE_COUNT_MEDIUM: 500,
  EDGE_COUNT_HIGH: 2000,
  EDGE_COUNT_MEDIUM: 1000,
  // Removed CULL_DISTANCE - using proper viewport bounds instead
  LOD_DISTANCE_1: 400, // Screen-space distance for detail levels
  LOD_DISTANCE_2: 800, // Screen-space distance for detail levels
  MIN_NODE_SIZE: 2,
  MAX_NODE_SIZE: 32,
  MIN_EDGE_WIDTH: 0.5,
  MAX_EDGE_WIDTH: 8,
  VIEWPORT_BUFFER: 200, // Pixels buffer for smooth culling transitions
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

    // Calculate screen bounds for proper viewport culling (2025 best practice)
    // Transform world coordinates to screen coordinates
    const screenX = (node.x * this.viewport.zoom) + this.viewport.x;
    const screenY = (node.y * this.viewport.zoom) + this.viewport.y;

    // Define screen bounds with buffer for smooth transitions
    const buffer = 200; // pixels buffer for smooth appearing/disappearing
    const leftBound = -buffer;
    const rightBound = this.viewport.width + buffer;
    const topBound = -buffer;
    const bottomBound = this.viewport.height + buffer;

    // Check if node is completely outside screen bounds (true viewport culling)
    if (screenX < leftBound || screenX > rightBound ||
        screenY < topBound || screenY > bottomBound) {
      return 3; // Cull completely - outside viewport
    }

    // Calculate distance from viewport center for LOD decisions
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(screenX - centerX, 2) + Math.pow(screenY - centerY, 2)
    );

    // Performance-based LOD adjustment using screen-space distances
    let baseDistance1 = PERFORMANCE_THRESHOLDS.LOD_DISTANCE_1;
    let baseDistance2 = PERFORMANCE_THRESHOLDS.LOD_DISTANCE_2;

    // Scale LOD distances based on performance requirements
    if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_HIGH) {
      baseDistance1 *= 0.6;
      baseDistance2 *= 0.6;
    } else if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_MEDIUM) {
      baseDistance1 *= 0.8;
      baseDistance2 *= 0.8;
    }

    // Use screen-space distances for consistent LOD behavior
    const screenDiagonal = Math.sqrt(this.viewport.width * this.viewport.width + this.viewport.height * this.viewport.height);
    const normalizedDistance = distanceFromCenter / screenDiagonal;

    if (normalizedDistance > 0.8) {
      return 2; // Minimal detail - far from center
    } else if (normalizedDistance > 0.4) {
      return 1; // Reduced detail - medium distance
    } else {
      return 0; // Full detail - near center
    }
  }

  getEdgeLOD(edge: EnhancedGraphEdge): number {
    if (!edge.sourceNode || !edge.targetNode) return 3;

    const sourceLOD = this.getNodeLOD(edge.sourceNode);
    const targetLOD = this.getNodeLOD(edge.targetNode);

    // If both nodes are culled (LOD 3), cull the edge
    if (sourceLOD === 3 && targetLOD === 3) {
      return 3;
    }

    // If one node is culled but the other is visible, check if edge crosses viewport
    if (sourceLOD === 3 || targetLOD === 3) {
      // Keep edge visible if it might cross the viewport
      // This prevents edges from disappearing when one node is just outside bounds
      return Math.min(sourceLOD, targetLOD);
    }

    // Edge LOD is determined by the best (lowest) node LOD for smoother transitions
    const minLOD = Math.min(sourceLOD, targetLOD);

    // Additional edge-specific culling for performance
    if (this.edgeCount > PERFORMANCE_THRESHOLDS.EDGE_COUNT_HIGH && minLOD > 0) {
      return Math.min(minLOD + 1, 3); // Slightly more aggressive culling for high edge counts
    }

    return minLOD;
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

    // Debug container dimensions and state
    console.log('Container debug info:', {
      container,
      containerChildren: container.children.length,
      containerStyle: {
        width: container.style.width,
        height: container.style.height,
        display: container.style.display,
        position: container.style.position,
      },
      containerClasses: container.className,
      containerId: container.id,
      parentElement: container.parentElement,
      boundingRect: rect,
      offsetDimensions: {
        width: container.offsetWidth,
        height: container.offsetHeight
      },
      clientDimensions: {
        width: container.clientWidth,
        height: container.clientHeight
      }
    });

    // Check if container has zero dimensions
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Container has zero dimensions, delaying PIXI initialization');
      setTimeout(() => initializePixi(), 100);
      return;
    }

    try {
      console.log('Initializing PIXI.js application...', {
        containerWidth: rect.width,
        containerHeight: rect.height,
        devicePixelRatio: window.devicePixelRatio
      });

      // Create PIXI application with WebGL
      const app = new PIXI.Application();

      // Initialize PIXI application with enhanced settings
      await app.init({
        width: Math.max(rect.width || 800, 100),  // Ensure minimum width
        height: Math.max(rect.height || 600, 100), // Ensure minimum height
        backgroundColor: 0x1a1a1a,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // Enable for debugging
        hello: true, // Show PIXI greeting in console
      });

      // Verify canvas was created
      if (!app.canvas) {
        throw new Error('PIXI.js failed to create canvas element');
      }

      // Style canvas element for proper integration
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.zIndex = '10';
      canvas.setAttribute('data-testid', 'pixi-canvas');
      canvas.setAttribute('data-pixi-version', PIXI.VERSION);
      canvas.id = 'songnodes-pixi-canvas';
      canvas.className = 'pixi-graph-canvas';

      // Add canvas to container
      container.appendChild(canvas);
      pixiAppRef.current = app;

      // Make PIXI app globally accessible for debugging
      (window as any).pixiApp = app;
      (window as any).__PIXI_APP__ = app;
      (window as any).PIXI = PIXI;
      (window as any).pixiCanvas = canvas;
      (canvas as any).__pixi_app__ = app;

      // Additional canvas debugging
      console.log('Canvas DOM state after append:', {
        canvasParent: canvas.parentElement,
        canvasInDocument: document.contains(canvas),
        canvasStyle: {
          position: canvas.style.position,
          top: canvas.style.top,
          left: canvas.style.left,
          width: canvas.style.width,
          height: canvas.style.height,
          display: canvas.style.display,
          visibility: canvas.style.visibility,
          opacity: canvas.style.opacity,
          zIndex: canvas.style.zIndex
        },
        canvasComputedStyle: {
          display: window.getComputedStyle(canvas).display,
          visibility: window.getComputedStyle(canvas).visibility,
          opacity: window.getComputedStyle(canvas).opacity
        },
        containerRect: container.getBoundingClientRect(),
        canvasRect: canvas.getBoundingClientRect()
      });

      console.log('PIXI.js application initialized successfully', {
        canvasElement: canvas,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        canvasStyleWidth: canvas.style.width,
        canvasStyleHeight: canvas.style.height,
        rendererType: app.renderer.type,
        pixiVersion: PIXI.VERSION,
        container: container,
        containerChildren: container.children.length
      });

    // Create container hierarchy for proper layering
    const edgesContainer = new PIXI.Container();
    edgesContainer.label = 'edges';
    const nodesContainer = new PIXI.Container();
    nodesContainer.label = 'nodes';
    const labelsContainer = new PIXI.Container();
    labelsContainer.label = 'labels';
    const interactionContainer = new PIXI.Container();
    interactionContainer.label = 'interaction';

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

    // Remove test visuals - no longer needed
    // const testVisual = new PIXI.Graphics();
    // app.stage.addChild(testVisual);

    // Also add a background to verify the canvas is visible
    const background = new PIXI.Graphics();
    background.rect(0, 0, rect.width, rect.height);
    background.fill(0x1a1a1a); // Darker background for better contrast
    app.stage.addChildAt(background, 0); // Add as first child (bottom layer)
    console.log('Added background visual to PIXI stage');

    // Update viewport dimensions
    viewportRef.current.width = rect.width;
    viewportRef.current.height = rect.height;

    // Initialize LOD system
    lodSystemRef.current = new LODSystem(viewportRef.current);

    // Start render loop
    app.ticker.add(renderFrame);
    console.log('Started PIXI render loop with ticker');

    // Force an initial render to show test visuals
    app.render();
    console.log('Forced initial PIXI render');

    setIsInitialized(true);
    console.log('PIXI initialization complete, isInitialized set to true');

    } catch (error) {
      console.error('Failed to initialize PIXI.js application:', error);

      // Create fallback canvas for debugging
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.id = 'songnodes-fallback-canvas';
      fallbackCanvas.className = 'fallback-graph-canvas';
      fallbackCanvas.style.position = 'absolute';
      fallbackCanvas.style.top = '0';
      fallbackCanvas.style.left = '0';
      fallbackCanvas.style.width = '100%';
      fallbackCanvas.style.height = '100%';
      fallbackCanvas.style.backgroundColor = '#1a1a1a';
      fallbackCanvas.style.border = '2px solid #ff4444';
      fallbackCanvas.width = Math.max(rect.width || 800, 100);
      fallbackCanvas.height = Math.max(rect.height || 600, 100);

      // Add error message to canvas
      const ctx = fallbackCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ff4444';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PIXI.js Initialization Failed', fallbackCanvas.width / 2, fallbackCanvas.height / 2 - 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Check console for details', fallbackCanvas.width / 2, fallbackCanvas.height / 2 + 10);
      }

      container.appendChild(fallbackCanvas);

      // Store error state globally for debugging
      (window as any).pixiInitError = error;
      (window as any).fallbackCanvas = fallbackCanvas;

      // Set initialized to true to prevent infinite retry
      setIsInitialized(true);
    }
  }, []);

  // Initialize D3 force simulation
  const initializeSimulation = useCallback(() => {
    const simulation = forceSimulation<EnhancedGraphNode, EnhancedGraphEdge>()
      .force('link', forceLink<EnhancedGraphNode, EnhancedGraphEdge>()
        .id(d => d.id)
        .distance(250) // Much larger distance for better separation
        .strength(0.3)  // Weaker strength to allow more spread
      )
      .force('charge', forceManyBody<EnhancedGraphNode>()
        .strength(-1500) // Even stronger repulsion for maximum separation
        .distanceMax(2000) // Much larger influence radius
        .distanceMin(50)   // Larger minimum distance
      )
      .force('center', forceCenter<EnhancedGraphNode>(0, 0))
      .force('collision', forceCollide<EnhancedGraphNode>()
        .radius(d => (d.radius || DEFAULT_CONFIG.graph.defaultRadius) + 40) // Much larger collision radius
        .strength(1.0)  // Strong collision prevention
        .iterations(3)  // More iterations for better separation
      )
      .velocityDecay(0.4)  // Lower decay for more spreading motion
      .alphaDecay(0.02)    // Slower stabilization to allow full spread
      .alphaMin(0.001);    // Lower min for complete stop

    simulation.on('tick', handleSimulationTick);
    simulation.on('end', handleSimulationEnd);

    simulationRef.current = simulation;
    return simulation;
  }, []);

  // Initialize D3 zoom behavior
  // NOTE: We define the zoom handler inline to avoid React hook ordering issues
  const initializeZoom = useCallback(() => {
    if (!containerRef.current) return;
    if (zoomBehaviorRef.current) return; // Already initialized

    const zoomHandler = zoom<HTMLDivElement, unknown>()
      .scaleExtent([DEFAULT_CONFIG.ui.minZoom, DEFAULT_CONFIG.ui.maxZoom])
      .filter((event: any) => {
        // Allow wheel zoom and drag events, block right-click drag
        return !event.ctrlKey && !event.button;
      })
      .wheelDelta((event: any) => {
        // Standard wheel delta handling for proper zoom speed
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      })
      .on('zoom', (event: any) => {
        const transform: ZoomTransform = event.transform;
        currentTransformRef.current = transform;

        // Update viewport with consistent coordinate system
        viewportRef.current.x = transform.x;
        viewportRef.current.y = transform.y;
        viewportRef.current.zoom = transform.k;

        // Update store
        requestAnimationFrame(() => {
          const store = useStore.getState();
          store.view.updateViewport(transform.k, { x: transform.x, y: transform.y });
        });

        // Update LOD system
        if (lodSystemRef.current) {
          lodSystemRef.current.updateViewport(viewportRef.current);
        }

        // Apply unified transform to PIXI stage - single source of truth
        if (pixiAppRef.current?.stage) {
          pixiAppRef.current.stage.x = transform.x;
          pixiAppRef.current.stage.y = transform.y;
          pixiAppRef.current.stage.scale.set(transform.k, transform.k);
        }
      });

    const selection = select(containerRef.current);
    selection.call(zoomHandler);

    // Set initial transform - center the graph in the viewport
    const centerX = viewportRef.current.width / 2;
    const centerY = viewportRef.current.height / 2;

    const initialTransform = zoomIdentity
      .translate(centerX + (viewState.pan.x || 0), centerY + (viewState.pan.y || 0))
      .scale(viewState.zoom || 1);

    selection.call(zoomHandler.transform, initialTransform);

    // Make sure the container can receive events
    if (containerRef.current) {
      containerRef.current.style.touchAction = 'none'; // Prevents browser zoom on touch devices
    }

    zoomBehaviorRef.current = zoomHandler;
  }, []);

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
  const createEnhancedEdge = useCallback((edge: GraphEdge, nodes: Map<string, EnhancedGraphNode>): EnhancedGraphEdge | null => {
    const sourceNode = nodes.get(edge.source);
    const targetNode = nodes.get(edge.target);

    // Skip edges where source or target nodes don't exist
    if (!sourceNode || !targetNode) {
      console.warn(`Skipping edge ${edge.id}: missing nodes (source: ${edge.source}, target: ${edge.target})`);
      return null;
    }

    const enhanced: EnhancedGraphEdge = {
      id: edge.id,
      weight: edge.weight,
      type: edge.type,
      strength: edge.strength,
      color: edge.color,
      opacity: edge.opacity,
      distance: edge.distance,
      source: sourceNode,
      target: targetNode,
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

    // Create artist label (above node)
    const artistLabel = new PIXI.Text({
      text: node.artist || 'Unknown Artist',
      style: {
        fontFamily: 'Arial',
        fontSize: 11,
        fill: 0xaaaaaa,  // Lighter gray for artist
        align: 'center',
        fontWeight: 'normal',
      },
    });
    artistLabel.anchor.set(0.5, 1);  // Bottom-centered anchor
    artistLabel.visible = false; // Hidden by default
    container.addChild(artistLabel);

    // Create title label (below node)
    const titleLabel = new PIXI.Text({
      text: node.title || node.label || 'Unknown',
      style: {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xffffff,  // White for song title
        align: 'center',
        fontWeight: 'bold',
      },
    });
    titleLabel.anchor.set(0.5, 0);  // Top-centered anchor
    titleLabel.visible = false; // Hidden by default
    container.addChild(titleLabel);

    // Store references (using pixiLabel for title, add new property for artist)
    node.pixiNode = container;
    node.pixiCircle = circle;
    node.pixiLabel = titleLabel;  // Main label is the title
    (node as any).pixiArtistLabel = artistLabel;  // Store artist label separately

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

    // Use fixed radius - let stage scaling handle zoom
    const screenRadius = node.screenRadius || DEFAULT_CONFIG.graph.defaultRadius;

    const color = getNodeColor(node);
    const alpha = lodLevel > 1 ? 0.5 : node.opacity || 1;

    // Update position
    node.pixiNode.position.set(node.x || 0, node.y || 0);

    // Clear and redraw the circle using PIXI v8 API
    node.pixiCircle.clear();

    if (viewState.selectedNodes.has(node.id)) {
      // Selected node outline
      node.pixiCircle.circle(0, 0, screenRadius + 2);
      node.pixiCircle.setStrokeStyle({ width: 2, color: COLOR_SCHEMES.node.selected, alpha: alpha });
      node.pixiCircle.stroke();
    }

    // Draw the main node circle
    node.pixiCircle.circle(0, 0, screenRadius);
    node.pixiCircle.fill({ color: color, alpha: alpha });

    // Update label visibility and content
    // Always show labels for now to make nodes identifiable
    const shouldShowLabel = true; // viewState.showLabels && lodLevel === 0 && transform.k > 1.5;
    node.pixiLabel.visible = shouldShowLabel;

    const artistLabel = (node as any).pixiArtistLabel;
    if (artistLabel) {
      artistLabel.visible = shouldShowLabel;
    }

    if (shouldShowLabel) {
      const fontSize = 11; // Fixed font size - stage scaling will handle zoom

      // Update title label (below node)
      node.pixiLabel.style.fontSize = fontSize * 1.2;  // Title slightly larger
      node.pixiLabel.position.set(0, screenRadius + 10);

      // Update artist label (above node)
      if (artistLabel) {
        artistLabel.style.fontSize = fontSize;
        artistLabel.position.set(0, -screenRadius - 5);
      }
    }

    // Update container alpha
    node.pixiNode.alpha = alpha;
    node.lodLevel = lodLevel;
    node.lastUpdateFrame = frameRef.current;
  }, [getNodeColor, viewState]);

  // Update edge visual appearance
  const updateEdgeVisuals = useCallback((edge: EnhancedGraphEdge, lodLevel: number) => {
    if (!edge.pixiEdge || !edge.sourceNode || !edge.targetNode) {
      console.log('Edge missing components:', {
        hasPixiEdge: !!edge.pixiEdge,
        hasSource: !!edge.sourceNode,
        hasTarget: !!edge.targetNode
      });
      return;
    }
    if (!edge.sourceNode.x || !edge.sourceNode.y || !edge.targetNode.x || !edge.targetNode.y) {
      console.log('Edge missing positions:', {
        sourcePos: { x: edge.sourceNode.x, y: edge.sourceNode.y },
        targetPos: { x: edge.targetNode.x, y: edge.targetNode.y }
      });
      return;
    }

    // Use very thin edges for clean visualization
    // Weight-based width: stronger relationships get slightly thicker lines
    const baseWidth = 0.5; // Very thin base width
    const weight = edge.weight || 1;
    const screenWidth = baseWidth + Math.min(weight / 10, 1); // Max width of 1.5 for highest weights

    const color = getEdgeColor(edge);
    // Reduce edge opacity for cleaner appearance
    const baseAlpha = lodLevel > 1 ? 0.2 : Math.max(0.3, viewState.edgeOpacity || 0.4);
    const alpha = baseAlpha * Math.max(0.6, edge.opacity || 1);

    // Update graphics using PIXI v8 API
    edge.pixiEdge.clear();
    edge.pixiEdge.setStrokeStyle({ width: screenWidth, color: color, alpha: alpha });
    edge.pixiEdge.moveTo(edge.sourceNode.x, edge.sourceNode.y);
    edge.pixiEdge.lineTo(edge.targetNode.x, edge.targetNode.y);
    edge.pixiEdge.stroke();

    // Debug first few edges
    if (Math.random() < 0.001) { // Log ~0.1% of edges to avoid spam
      console.log('Edge rendered:', {
        id: edge.id,
        width: screenWidth,
        color: color.toString(16),
        alpha: alpha,
        from: { x: edge.sourceNode.x, y: edge.sourceNode.y },
        to: { x: edge.targetNode.x, y: edge.targetNode.y },
        visible: edge.pixiEdge.visible
      });
    }

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
      let visibleEdgeCount = 0;
      enhancedEdgesRef.current.forEach(edge => {
        const lodLevel = lodSystem.getEdgeLOD(edge);
        const shouldRender = lodLevel < 3;

        if (edge.pixiEdge) {
          edge.pixiEdge.visible = shouldRender;
          edge.isVisible = shouldRender;

          if (shouldRender) {
            visibleEdgeCount++;
            if (edge.lastUpdateFrame < currentFrame || shouldOptimize) {
              updateEdgeVisuals(edge, lodLevel);
            }
          }
        }
      });

      // Debug logging - only log occasionally to avoid spam
      if (currentFrame % 60 === 0) {
        console.log(`Edge render debug: ${visibleEdgeCount}/${enhancedEdgesRef.current.size} edges visible, showEdges=${viewState.showEdges}`);
      }
    } else if (currentFrame % 60 === 0) {
      console.log(`Edges not rendering: showEdges=${viewState.showEdges}, container=${!!edgesContainerRef.current}`);
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

    // Filter out invalid edges before processing
    const nodeIds = new Set(graphData.nodes.map(n => n.id));
    const validEdges = graphData.edges.filter(edge => {
      const sourceExists = nodeIds.has(edge.source);
      const targetExists = nodeIds.has(edge.target);
      if (!sourceExists || !targetExists) {
        console.warn(`Filtering out edge ${edge.id} due to missing nodes. Source: ${edge.source} (exists: ${sourceExists}), Target: ${edge.target} (exists: ${targetExists})`);
      }
      return sourceExists && targetExists;
    });

    // Create enhanced edges
    validEdges.forEach(edgeData => {
      const edge = createEnhancedEdge(edgeData, nodeMap);
      if (!edge) {
        return; // This check is now redundant but safe to keep
      }

      const pixiGraphics = createPixiEdge(edge);

      edgesContainerRef.current!.addChild(pixiGraphics);
      enhancedEdgesRef.current.set(edge.id, edge);
    });

    // Update simulation with nodes and edges
    simulation.nodes(Array.from(nodeMap.values()));

    // Update the existing link force with new edges data
    const linkForce = simulation.force('link') as ForceLink<EnhancedGraphNode, EnhancedGraphEdge>;
    if (linkForce) {
      linkForce.links(Array.from(enhancedEdgesRef.current.values()));
    }

    // Restart simulation
    simulation.alpha(0.3).restart();

    // Rebuild spatial index
    spatialIndexRef.current.rebuild(Array.from(nodeMap.values()));

    frameRef.current++;
  }, [graphData, createEnhancedNode, createPixiNode, createEnhancedEdge, createPixiEdge]);


  // Effects

  // Initialize on mount - delayed to ensure container is properly mounted
  useEffect(() => {
    const initializeAfterMount = () => {
      console.log('Attempting PIXI initialization after component mount');
      initializePixi();
    };

    // Use a small delay to ensure the DOM is fully rendered
    const timeoutId = setTimeout(initializeAfterMount, 0);

    return () => {
      clearTimeout(timeoutId);
      if (pixiAppRef.current) {
        console.log('Destroying PIXI application on unmount');
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
      className="graph-canvas graph-container graph-visualization graph-component w-full h-full overflow-hidden bg-gray-900 relative"
      style={{ touchAction: 'none' }}
    >
      {!isInitialized && (
        <div className="graph-loading absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p>Initializing visualization...</p>
          </div>
        </div>
      )}

      {isInitialized && graphData.nodes.length === 0 && (
        <div className="graph-empty absolute inset-0 flex items-center justify-center text-white/60">
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