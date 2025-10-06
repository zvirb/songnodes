import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  ForceLink,
} from 'd3-force';
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import useStore from '../store/useStore';
import { GraphNode, GraphEdge, DEFAULT_CONFIG, Bounds, Track } from '../types';

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
  genre: {
    // Electronic/Dance genres
    'house': 0x3498db,
    'techno': 0x9b59b6,
    'trance': 0xe74c3c,
    'dubstep': 0x1abc9c,
    'drum and bass': 0xf39c12,
    'edm': 0x2ecc71,
    // Other genres
    'hip hop': 0xe67e22,
    'pop': 0xff6b9d,
    'rock': 0xc0392b,
    'indie': 0x16a085,
    'electronic': 0x8e44ad,
    'ambient': 0x34495e,
    'default': 0x95a5a6,
  },
} as const;

// Layout mode for force simulation
type LayoutMode = 'standard' | 'energy-genre';

// Force simulation settings
interface ForceSettings {
  layoutMode: LayoutMode;
  energyStrength: number;
  genreStrength: number;
  linkStrength: number;
  linkDistance: number;
}

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
    // Convert world coordinates to screen coordinates
    // D3 transform: screen = world * zoom + transform.offset + center
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;
    const screenX = (node.x ?? 0) * this.viewport.zoom + this.viewport.x + centerX;
    const screenY = (node.y ?? 0) * this.viewport.zoom + this.viewport.y + centerY;

    // Define screen bounds with buffer for smooth transitions
    const buffer = PERFORMANCE_THRESHOLDS.VIEWPORT_BUFFER;
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
    // screenX/screenY are already in screen space (0,0 = top-left corner)
    // Center is at (width/2, height/2)
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
    // Edge LOD based on both endpoint nodes
    const sourceLOD = this.getNodeLOD(edge.source);
    const targetLOD = this.getNodeLOD(edge.target);

    // If either endpoint is culled (LOD 3), cull the edge
    if (sourceLOD === 3 || targetLOD === 3) {
      return 3;
    }

    // Otherwise, use the maximum LOD of the two endpoints
    // (show edge at lower detail if either endpoint is far)
    return Math.max(sourceLOD, targetLOD);
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
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

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
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return false;
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
        if (typeof node.x !== 'number' || typeof node.y !== 'number') continue;
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
  private lastUpdate: number = 0; // Initialize to 0, will be set on first update
  private targetFPS: number = DEFAULT_CONFIG.performance.targetFPS;

  update(): { frameRate: number; renderTime: number; shouldOptimize: boolean } {
    // Safe performance.now() with fallback
    const now = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();

    // Initialize lastUpdate on first call if needed
    if (this.lastUpdate === 0) {
      this.lastUpdate = now;
    }

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
    // Safe performance.now() with fallback
    this.lastUpdate = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }
}

interface GraphVisualizationProps {
  onTrackSelect?: (track: Track) => void;
  onTrackRightClick?: (track: Track, position: { x: number; y: number }) => void;
}

export const GraphVisualization: React.FC<GraphVisualizationProps> = ({ onTrackSelect, onTrackRightClick }) => {
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

  // Animation control system with play/pause functionality
  const [isSimulationPaused, setIsSimulationPaused] = useState(false);
  const isSimulationPausedRef = useRef(false); // Add ref to avoid closure issues
  const animationStateRef = useRef<AnimationState>({
    isActive: true, // Start active by default
    startTime: 0,
    duration: Infinity, // Continuous until paused
    trigger: 'initial'
  });
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string>('');

  // Render state
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [animationTimer, setAnimationTimer] = useState<number>(0);

  // Force layout settings for energy-genre visualization
  const [forceSettings, setForceSettings] = useState<ForceSettings>({
    layoutMode: 'standard',
    energyStrength: 0.15,
    genreStrength: 0.1,
    linkStrength: 0.2,
    linkDistance: 150,
  });
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

  // Helper function to get genre color (must be defined BEFORE getNodeColor)
  const getGenreColor = useCallback((genre?: string): number => {
    if (!genre) return COLOR_SCHEMES.genre.default;
    const lowerGenre = genre.toLowerCase();
    return (COLOR_SCHEMES.genre as any)[lowerGenre] || COLOR_SCHEMES.genre.default;
  }, []);

  // Memoized color functions
  const getNodeColor = useCallback((node: EnhancedGraphNode): number => {
    // Path and selection states take priority
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

    // Genre-based coloring in energy-genre layout mode
    if (forceSettings.layoutMode === 'energy-genre') {
      return getGenreColor((node as any).genre);
    }

    return COLOR_SCHEMES.node.default;
  }, [viewState.selectedNodes, viewState.hoveredNode, pathfindingState, forceSettings.layoutMode, getGenreColor]);

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
          wheel: false,  // CRITICAL FIX: Disable PIXI wheel events, let D3 handle zoom
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
      (window as any).enhancedNodesRef = enhancedNodesRef;
      (window as any).enhancedEdgesRef = enhancedEdgesRef;
      (window as any).lodSystemRef = lodSystemRef;
      (window as any).viewportRef = viewportRef;

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

    // Center the stage so world coordinate (0,0) appears at canvas center
    app.stage.position.set(rect.width / 2, rect.height / 2);
    console.log(`Centered stage at (${rect.width / 2}, ${rect.height / 2})`);

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
    // Offset background to compensate for stage centering transform
    const background = new PIXI.Graphics();
    background.rect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
    background.fill(0x1a1a1a); // Darker background for better contrast
    app.stage.addChildAt(background, 0); // Add as first child (bottom layer)
    console.log('Added background visual to PIXI stage (offset for centered stage)');

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
    // CRITICAL FIX: Check ref instead of state to avoid closure issues
    if (isSimulationPausedRef.current) {
      // Simulation is paused, don't update positions (but keep rendering current positions)
      return;
    }

    if (!animationStateRef.current.isActive) {
      // Animation not active, don't update positions
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

  // Custom genre clustering force
  const genreClusterForce = useCallback((alpha: number) => {
    const nodes = Array.from(enhancedNodesRef.current.values());

    // Group nodes by genre
    const genreGroups = new Map<string, EnhancedGraphNode[]>();
    nodes.forEach(node => {
      const genre = (node as any).genre || 'unknown';
      if (!genreGroups.has(genre)) {
        genreGroups.set(genre, []);
      }
      genreGroups.get(genre)!.push(node);
    });

    // Pull each node toward its genre cluster centroid
    genreGroups.forEach(group => {
      if (group.length < 2) return;

      const cx = group.reduce((sum, n) => sum + (n.x || 0), 0) / group.length;
      const cy = group.reduce((sum, n) => sum + (n.y || 0), 0) / group.length;

      group.forEach(node => {
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          node.vx = (node.vx || 0) - (node.x - cx) * alpha * forceSettings.genreStrength;
          node.vy = (node.vy || 0) - (node.y - cy) * alpha * forceSettings.genreStrength;
        }
      });
    });
  }, [forceSettings.genreStrength]);

  // Initialize D3 force simulation with balanced parameters
  const initializeSimulation = useCallback(() => {
    const simulation = forceSimulation<EnhancedGraphNode, EnhancedGraphEdge>()
      .force('link', forceLink<EnhancedGraphNode, EnhancedGraphEdge>()
        .id(d => d.id)
        .distance(d => {
          // Dynamic distance based on energy difference for elastic stretching
          if (forceSettings.layoutMode === 'energy-genre') {
            const source = d.source as any;
            const target = d.target as any;
            const energyDiff = Math.abs((source.energy || 0.5) - (target.energy || 0.5));
            return forceSettings.linkDistance + (energyDiff * 300); // Stretch across energy gaps
          }
          return forceSettings.linkDistance;
        })
        .strength(forceSettings.linkStrength)  // Elastic for energy-genre mode
      )
      .force('charge', forceManyBody<EnhancedGraphNode>()
        .strength(-800) // Strong but not extreme repulsion
        .distanceMax(800) // Reasonable influence radius
        .distanceMin(30)
      )
      .force('center', forceCenter<EnhancedGraphNode>(0, 0).strength(0.05)) // STRONGER center force to keep nodes in viewport
      .force('collision', forceCollide<EnhancedGraphNode>()
        .radius(d => (d.radius || DEFAULT_CONFIG.graph.defaultRadius) + 20)
        .strength(0.8)  // Balanced collision prevention
        .iterations(3)
      )
      .velocityDecay(0.4)   // FIXED: Normal friction to prevent nodes flying off (was 0.1)
      .alphaDecay(0.0228)    // Standard decay rate for reasonable settling time
      .alphaMin(0.001);      // Standard threshold

    // Add energy-genre layout forces if enabled
    if (forceSettings.layoutMode === 'energy-genre') {
      // X-axis: Energy positioning (low energy left, high energy right)
      simulation.force('x', forceX<EnhancedGraphNode>()
        .x(d => {
          const energy = (d as any).energy || 0.5; // 0-1 from Spotify API
          const viewportWidth = pixiAppRef.current?.screen.width || 1920;
          return (energy - 0.5) * viewportWidth * 0.8; // 80% of viewport width
        })
        .strength(forceSettings.energyStrength) // Dominant force for energy positioning
      );

      // Genre clustering force (custom)
      simulation.force('genre-cluster', genreClusterForce);
    } else {
      // Remove energy-genre forces in standard mode
      simulation.force('x', null);
      simulation.force('genre-cluster', null);
    }

    simulation.on('tick', handleSimulationTick);
    simulation.on('end', handleSimulationEnd);

    simulationRef.current = simulation;
    return simulation;
  }, [handleSimulationTick, handleSimulationEnd, forceSettings, genreClusterForce]);

  // Fast pre-computation method using manual ticks for accurate positioning
  const preComputeLayout = useCallback((nodes: EnhancedGraphNode[], maxTicks = 300) => {
    console.log('🚀 Pre-computing accurate layout positions...');

    // Create a separate simulation for pre-computation (match main simulation parameters)
    const preSimulation = forceSimulation<EnhancedGraphNode>(nodes)
      .force('link', forceLink<EnhancedGraphNode, EnhancedGraphEdge>(enhancedEdgesRef.current)
        .id(d => d.id)
        .distance(150)
        .strength(0.3)
      )
      .force('charge', forceManyBody<EnhancedGraphNode>()
        .strength(-800) // Match main simulation
        .distanceMax(800) // Match main simulation
        .distanceMin(30)
      )
      .force('center', forceCenter<EnhancedGraphNode>(0, 0).strength(0.05)) // Match main simulation
      .force('collision', forceCollide<EnhancedGraphNode>()
        .radius(d => (d.radius || DEFAULT_CONFIG.graph.defaultRadius) + 20)
        .strength(0.8)
        .iterations(3)
      )
      .velocityDecay(0.4)   // Match main simulation
      .alphaDecay(0.0228)   // Match main simulation
      .alphaMin(0.001)      // Match main simulation
      .stop(); // Stop automatic ticking

    // Run manual ticks until convergence
    let tickCount = 0;
    const startTime = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();

    while (preSimulation.alpha() > preSimulation.alphaMin() && tickCount < maxTicks) {
      preSimulation.tick();
      tickCount++;
    }

    const endTime = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    console.log(`✅ Layout pre-computed in ${tickCount} ticks (${(endTime - startTime).toFixed(1)}ms)`);

    // Return the computed positions
    return nodes.map(node => ({
      id: node.id,
      x: node.x || 0,
      y: node.y || 0
    }));
  }, []);

  // Initialize D3 zoom behavior
  // NOTE: We define the zoom handler inline to avoid React hook ordering issues
  const initializeZoom = useCallback(() => {
    if (!containerRef.current) return;
    if (zoomBehaviorRef.current) return; // Already initialized

    console.log('🚀 Initializing D3 zoom with zoom-to-cursor fix...');

    const zoomHandler = zoom<HTMLDivElement, unknown>()
      .scaleExtent([DEFAULT_CONFIG.ui.minZoom, DEFAULT_CONFIG.ui.maxZoom])
      .filter((event: any) => {
        // CRITICAL FIX: Properly separate D3 zoom from PIXI node interactions

        // Block D3 zoom if event originated from a PIXI interactive element
        // PIXI events set a custom flag or we can check the target
        if (event.target?.tagName === 'CANVAS') {
          // Event is on the canvas - check if it's over a PIXI interactive element
          // PIXI events will have stopPropagation() called, so they won't reach here
          // But we need to check if we're clicking on the canvas itself (background)
        }

        // Allow wheel zoom (unless Ctrl is pressed for browser zoom)
        if (event.type === 'wheel') {
          return !event.ctrlKey;
        }

        // For pointer events (drag/pan), ONLY allow left-click on the background
        // PIXI node events call stopPropagation(), so they won't trigger D3 zoom
        if (event.type === 'mousedown' || event.type === 'pointerdown') {
          // Only allow left-click (button 0) for panning
          // Right-click (button 2) is reserved for context menus on nodes
          return event.button === 0;
        }

        // Allow other zoom-related events (like touchstart, touchmove)
        return true;
      })
      .wheelDelta((event: any) => {
        // Standard wheel delta handling for proper zoom speed
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      })
      .on('zoom', function(event: any) {
        // ZOOM-TO-CURSOR FIX: Calculate correct transform for wheel events
        // This ensures zooming happens at the cursor position, not at the canvas origin
        console.log('🎯 ZOOM EVENT FIRED:', {
          hasSourceEvent: !!event.sourceEvent,
          eventType: event.sourceEvent?.type,
          transformK: event.transform.k
        });

        if (event.sourceEvent && event.sourceEvent.type === 'wheel') {
          const container = containerRef.current;
          if (!container) return;

          // Get mouse position relative to container
          const rect = container.getBoundingClientRect();
          const mouseX = event.sourceEvent.clientX - rect.left;
          const mouseY = event.sourceEvent.clientY - rect.top;

          // Get current transform (before this zoom)
          const currentTransform = currentTransformRef.current || zoomIdentity;

          // Center offset (our coordinate system has origin at center)
          const centerX = viewportRef.current.width / 2;
          const centerY = viewportRef.current.height / 2;

          // Calculate world coordinates of the point under the mouse BEFORE zoom
          // Formula: world = (screen - center - transform.offset) / transform.scale
          const worldX = (mouseX - centerX - currentTransform.x) / currentTransform.k;
          const worldY = (mouseY - centerY - currentTransform.y) / currentTransform.k;

          // Get the new scale from the event
          const newScale = event.transform.k;

          // Calculate new transform offset to keep the world point under the mouse
          // Formula: screen = world * newScale + newOffset + center
          // Solving for newOffset: newOffset = screen - world * newScale - center
          const newX = mouseX - centerX - worldX * newScale;
          const newY = mouseY - centerY - worldY * newScale;

          // Update the transform with corrected translation
          event.transform.x = newX;
          event.transform.y = newY;

          // Verify the calculation by transforming world back to screen
          const verifyX = worldX * newScale + newX + centerX;
          const verifyY = worldY * newScale + newY + centerY;

          console.log('🔍 Zoom-to-cursor DEBUG:', {
            viewport: { width: viewportRef.current.width, height: viewportRef.current.height, centerX, centerY },
            mouseScreen: { x: mouseX.toFixed(2), y: mouseY.toFixed(2) },
            mouseClient: { x: event.sourceEvent.clientX, y: event.sourceEvent.clientY },
            rectOffset: { left: rect.left.toFixed(2), top: rect.top.toFixed(2) },
            worldCoords: { x: worldX.toFixed(2), y: worldY.toFixed(2) },
            oldTransform: { x: currentTransform.x.toFixed(2), y: currentTransform.y.toFixed(2), k: currentTransform.k.toFixed(3) },
            newTransform: { x: newX.toFixed(2), y: newY.toFixed(2), k: newScale.toFixed(3) },
            verification: {
              screenX: verifyX.toFixed(2),
              screenY: verifyY.toFixed(2),
              errorX: Math.abs(verifyX - mouseX).toFixed(2),
              errorY: Math.abs(verifyY - mouseY).toFixed(2),
              shouldBeZero: Math.abs(verifyX - mouseX) < 0.1 && Math.abs(verifyY - mouseY) < 0.1 ? '✅ CORRECT' : '❌ ERROR'
            }
          });
        }

        // Continue with regular zoom handling
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
        // Stage is centered at (width/2, height/2), so we add the transform offset to that
        if (pixiAppRef.current?.stage) {
          const centerX = viewportRef.current.width / 2;
          const centerY = viewportRef.current.height / 2;
          pixiAppRef.current.stage.x = centerX + transform.x;
          pixiAppRef.current.stage.y = centerY + transform.y;
          pixiAppRef.current.stage.scale.set(transform.k, transform.k);

          const firstNode = Array.from(enhancedNodesRef.current.values())[0];
          console.log('🎯 Zoom handler applied:', {
            transform: { x: transform.x, y: transform.y, k: transform.k },
            viewport: { width: viewportRef.current.width, height: viewportRef.current.height },
            stagePosition: { x: pixiAppRef.current.stage.x, y: pixiAppRef.current.stage.y },
            nodeCount: enhancedNodesRef.current.size,
            firstNodePosition: firstNode ? {
              x: firstNode.x,
              y: firstNode.y
            } : 'no nodes'
          });
        }

        // NOTE: Hit radius is set ONCE during node creation and NEVER updated
        // Updating hit radius during zoom causes the "snap to node center" bug
        // PIXI automatically handles scaling of hit areas based on stage transform
      });

    const selection = select(containerRef.current);
    selection.call(zoomHandler);

    // Set initial transform
    // Note: Stage is already centered at (width/2, height/2) in initializePixi,
    // so we only apply any saved pan/zoom state, not the centering offset
    const initialTransform = zoomIdentity
      .translate(viewState.pan.x || 0, viewState.pan.y || 0)
      .scale(viewState.zoom || 1);

    console.log('🚀 Setting initial D3 zoom transform:', {
      transform: { x: initialTransform.x, y: initialTransform.y, k: initialTransform.k },
      viewState: { pan: viewState.pan, zoom: viewState.zoom },
      viewport: { width: viewportRef.current.width, height: viewportRef.current.height }
    });

    selection.call(zoomHandler.transform, initialTransform);

    // Make sure the container can receive events
    if (containerRef.current) {
      containerRef.current.style.touchAction = 'none'; // Prevents browser zoom on touch devices
      // CRITICAL FIX: Ensure container is properly set up for event handling
      containerRef.current.style.position = 'relative';
      containerRef.current.style.overflow = 'hidden';
      containerRef.current.style.userSelect = 'none';

      // DEBUG: Add right-click handler to show coordinate information
      containerRef.current.addEventListener('contextmenu', (e) => {
        // Only show debug info if right-clicking on the background (not on a node)
        if (e.target !== containerRef.current?.querySelector('canvas')) {
          return; // Let PIXI handle node right-clicks
        }

        e.preventDefault();

        const rect = containerRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const currentTransform = currentTransformRef.current || zoomIdentity;
        const centerX = viewportRef.current.width / 2;
        const centerY = viewportRef.current.height / 2;

        // Calculate world coordinates
        const worldX = (mouseX - centerX - currentTransform.x) / currentTransform.k;
        const worldY = (mouseY - centerY - currentTransform.y) / currentTransform.k;

        // Calculate screen coordinates (for verification)
        const screenX = worldX * currentTransform.k + currentTransform.x + centerX;
        const screenY = worldY * currentTransform.k + currentTransform.y + centerY;

        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║              🎯 COORDINATE SYSTEM DEBUG INFO                  ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log('║ MOUSE POSITION (relative to container):');
        console.log(`║   X: ${mouseX.toFixed(2)}px, Y: ${mouseY.toFixed(2)}px`);
        console.log('║');
        console.log('║ VIEWPORT:');
        console.log(`║   Width: ${viewportRef.current.width}px, Height: ${viewportRef.current.height}px`);
        console.log(`║   Center: (${centerX}px, ${centerY}px)`);
        console.log('║');
        console.log('║ CURRENT TRANSFORM:');
        console.log(`║   Offset: (${currentTransform.x.toFixed(2)}, ${currentTransform.y.toFixed(2)})`);
        console.log(`║   Scale (zoom): ${currentTransform.k.toFixed(3)}x`);
        console.log('║');
        console.log('║ WORLD COORDINATES (graph space):');
        console.log(`║   X: ${worldX.toFixed(2)}, Y: ${worldY.toFixed(2)}`);
        console.log('║');
        console.log('║ VERIFICATION (world → screen):');
        console.log(`║   Screen X: ${screenX.toFixed(2)}px (should match ${mouseX.toFixed(2)}px)`);
        console.log(`║   Screen Y: ${screenY.toFixed(2)}px (should match ${mouseY.toFixed(2)}px)`);
        console.log(`║   Error: X=${Math.abs(screenX - mouseX).toFixed(2)}px, Y=${Math.abs(screenY - mouseY).toFixed(2)}px`);
        console.log('╚═══════════════════════════════════════════════════════════════╝');

        // Also show a visual indicator
        alert(`Cursor Position Debug:\n\n` +
              `Mouse: (${mouseX.toFixed(0)}, ${mouseY.toFixed(0)})px\n` +
              `World: (${worldX.toFixed(1)}, ${worldY.toFixed(1)})\n` +
              `Zoom: ${currentTransform.k.toFixed(2)}x\n` +
              `Transform: (${currentTransform.x.toFixed(0)}, ${currentTransform.y.toFixed(0)})\n\n` +
              `Check console for detailed debug info`);
      });
    }

    zoomBehaviorRef.current = zoomHandler;
  }, []);

  // Handle zoom events

  // Throttled frame updates (2025 best practice - prevent excessive re-renders)
  // Define BEFORE animation functions to avoid temporal dead zone
  const throttledFrameUpdate = useRef<NodeJS.Timeout | null>(null);

  const scheduleFrameUpdate = useCallback(() => {
    if (throttledFrameUpdate.current) return; // Already scheduled

    throttledFrameUpdate.current = setTimeout(() => {
      frameRef.current++;
      throttledFrameUpdate.current = null;
    }, 16); // ~60fps max
  }, []);

  // Animation control functions
  // Define stopAnimation BEFORE startAnimation to avoid hooks dependency issues
  // Pause/unpause simulation
  const toggleSimulation = useCallback(() => {
    setIsSimulationPaused(prev => {
      const newPaused = !prev;
      console.log(newPaused ? '⏸️ Pausing simulation' : '▶️ Resuming simulation');

      // CRITICAL: Update ref immediately to avoid closure issues
      isSimulationPausedRef.current = newPaused;

      if (newPaused) {
        // Pause: stop D3 simulation but keep rendering
        console.log('🛑 PAUSING: Stopping D3 simulation only (keeping visuals)');
        animationStateRef.current.isActive = false;

        // Stop D3 simulation
        if (simulationRef.current) {
          simulationRef.current.stop();
          console.log('✅ D3 simulation stopped');
        }

        // CORRECTED: Keep PIXI ticker running to show frozen nodes
        console.log('🖼️ Keeping PIXI ticker active to display frozen positions');
      } else {
        // Resume: restart D3 simulation
        console.log('▶️ RESUMING: Starting D3 simulation');
        animationStateRef.current.isActive = true;

        // Restart D3 simulation
        if (simulationRef.current) {
          simulationRef.current.alpha(0.8).restart(); // Resume with high energy
          console.log('✅ D3 simulation restarted');
        }

        // Ensure PIXI ticker is running (should already be)
        if (pixiAppRef.current?.ticker && !pixiAppRef.current.ticker.started) {
          pixiAppRef.current.ticker.start();
          console.log('✅ PIXI ticker ensured active');
        }
      }

      return newPaused;
    });
  }, []);

  const stopAnimation = useCallback(() => {
    console.log('🛑 Stopping animation and freezing layout');

    animationStateRef.current.isActive = false;
    setIsSimulationPaused(true);
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
  }, []);

  const startAnimation = useCallback((trigger: AnimationState['trigger']) => {
    console.log(`🎬 Starting ${trigger} dynamic simulation with maximum speed`);

    const state: AnimationState = {
      isActive: true,
      startTime: Date.now(),
      duration: Infinity, // Continuous until manually paused
      trigger
    };

    animationStateRef.current = state;
    setIsSimulationPaused(false);
    isSimulationPausedRef.current = false; // CRITICAL: Update ref too

    // Clear any existing timer
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }

    // NO automatic stopping - simulation runs until manually paused

    // Restart PIXI ticker if it was stopped
    if (pixiAppRef.current?.ticker && !pixiAppRef.current.ticker.started) {
      pixiAppRef.current.ticker.start();
      console.log('✅ PIXI ticker restarted for animation');
    }

    // Start the D3 simulation with maximum energy for fastest movement
    if (simulationRef.current) {
      simulationRef.current.alpha(1.0).restart(); // Maximum alpha for fastest initial movement
      console.log('🚀 D3 simulation restarted with maximum speed settings');
    }

    // Update rendering immediately
    scheduleFrameUpdate();
  }, [scheduleFrameUpdate]);

  // Manual refresh for debugging/testing - defined after startAnimation to avoid circular dependency
  const manualRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    startAnimation('manual_refresh');
  }, [startAnimation]);

  // Expose simulation controls globally for debugging/testing
  useEffect(() => {
    (window as any).toggleSimulation = toggleSimulation;
    (window as any).manualRefresh = manualRefresh;
    return () => {
      delete (window as any).toggleSimulation;
      delete (window as any).manualRefresh;
    };
  }, [toggleSimulation, manualRefresh]);


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

    // Define small, constant hit area for the container
    // CRITICAL: Keep hit radius small to prevent zoom targeting wrong location
    const visualRadius = node.screenRadius || DEFAULT_CONFIG.graph.defaultRadius;
    const hitRadius = visualRadius + 4; // Small constant for easier clicking
    node.hitBoxRadius = hitRadius; // Store for future updates
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
      text: node.artist || node.metadata?.artist || 'Unknown Artist',
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
      text: node.title || node.metadata?.title || node.metadata?.label || node.label || 'Unknown',
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

    // Enhanced interaction handlers with 2025 best practices
    const nodeId = node.id;

    // Store interaction state
    let isSelected = false;
    let isDragging = false;
    let dragStartPosition = { x: 0, y: 0 };
    let lastClickTime = 0;
    let isPointerDown = false;

    // CRITICAL FIX: Use pointerdown/pointerup for reliable click detection
    // This ensures clicks work even during animations
    container.on('pointerdown', (event) => {
      console.log(`[Event Triggered] pointerdown → node ${nodeId}`);
      isPointerDown = true;
      const now = Date.now();

      // Store drag start position for drag detection
      dragStartPosition = { x: event.globalX, y: event.globalY };
      isDragging = false;

      // Visual feedback - immediate response
      if (circle) {
        const originalTint = circle.tint;
        circle.tint = 0xFFFFFF;
        setTimeout(() => {
          if (circle) circle.tint = originalTint;
        }, 100);
      }

      event.stopPropagation();
    });

    container.on('pointerup', (event) => {
      console.log(`[Event Triggered] pointerup → node ${nodeId}`);

      if (!isPointerDown) return;
      isPointerDown = false;

      // Calculate drag distance to differentiate click from drag
      const dragDistance = Math.sqrt(
        Math.pow(event.globalX - dragStartPosition.x, 2) +
        Math.pow(event.globalY - dragStartPosition.y, 2)
      );

      // Only process as click if minimal movement (< 5 pixels)
      if (dragDistance < 5) {
        processNodeClick(event, nodeId, node);
      } else {
        console.log(`⚠️ Ignored drag (distance: ${dragDistance.toFixed(1)}px)`);
      }

      isDragging = false;

      // CRITICAL FIX: Prevent D3 zoom from handling this event
      event.stopPropagation();
    });

    container.on('pointermove', (event) => {
      if (!isPointerDown) return;

      const dragDistance = Math.sqrt(
        Math.pow(event.globalX - dragStartPosition.x, 2) +
        Math.pow(event.globalY - dragStartPosition.y, 2)
      );

      if (dragDistance > 3) {
        isDragging = true;
      }

      // CRITICAL FIX: Prevent D3 zoom pan from activating when dragging a node
      event.stopPropagation();
    });

    // Enhanced hover handling with visual feedback
    container.on('pointerenter', (event) => {
      console.log(`[Event Triggered] pointerenter → node ${nodeId}`);

      if (graph?.setHoveredNode && !isDragging) {
        graph.setHoveredNode(nodeId);

        // Visual feedback for hover
        if (circle && !isSelected) {
          circle.tint = COLOR_SCHEMES.node.hovered;
        }
      }

      // Prevent event from bubbling to D3 zoom handler
      event.stopPropagation();
    });

    container.on('pointerleave', (event) => {
      console.log(`[Event Triggered] pointerleave → node ${nodeId}`);

      if (graph?.setHoveredNode) {
        graph.setHoveredNode(null);

        // Reset visual state
        if (circle) {
          circle.tint = isSelected ? COLOR_SCHEMES.node.selected : COLOR_SCHEMES.node.default;
        }
      }

      // Prevent event from bubbling to D3 zoom handler
      event.stopPropagation();
    });

    // Enhanced right-click context menu
    container.on('rightclick', (event) => {
      console.log(`[Event Triggered] rightclick → node ${nodeId}`);
      event.preventDefault();
      event.stopPropagation();

      // Call the parent handler if provided
      if (onTrackRightClick && node.track) {
        // Convert PIXI global coordinates to DOM coordinates
        // PIXI's event.global is relative to the canvas
        const canvas = event.target.parent?.parent as any;
        const canvasRect = canvas?.view?.getBoundingClientRect?.();

        if (canvasRect) {
          const domX = canvasRect.left + event.globalX;
          const domY = canvasRect.top + event.globalY;
          onTrackRightClick(node.track, { x: domX, y: domY });
        } else {
          // Fallback to global coordinates if canvas rect not available
          onTrackRightClick(node.track, { x: event.globalX, y: event.globalY });
        }
      }

      // Show context menu with node information
      console.group('🎵 Node Context Menu');
      console.log('Track:', node.track?.name || 'Unknown');
      console.log('Artist:', node.track?.artist || 'Unknown');
      console.log('BPM:', node.track?.bpm || 'Unknown');
      console.log('Position:', { x: event.globalX, y: event.globalY });
      console.groupEnd();

      // TODO: Show visual context menu
    });

    // Main click processing function
    const processNodeClick = (event: any, nodeId: string, node: EnhancedGraphNode) => {
      const now = Date.now();

      // Debounce rapid clicks
      if (now - lastClickTime < 150) {
        console.log(`⚠️ Click debounced - too rapid (${now - lastClickTime}ms)`);
        return;
      }
      lastClickTime = now;

      console.log(`✅ Processing click for node ${nodeId}`);

      const isCtrlClick = event.ctrlKey || event.metaKey;
      const isShiftClick = event.shiftKey;

      // Handle different interaction modes
      switch (viewState.selectedTool) {
        case 'select':
          if (isCtrlClick) {
            // Multi-select: toggle this node
            isSelected = !isSelected;
            graph.toggleNodeSelection(nodeId);
            console.log(`🔸 Multi-select toggled for node ${nodeId}`);
          } else if (isShiftClick) {
            // Range select: select all nodes between last selected and this one
            console.log(`📏 Range select to node ${nodeId} (TODO)`);
            // TODO: Implement range selection
          } else {
            // Single select: clear others and select this one
            graph.clearAllSelections?.();
            isSelected = true;
            graph.toggleNodeSelection(nodeId);
            console.log(`🎯 Single select for node ${nodeId}`);
          }

          // Update visual state
          if (circle) {
            circle.tint = isSelected ? COLOR_SCHEMES.node.selected : COLOR_SCHEMES.node.default;
          }

          // CRITICAL: Trigger track modal if onTrackSelect is provided
          console.log('🔍 Checking track modal trigger:', {
            hasNode: !!node,
            hasTrack: !!(node?.track),
            hasCallback: !!onTrackSelect,
            nodeId: nodeId,
            trackName: node?.track?.name || 'N/A'
          });

          if (node?.track && onTrackSelect) {
            console.log('🎵 Opening track modal for:', node.track.name || node.track.id);
            onTrackSelect(node.track);
          } else if (!node?.track) {
            console.log('⚠️ No track data available for node:', nodeId);
          } else if (!onTrackSelect) {
            console.log('⚠️ No onTrackSelect callback provided');
          }
          break;

        case 'path':
          if (!pathfindingState.startTrackId) {
            pathfinding.setStartTrack(nodeId);
            console.log(`🚩 Set START track: ${nodeId}`);
          } else if (!pathfindingState.endTrackId && nodeId !== pathfindingState.startTrackId) {
            pathfinding.setEndTrack(nodeId);
            console.log(`🏁 Set END track: ${nodeId}`);
          } else {
            pathfinding.addWaypoint(nodeId);
            console.log(`📍 Added waypoint: ${nodeId}`);
          }
          break;

        case 'setlist':
          console.log(`📝 Add to setlist: ${nodeId}`);
          // TODO: Implement setlist functionality
          break;

        default:
          console.log(`⚠️ Unknown tool: ${viewState.selectedTool}`);
      }
    };

    // Enhanced debugging - log all attached event listeners
    console.log(`[Events Attached] Node ${node.id}:`, {
      pointerdown: container.listenerCount('pointerdown'),
      pointerup: container.listenerCount('pointerup'),
      pointermove: container.listenerCount('pointermove'),
      pointerenter: container.listenerCount('pointerenter'),
      pointerleave: container.listenerCount('pointerleave'),
      rightclick: container.listenerCount('rightclick'),
      eventMode: container.eventMode,
      cursor: container.cursor,
      hitArea: container.hitArea ? `Circle(r=${(container.hitArea as PIXI.Circle).radius})` : 'none'
    });

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

    // NOTE: Hit radius is set ONCE during node creation and NEVER updated here
    // Updating hit radius during rendering causes dynamic hit box growth
    // The hit area was already set in createNodeVisuals() and should remain static

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
    if (typeof edge.sourceNode.x !== 'number' || typeof edge.sourceNode.y !== 'number' ||
        typeof edge.targetNode.x !== 'number' || typeof edge.targetNode.y !== 'number') {
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

    // CORRECTED: Always render to show nodes, even when paused
    // Pausing should freeze movement, not hide the graph

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
      // Debug logging - check if we have nodes to render
      if (currentFrame % 120 === 0) {
        console.log(`🎨 Render check: ${enhancedNodesRef.current.size} enhanced nodes, ${nodesContainerRef.current.children.length} PIXI nodes`);

        // Sample LOD levels
        const lodSamples: Array<{id: string, x: number, y: number, lod: number, shouldRender: boolean}> = [];
        let sampleCount = 0;
        enhancedNodesRef.current.forEach(node => {
          if (sampleCount < 5) {
            const lod = lodSystem.getNodeLOD(node);
            lodSamples.push({
              id: node.id.substring(0, 20),
              x: Math.round(node.x || 0),
              y: Math.round(node.y || 0),
              lod,
              shouldRender: lod < 3
            });
            sampleCount++;
          }
        });
        console.log('📊 LOD samples:', lodSamples);
      }

      let visibleNodeCount = 0;
      enhancedNodesRef.current.forEach(node => {
        const lodLevel = lodSystem.getNodeLOD(node);
        const shouldRender = lodLevel < 3;

        if (node.pixiNode) {
          node.pixiNode.visible = shouldRender;
          node.isVisible = shouldRender;

          if (shouldRender) {
            visibleNodeCount++;
            if (node.lastUpdateFrame < currentFrame || shouldOptimize) {
              updateNodeVisuals(node, lodLevel);
            }
          }
        }
      });

      // Debug: Log visible node count
      if (currentFrame % 120 === 0) {
        console.log(`👁️ Node visibility: ${visibleNodeCount}/${enhancedNodesRef.current.size} nodes visible`);
      }
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
        title: node.title || node.metadata?.title || node.metadata?.label || node.label,
        artist: node.artist || node.metadata?.artist,
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

        // Center camera on selected node with smooth animation (2025 best practice)
        if (node && zoomBehaviorRef.current && containerRef.current) {
          const div = select(containerRef.current);
          const viewport = viewportRef.current;

          // Calculate the transform needed to center this node
          // World position (0,0) is at screen center, so we need to translate
          // to move the node to the center
          const k = currentTransformRef.current.k;

          // New pan: we want the node's world position to appear at screen center
          // Screen center is (width/2, height/2)
          // Transform formula: screenPos = (worldPos * zoom) + pan
          // We want: (width/2, height/2) = (node.x * k) + pan
          // So: pan = (width/2, height/2) - (node.x * k)
          // But since world (0,0) is already at screen center, we need:
          // pan = -(node.x * k, node.y * k)
          const newX = -(node.x * k);
          const newY = -(node.y * k);

          console.log('📸 Focusing on node with smooth animation:', {
            nodeId: nodeId,
            nodeWorldPos: { x: node.x, y: node.y },
            viewport: { width: viewport.width, height: viewport.height },
            currentZoom: k,
            newPan: { x: newX, y: newY }
          });

          // Use D3 transition for smooth animation
          // This triggers the 'zoom' event which updates PIXI stage
          div.transition()
            .duration(500)
            .ease(t => t * (2 - t)) // easeOutQuad for smooth deceleration
            .call(
              zoomBehaviorRef.current.transform,
              zoomIdentity.translate(newX, newY).scale(k)
            );

          // Add visual highlight to focused node
          if (node.pixiNode) {
            const circle = node.pixiNode.children.find(child => child instanceof PIXI.Graphics) as PIXI.Graphics | undefined;
            if (circle) {
              // Pulse animation for visual feedback
              const originalTint = circle.tint;
              circle.tint = 0x00ff00; // Green highlight
              setTimeout(() => {
                circle.tint = originalTint;
              }, 1000);
            }
          }
        }

        // Trigger track modal if track data is available
        if (node?.track && onTrackSelect) {
          console.log('🎵 Opening track modal for:', node.track.name || node.track.id);
          onTrackSelect(node.track);
        } else if (!node?.track) {
          console.log('⚠️ No track data available for node:', nodeId);
        }
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
        title: node.title || node.metadata?.title || node.metadata?.label || node.label,
        artist: node.artist || node.metadata?.artist
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

    // Re-center the stage when canvas size changes
    pixiAppRef.current.stage.position.set(rect.width / 2, rect.height / 2);

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
      console.log('🔄 New data detected - using instant positioning instead of animation');
      // NO automatic animation - instant positioning happens in updateGraphData
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

    // PRE-COMPUTE LAYOUT: Position nodes before showing them
    // This prevents LOD from culling nodes that start at random positions
    const nodes = Array.from(nodeMap.values());
    console.log('🚀 PRE-COMPUTE: Running layout pre-computation for', nodes.length, 'nodes...');
    preComputeLayout(nodes, 300); // Run 300 ticks for better convergence
    console.log('✅ PRE-COMPUTE: Layout pre-computation complete');

    // START DYNAMIC SIMULATION: Begin continuous movement
    console.log('🚀 DYNAMIC: Starting simulation with nodes for continuous movement...');

    // Update simulation with nodes/edges and START it
    simulation.nodes(nodes);
    const linkForce = simulation.force('link') as ForceLink<EnhancedGraphNode, EnhancedGraphEdge>;
    if (linkForce) {
      linkForce.links(Array.from(enhancedEdgesRef.current.values()));
    }

    // START simulation for dynamic movement
    // CRITICAL FIX: Check the ref, not the state, to avoid closure issues
    if (!isSimulationPausedRef.current) {
      simulation.alpha(1.0).restart(); // Start with maximum energy
      animationStateRef.current.isActive = true;
      console.log('✅ DYNAMIC: Simulation started with maximum speed for continuous movement');
    } else {
      console.log('⏸️ Simulation is paused - NOT restarting on data update');
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
      // NO automatic animation - use instant positioning when data loads
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
  }, [isInitialized, graphData, updateGraphData]); // Depend on actual data, not just length

  // Handle window resize
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Enhanced keyboard navigation and debugging (2025 best practices)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target && (event.target as any).tagName?.toLowerCase() === 'input') {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'd':
          // Toggle debug mode
          setShowDebugInfo(prev => {
            const newValue = !prev;
            console.log(`🐛 Debug mode ${newValue ? 'ENABLED' : 'DISABLED'}`);
            if (newValue) {
              console.group('🔍 Debug Information');
              console.log('- Total nodes:', enhancedNodesRef.current.size);
              console.log('- Selected nodes:', viewState.selectedNodes.size);
              console.log('- Hovered node:', viewState.hoveredNode);
              console.log('- Selected tool:', viewState.selectedTool);
              console.log('- Zoom level:', viewState.zoom);
              console.log('- Animation active:', animationStateRef.current.isActive);
              console.log('- Simulation paused:', isSimulationPausedRef.current);
              console.groupEnd();

              // Enable hit area debugging
              (window as any).DEBUG_HIT_AREAS = true;
            } else {
              (window as any).DEBUG_HIT_AREAS = false;
            }
            return newValue;
          });
          break;

        case 'h':
          // Show keyboard shortcuts help
          console.group('⌨️ Keyboard Shortcuts');
          console.log('D - Toggle debug mode');
          console.log('H - Show this help');
          console.log('Space - Pause/resume animation');
          console.log('Escape - Clear selection');
          console.log('A - Select all visible nodes');
          console.log('Tab - Navigate between selected nodes');
          console.log('Enter - Open track modal for focused node');
          console.log('Arrow Keys - Pan viewport');
          console.log('+ / - - Zoom in/out');
          console.groupEnd();
          break;

        case ' ':
          // Space bar - pause/resume animation
          event.preventDefault();
          const wasPaused = isSimulationPausedRef.current;
          isSimulationPausedRef.current = !wasPaused;
          console.log(`⏯️ Animation ${wasPaused ? 'RESUMED' : 'PAUSED'}`);
          break;

        case 'escape':
          // Clear all selections
          graph.clearAllSelections?.();
          console.log('🚫 All selections cleared');
          break;

        case 'a':
          if (event.ctrlKey || event.metaKey) {
            // Ctrl+A - Select all visible nodes
            event.preventDefault();
            const visibleNodes = Array.from(enhancedNodesRef.current.values())
              .filter(node => node.isVisible);

            visibleNodes.forEach(node => {
              graph.toggleNodeSelection(node.id);
            });
            console.log(`📋 Selected ${visibleNodes.length} visible nodes`);
          }
          break;

        case 'tab':
          // Tab navigation between selected nodes
          event.preventDefault();
          const selectedNodes = Array.from(viewState.selectedNodes);
          if (selectedNodes.length > 0) {
            // TODO: Implement focus cycling between selected nodes
            console.log('🔄 Tab navigation (TODO)');
          }
          break;

        case 'enter':
          // Enter - open track modal for focused node
          if (viewState.hoveredNode) {
            const node = enhancedNodesRef.current.get(viewState.hoveredNode);
            if (node?.track && onTrackSelect) {
              console.log('⏎ Opening track modal via keyboard');
              onTrackSelect(node.track);
            }
          }
          break;

        // Viewport navigation with arrow keys
        case 'arrowup':
        case 'arrowdown':
        case 'arrowleft':
        case 'arrowright':
          event.preventDefault();
          // TODO: Implement viewport panning
          console.log(`🧭 Arrow key navigation: ${event.key} (TODO)`);
          break;

        case '+':
        case '=':
          // Zoom in
          event.preventDefault();
          console.log('🔍 Zoom in (TODO)');
          break;

        case '-':
        case '_':
          // Zoom out
          event.preventDefault();
          console.log('🔍 Zoom out (TODO)');
          break;

        default:
          // Log unhandled keys for debugging
          if (showDebugInfo) {
            console.log(`⌨️ Unhandled key: ${event.key}`);
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState, showDebugInfo, graph, onTrackSelect]);

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

      {/* Controls moved to main toolbar - keeping this comment for reference */}

      {/* Energy-Genre Layout Controls */}
      <div className="absolute top-4 right-4 bg-black/80 text-gray-200 p-4 rounded-lg font-sans text-sm w-80">
        <div className="mb-3 text-cyan-400 font-bold flex items-center gap-2">
          <span>🎵</span>
          <span>Layout Mode</span>
        </div>

        {/* Layout Mode Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forceSettings.layoutMode === 'energy-genre'}
              onChange={(e) => {
                const newMode = e.target.checked ? 'energy-genre' : 'standard';
                setForceSettings(prev => ({ ...prev, layoutMode: newMode }));

                // Reinitialize simulation with new mode
                if (simulationRef.current) {
                  simulationRef.current.stop();
                  initializeSimulation();
                  simulationRef.current.nodes(Array.from(enhancedNodesRef.current.values()));
                  const linkForce = simulationRef.current.force('link') as ForceLink<EnhancedGraphNode, EnhancedGraphEdge>;
                  if (linkForce) {
                    linkForce.links(enhancedEdgesRef.current);
                  }
                  simulationRef.current.alpha(1).restart();
                }
              }}
              className="rounded"
            />
            <span className={forceSettings.layoutMode === 'energy-genre' ? 'text-green-400' : 'text-gray-400'}>
              Energy vs. Genre Layout
            </span>
          </label>
        </div>

        {/* Force Strength Controls */}
        {forceSettings.layoutMode === 'energy-genre' && (
          <div className="space-y-3">
            {/* Energy Strength */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Energy Strength: {forceSettings.energyStrength.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.05"
                max="0.3"
                step="0.01"
                value={forceSettings.energyStrength}
                onChange={(e) => setForceSettings(prev => ({ ...prev, energyStrength: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">Low energy ← → High energy</div>
            </div>

            {/* Genre Clustering Strength */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Genre Clustering: {forceSettings.genreStrength.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.02"
                max="0.2"
                step="0.01"
                value={forceSettings.genreStrength}
                onChange={(e) => setForceSettings(prev => ({ ...prev, genreStrength: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">Groups tracks by genre</div>
            </div>

            {/* Link Strength */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Link Elasticity: {forceSettings.linkStrength.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={forceSettings.linkStrength}
                onChange={(e) => setForceSettings(prev => ({ ...prev, linkStrength: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">Lower = more stretchy edges</div>
            </div>

            {/* Apply Button */}
            <button
              onClick={() => {
                if (simulationRef.current) {
                  simulationRef.current.stop();
                  initializeSimulation();
                  simulationRef.current.nodes(Array.from(enhancedNodesRef.current.values()));
                  const linkForce = simulationRef.current.force('link') as ForceLink<EnhancedGraphNode, EnhancedGraphEdge>;
                  if (linkForce) {
                    linkForce.links(enhancedEdgesRef.current);
                  }
                  simulationRef.current.alpha(1).restart();
                }
              }}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition-colors"
            >
              Apply Changes
            </button>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-2">Genre Colors:</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#3498db'}}></div>
                  <span>House</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#9b59b6'}}></div>
                  <span>Techno</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#e74c3c'}}></div>
                  <span>Trance</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#2ecc71'}}></div>
                  <span>EDM</span>
                </div>
              </div>
            </div>
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
            <div className="text-xs">• Paused: {isSimulationPaused ? 'YES' : 'NO'}</div>
            <div className="text-xs">• Trigger: {animationStateRef.current.trigger}</div>
            <div className="text-xs">• Alpha: {simulationRef.current?.alpha()?.toFixed(3) || 'N/A'}</div>
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