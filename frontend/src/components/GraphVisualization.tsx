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

// Animation control system
interface AnimationState {
  isActive: boolean;
  startTime: number;
  duration: number; // in milliseconds
  trigger: 'initial' | 'data_change' | 'manual_refresh';
}

// Enhanced node interface for PIXI and D3 integration
interface EnhancedGraphNode extends GraphNode, SimulationNodeDatum {
  pixiNode?: PIXI.Container;
  pixiCircle?: PIXI.Graphics;
  pixiLabel?: PIXI.Text;
  lodLevel: number;
  lastUpdateFrame: number;
  isVisible: boolean;
  screenRadius: number;
  hitBoxRadius: number; // Extended hit box for zoom-aware clicking
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

  // Animation control system
  const animationStateRef = useRef<AnimationState>({
    isActive: false,
    startTime: 0,
    duration: 15000, // 15 seconds
    trigger: 'initial'
  });
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string>('');

  // Render state
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [animationTimer, setAnimationTimer] = useState<number>(0);
  const frameRef = useRef<number>(0);
  const lastRenderFrame = useRef<number>(0);

  // Memory monitoring (2025 best practice)
  const memoryStatsRef = useRef({
    lastCheck: Date.now(),
    initialMemory: 0,
    lastMemory: 0,
    webglMemory: {
      buffers: 0,
      textures: 0,
      programs: 0
    }
  });

  // Performance monitoring timer
  const performanceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        eventMode: 'static',  // Enable events globally
        eventFeatures: {
          move: true,
          globalMove: false,
          click: true,
          wheel: true,
        },
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
      // CRITICAL FIX: Ensure canvas doesn't interfere with D3 zoom events
      canvas.style.pointerEvents = 'auto';
      canvas.style.userSelect = 'none';

      // Initialize WebGL memory monitoring (2025 best practice)
      const gl = app.renderer.gl;
      if (gl) {
        console.log('WebGL context initialized', {
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
        });

        // Monitor initial WebGL memory state
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          console.log('GPU info:', {
            vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
            renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          });
        }
      }
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

  // Handle D3 simulation tick
  const handleSimulationTick = useCallback(() => {
    // CRITICAL FIX: Only allow position updates during active animation window
    if (!animationStateRef.current.isActive) {
      // Animation is frozen, don't update positions
      return;
    }

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
      .velocityDecay(0.8)  // Higher decay for faster settling
      .alphaDecay(0.1)     // Much faster decay for quick convergence (nodes settle in ~3-5 seconds)
      .alphaMin(0.005);    // Lower threshold for more complete positioning

    simulation.on('tick', handleSimulationTick);
    simulation.on('end', handleSimulationEnd);

    simulationRef.current = simulation;
    return simulation;
  }, [handleSimulationTick, handleSimulationEnd]);

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

        // CRITICAL FIX: Update hit box radii for all nodes when zoom changes
        // This ensures click detection remains accurate at all zoom levels
        enhancedNodesRef.current.forEach(node => {
          if (node.pixiNode) {
            const currentZoom = transform.k;
            const baseRadius = node.screenRadius || DEFAULT_CONFIG.graph.defaultRadius;
            const minHitBoxSizeScreen = 20; // minimum 20px hit area in screen coordinates
            const minHitBoxWorldSize = minHitBoxSizeScreen / currentZoom; // Convert to world coordinates
            const hitRadius = Math.max(baseRadius + 10, minHitBoxWorldSize);
            node.hitBoxRadius = hitRadius;
            node.pixiNode.hitArea = new PIXI.Circle(0, 0, hitRadius);
          }
        });
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
      // CRITICAL FIX: Ensure container is properly set up for event handling
      containerRef.current.style.position = 'relative';
      containerRef.current.style.overflow = 'hidden';
      containerRef.current.style.userSelect = 'none';
    }

    zoomBehaviorRef.current = zoomHandler;
  }, []);

  // Handle zoom events

  // Animation control functions
  const startAnimation = useCallback((trigger: AnimationState['trigger']) => {
    console.log(`🎬 Starting ${trigger} animation for 15 seconds`);

    const state: AnimationState = {
      isActive: true,
      startTime: Date.now(),
      duration: 15000,
      trigger
    };

    animationStateRef.current = state;

    // Clear any existing timer
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }

    // Set timer to stop animation after 15 seconds
    animationTimerRef.current = setTimeout(() => {
      console.log('⏹️ Animation time limit reached, freezing movement');
      stopAnimation();
    }, 15000);

    // Update UI timer every second
    if (uiTimerRef.current) {
      clearInterval(uiTimerRef.current);
    }
    uiTimerRef.current = setInterval(() => {
      if (animationStateRef.current.isActive) {
        const elapsed = Date.now() - animationStateRef.current.startTime;
        const remaining = Math.max(0, Math.ceil((15000 - elapsed) / 1000));
        setAnimationTimer(remaining);
        if (remaining <= 0) {
          clearInterval(uiTimerRef.current!);
          uiTimerRef.current = null;
        }
      } else {
        // Animation was stopped externally, clean up this timer
        clearInterval(uiTimerRef.current!);
        uiTimerRef.current = null;
      }
    }, 1000);

    // Restart PIXI ticker if it was stopped
    if (pixiAppRef.current?.ticker && !pixiAppRef.current.ticker.started) {
      pixiAppRef.current.ticker.start();
      console.log('✅ PIXI ticker restarted for animation');
    }

    // If simulation exists, restart it with more energy
    if (simulationRef.current) {
      simulationRef.current.alpha(0.8).restart();
    }
  }, []);

  const stopAnimation = useCallback(() => {
    console.log('🛑 Stopping animation and freezing layout');

    animationStateRef.current.isActive = false;
    setAnimationTimer(0);

    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    if (uiTimerRef.current) {
      clearInterval(uiTimerRef.current);
      uiTimerRef.current = null;
    }

    // Stop the simulation immediately and forcefully
    if (simulationRef.current) {
      // Set alpha to 0 to immediately stop all forces
      simulationRef.current.alpha(0);
      simulationRef.current.stop();
      console.log('✅ D3 simulation force-stopped (alpha set to 0)');
    }

    // Also stop PIXI ticker to prevent visual updates
    if (pixiAppRef.current?.ticker) {
      pixiAppRef.current.ticker.stop();
      console.log('✅ PIXI ticker stopped to freeze animation');
    }
  }, []);

  const manualRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    startAnimation('manual_refresh');
  }, [startAnimation]);

  // Expose manual refresh function globally for debugging/testing
  useEffect(() => {
    (window as any).manualRefresh = manualRefresh;
    return () => {
      delete (window as any).manualRefresh;
    };
  }, [manualRefresh]);

  // Create enhanced node from graph node
  const createEnhancedNode = useCallback((node: GraphNode): EnhancedGraphNode => {
    const baseRadius = node.radius || viewState.nodeSize || DEFAULT_CONFIG.graph.defaultRadius;
    // Calculate zoom-aware hit box radius (minimum 20px at current zoom level)
    const currentZoom = viewState.zoom || 1;
    const minHitBoxSizeScreen = 20; // minimum 20px hit area in screen coordinates
    const minHitBoxWorldSize = minHitBoxSizeScreen / currentZoom; // Convert to world coordinates
    const hitBoxRadius = Math.max(baseRadius + 10, minHitBoxWorldSize);

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
      screenRadius: baseRadius,
      hitBoxRadius: hitBoxRadius,
    };

    return enhanced;
  }, [viewState.nodeSize, viewState.zoom]);

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

    // Define EXTENDED hit area for the container (critical for click detection!)
    // Use the extended hit box radius for easier clicking, especially when zoomed out
    const visualRadius = node.screenRadius || DEFAULT_CONFIG.graph.defaultRadius;
    const hitRadius = node.hitBoxRadius || (visualRadius + 10);
    container.hitArea = new PIXI.Circle(0, 0, hitRadius);

    // Visual debugging for hit areas (optional, can be enabled for testing)
    if ((window as any).DEBUG_HIT_AREAS) {
      const hitAreaDebug = new PIXI.Graphics();
      hitAreaDebug.circle(0, 0, hitRadius);
      hitAreaDebug.setStrokeStyle({ width: 1, color: 0xff0000, alpha: 0.3 });
      hitAreaDebug.stroke();
      container.addChild(hitAreaDebug);
    }

    // Debug: Log container setup
    console.log(`[Node Setup] Creating node ${node.id} - eventMode: ${container.eventMode}, cursor: ${container.cursor}, visual radius: ${visualRadius}, hit radius: ${hitRadius}`);

    // Main circle (make it non-interactive so it doesn't block container events)
    const circle = new PIXI.Graphics();
    circle.eventMode = 'none';  // Important: let events pass through to container
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
    artistLabel.eventMode = 'none';  // Don't block events
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
    titleLabel.eventMode = 'none';  // Don't block events
    container.addChild(titleLabel);

    // Store references (using pixiLabel for title, add new property for artist)
    node.pixiNode = container;
    node.pixiCircle = circle;
    node.pixiLabel = titleLabel;  // Main label is the title
    (node as any).pixiArtistLabel = artistLabel;  // Store artist label separately

    // Add interaction handlers with debugging
    // Note: These will be connected to the actual handlers later when nodes are created
    const nodeId = node.id;

    // Modern PIXI.js v8 event handling with proper click-to-select
    // CRITICAL FIX: Use 'pointerenter' and 'pointerleave' instead of 'pointerover'/'pointerout'
    // This prevents event bubbling issues and provides more stable hover detection
    container.on('pointerenter', () => {
      console.log(`[Event Triggered] pointerenter → node ${nodeId}`);
      if (graph?.setHoveredNode) {
        graph.setHoveredNode(nodeId);
      }
    });

    container.on('pointerleave', () => {
      console.log(`[Event Triggered] pointerleave → node ${nodeId}`);
      graph.setHoveredNode(null);
    });

    container.on('click', (event) => {
      console.log(`[Event Triggered] click → node ${nodeId}`);

      // CRITICAL FIX: Prevent click events during active animation/movement
      // This is a major cause of click interference
      if (animationStateRef.current.isActive) {
        const timeSinceStart = Date.now() - animationStateRef.current.startTime;
        if (timeSinceStart < 2000) { // Block clicks for first 2 seconds of animation
          console.log(`⚠️ Click blocked - animation in progress (${timeSinceStart}ms since start)`);
          return;
        }
      }

      // CRITICAL FIX: Prevent rapid successive clicks (debouncing)
      const now = Date.now();
      const lastClickTime = (container as any).lastClickTime || 0;
      if (now - lastClickTime < 200) { // 200ms debounce
        console.log(`⚠️ Click blocked - too rapid (${now - lastClickTime}ms since last)`);
        return;
      }
      (container as any).lastClickTime = now;

      // Visual feedback - flash the node
      const originalTint = circle.tint;
      circle.tint = 0xFFFFFF;
      setTimeout(() => {
        circle.tint = originalTint;
      }, 150);

      // Handle selection based on current tool
      switch (viewState.selectedTool) {
        case 'select':
          graph.toggleNodeSelection(nodeId);
          console.log(`Node ${nodeId} selection toggled`);
          break;
        case 'path':
          if (!pathfindingState.startTrackId) {
            pathfinding.setStartTrack(nodeId);
            console.log(`Set START track: ${nodeId}`);
          } else if (!pathfindingState.endTrackId && nodeId !== pathfindingState.startTrackId) {
            pathfinding.setEndTrack(nodeId);
            console.log(`Set END track: ${nodeId}`);
          } else {
            pathfinding.addWaypoint(nodeId);
            console.log(`Added waypoint: ${nodeId}`);
          }
          break;
        case 'setlist':
          // TODO: Add to setlist
          console.log(`TODO: Add to setlist: ${nodeId}`);
          break;
      }
    });

    container.on('rightclick', (event) => {
      console.log(`[Event Triggered] rightclick → node ${nodeId}`);
      event.preventDefault();
      // TODO: Show context menu
    });

    // Log that events were attached
    console.log(`[Events Attached] Node ${node.id} has ${container.listenerCount('pointerdown')} pointerdown listeners`);

    return container;
  }, [graph, pathfinding, viewState, pathfindingState]);

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

    // Recalculate zoom-aware hit box for current zoom level
    const currentZoom = viewState.zoom || 1;
    const minHitBoxSizeScreen = 20; // minimum 20px hit area in screen coordinates
    const minHitBoxWorldSize = minHitBoxSizeScreen / currentZoom; // Convert to world coordinates
    const hitRadius = Math.max(screenRadius + 10, minHitBoxWorldSize);
    node.hitBoxRadius = hitRadius;

    // Update hit area with extended radius (CRITICAL for click detection!)
    node.pixiNode.hitArea = new PIXI.Circle(0, 0, hitRadius);

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

    // Skip rendering if animation is not active (optimization for frozen state)
    if (!animationStateRef.current.isActive) {
      return;
    }

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

    // Debug logging for click registration
    console.group(`🎵 Node Click Detected`);
    console.log('Node ID:', nodeId);
    console.log('Selected Tool:', tool);
    console.log('Timestamp:', new Date().toISOString());

    // Get node details for debugging
    const node = enhancedNodesRef.current.get(nodeId);
    if (node) {
      console.log('Node Details:', {
        id: node.id,
        title: node.title,
        artist: node.artist,
        x: node.x,
        y: node.y,
        isSelected: viewState.selectedNodes.has(nodeId),
        isHovered: viewState.hoveredNode === nodeId
      });

      // Visual feedback: Flash the node to confirm click registration
      if (node.pixiCircle) {
        const originalTint = node.pixiCircle.tint;
        const originalAlpha = node.pixiCircle.alpha;
        const originalScale = node.pixiNode?.scale.x || 1;

        // Flash white and scale up briefly
        node.pixiCircle.tint = 0xFFFFFF;
        node.pixiCircle.alpha = 1;
        if (node.pixiNode) {
          node.pixiNode.scale.set(originalScale * 1.2);
        }

        // Restore after 200ms
        setTimeout(() => {
          if (node.pixiCircle) {
            node.pixiCircle.tint = originalTint;
            node.pixiCircle.alpha = originalAlpha;
          }
          if (node.pixiNode) {
            node.pixiNode.scale.set(originalScale);
          }
        }, 200);
      }
    }

    switch (tool) {
      case 'select':
        console.log('Action: Toggling node selection');
        graph.toggleNodeSelection(nodeId);
        console.log('Selected nodes after toggle:', Array.from(viewState.selectedNodes));
        break;
      case 'path':
        console.log('Action: Pathfinding mode');
        if (!pathfindingState.startTrackId) {
          console.log('Setting as START track');
          pathfinding.setStartTrack(nodeId);
        } else if (!pathfindingState.endTrackId && nodeId !== pathfindingState.startTrackId) {
          console.log('Setting as END track');
          pathfinding.setEndTrack(nodeId);
        } else {
          console.log('Adding as WAYPOINT');
          pathfinding.addWaypoint(nodeId);
        }
        console.log('Pathfinding state:', pathfindingState);
        break;
      case 'setlist':
        console.log('Action: Setlist mode');
        if (node?.track) {
          console.log('Track found, adding to setlist:', node.track);
          // TODO: Add to setlist functionality
        } else {
          console.log('⚠️ No track data for this node');
        }
        break;
      default:
        console.log('⚠️ Unknown tool:', tool);
    }
    console.groupEnd();
  }, [viewState, pathfindingState, graph, pathfinding]);

  const handleNodeHover = useCallback((nodeId: string, isHovering: boolean) => {
    // Debug hover events (less verbose since these fire frequently)
    if (isHovering) {
      console.log(`🎯 Hover START on node: ${nodeId}`);
    } else {
      console.log(`👋 Hover END on node: ${nodeId}`);
    }
    graph.setHoveredNode(isHovering ? nodeId : null);
  }, [graph]);

  const handleNodeRightClick = useCallback((nodeId: string, event: PIXI.FederatedPointerEvent) => {
    event.preventDefault();

    console.group(`🎵 Node Right-Click Detected`);
    console.log('Node ID:', nodeId);
    console.log('Event position:', { x: event.global.x, y: event.global.y });

    const node = enhancedNodesRef.current.get(nodeId);
    if (node) {
      console.log('Node Details:', {
        title: node.title,
        artist: node.artist
      });
    }

    // TODO: Show context menu
    console.log('TODO: Show context menu for node');
    console.groupEnd();
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

  // Detect data changes to trigger animation
  const generateDataHash = useCallback((nodes: GraphNode[], edges: GraphEdge[]): string => {
    const nodeHash = nodes.map(n => `${n.id}:${n.x}:${n.y}`).join('|');
    const edgeHash = edges.map(e => `${e.id}:${e.source}:${e.target}`).join('|');
    return `${nodeHash}#${edgeHash}`;
  }, []);

  // Update graph data
  const updateGraphData = useCallback(() => {
    if (!simulationRef.current || !nodesContainerRef.current || !edgesContainerRef.current) return;

    // Check if this is new data (trigger animation)
    const newDataHash = generateDataHash(graphData.nodes, graphData.edges);
    const isNewData = newDataHash !== lastDataHashRef.current;
    const wasEmpty = lastDataHashRef.current === '';
    lastDataHashRef.current = newDataHash;

    if (isNewData && !wasEmpty) { // Don't trigger on initial empty->data load
      console.log('🔄 New data detected, triggering animation');
      startAnimation('data_change');
    }

    const simulation = simulationRef.current;

    // Clear existing PIXI objects with proper cleanup (2025 best practice)
    if (nodesContainerRef.current) {
      nodesContainerRef.current.children.forEach(child => {
        child.removeAllListeners();
        if (child.destroy) {
          child.destroy({ children: true, texture: false, baseTexture: false });
        }
      });
      nodesContainerRef.current.removeChildren();
    }

    if (edgesContainerRef.current) {
      edgesContainerRef.current.children.forEach(child => {
        child.removeAllListeners();
        if (child.destroy) {
          child.destroy({ children: true, texture: false, baseTexture: false });
        }
      });
      edgesContainerRef.current.removeChildren();
    }

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

    // Restart simulation only if animation is active
    if (animationStateRef.current.isActive) {
      simulation.alpha(0.3).restart();
    } else {
      // If animation is not active, just position nodes without simulation
      console.log('🔒 Animation frozen, not restarting simulation');
    }

    // Rebuild spatial index
    spatialIndexRef.current.rebuild(Array.from(nodeMap.values()));

    frameRef.current++;
  }, [graphData, createEnhancedNode, createPixiNode, createEnhancedEdge, createPixiEdge, generateDataHash, startAnimation]);


  // Effects

  // Initialize on mount - delayed to ensure container is properly mounted
  useEffect(() => {
    const initializeAfterMount = () => {
      console.log('Attempting PIXI initialization after component mount');
      // Start initial animation on first load
      startAnimation('initial');
      initializePixi();
    };

    // Use a small delay to ensure the DOM is fully rendered
    const timeoutId = setTimeout(initializeAfterMount, 0);

    return () => {
      clearTimeout(timeoutId);

      // Comprehensive PIXI.js v8 cleanup (2025 best practices)
      if (pixiAppRef.current) {
        console.log('🧹 Comprehensive PIXI cleanup starting...');

        // Stop ticker safely (PIXI v8 compatibility)
        if (pixiAppRef.current.ticker) {
          try {
            pixiAppRef.current.ticker.stop();
            // Don't manually remove ticker listeners - let app.destroy() handle it
            console.log('✅ Ticker stopped successfully');
          } catch (error) {
            console.warn('⚠️ Ticker stop warning:', error);
          }
        }

        // Clean up all containers and their children safely
        [nodesContainerRef, edgesContainerRef, labelsContainerRef, interactionContainerRef].forEach((containerRef, index) => {
          if (containerRef.current) {
            try {
              // Remove all event listeners from container children
              containerRef.current.children.forEach(child => {
                try {
                  child.removeAllListeners?.();
                  if (child.destroy) {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                  }
                } catch (childError) {
                  console.warn(`⚠️ Child cleanup warning in container ${index}:`, childError);
                }
              });
              containerRef.current.destroy({ children: true });
              containerRef.current = null;
              console.log(`✅ Container ${index} cleaned up successfully`);
            } catch (containerError) {
              console.warn(`⚠️ Container ${index} cleanup warning:`, containerError);
              containerRef.current = null; // Clear reference even if cleanup failed
            }
          }
        });

        // Clear enhanced data maps
        enhancedNodesRef.current.clear();
        enhancedEdgesRef.current.clear();

        // Stop D3 simulation
        if (simulationRef.current) {
          simulationRef.current.stop();
          simulationRef.current = null;
        }

        // Destroy PIXI app with comprehensive options (v8 memory leak fix)
        // The destroy method will handle ticker cleanup internally
        pixiAppRef.current.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true
        });

        // Manual v8 renderGroup cleanup (known issue workaround)
        // Note: Do this BEFORE nulling pixiAppRef
        try {
          if (pixiAppRef.current?.stage?.renderGroup) {
            pixiAppRef.current.stage.renderGroup.childrenRenderablesToUpdate = {};
            pixiAppRef.current.stage.renderGroup.childrenToUpdate = {};
            pixiAppRef.current.stage.renderGroup.instructionSet = null;
          }
        } catch (e) {
          console.warn('Could not clean renderGroup:', e);
        }

        pixiAppRef.current = null;
        console.log('✅ PIXI cleanup completed');
      }

      // Clean up performance timer
      if (performanceTimerRef.current) {
        clearInterval(performanceTimerRef.current);
        performanceTimerRef.current = null;
      }

      // Clean up animation timer
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }

      // Clean up UI timer
      if (uiTimerRef.current) {
        clearInterval(uiTimerRef.current);
        uiTimerRef.current = null;
      }

      // Clean up throttled frame timer
      if (throttledFrameUpdate.current) {
        clearTimeout(throttledFrameUpdate.current);
        throttledFrameUpdate.current = null;
      }
    };
  }, [initializePixi, startAnimation]);

  // Initialize simulation and zoom after PIXI is ready
  useEffect(() => {
    if (isInitialized) {
      initializeSimulation();
      initializeZoom();

      // Start memory monitoring (2025 best practice)
      if ('memory' in performance) {
        memoryStatsRef.current.initialMemory = (performance as any).memory.usedJSHeapSize;

        performanceTimerRef.current = setInterval(() => {
          if ('memory' in performance) {
            const memInfo = (performance as any).memory;
            const currentMemory = memInfo.usedJSHeapSize;
            const memoryDiff = currentMemory - memoryStatsRef.current.lastMemory;

            // Monitor WebGL resources if available
            if (pixiAppRef.current?.renderer?.gl) {
              const gl = pixiAppRef.current.renderer.gl;
              const webglMemory = {
                buffers: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                textures: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
                programs: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)
              };
              memoryStatsRef.current.webglMemory = webglMemory;
            }

            // Log significant memory increases (> 5MB)
            if (memoryDiff > 5 * 1024 * 1024) {
              console.warn(`🚨 Memory increase detected: +${(memoryDiff / 1024 / 1024).toFixed(2)}MB`, {
                current: `${(currentMemory / 1024 / 1024).toFixed(2)}MB`,
                limit: `${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
                webgl: memoryStatsRef.current.webglMemory
              });
            }

            memoryStatsRef.current.lastMemory = currentMemory;
          }
        }, 5000); // Check every 5 seconds
      }
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

  // Handle keyboard shortcuts for debugging
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Press 'D' to toggle debug mode
      if (event.key === 'd' || event.key === 'D') {
        setShowDebugInfo(prev => {
          const newValue = !prev;
          console.log(`🐛 Debug mode ${newValue ? 'ENABLED' : 'DISABLED'}`);
          if (newValue) {
            console.log('Debug Info:');
            console.log('- Total nodes:', enhancedNodesRef.current.size);
            console.log('- Selected nodes:', viewState.selectedNodes.size);
            console.log('- Hovered node:', viewState.hoveredNode);
            console.log('- Selected tool:', viewState.selectedTool);
            console.log('- Zoom level:', viewState.zoom);
          }
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState]);

  // Throttled frame updates (2025 best practice - prevent excessive re-renders)
  const throttledFrameUpdate = useRef<NodeJS.Timeout | null>(null);

  const scheduleFrameUpdate = useCallback(() => {
    if (throttledFrameUpdate.current) return; // Already scheduled

    throttledFrameUpdate.current = setTimeout(() => {
      frameRef.current++;
      throttledFrameUpdate.current = null;
    }, 16); // ~60fps max
  }, []);

  // Handle view state changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [viewState.showLabels, viewState.showEdges, viewState.nodeSize, viewState.edgeOpacity, scheduleFrameUpdate]);

  // Handle selected nodes changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [viewState.selectedNodes, scheduleFrameUpdate]);

  // Handle hovered node changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [viewState.hoveredNode, scheduleFrameUpdate]);

  // Handle pathfinding state changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [pathfindingState.currentPath, pathfindingState.selectedWaypoints, scheduleFrameUpdate]);


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

      {/* Animation Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={manualRefresh}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          title="Restart animation for 15 seconds"
        >
          🔄 Refresh Layout
        </button>
        {animationStateRef.current.isActive && animationTimer > 0 && (
          <div className="bg-green-600 text-white px-3 py-1 rounded text-xs text-center">
            🎬 Animating... {animationTimer}s
          </div>
        )}
      </div>

      {/* Debug overlay */}
      {showDebugInfo && (
        <div className="absolute top-4 left-4 bg-black/80 text-green-400 p-4 rounded-lg font-mono text-xs max-w-md">
          <div className="mb-2 text-yellow-400 font-bold">🐛 DEBUG MODE</div>
          <div>Press 'D' to toggle</div>
          <div className="mt-2">
            <div>Nodes: {enhancedNodesRef.current.size}</div>
            <div>Selected: {viewState.selectedNodes.size} nodes</div>
            <div>Hovered: {viewState.hoveredNode || 'none'}</div>
            <div>Tool: {viewState.selectedTool}</div>
            <div>Zoom: {viewState.zoom.toFixed(2)}x</div>
            <div>FPS: {performance?.fps?.toFixed(0) || 'N/A'}</div>
            {('memory' in window.performance) && (
              <div className="mt-1 text-yellow-300">
                <div>Memory: {((window.performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB</div>
                <div>Limit: {((window.performance as any).memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)}MB</div>
              </div>
            )}
          </div>
          <div className="mt-2 text-cyan-400">
            <div>Animation:</div>
            <div className="text-xs">• Active: {animationStateRef.current.isActive ? 'YES' : 'NO'}</div>
            <div className="text-xs">• Trigger: {animationStateRef.current.trigger}</div>
            <div className="text-xs">• Manual: window.manualRefresh()</div>
          </div>
          <div className="mt-2 text-orange-400">
            <div>Click Events:</div>
            <div className="text-xs">• Extended hit boxes enabled</div>
            <div className="text-xs">• Zoom-aware hit detection</div>
            <div className="text-xs">• Animation blocking for first 2s</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphVisualization;