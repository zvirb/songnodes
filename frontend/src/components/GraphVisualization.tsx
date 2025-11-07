import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
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
import { zoom, zoomIdentity, zoomTransform, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition'; // Adds .transition() method to selections
import useStore from '../store/useStore';
import { GraphNode, GraphEdge, DEFAULT_CONFIG, Bounds, Track } from '../types';
import { ContextMenu, useContextMenu } from './ContextMenu';
// import { GraphMiniMap } from './GraphMiniMap'; // DISABLED: Minimap commented out

// Performance constants - updated for 2025 best practices
const PERFORMANCE_THRESHOLDS = {
  NODE_COUNT_HIGH: 5000,  // ✅ FIX: Increased from 2000 to match new 4x larger spacing
  NODE_COUNT_MEDIUM: 2500,  // ✅ FIX: Increased from 1000 to keep labels visible longer
  EDGE_COUNT_HIGH: 12000,  // ✅ FIX: Increased proportionally
  EDGE_COUNT_MEDIUM: 7000,  // ✅ FIX: Increased proportionally
  // Removed CULL_DISTANCE - using proper viewport bounds instead
  LOD_DISTANCE_1: 400, // Screen-space distance for detail levels
  LOD_DISTANCE_2: 800, // Screen-space distance for detail levels
  MIN_NODE_SIZE: 2,
  MAX_NODE_SIZE: 32,
  MIN_EDGE_WIDTH: 1,
  MAX_EDGE_WIDTH: 8,
  VIEWPORT_BUFFER: 400, // Pixels buffer for smooth culling transitions (doubled in LOD calculations)
} as const;

// Debug flag - set to true to enable LOD debugging
const DEBUG_LOD = false;

// Color schemes
const COLOR_SCHEMES = {
  node: {
    default: 0x4a90e2,
    selected: 0xff6b35,      // Orange - regular selection
    hovered: 0x7ed321,        // Green - hover state
    nowPlaying: 0xff1744,     // Bright red - currently playing track
    path: 0x9013fe,           // Purple - nodes in calculated path
    waypoint: 0xf5a623,       // Amber - intermediate waypoints
    startPoint: 0x00ff00,     // Bright green - path start
    endPoint: 0xff0000,       // Bright red - path end/destination
  },
  edge: {
    default: 0x8e8e93,
    selected: 0xff6b35,
    path: 0xff1744,           // Bright red - edges in calculated path (more visible)
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

// Force simulation settings
interface ForceSettings {
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
  pixiCircle?: PIXI.Graphics | PIXI.Sprite; // Support both Graphics and Sprite
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
  // GPU optimization: Track last rendered positions to avoid redundant redraws
  lastSourceX?: number;
  lastSourceY?: number;
  lastTargetX?: number;
  lastTargetY?: number;
  lastPathState?: boolean; // Track if edge was in path
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
    // ✅ CRITICAL FIX: Proper coordinate transformation for PIXI centered stage
    // The PIXI stage is centered at (width/2, height/2) with scale applied
    // D3 zoom transform provides: k (zoom), x (pan x), y (pan y)
    // Screen position = (world position * zoom) + pan offset
    // Since PIXI stage origin is at center, we need to account for that

    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;

    // Transform world coordinates to screen space
    // The viewport.x and viewport.y are already D3's transform.x and transform.y
    const screenX = (node.x ?? 0) * this.viewport.zoom + this.viewport.x + centerX;
    const screenY = (node.y ?? 0) * this.viewport.zoom + this.viewport.y + centerY;

    // Optional debug logging
    //if (DEBUG_LOD && Math.random() < 0.001) { // Log ~0.1% of checks
    //  console.log('LOD Check:', {
    //    nodeId: node.id.substring(0, 20),
    //    world: { x: node.x, y: node.y },
    //    screen: { x: Math.round(screenX), y: Math.round(screenY) },
    //    viewport: { w: this.viewport.width, h: this.viewport.height, zoom: this.viewport.zoom.toFixed(2) }
    //  });
    //}

    // Define screen bounds with generous buffer for smooth transitions
    // Increased buffer to prevent premature culling at edges
    const buffer = PERFORMANCE_THRESHOLDS.VIEWPORT_BUFFER * 2; // Double buffer for safety
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

    // ✅ FIX: More conservative LOD thresholds to prevent premature detail reduction
    // Use screen-space distance thresholds that scale with viewport size
    const screenDiagonal = Math.sqrt(this.viewport.width * this.viewport.width + this.viewport.height * this.viewport.height);
    const normalizedDistance = distanceFromCenter / screenDiagonal;

    // More generous thresholds - reduced detail only when really far from center
    // This prevents labels from disappearing when they're still clearly visible
    let threshold1 = 0.5; // ~50% of diagonal for reduced detail (was 0.4)
    let threshold2 = 0.9; // ~90% of diagonal for minimal detail (was 0.8)

    // Only reduce thresholds for VERY large graphs to maintain visual quality
    if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_HIGH * 2) { // 10000+ nodes
      threshold1 *= 0.85; // ✅ FIX: Less aggressive (was 0.7) with new spacing
      threshold2 *= 0.9;  // ✅ FIX: Less aggressive (was 0.8) with new spacing
    } else if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_HIGH) { // 5000-10000 nodes
      threshold1 *= 0.95; // ✅ FIX: Much less aggressive (was 0.85) to keep labels visible
      threshold2 *= 0.95; // ✅ FIX: Much less aggressive (was 0.9) to keep labels visible
    }
    // For < 1000 nodes, use full generous thresholds

    if (normalizedDistance > threshold2) {
      return 2; // Minimal detail - very far from center (no labels, but still visible)
    } else if (normalizedDistance > threshold1) {
      return 1; // Reduced detail - medium distance (labels may hide)
    } else {
      return 0; // Full detail - near center (all details visible)
    }
  }

  getEdgeLOD(edge: EnhancedGraphEdge): number {
    // ✅ IMPROVED: Edge LOD based on endpoint visibility
    // Handle case where source/target might still be IDs (before D3 processing)
    const source = typeof edge.source === 'object' ? edge.source : null;
    const target = typeof edge.target === 'object' ? edge.target : null;

    if (!source || !target) {
      return 0; // Default to full detail if nodes aren't resolved yet
    }

    const sourceLOD = this.getNodeLOD(source);
    const targetLOD = this.getNodeLOD(target);

    // ✅ FIX: Only cull edge if BOTH endpoints are culled (LOD 3)
    // This keeps edges visible when they connect to visible nodes at screen edges
    if (sourceLOD === 3 && targetLOD === 3) {
      return 3; // Both endpoints off-screen, safe to cull edge
    }

    // If at least one endpoint is visible (LOD < 3), show the edge
    // Use the MINIMUM LOD to keep edges more visible (was using MAX)
    // This ensures edges to nearby nodes are rendered with full detail
    return Math.min(sourceLOD, targetLOD);
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

  findNearest(x: number, y: number, maxRadius: number = 20): EnhancedGraphNode | null {
    const cellX = Math.floor(x / this.gridSize);
    const cellY = Math.floor(y / this.gridSize);
    let nearest: EnhancedGraphNode | null = null;
    let minDistance = Infinity;

    // ✅ PERFORMANCE FIX: Adaptive search with configurable max radius
    // Continue expanding search until we find at least one candidate, then check one more ring
    let foundCandidate = false;

    for (let radius = 0; radius <= maxRadius; radius++) {
      const candidates: EnhancedGraphNode[] = [];

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Only check the ring (perimeter) for radius > 0
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
          foundCandidate = true;
        }
      }

      // If we found a candidate in this ring, check one more ring to ensure no closer node
      if (foundCandidate && radius > 0) {
        // Check one more ring for safety, then exit
        if (nearest && minDistance < this.gridSize * radius) break;
      }
    }

    return nearest;
  }

  rebuild(nodes: EnhancedGraphNode[]): void {
    this.clear();
    nodes.forEach(node => this.add(node));
  }
}

// Texture Atlas Generator for sprite-based rendering (2025 optimization)
class TextureAtlasGenerator {
  private textures: Map<string, PIXI.Texture> = new Map();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
  }

  // Generate a circular node texture with given color and radius
  generateNodeTexture(color: number, radius: number, selected: boolean = false): PIXI.Texture {
    // OPTIMIZATION: Round radius to nearest integer to improve cache hit rate
    const roundedRadius = Math.round(radius);
    const key = `node_${color}_${roundedRadius}_${selected}`;

    if (this.textures.has(key)) {
      return this.textures.get(key)!;
    }

    // Create a dedicated canvas for this texture (better quality)
    const size = Math.ceil(roundedRadius * 2 + 8); // Extra space for outline
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d')!;

    const centerX = size / 2;
    const centerY = size / 2;

    // Draw selection outline if selected
    if (selected) {
      tempCtx.beginPath();
      tempCtx.arc(centerX, centerY, roundedRadius + 2, 0, Math.PI * 2);
      tempCtx.strokeStyle = `#${COLOR_SCHEMES.node.selected.toString(16).padStart(6, '0')}`;
      tempCtx.lineWidth = 2;
      tempCtx.stroke();
    }

    // Draw main circle
    tempCtx.beginPath();
    tempCtx.arc(centerX, centerY, roundedRadius, 0, Math.PI * 2);
    tempCtx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    tempCtx.fill();

    // Create PIXI texture from canvas
    const texture = PIXI.Texture.from(tempCanvas);
    this.textures.set(key, texture);

    return texture;
  }

  // Generate a glow texture (GPU-optimized cached sprite)
  generateGlowTexture(radius: number, color: number = 0x7ed321): PIXI.Texture {
    // OPTIMIZATION: Round radius to improve cache hit rate
    const roundedRadius = Math.round(radius);
    const key = `glow_${roundedRadius}_${color}`;

    if (this.textures.has(key)) {
      return this.textures.get(key)!;
    }

    // Create canvas for glow effect
    const glowRadius = roundedRadius + 6;
    const size = Math.ceil(glowRadius * 2 + 4);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d')!;

    const centerX = size / 2;
    const centerY = size / 2;

    // Create radial gradient for soft glow
    const gradient = tempCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    gradient.addColorStop(0, `${colorHex}4D`); // 30% opacity at center
    gradient.addColorStop(0.5, `${colorHex}26`); // 15% opacity mid
    gradient.addColorStop(1, `${colorHex}00`); // 0% opacity at edge

    // Draw glow circle with gradient
    tempCtx.beginPath();
    tempCtx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    tempCtx.fillStyle = gradient;
    tempCtx.fill();

    // Create PIXI texture from canvas
    const texture = PIXI.Texture.from(tempCanvas);
    this.textures.set(key, texture);

    return texture;
  }

  // Pre-generate common textures to avoid runtime overhead
  preGenerateTextures(colors: number[], radii: number[]): void {
    let count = 0;

    for (const color of colors) {
      for (const radius of radii) {
        this.generateNodeTexture(color, radius, false);
        this.generateNodeTexture(color, radius, true);
        count += 2;
      }
    }

    // DEBUG: Texture generation logging disabled (too noisy)
    // if (process.env.NODE_ENV === 'development') {
    //   console.log(`✅ Generated ${count} textures`);
    // }
  }

  destroy(): void {
    this.textures.forEach(texture => texture.destroy(true));
    this.textures.clear();
  }
}

// ✅ REMOVED: TextLabelPool class - pooling was disabled for stability
// Labels are now created directly in createPixiNode without pooling overhead
// If pooling is needed in future, re-implement with proper lifecycle management

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
  highlightedNodeIds?: Set<string>;  // NEW: Nodes to highlight (e.g., reachable nodes)
  highlightColor?: number;  // NEW: Color for highlighted nodes (default: yellow)
}

export const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  onTrackSelect,
  onTrackRightClick,
  highlightedNodeIds,
  highlightColor = 0xFFFF00  // Yellow default
}) => {
  // Store hooks
  const {
    graphData,
    viewState,
    pathfindingState,
    graph,
    pathfinding,
    performance: performanceStore,
    performanceMetrics,
    view,
    simulation,
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
  const textureAtlasRef = useRef<TextureAtlasGenerator | null>(null);
  // ✅ REMOVED: textLabelPoolRef - pooling was disabled, direct creation is cleaner

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
  const graphDataRef = useRef(graphData); // Stable ref to break dependency cycles

  // Render state
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [animationTimer, setAnimationTimer] = useState<number>(0);
  const [mainGraphWidth, setMainGraphWidth] = useState(0); // State for main graph width
  const [mainGraphHeight, setMainGraphHeight] = useState(0); // State for main graph height

  // Force layout settings for standard visualization
  const [forceSettings, setForceSettings] = useState<ForceSettings>({
    linkStrength: 1.0,   // D3 auto-calculates, this is ignored
    linkDistance: 120,   // Maximum distance for weight=1
  });

  // Sprite-based rendering mode (2025 optimization - enabled by default for better performance)
  const [useSpriteMode, setUseSpriteMode] = useState(true);

  // Context menu for layout mode and options
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();
  const frameRef = useRef<number>(0);
  const lastRenderFrame = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0); // For render throttling

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

  // Navigation state - track current focused node index for Tab cycling
  const focusedNodeIndexRef = useRef<number>(0);

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
    const { currentPath, startTrackId, endTrackId } = pathfindingState;

    // Create sets for efficient lookup from the final, calculated path
    const pathNodeIds = new Set(currentPath?.path.map(p => p.track.id) || []);
    const waypointIds = new Set(currentPath?.waypoints_visited || []);

    // Pathfinding states take highest priority
    if (node.id === startTrackId) return COLOR_SCHEMES.node.startPoint;
    if (node.id === endTrackId) return COLOR_SCHEMES.node.endPoint;
    if (waypointIds.has(node.id)) return COLOR_SCHEMES.node.waypoint;
    if (pathNodeIds.has(node.id)) return COLOR_SCHEMES.node.path;

    // Regular selection states
    if (viewState.selectedNodes.has(node.id)) {
      return COLOR_SCHEMES.node.selected;
    }
    if (viewState.hoveredNode === node.id) {
      return COLOR_SCHEMES.node.hovered;
    }

    // Highlighted nodes (connectivity visualization) - check both props and store
    const highlightedNodes = highlightedNodeIds || viewState.highlightedNodes;
    if (highlightedNodes && highlightedNodes.has(node.id)) {
      return highlightColor;
    }

    // Fallback to default color
    return COLOR_SCHEMES.node.default;
  }, [viewState.selectedNodes, viewState.hoveredNode, viewState.highlightedNodes, pathfindingState, highlightedNodeIds, highlightColor]);

  const getEdgeColor = useCallback((edge: EnhancedGraphEdge): number => {
    // Check if edge is part of the pathfinding result
    if (pathfindingState.currentPath?.path.some((p, i) => {
      const next = pathfindingState.currentPath!.path[i + 1];
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
      return next && (
        (p.track.id === sourceId && next.track.id === targetId) ||
        (p.track.id === targetId && next.track.id === sourceId)
      );
    })) {
      return COLOR_SCHEMES.edge.path;
    }

    // Check if either source or target node is selected
    const isSourceSelected = viewState.selectedNodes.has(
      typeof edge.source === 'object' ? edge.source.id : edge.source
    );
    const isTargetSelected = viewState.selectedNodes.has(
      typeof edge.target === 'object' ? edge.target.id : edge.target
    );

    if (isSourceSelected || isTargetSelected) {
      return COLOR_SCHEMES.edge.selected; // Highlight if connected to a selected node
    }

    // Default color logic
    if (edge.weight > 0.7) {
      return COLOR_SCHEMES.edge.strong;
    }
    return COLOR_SCHEMES.edge.default;
  }, [pathfindingState, viewState.selectedNodes]); // Added viewState.selectedNodes to dependencies

  // Initialize PIXI application
  const initializePixi = useCallback(async () => {
    if (!containerRef.current || pixiAppRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // DEBUG: Container debug logging disabled (too noisy)
    // console.log('Container debug info:', {
    //   container,
    //   containerChildren: container.children.length,
    //   containerStyle: {
    //     width: container.style.width,
    //     height: container.style.height,
    //     display: container.style.display,
    //     position: container.style.position,
    //   },
    //   containerClasses: container.className,
    //   containerId: container.id,
    //   parentElement: container.parentElement,
    //   boundingRect: rect,
    //   offsetDimensions: {
    //     width: container.offsetWidth,
    //     height: container.offsetHeight
    //   },
    //   clientDimensions: {
    //     width: container.clientWidth,
    //     height: container.clientHeight
    //   }
    // });

    // Check if container has zero dimensions
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Container has zero dimensions, delaying PIXI initialization');
      setTimeout(() => initializePixi(), 100);
      return;
    }

    try {
      // DEBUG: PIXI initialization logging disabled (too noisy)
      // console.log('Initializing PIXI.js application...', {
      //   containerWidth: rect.width,
      //   containerHeight: rect.height,
      //   devicePixelRatio: window.devicePixelRatio
      // });

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
      const gl = (app.renderer as any).gl;
      if (gl) {
        // DEBUG: WebGL context logging disabled (too noisy)
        // console.log('WebGL context initialized', {
        //   vendor: gl.getParameter(gl.VENDOR),
        //   renderer: gl.getParameter(gl.RENDERER),
        //   version: gl.getParameter(gl.VERSION),
        //   maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        //   maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
        // });

        // Monitor initial WebGL memory state
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          // DEBUG: GPU info logging disabled (too noisy)
          // console.log('GPU info:', {
          //   vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
          //   renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          // });
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

      // DEBUG: Canvas DOM state logging disabled (too noisy)
      // console.log('Canvas DOM state after append:', {
      //   canvasParent: canvas.parentElement,
      //   canvasInDocument: document.contains(canvas),
      //   canvasStyle: {
      //     position: canvas.style.position,
      //     top: canvas.style.top,
      //     left: canvas.style.left,
      //     width: canvas.style.width,
      //     height: canvas.style.height,
      //     display: canvas.style.display,
      //     visibility: canvas.style.visibility,
      //     opacity: canvas.style.opacity,
      //     zIndex: canvas.style.zIndex
      //   },
      //   canvasComputedStyle: {
      //     display: window.getComputedStyle(canvas).display,
      //     visibility: window.getComputedStyle(canvas).visibility,
      //     opacity: window.getComputedStyle(canvas).opacity
      //   },
      //   containerRect: container.getBoundingClientRect(),
      //   canvasRect: canvas.getBoundingClientRect()
      // });

      // DEBUG: PIXI initialization success logging disabled (too noisy)
      // console.log('PIXI.js application initialized successfully', {
      //   canvasElement: canvas,
      //   canvasWidth: canvas.width,
      //   canvasHeight: canvas.height,
      //   canvasStyleWidth: canvas.style.width,
      //   canvasStyleHeight: canvas.style.height,
      //   rendererType: app.renderer.type,
      //   pixiVersion: PIXI.VERSION,
      //   container: container,
      //   containerChildren: container.children.length
      // });

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
    // DEBUG: Stage centering logging disabled (too noisy)
    // console.log(`Centered stage at (${rect.width / 2}, ${rect.height / 2})`);

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
    // DEBUG: Background visual logging disabled (too noisy)
    // console.log('Added background visual to PIXI stage (offset for centered stage)');

    // Update viewport dimensions
    viewportRef.current.width = rect.width;
    viewportRef.current.height = rect.height;

    // Set initial main graph dimensions for mini-map
    setMainGraphWidth(rect.width);
    setMainGraphHeight(rect.height);

    // Initialize LOD system
    lodSystemRef.current = new LODSystem(viewportRef.current);

    // Initialize texture atlas for sprite-based rendering (2025 optimization)
    textureAtlasRef.current = new TextureAtlasGenerator();

    // Pre-generate common node textures for instant sprite creation
    const commonColors = [
      ...Object.values(COLOR_SCHEMES.node),
      ...Object.values(COLOR_SCHEMES.genre),
    ];
    const commonRadii = [DEFAULT_CONFIG.graph.defaultRadius, 8, 12, 16];
    textureAtlasRef.current.preGenerateTextures(commonColors, commonRadii);

    // ✅ REMOVED: TextLabelPool initialization - pooling disabled
    // Labels are created directly in createPixiNode for simplicity and stability

    // Start render loop
    app.ticker.add(renderFrame);
    // DEBUG: PIXI ticker start logging disabled (too noisy)
    // console.log('Started PIXI render loop with ticker');

    // Force an initial render to show test visuals
    app.render();
    // DEBUG: Initial render logging disabled (too noisy)
    // console.log('Forced initial PIXI render');

    setIsInitialized(true);
    // DEBUG: PIXI initialization complete logging disabled (too noisy)
    // console.log('PIXI initialization complete, isInitialized set to true');

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
  }, [setMainGraphWidth, setMainGraphHeight]);

  // Handle D3 simulation tick with throttling
  const lastSimulationTickRef = useRef<number>(0);
  const handleSimulationTick = useCallback(() => {
    // CRITICAL FIX: Early exit if nodes map doesn't exist or is cleared
    if (!enhancedNodesRef.current || enhancedNodesRef.current.size === 0) {
      return;
    }

    // CRITICAL FIX: Check ref instead of state to avoid closure issues
    if (isSimulationPausedRef.current) {
      // Simulation is paused, don't update positions (but keep rendering current positions)
      return;
    }

    if (!animationStateRef.current.isActive) {
      // Animation not active, don't update positions
      return;
    }

    // PERFORMANCE OPTIMIZATION: Aggressive throttling for large graphs
    // 10fps for 1000+ nodes, 15fps for 500+ nodes, 20fps for 200+ nodes
    const currentTime = performance.now();
    const nodeCount = enhancedNodesRef.current.size;
    let minTickInterval = 50; // 20fps default

    if (nodeCount > 1000) {
      minTickInterval = 100; // 10fps for very large graphs
    } else if (nodeCount > 500) {
      minTickInterval = 66; // 15fps for large graphs
    }

    if (nodeCount > 200 && currentTime - lastSimulationTickRef.current < minTickInterval) {
      return; // Skip this tick
    }
    lastSimulationTickRef.current = currentTime;

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

    // Update simulation alpha in store for minimap optimization
    if (simulationRef.current) {
      const currentAlpha = simulationRef.current.alpha();
      simulation.updateSimulationAlpha(currentAlpha);
    }

    // Mark for re-render
    frameRef.current++;
  }, [graph, simulation]);

  // Handle simulation end
  const handleSimulationEnd = useCallback(() => {
    console.log('✅ Force simulation settled - layout is now stable');

    // Mark simulation as paused/settled
    isSimulationPausedRef.current = true;
    setIsSimulationPaused(true);

    // Ensure animation state reflects settled state
    animationStateRef.current.isActive = false;

    // Update store to indicate simulation has settled (for minimap optimization)
    simulation.setSimulationSettled(true);
  }, [simulation]);

  // ═══════════════════════════════════════════════════════════════════════
  // CLEAN SLATE: D3.js Defaults + Minimal Smart Modifications
  // Strategy: Start with proven D3 defaults, add ONLY what's needed
  // ═══════════════════════════════════════════════════════════════════════
  const initializeSimulation = useCallback(() => {
    const simulation = forceSimulation<EnhancedGraphNode, EnhancedGraphEdge>()

      // ──────────────────────────────────────────────────────────────────
      // 1. LINK FORCE: Weight-based distance for cluster separation
      // ──────────────────────────────────────────────────────────────────
      .force('link', forceLink<EnhancedGraphNode, EnhancedGraphEdge>()
        .id(d => d.id)
        .distance(d => {
          // Exponential scaling for more dramatic weight differences
          const weight = d.weight || 1;
          // ✅ REFINEMENT: Even larger distances for cleaner, less messy graph
          // Strong edges (weight 10): 150px apart (tight clusters with clear separation)
          // Medium edges (weight 5): 525px apart
          // Weak edges (weight 1): 900px apart (dramatic separation)
          const minDist = 150;
          const maxDist = 900;
          const normalizedWeight = Math.min(weight / 10, 1.0);
          return maxDist - (normalizedWeight * normalizedWeight * (maxDist - minDist));
        })
        .strength(d => {
          // ✅ REFINEMENT: Reduced link strength for more elasticity/flexibility
          const weight = d.weight || 1;
          const normalizedWeight = Math.min(weight / 10, 1.0);
          return normalizedWeight * 0.6 + 0.1; // Range: 0.1 to 0.7 (more flexible)
        })
      )

      // ──────────────────────────────────────────────────────────────────
      // 2. CHARGE FORCE: Stronger repulsion for better node distribution
      // ──────────────────────────────────────────────────────────────────
      .force('charge', forceManyBody<EnhancedGraphNode>()
        .strength(-2500)  // ✅ REFINEMENT: 5x stronger repulsion (was -500) for cleaner graph
        .distanceMax(2500)  // ✅ REFINEMENT: 5x larger repulsion range for dramatic separation
        // D3 defaults for distanceMin, theta - KEEP THEM
      )

      // ──────────────────────────────────────────────────────────────────
      // 3. COLLISION: Prevent overlap
      // ──────────────────────────────────────────────────────────────────
      .force('collision', forceCollide<EnhancedGraphNode>()
        .radius(d => (d.radius || 8) + 50)  // ✅ REFINEMENT: Even larger padding (~58px total)
        // D3 defaults for strength and iterations - KEEP THEM
      )

      // ──────────────────────────────────────────────────────────────────
      // 4. CENTER FORCE: Weak centering to prevent linear spreading
      // ──────────────────────────────────────────────────────────────────
      .force('center', forceCenter<EnhancedGraphNode>(0, 0).strength(0.02))

      // ──────────────────────────────────────────────────────────────────
      // 5. EDGE REPULSION: Spread edges evenly around nodes
      // ──────────────────────────────────────────────────────────────────
      .force('edgeRepulsion', (alpha) => {
        // Custom force: edges that share a node repel each other
        // This creates more even distribution of edges around a node
        const edges = Array.from(enhancedEdgesRef.current.values());
        const edgeRepulsionStrength = 15; // Moderate repulsion force
        const maxRepulsionDistance = 100; // Only repel nearby edges

        // Build adjacency map: node -> array of connected edges
        const nodeToEdges = new Map<string, EnhancedGraphEdge[]>();
        edges.forEach(edge => {
          const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

          if (!nodeToEdges.has(sourceId)) nodeToEdges.set(sourceId, []);
          if (!nodeToEdges.has(targetId)) nodeToEdges.set(targetId, []);

          nodeToEdges.get(sourceId)!.push(edge);
          nodeToEdges.get(targetId)!.push(edge);
        });

        // For each node with multiple edges, apply repulsion between those edges
        nodeToEdges.forEach((nodeEdges, nodeId) => {
          if (nodeEdges.length < 2) return; // Need at least 2 edges to repel

          // Compare each pair of edges connected to this node
          for (let i = 0; i < nodeEdges.length; i++) {
            for (let j = i + 1; j < nodeEdges.length; j++) {
              const edge1 = nodeEdges[i];
              const edge2 = nodeEdges[j];

              // Get the "other" node for each edge (the one not matching nodeId)
              const source1 = typeof edge1.source === 'object' ? edge1.source : enhancedNodesRef.current.get(edge1.source);
              const target1 = typeof edge1.target === 'object' ? edge1.target : enhancedNodesRef.current.get(edge1.target);
              const source2 = typeof edge2.source === 'object' ? edge2.source : enhancedNodesRef.current.get(edge2.source);
              const target2 = typeof edge2.target === 'object' ? edge2.target : enhancedNodesRef.current.get(edge2.target);

              if (!source1 || !target1 || !source2 || !target2) continue;

              // Get the endpoints opposite to the shared node
              const otherNode1 = source1.id === nodeId ? target1 : source1;
              const otherNode2 = source2.id === nodeId ? target2 : source2;

              // Calculate distance between the "other" endpoints
              const dx = (otherNode2.x || 0) - (otherNode1.x || 0);
              const dy = (otherNode2.y || 0) - (otherNode1.y || 0);
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance === 0 || distance > maxRepulsionDistance) continue;

              // Apply repulsive force proportional to 1/distance
              // Closer edges repel more strongly
              const force = (edgeRepulsionStrength * alpha) / (distance * distance);
              const fx = (dx / distance) * force;
              const fy = (dy / distance) * force;

              // Apply force to the "other" nodes (push them apart)
              if (otherNode1.vx !== undefined && otherNode1.vy !== undefined) {
                otherNode1.vx -= fx;
                otherNode1.vy -= fy;
              }
              if (otherNode2.vx !== undefined && otherNode2.vy !== undefined) {
                otherNode2.vx += fx;
                otherNode2.vy += fy;
              }
            }
          }
        });
      })

      // ✅ REMOVED: edgeAvoidance force - O(N×E) complexity was causing severe performance issues
      // The combination of forceManyBody (charge) + forceCollide provides sufficient node separation
      // For graphs with 1000 nodes and 3000 edges, this eliminates 3M calculations per tick!

      // ──────────────────────────────────────────────────────────────────
      // 6. TIMING: Extended settling (30 seconds for cluster formation)
      // ──────────────────────────────────────────────────────────────────
      .velocityDecay(0.4)    // Lower friction allows more exploration
      .alphaDecay(0.004)     // Slower cooldown = ~1800 iterations (~30 seconds @ 60fps)
      .alphaMin(0.001);      // Standard threshold - simulation stops when alpha < this

    // No additional modifications - let the forces work naturally

    simulation.on('tick', handleSimulationTick);
    simulation.on('end', handleSimulationEnd);

    simulationRef.current = simulation;
    return simulation;
  }, [handleSimulationTick, handleSimulationEnd, forceSettings]);

  // Fast pre-computation method using manual ticks for accurate positioning
  const preComputeLayout = useCallback((nodes: EnhancedGraphNode[], maxTicks = 100) => {
    // ✅ OPTIMIZATION NOTE: This runs synchronously but is already optimized:
    // - Limited to 50 ticks (called with maxTicks=50 from updateGraphData)
    // - Only runs on new nodes in incremental updates
    // - Uses high friction (0.7) and fast cooldown (0.1) for quick convergence
    // For graphs > 5000 nodes, consider moving to a Web Worker for true non-blocking

    // Create a separate simulation for pre-computation (OPTIMIZED: simplified forces)
    const preSimulation = forceSimulation<EnhancedGraphNode>(nodes)
      .force('link', forceLink<EnhancedGraphNode, EnhancedGraphEdge>(Array.from(enhancedEdgesRef.current.values()))
        .id(d => d.id)
        .distance(d => {
          // Use simplified weight-based distance for fast pre-computation
          const weight = d.weight || 1;
          const minDistance = 180;  // ✅ REFINEMENT: Match main simulation (150→180 for pre-comp)
          const maxDistance = 950;  // ✅ REFINEMENT: Match main simulation (900→950 for pre-comp)
          const normalizedWeight = Math.log(weight + 1) / Math.log(13);
          return maxDistance - (normalizedWeight * (maxDistance - minDistance));
        })
        .strength(d => {
          // Simplified quadratic strength with degree boost
          const weight = d.weight || 1;
          const normalizedWeight = Math.min(weight / 12, 1.0);
          const baseStrength = 0.1 + 0.5 * Math.pow(normalizedWeight, 2);

          // Degree boost for hub gravity wells (simplified for pre-computation)
          const source = d.source as any;
          const target = d.target as any;
          const sourceDegree = source.degree || source.connections || 0;
          const targetDegree = target.degree || target.connections || 0;
          const maxDegree = Math.max(sourceDegree, targetDegree);
          const degreeBoost = 1 + Math.min(maxDegree / 20, 1.5); // Up to 2.5x for pre-comp

          return baseStrength * degreeBoost;
        })
      )
      .force('charge', forceManyBody<EnhancedGraphNode>()
        .strength(-2500)  // ✅ REFINEMENT: Match main simulation's stronger repulsion
        .distanceMax(2500)  // ✅ REFINEMENT: Match main simulation's larger repulsion range
        .theta(0.95) // OPTIMIZED: More approximation for speed
      )
      .force('center', forceCenter<EnhancedGraphNode>(0, 0).strength(0.02)) // Match main simulation's center force
      .force('collision', forceCollide<EnhancedGraphNode>()
        .radius(d => {
          const baseRadius = (d.radius || DEFAULT_CONFIG.graph.defaultRadius) + 40;
          const degree = d.degree || d.connections || 0;

          // Hubs need more breathing room (same as main simulation)
          if (degree >= 10) {
            return baseRadius * 1.5;
          } else if (degree >= 5) {
            return baseRadius * 1.25;
          }
          return baseRadius;
        })
        .strength(0.7) // Stronger collision (was 0.3)
        .iterations(2) // More iterations for better initial separation (was 1)
      )
      // Edge repulsion for pre-computation (simplified version)
      .force('edgeRepulsion', (alpha) => {
        const edges = Array.from(enhancedEdgesRef.current.values());
        const edgeRepulsionStrength = 10; // Slightly weaker for faster convergence
        const maxRepulsionDistance = 80; // Shorter range for pre-computation

        const nodeToEdges = new Map<string, EnhancedGraphEdge[]>();
        edges.forEach(edge => {
          const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

          if (!nodeToEdges.has(sourceId)) nodeToEdges.set(sourceId, []);
          if (!nodeToEdges.has(targetId)) nodeToEdges.set(targetId, []);

          nodeToEdges.get(sourceId)!.push(edge);
          nodeToEdges.get(targetId)!.push(edge);
        });

        nodeToEdges.forEach((nodeEdges, nodeId) => {
          if (nodeEdges.length < 2) return;

          for (let i = 0; i < nodeEdges.length; i++) {
            for (let j = i + 1; j < nodeEdges.length; j++) {
              const edge1 = nodeEdges[i];
              const edge2 = nodeEdges[j];

              const source1 = typeof edge1.source === 'object' ? edge1.source : enhancedNodesRef.current.get(edge1.source);
              const target1 = typeof edge1.target === 'object' ? edge1.target : enhancedNodesRef.current.get(edge1.target);
              const source2 = typeof edge2.source === 'object' ? edge2.source : enhancedNodesRef.current.get(edge2.source);
              const target2 = typeof edge2.target === 'object' ? edge2.target : enhancedNodesRef.current.get(edge2.target);

              if (!source1 || !target1 || !source2 || !target2) continue;

              const otherNode1 = source1.id === nodeId ? target1 : source1;
              const otherNode2 = source2.id === nodeId ? target2 : source2;

              const dx = (otherNode2.x || 0) - (otherNode1.x || 0);
              const dy = (otherNode2.y || 0) - (otherNode1.y || 0);
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance === 0 || distance > maxRepulsionDistance) continue;

              const force = (edgeRepulsionStrength * alpha) / (distance * distance);
              const fx = (dx / distance) * force;
              const fy = (dy / distance) * force;

              if (otherNode1.vx !== undefined && otherNode1.vy !== undefined) {
                otherNode1.vx -= fx;
                otherNode1.vy -= fy;
              }
              if (otherNode2.vx !== undefined && otherNode2.vy !== undefined) {
                otherNode2.vx += fx;
                otherNode2.vy += fy;
              }
            }
          }
        });
      })
      .velocityDecay(0.7)   // OPTIMIZED: High friction
      .alphaDecay(0.1)      // OPTIMIZED: Fast cooldown
      .alphaMin(0.05)       // OPTIMIZED: Stop early
      .stop(); // Stop automatic ticking

    // Run manual ticks until convergence
    let tickCount = 0;

    while (preSimulation.alpha() > preSimulation.alphaMin() && tickCount < maxTicks) {
      preSimulation.tick();
      tickCount++;
    }

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
        // DEBUG: Zoom event logging disabled (too noisy)
        // console.log('🎯 ZOOM EVENT FIRED:', {
        //   hasSourceEvent: !!event.sourceEvent,
        //   eventType: event.sourceEvent?.type,
        //   transformK: event.transform.k
        // });

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

          // DEBUG: Zoom-to-cursor calculation logging disabled (too noisy)
          // console.log('🔍 Zoom-to-cursor DEBUG:', {
          //   viewport: { width: viewportRef.current.width, height: viewportRef.current.height, centerX, centerY },
          //   mouseScreen: { x: mouseX.toFixed(2), y: mouseY.toFixed(2) },
          //   mouseClient: { x: event.sourceEvent.clientX, y: event.sourceEvent.clientY },
          //   rectOffset: { left: rect.left.toFixed(2), top: rect.top.toFixed(2) },
          //   worldCoords: { x: worldX.toFixed(2), y: worldY.toFixed(2) },
          //   oldTransform: { x: currentTransform.x.toFixed(2), y: currentTransform.y.toFixed(2), k: currentTransform.k.toFixed(3) },
          //   newTransform: { x: newX.toFixed(2), y: newY.toFixed(2), k: newScale.toFixed(3) },
          //   verification: {
          //     screenX: verifyX.toFixed(2),
          //     screenY: verifyY.toFixed(2),
          //     errorX: Math.abs(verifyX - mouseX).toFixed(2),
          //     errorY: Math.abs(verifyY - mouseY).toFixed(2),
          //     shouldBeZero: Math.abs(verifyX - mouseX) < 0.1 && Math.abs(verifyY - mouseY) < 0.1 ? '✅ CORRECT' : '❌ ERROR'
          //   }
          // });
        }

        // Continue with regular zoom handling
        const transform: ZoomTransform = event.transform;
        currentTransformRef.current = transform;

        // Update viewport with consistent coordinate system
        viewportRef.current.x = transform.x;
        viewportRef.current.y = transform.y;
        viewportRef.current.zoom = transform.k;

        // ✅ FIX: Update store inside requestAnimationFrame to prevent infinite render loops
        // This decouples the D3 event from the React render cycle.
        const updateStore = () => {
          const store = useStore.getState();
          store.view.updateViewport(transform.k, { x: transform.x, y: transform.y });
        };
        requestAnimationFrame(updateStore);

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

          // DEBUG: Zoom handler logging disabled (too noisy)
          // const firstNode = Array.from(enhancedNodesRef.current.values())[0];
          // console.log('🎯 Zoom handler applied:', {
          //   transform: { x: transform.x, y: transform.y, k: transform.k },
          //   viewport: { width: viewportRef.current.width, height: viewportRef.current.height },
          //   stagePosition: { x: pixiAppRef.current.stage.x, y: pixiAppRef.current.stage.y },
          //   nodeCount: enhancedNodesRef.current.size,
          //   firstNodePosition: firstNode ? {
          //     x: firstNode.x,
          //     y: firstNode.y
          //   } : 'no nodes'
          // });
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

      // CRITICAL: Update ref immediately to avoid closure issues
      isSimulationPausedRef.current = newPaused;

      if (newPaused) {
        // Pause: stop D3 simulation but keep rendering
        animationStateRef.current.isActive = false;

        // Stop D3 simulation completely
        if (simulationRef.current) {
          // CRITICAL FIX: Freeze all node velocities to prevent drift
          // Even if D3 auto-reheats, nodes won't move with zero velocity
          enhancedNodesRef.current.forEach(node => {
            node.vx = 0;
            node.vy = 0;
          });

          // CRITICAL FIX: Set alpha to 0 and alphaTarget to 0 to prevent auto-restart
          simulationRef.current.alpha(0);
          simulationRef.current.alphaTarget(0);
          simulationRef.current.stop();
        }

        // CORRECTED: Keep PIXI ticker running to show frozen nodes
      } else {
        // Resume: restart D3 simulation
        animationStateRef.current.isActive = true;

        // Reset simulation settled state when restarting
        simulation.setSimulationSettled(false);

        // Restart D3 simulation
        if (simulationRef.current) {
          simulationRef.current.alpha(0.8).restart(); // Resume with high energy
        }

        // Ensure PIXI ticker is running (should already be)
        if (pixiAppRef.current?.ticker && !pixiAppRef.current.ticker.started) {
          pixiAppRef.current.ticker.start();
        }
      }

      return newPaused;
    });
  }, [simulation]);

  const stopAnimation = useCallback(() => {

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
    }
  }, []);

  const startAnimation = useCallback((trigger: AnimationState['trigger']) => {

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
    }

    // Reset simulation settled state when restarting
    simulation.setSimulationSettled(false);

    // Start the D3 simulation with maximum energy for fastest movement
    if (simulationRef.current) {
      simulationRef.current.alpha(1.0).restart(); // Maximum alpha for fastest initial movement
    }

    // Update rendering immediately
    scheduleFrameUpdate();
  }, [scheduleFrameUpdate, simulation]);

  // Manual refresh for debugging/testing - defined after startAnimation to avoid circular dependency
  const manualRefresh = useCallback(() => {
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

    // Debug: Log container setup (DISABLED for performance)
    // console.log(`[Node Setup] Creating node ${node.id} - eventMode: ${container.eventMode}, cursor: ${container.cursor}, visual radius: ${visualRadius}, hit radius: ${hitRadius}`);

    // Main circle - use sprite or graphics based on mode (2025 optimization)
    let circle: PIXI.Graphics | PIXI.Sprite;

    if (useSpriteMode && textureAtlasRef.current) {
      // SPRITE MODE: Use pre-generated texture for better batching
      const color = getNodeColor(node);
      const texture = textureAtlasRef.current.generateNodeTexture(color, visualRadius, false);
      circle = new PIXI.Sprite(texture);
      circle.anchor.set(0.5);
      circle.eventMode = 'none';
      // console.log(`[Sprite Mode] Created sprite node ${node.id}`); // DISABLED: Excessive logging
    } else {
      // GRAPHICS MODE: Traditional dynamic drawing
      circle = new PIXI.Graphics();
      circle.eventMode = 'none';  // Important: let events pass through to container
    }

    container.addChild(circle);

    // Create combined label - direct creation (no pooling)
    let combinedLabel!: PIXI.Text;

    // Create multi-line, multi-color label with container
    const artistText = node.artist || node.track?.artist || node.metadata?.artist || 'Unknown Artist';
    const fullTitleText = node.title || node.track?.name || node.metadata?.title || node.metadata?.label || node.label || 'Unknown Title';

    // Extract remix info from title (common patterns)
    // Matches: (Extended Mix), [Radio Edit], - Laidback Luke Remix, etc.
    const remixMatch = fullTitleText.match(/[\(\[](.+?(?:mix|remix|edit|version|dub|vip|rework|bootleg|flip)[^\)\]]*?)[\)\]]|[\-–]\s*(.+?(?:mix|remix|edit|version|dub|vip|rework|bootleg|flip).*)$/i);
    let remixText = remixMatch ? (remixMatch[1] || remixMatch[2] || '').trim() : '';

    // Also check track metadata for explicit remix field
    if (!remixText && node.track?.metadata?.remix) {
      remixText = node.track.metadata.remix;
    }

    // Clean title: remove remix info from title display
    let titleText = fullTitleText;
    if (remixText) {
      // Remove the remix part from title for cleaner display
      titleText = fullTitleText.replace(/[\(\[](.+?(?:mix|remix|edit|version|dub|vip|rework|bootleg|flip)[^\)\]]*?)[\)\]]|[\-–]\s*(.+?(?:mix|remix|edit|version|dub|vip|rework|bootleg|flip).*)$/i, '').trim();
    }

    // Year is already extracted by data loader to node.year
    let yearText: string | number = node.year || node.track?.year || '';

    // Handle full dates - extract just the year
    if (yearText) {
      const yearStr = yearText.toString();
      if (yearStr.length > 4) {
        const yearMatch = yearStr.match(/(\d{4})/);
        yearText = yearMatch ? yearMatch[1] : yearStr;
      }
    }

    const hasError = artistText.includes('ERROR') || titleText.includes('ERROR');

    // DEBUG: Log node data occasionally to see what's available
    if (Math.random() < 0.01) { // Log 1% of nodes
      console.log('Node label data:', {
        id: node.id.substring(0, 20),
        artist: artistText,
        title: titleText,
        remix: remixText,
        year: yearText,
        fullTitle: fullTitleText,
        hasTrack: !!node.track,
      });

      // Log full node structure to understand data shape
      console.log('Full node object:', {
        id: node.id,
        type: node.type,
        label: node.label,
        artist: node.artist,
        title: node.title,
        year: node.year,
        metadata: node.metadata,
        track: node.track ? {
          name: node.track.name,
          artist: node.track.artist,
          year: node.track.year,
          metadata: node.track.metadata,
          allFields: Object.keys(node.track),
        } : null,
        allNodeFields: Object.keys(node),
      });
    }

    // Create a container for multi-line label
    const labelContainer = new PIXI.Container();
    labelContainer.eventMode = 'none';  // Don't block events
    labelContainer.visible = false; // Hidden by default

    const baseStyle = {
      fontFamily: 'Arial',
      fontSize: 12,
      fontWeight: '600',
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 4,
      dropShadowAlpha: 0.9,
      dropShadowDistance: 1.5,
    };

    // Line 1: Artist (purple: 0xa855f7)
    const artistLabel = new PIXI.Text({
      text: artistText,
      style: { ...baseStyle, fill: hasError ? 0xff0000 : 0xa855f7, fontSize: 12, fontWeight: '700' },
    });
    artistLabel.anchor.set(0, 0.5); // Left-aligned
    artistLabel.position.set(0, -18); // Above center
    labelContainer.addChild(artistLabel);

    // Line 2: Title (blue: 0x60a5fa)
    const titleLabel = new PIXI.Text({
      text: titleText,
      style: { ...baseStyle, fill: hasError ? 0xff0000 : 0x60a5fa, fontSize: 11, fontWeight: '600' },
    });
    titleLabel.anchor.set(0, 0.5);
    titleLabel.position.set(0, -6); // Slightly above center
    labelContainer.addChild(titleLabel);

    // Line 3: Remix (red: 0xef4444) - only if present
    if (remixText) {
      const remixLabel = new PIXI.Text({
        text: remixText,
        style: { ...baseStyle, fill: 0xef4444, fontSize: 10, fontWeight: '500' },
      });
      remixLabel.anchor.set(0, 0.5);
      remixLabel.position.set(0, 6); // Below center
      labelContainer.addChild(remixLabel);
    }

    // Line 4: Year (yellow: 0xfbbf24) - only if present
    if (yearText) {
      const yearLabel = new PIXI.Text({
        text: String(yearText),
        style: { ...baseStyle, fill: 0xfbbf24, fontSize: 10, fontWeight: '500' },
      });
      yearLabel.anchor.set(0, 0.5);
      yearLabel.position.set(0, remixText ? 18 : 6); // Adjust based on remix presence
      labelContainer.addChild(yearLabel);
    }

    container.addChild(labelContainer);

    // Create a simple combined label for backward compatibility (used in some places)
    combinedLabel = new PIXI.Text({
      text: `${artistText} - ${titleText}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 11,
        fill: hasError ? 0xff0000 : 0xffffff,
        align: 'center',
        fontWeight: '500',
      },
    });
    combinedLabel.visible = false; // Not used, kept for compatibility

    // Store references
    node.pixiNode = container;
    node.pixiCircle = circle;
    node.pixiLabel = combinedLabel;  // Keep for compatibility
    (node as any).pixiLabelContainer = labelContainer;  // Store the new multi-line label

    // Enhanced interaction handlers with 2025 best practices
    const nodeId = node.id;

    // Store interaction state
    // ✅ CRITICAL FIX: Removed local isSelected - always query global store instead
    let isDragging = false;
    let dragStartPosition = { x: 0, y: 0 };
    let lastClickTime = 0;
    let isPointerDown = false;

    // CRITICAL FIX: Use pointerdown/pointerup for reliable click detection
    // This ensures clicks work even during animations
    container.on('pointerdown', (event) => {
      // console.log(`[Event Triggered] pointerdown → node ${nodeId}`); // DISABLED: Excessive logging
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
      // console.log(`[Event Triggered] pointerup → node ${nodeId}`); // DISABLED: Excessive logging

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
      }
      // Drag ignored - no need to log this common event

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
      // console.log(`[Event Triggered] pointerenter → node ${nodeId}`); // DISABLED: Excessive logging

      if (graph?.setHoveredNode && !isDragging) {
        graph.setHoveredNode(nodeId);

        // ✅ CRITICAL FIX: Query current selection state from global store
        const isCurrentlySelected = useStore.getState().viewState.selectedNodes.has(nodeId);

        // Visual feedback for hover (only if not selected)
        if (circle && !isCurrentlySelected) {
          circle.tint = COLOR_SCHEMES.node.hovered;
        }
      }

      // Prevent event from bubbling to D3 zoom handler
      event.stopPropagation();
    });

    container.on('pointerleave', (event) => {
      // console.log(`[Event Triggered] pointerleave → node ${nodeId}`); // DISABLED: Excessive logging

      if (graph?.setHoveredNode) {
        graph.setHoveredNode(null);

        // ✅ CRITICAL FIX: Query current selection state from global store
        const isCurrentlySelected = useStore.getState().viewState.selectedNodes.has(nodeId);

        // Reset visual state based on current selection
        if (circle) {
          circle.tint = isCurrentlySelected ? COLOR_SCHEMES.node.selected : COLOR_SCHEMES.node.default;
        }
      }

      // Prevent event from bubbling to D3 zoom handler
      event.stopPropagation();
    });

    // Enhanced right-click context menu
    container.on('rightclick', (event) => {
      // console.log(`[Event Triggered] rightclick → node ${nodeId}`); // DISABLED: Excessive logging
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
      handleNodeRightClick(nodeId, event);
    });

    // Main click processing function
    const processNodeClick = (event: any, nodeId: string, node: EnhancedGraphNode) => {
      const now = Date.now();

      // Debounce rapid clicks
      if (now - lastClickTime < 150) {
        return;
      }
      lastClickTime = now;

      const isCtrlClick = event.ctrlKey || event.metaKey;
      const isShiftClick = event.shiftKey;

      // Handle different interaction modes
      switch (viewState.selectedTool) {
        case 'select':
          // ✅ CRITICAL FIX: Read current selection state directly from global store
          const isCurrentlySelected = useStore.getState().viewState.selectedNodes.has(nodeId);

          if (isCtrlClick) {
            // Multi-select: toggle this node based on its actual current state
            graph.toggleNodeSelection(nodeId);
          } else if (isShiftClick) {
            // Range select: select all nodes in bounding box between last selected and this one
            const selectedNodes = useStore.getState().viewState.selectedNodes;
            const lastSelectedId = Array.from(selectedNodes).pop();

            if (lastSelectedId && lastSelectedId !== nodeId) {
              const lastNode = enhancedNodesRef.current.get(lastSelectedId);
              const currentNode = enhancedNodesRef.current.get(nodeId);

              if (lastNode && currentNode && lastNode.x !== undefined && lastNode.y !== undefined &&
                  currentNode.x !== undefined && currentNode.y !== undefined) {
                // Calculate bounding box
                const minX = Math.min(lastNode.x, currentNode.x);
                const maxX = Math.max(lastNode.x, currentNode.x);
                const minY = Math.min(lastNode.y, currentNode.y);
                const maxY = Math.max(lastNode.y, currentNode.y);

                // Select all nodes within bounding box
                enhancedNodesRef.current.forEach((n) => {
                  if (n.x !== undefined && n.y !== undefined &&
                      n.x >= minX && n.x <= maxX &&
                      n.y >= minY && n.y <= maxY) {
                    graph.toggleNodeSelection(n.id, true); // Force select
                  }
                });

                console.log(`📦 Range selected ${useStore.getState().viewState.selectedNodes.size} nodes`);
              } else {
                // Fallback: just select both nodes
                graph.toggleNodeSelection(nodeId, true);
              }
            } else {
              // No last selected node, just select this one
              graph.toggleNodeSelection(nodeId, true);
            }
          } else {
            // Single select: clear others ONLY if this node isn't the only one selected
            if (!isCurrentlySelected || useStore.getState().viewState.selectedNodes.size > 1) {
              graph.clearSelection?.();
              graph.toggleNodeSelection(nodeId);
            }
          }

          // ✅ CRITICAL FIX: Update visual state based on fresh store query
          const newSelectionState = useStore.getState().viewState.selectedNodes.has(nodeId);
          if (circle) {
            circle.tint = newSelectionState ? COLOR_SCHEMES.node.selected : COLOR_SCHEMES.node.default;
          }

          // CRITICAL: Trigger track modal if onTrackSelect is provided
          if (node?.track && onTrackSelect) {
            onTrackSelect(node.track);
          }
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
          // Add track to setlist when clicking node in setlist mode
          if (node?.track) {
            useStore.getState().setlist.addTrackToSetlist(node.track);
            console.log('✅ Added to setlist:', node.track.name);
          }
          break;

        default:
      }
    };

    // Enhanced debugging - log all attached event listeners (DISABLED for performance)
    // console.log(`[Events Attached] Node ${node.id}:`, {
    //   pointerdown: container.listenerCount('pointerdown'),
    //   pointerup: container.listenerCount('pointerup'),
    //   pointermove: container.listenerCount('pointermove'),
    //   pointerenter: container.listenerCount('pointerenter'),
    //   pointerleave: container.listenerCount('pointerleave'),
    //   rightclick: container.listenerCount('rightclick'),
    //   eventMode: container.eventMode,
    //   cursor: container.cursor,
    //   hitArea: container.hitArea ? `Circle(r=${(container.hitArea as PIXI.Circle).radius})` : 'none'
    // });

    return container;
  }, [graph, pathfinding, viewState, pathfindingState, useSpriteMode, getNodeColor]);

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

    // GPU-OPTIMIZED: Cached glow sprite instead of Graphics
    let glow = node.pixiNode.getChildByLabel('glow') as PIXI.Sprite; // PixiJS v8: use getChildByLabel instead of getChildByName
    const isHoveredOrSelected = viewState.hoveredNode === node.id || viewState.selectedNodes.has(node.id);

    if (isHoveredOrSelected && lodLevel < 2) { // Only show glow for full/reduced detail
      if (!glow && textureAtlasRef.current) {
        // Create glow sprite ONCE from cached texture
        const glowColor = COLOR_SCHEMES.node.hovered;
        const glowTexture = textureAtlasRef.current.generateGlowTexture(screenRadius, glowColor);
        glow = new PIXI.Sprite(glowTexture);
        glow.label = 'glow'; // PixiJS v8: use label instead of deprecated name property
        glow.anchor.set(0.5);
        glow.eventMode = 'none';
        glow.alpha = 0.15; // Subtle glow
        node.pixiNode.addChildAt(glow, 0); // Add behind the main circle
      }
      if (glow) {
        glow.visible = true;
        // Update tint based on hover vs selection (reuses same texture)
        glow.tint = viewState.hoveredNode === node.id ? COLOR_SCHEMES.node.hovered : COLOR_SCHEMES.node.selected;
      }
    } else {
      if (glow) {
        glow.visible = false;
      }
    }

    // Update visual based on rendering mode (2025 optimization)
    if (node.pixiCircle instanceof PIXI.Sprite) {
      // SPRITE MODE: Update texture if color/selection changed
      const isSelected = viewState.selectedNodes.has(node.id);
      if (textureAtlasRef.current) {
        const texture = textureAtlasRef.current.generateNodeTexture(color, screenRadius, isSelected);
        node.pixiCircle.texture = texture;
      }
      node.pixiCircle.tint = 0xFFFFFF; // Reset tint
      node.pixiCircle.alpha = alpha;
    } else {
      // GRAPHICS MODE: Clear and redraw using PIXI v8 API
      (node.pixiCircle as PIXI.Graphics).clear();

      if (viewState.selectedNodes.has(node.id)) {
        // Selected node outline
        (node.pixiCircle as PIXI.Graphics).circle(0, 0, screenRadius + 2);
        (node.pixiCircle as PIXI.Graphics).setStrokeStyle({ width: 2, color: COLOR_SCHEMES.node.selected, alpha: alpha });
        (node.pixiCircle as PIXI.Graphics).stroke();
      }

      // Draw the main node circle
      (node.pixiCircle as PIXI.Graphics).circle(0, 0, screenRadius);
      (node.pixiCircle as PIXI.Graphics).fill({ color: color, alpha: alpha });
    }

    // Show multi-line labels for better readability
    // ✅ FIX: Show labels for LOD 0-2 (only hide when culled at LOD 3)
    const shouldShowLabel = viewState.showLabels && lodLevel < 3; // LOD 0-2 show labels

    // Use the new multi-line label container
    const labelContainer = (node as any).pixiLabelContainer as PIXI.Container | undefined;
    if (labelContainer) {
      labelContainer.visible = shouldShowLabel;

      // Only update label POSITION when visible (skip expensive style updates)
      if (shouldShowLabel) {
        // Position label to the RIGHT of the node, aligned with top
        // Nodes are now larger, so give more space
        labelContainer.position.set(screenRadius + 8, -screenRadius * 0.5);
      }
    }

    // Keep old label hidden (backward compatibility)
    node.pixiLabel.visible = false;
  }, [getNodeColor, viewState]);

  // Update edge visual appearance
  const updateEdgeVisuals = useCallback((edge: EnhancedGraphEdge, lodLevel: number) => {
    if (!edge.pixiEdge || !edge.sourceNode || !edge.targetNode) {
      return;
    }
    if (typeof edge.sourceNode.x !== 'number' || typeof edge.sourceNode.y !== 'number' ||
        typeof edge.targetNode.x !== 'number' || typeof edge.targetNode.y !== 'number') {
      return;
    }

    // Check if this edge is part of the calculated path
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

    const isPathEdge = pathfindingState.currentPath?.path.some((p, i) => {
      const next = pathfindingState.currentPath!.path[i + 1];
      return next && (
        (p.track.id === sourceId && next.track.id === targetId) ||
        (p.track.id === targetId && next.track.id === sourceId)
      );
    });

    // Use very thin edges for clean visualization
    // Weight-based width: stronger relationships get slightly thicker lines
    const baseWidth = isPathEdge ? 3.0 : 0.5; // Path edges are 6x thicker!
    const weight = edge.weight || 1;
    const screenWidth = isPathEdge
      ? baseWidth // Path edges maintain constant thick width
      : baseWidth + Math.min(weight / 10, 1); // Regular edges scale with weight (max 1.5)

    const color = getEdgeColor(edge);
    // Reduce edge opacity for cleaner appearance, but make path edges fully opaque
    const baseAlpha = isPathEdge
      ? 1.0 // Path edges fully opaque for maximum visibility
      : (lodLevel > 1 ? 0.2 : Math.max(0.3, viewState.edgeOpacity || 0.4));
    const alpha = isPathEdge ? 1.0 : baseAlpha * Math.max(0.6, edge.opacity || 1);

    // Calculate edge endpoints that stop at node boundaries
    // Get node radii (use enhanced node data if available)
    const sourceRadius = (edge.sourceNode as any).screenRadius || viewState.nodeSize || DEFAULT_CONFIG.graph.defaultRadius;
    const targetRadius = (edge.targetNode as any).screenRadius || viewState.nodeSize || DEFAULT_CONFIG.graph.defaultRadius;

    // Calculate direction vector from source to target
    const dx = edge.targetNode.x - edge.sourceNode.x;
    const dy = edge.targetNode.y - edge.sourceNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Avoid division by zero for nodes at the same position
    if (distance < 0.01) {
      edge.pixiEdge.clear(); // Don't draw edge for overlapping nodes
      return;
    }

    // Normalize direction vector
    const nx = dx / distance;
    const ny = dy / distance;

    // Calculate start and end points offset by node radii
    const startX = edge.sourceNode.x + nx * sourceRadius;
    const startY = edge.sourceNode.y + ny * sourceRadius;
    const endX = edge.targetNode.x - nx * targetRadius;
    const endY = edge.targetNode.y - ny * targetRadius;

    // GPU OPTIMIZATION: Only redraw if positions or path state changed
    const positionThreshold = 0.1; // Sub-pixel threshold
    const positionsChanged =
      edge.lastSourceX === undefined ||
      edge.lastSourceY === undefined ||
      edge.lastTargetX === undefined ||
      edge.lastTargetY === undefined ||
      Math.abs(startX - edge.lastSourceX) > positionThreshold ||
      Math.abs(startY - edge.lastSourceY) > positionThreshold ||
      Math.abs(endX - edge.lastTargetX) > positionThreshold ||
      Math.abs(endY - edge.lastTargetY) > positionThreshold ||
      edge.lastPathState !== isPathEdge;

    if (positionsChanged) {
      // Update graphics using PIXI v8 API (only when needed!)
      edge.pixiEdge.clear();
      edge.pixiEdge.setStrokeStyle({ width: screenWidth, color: color, alpha: alpha });
      edge.pixiEdge.moveTo(startX, startY);  // Start at source node boundary
      edge.pixiEdge.lineTo(endX, endY);      // End at target node boundary
      edge.pixiEdge.stroke();

      // Store rendered positions
      edge.lastSourceX = startX;
      edge.lastSourceY = startY;
      edge.lastTargetX = endX;
      edge.lastTargetY = endY;
      edge.lastPathState = isPathEdge;
    }

    // DEBUG: Edge rendering logging disabled (too noisy)
    // if (Math.random() < 0.001) { // Log ~0.1% of edges to avoid spam
    //   console.log('Edge rendered:', {
    //     id: edge.id,
    //     width: screenWidth,
    //     color: color.toString(16),
    //     alpha: alpha,
    //     from: { x: edge.sourceNode.x, y: edge.sourceNode.y },
    //     to: { x: edge.targetNode.x, y: edge.targetNode.y },
    //     visible: edge.pixiEdge.visible
    //   });
    // }

    edge.lodLevel = lodLevel;
    edge.lastUpdateFrame = frameRef.current;
  }, [getEdgeColor, viewState, pathfindingState]);

  // Main render frame function with throttling
  const renderFrame = useCallback(() => {
    if (!lodSystemRef.current || !pixiAppRef.current) return;

    // PERFORMANCE OPTIMIZATION: Throttle to 30fps for better CPU usage
    // Skip every other frame when performance is good
    const currentTime = performance.now();
    const lastFrameTime = lastFrameTimeRef.current || 0;
    const frameInterval = 1000 / 30; // 30fps target

    if (currentTime - lastFrameTime < frameInterval && enhancedNodesRef.current.size > 100) {
      return; // Skip this frame
    }
    lastFrameTimeRef.current = currentTime;

    // CORRECTED: Always render to show nodes, even when paused
    // Pausing should freeze movement, not hide the graph

    const currentFrame = frameRef.current;
    const { frameRate, renderTime, shouldOptimize } = performanceMonitorRef.current.update();

    // Update performance metrics
    const visibleNodes = Array.from(enhancedNodesRef.current.values()).filter(n => n.isVisible).length;
    const visibleEdges = Array.from(enhancedEdgesRef.current.values()).filter(e => e.isVisible).length;

    performanceStore.updatePerformanceMetrics({
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

      // ✅ PERFORMANCE FIX: Iterate only over visible edges determined by the LOD system.
      // This avoids processing thousands of off-screen edges every frame.
      const visibleEdgesArray = Array.from(enhancedEdgesRef.current.values()).filter(edge => {
        const lodLevel = lodSystem.getEdgeLOD(edge);
        const shouldRender = lodLevel < 3;
        if (edge.pixiEdge) edge.pixiEdge.visible = shouldRender;
        edge.isVisible = shouldRender;
        return shouldRender;
      });

      // CRITICAL PERFORMANCE: Only process edges with PIXI representation
      for (const edge of visibleEdgesArray) {
        const lodLevel = lodSystem.getEdgeLOD(edge);
        updateEdgeVisuals(edge, lodLevel);
      }

      // DEBUG: Edge render debug logging disabled (too noisy)
      // if (currentFrame % 60 === 0) {
      //   console.log(`Edge render debug: ${visibleEdgeCount}/${enhancedEdgesRef.current.size} edges visible, showEdges=${viewState.showEdges}`);
      // }
    } // else if (currentFrame % 60 === 0) {
      // console.log(`Edges not rendering: showEdges=${viewState.showEdges}, container=${!!edgesContainerRef.current}`);
    // }

    // Render nodes (middle layer)
    if (nodesContainerRef.current) {
      // DEBUG: Render check logging disabled (too noisy)
      // if (currentFrame % 120 === 0) {
      //   console.log(`🎨 Render check: ${enhancedNodesRef.current.size} enhanced nodes, ${nodesContainerRef.current.children.length} PIXI nodes`);

      //   // Sample LOD levels
      //   const lodSamples: Array<{id: string, x: number, y: number, lod: number, shouldRender: boolean}> = [];
      //   let sampleCount = 0;
      //   enhancedNodesRef.current.forEach(node => {
      //     if (sampleCount < 5) {
      //       const lod = lodSystem.getNodeLOD(node);
      //       lodSamples.push({
      //         id: node.id.substring(0, 20),
      //         x: Math.round(node.x || 0),
      //         y: Math.round(node.y || 0),
      //         lod,
      //         shouldRender: lod < 3
      //       });
      //       sampleCount++;
      //     }
      //   });
      //   console.log('📊 LOD samples:', lodSamples);
      // }

      let visibleNodeCount = 0;

      // ✅ PERFORMANCE FIX: Iterate only over visible nodes determined by the LOD system.
      // This is the most significant performance optimization.
      const visibleNodesArray = Array.from(enhancedNodesRef.current.values()).filter(node => {
        const lodLevel = lodSystem.getNodeLOD(node);
        const shouldRender = lodLevel < 3;
        if (node.pixiNode) node.pixiNode.visible = shouldRender;
        node.isVisible = shouldRender;
        return shouldRender;
      });

      // CRITICAL PERFORMANCE: Only process nodes with PIXI representation
      // Skipping this check saves ~30% iteration time on large graphs
      for (const node of visibleNodesArray) {
        const lodLevel = lodSystem.getNodeLOD(node);
        updateNodeVisuals(node, lodLevel);
      }

      // DEBUG: Node visibility logging disabled (too noisy)
      // if (currentFrame % 120 === 0) {
      //   console.log(`👁️ Node visibility: ${visibleNodeCount}/${enhancedNodesRef.current.size} nodes visible`);
      // }
    }

  }, [viewState, updateNodeVisuals, updateEdgeVisuals, performance]);

  // Helper function to navigate to a specific node with smooth animation
  const navigateToNode = useCallback((nodeId: string, options?: { highlight?: boolean; openModal?: boolean }) => {
    const node = enhancedNodesRef.current.get(nodeId);

    if (!node || !zoomBehaviorRef.current || !containerRef.current) {
      console.warn(`⚠️ Cannot navigate to node ${nodeId}: node or zoom behavior not found`);
      return;
    }

    const div = select(containerRef.current);
    const viewport = viewportRef.current;
    const k = currentTransformRef.current.k;

    // Calculate the transform needed to center this node
    const newX = -(node.x * k);
    const newY = -(node.y * k);


    // Use D3 transition for smooth animation
    (div as any).transition()
      .duration(500)
      .ease((t: number) => t * (2 - t)) // easeOutQuad for smooth deceleration
      .call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(newX, newY).scale(k)
      );

    // Add visual highlight if requested
    if (options?.highlight && node.pixiNode) {
      const circle = node.pixiNode.children.find(child => child instanceof PIXI.Graphics) as PIXI.Graphics | undefined;
      if (circle) {
        const originalTint = circle.tint;
        circle.tint = 0x00ff00; // Green highlight
        setTimeout(() => {
          circle.tint = originalTint;
        }, 1000);
      }
    }

    // Open track modal if requested
    if (options?.openModal && node.track && onTrackSelect) {
      onTrackSelect(node.track);
    }
  }, [onTrackSelect]);

  // Helper function to fit all nodes in view with optimal zoom
  const fitToContent = useCallback(() => {
    if (!zoomBehaviorRef.current || !containerRef.current) {
      console.warn('⚠️ Cannot fit to content: zoom behavior or container not found');
      return;
    }

    const nodes = Array.from(enhancedNodesRef.current.values());
    if (nodes.length === 0) {
      console.warn('⚠️ Cannot fit to content: no nodes found');
      return;
    }

    // Calculate bounding box of all nodes
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    });

    // Add padding around bounding box (20% on each side)
    const padding = 0.2;
    const width = maxX - minX;
    const height = maxY - minY;
    const paddedMinX = minX - width * padding;
    const paddedMaxX = maxX + width * padding;
    const paddedMinY = minY - height * padding;
    const paddedMaxY = maxY + height * padding;
    const paddedWidth = paddedMaxX - paddedMinX;
    const paddedHeight = paddedMaxY - paddedMinY;

    // Calculate optimal zoom to fit content
    const viewport = viewportRef.current;
    const scaleX = viewport.width / paddedWidth;
    const scaleY = viewport.height / paddedHeight;
    const optimalZoom = Math.min(scaleX, scaleY, DEFAULT_CONFIG.ui.maxZoom);

    // Clamp zoom to reasonable bounds
    const clampedZoom = Math.max(
      DEFAULT_CONFIG.ui.minZoom,
      Math.min(optimalZoom, DEFAULT_CONFIG.ui.maxZoom)
    );

    // Calculate center of bounding box
    const centerX = (paddedMinX + paddedMaxX) / 2;
    const centerY = (paddedMinY + paddedMaxY) / 2;

    // Calculate transform to center the bounding box at zoom level
    // Transform formula: screen = world * zoom + translate
    // We want: screen_center = world_center * zoom + translate
    // So: translate = screen_center - world_center * zoom
    const translateX = viewport.width / 2 - centerX * clampedZoom;
    const translateY = viewport.height / 2 - centerY * clampedZoom;

    // Apply transform with smooth animation
    const div = select(containerRef.current);
    (div as any).transition()
      .duration(750)
      .ease((t: number) => t * (2 - t)) // easeOutQuad
      .call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(translateX, translateY).scale(clampedZoom)
      );

    console.log('📐 Fit to content:', {
      boundingBox: { minX, maxX, minY, maxY, width, height },
      paddedBox: { paddedMinX, paddedMaxX, paddedMinY, paddedMaxY, paddedWidth, paddedHeight },
      viewport: { width: viewport.width, height: viewport.height },
      center: { centerX, centerY },
      zoom: clampedZoom,
      translate: { x: translateX, y: translateY }
    });
  }, []);

  // Helper function to center view on a specific node
  const centerOnNode = useCallback((nodeId: string, zoomLevel: number = 2.0) => {
    if (!zoomBehaviorRef.current || !containerRef.current) {
      console.warn('⚠️ Cannot center on node: zoom behavior or container not found');
      return;
    }

    const node = enhancedNodesRef.current.get(nodeId);
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') {
      console.warn('⚠️ Cannot center on node: node not found or missing position', nodeId);
      return;
    }

    // Clamp zoom to reasonable bounds
    const clampedZoom = Math.max(
      DEFAULT_CONFIG.ui.minZoom,
      Math.min(zoomLevel, DEFAULT_CONFIG.ui.maxZoom)
    );

    const viewport = viewportRef.current;

    // Calculate transform to center the node at the specified zoom level
    // Transform formula: screen = world * zoom + translate
    // We want: screen_center = node_position * zoom + translate
    // So: translate = screen_center - node_position * zoom
    const translateX = viewport.width / 2 - node.x * clampedZoom;
    const translateY = viewport.height / 2 - node.y * clampedZoom;

    // Apply transform with smooth animation
    const div = select(containerRef.current);
    (div as any).transition()
      .duration(750)
      .ease((t: number) => t * (2 - t)) // easeOutQuad
      .call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(translateX, translateY).scale(clampedZoom)
      );

    console.log('🎯 Centered on node:', {
      nodeId,
      label: node.label,
      position: { x: node.x, y: node.y },
      zoom: clampedZoom,
      translate: { x: translateX, y: translateY }
    });
  }, []);

  // Listen for custom event to center on a node (from context menu)
  useEffect(() => {
    const handleCenterOnNode = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string; zoomLevel?: number }>;
      const { nodeId, zoomLevel } = customEvent.detail;
      centerOnNode(nodeId, zoomLevel);
    };

    window.addEventListener('centerOnNode', handleCenterOnNode);

    return () => {
      window.removeEventListener('centerOnNode', handleCenterOnNode);
    };
  }, [centerOnNode]);

  // Handle node interactions
  const handleNodeClick = useCallback((nodeId: string) => {
    const tool = viewState.selectedTool;

    // Debug logging for click registration (only in debug mode)
    if (showDebugInfo) {
      console.group(`🎵 Node Click Detected`);
    }

    // Get node details for debugging
    const node = enhancedNodesRef.current.get(nodeId);
    if (node && showDebugInfo) {

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
        graph.toggleNodeSelection(nodeId);

        // Navigate to the selected node with highlight and modal
        navigateToNode(nodeId, { highlight: true, openModal: !!node?.track });

        if (!node?.track && showDebugInfo) {
        }
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
        if (node?.track) {
          useStore.getState().setlist.addTrackToSetlist(node.track);
          console.log('✅ Added to setlist:', node.track.name);
        }
        break;
      default:
    }
    if (showDebugInfo) console.groupEnd();
  }, [viewState, pathfindingState, graph, pathfinding, navigateToNode, showDebugInfo]);

  const handleNodeHover = useCallback((nodeId: string, isHovering: boolean) => {
    // Debug hover events (less verbose since these fire frequently)
    if (showDebugInfo) {
      if (isHovering) {
      } else {
      }
    }
    graph.setHoveredNode(isHovering ? nodeId : null);
  }, [graph, showDebugInfo]);

  // Ref to track if a node was just right-clicked (prevents double context menu)
  const nodeRightClickedRef = useRef(false);

  const handleNodeRightClick = useCallback((nodeId: string, event: PIXI.FederatedPointerEvent) => {
    event.preventDefault();

    // Set flag to prevent canvas context menu from also opening
    nodeRightClickedRef.current = true;

    // Clear the flag after a short delay to allow future clicks
    setTimeout(() => {
      nodeRightClickedRef.current = false;
    }, 100);

    if (showDebugInfo) {
      console.group(`🎵 Node Right-Click Detected`);
      const node = enhancedNodesRef.current.get(nodeId);
      if (node) {
        console.log('Node:', node);
      }
      console.groupEnd();
    }

    // Show context menu for node
    const node = enhancedNodesRef.current.get(nodeId);
    if (node) {
      // Create synthetic React MouseEvent from PIXI event
      const syntheticEvent = {
        clientX: event.clientX,
        clientY: event.clientY,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      } as React.MouseEvent;

      openContextMenu(syntheticEvent, 'node', node);
    }
  }, [showDebugInfo, openContextMenu]);

  // Handle window resize
  const handleResize = useCallback(() => {
    if (!pixiAppRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    pixiAppRef.current.renderer.resize(rect.width, rect.height);

    // Re-center the stage when canvas size changes
    pixiAppRef.current.stage.position.set(rect.width / 2, rect.height / 2);

    viewportRef.current.width = rect.width;
    viewportRef.current.height = rect.height;

    setMainGraphWidth(rect.width);
    setMainGraphHeight(rect.height);

    if (lodSystemRef.current) {
      lodSystemRef.current.updateViewport(viewportRef.current);
    }

  }, [setMainGraphWidth, setMainGraphHeight]);

  // Detect data changes to trigger animation
  const generateDataHash = useCallback((nodes: GraphNode[], edges: GraphEdge[]): string => {
    // ✅ FIX: Only hash structural data (IDs), NOT layout data (x, y)
    // Position changes during D3 simulation are expected and should NOT trigger re-initialization
    const nodeHash = nodes.map(n => n.id).sort().join('|');
    const edgeHash = edges.map(e => `${e.id}:${e.source}:${e.target}`).sort().join('|');
    return `${nodeHash}#${edgeHash}`;
  }, []);

  // Update graph data with intelligent diffing (2025 optimization)
  const updateGraphData = useCallback(() => {
    if (!simulationRef.current || !nodesContainerRef.current || !edgesContainerRef.current) return;

    // CRITICAL FIX: Ensure enhancedNodesRef is initialized
    if (!enhancedNodesRef.current) {
      enhancedNodesRef.current = new Map();
    }
    if (!enhancedEdgesRef.current) {
      enhancedEdgesRef.current = new Map();
    }

    // CRITICAL FIX: Use ref to access current graphData without capturing in closure
    const currentGraphData = graphDataRef.current;

    // Check if this is new data (trigger animation)
    const newDataHash = generateDataHash(currentGraphData.nodes, currentGraphData.edges);
    const isNewData = newDataHash !== lastDataHashRef.current;
    const wasEmpty = lastDataHashRef.current === '';

    // CRITICAL FIX: Don't re-run if data hasn't actually changed
    if (!isNewData && !wasEmpty) {
      return; // Data unchanged - skip redundant update
    }

    lastDataHashRef.current = newDataHash;

    const simulation = simulationRef.current;

    // ✅ PERFORMANCE OPTIMIZATION: Intelligent diffing instead of full teardown
    // Calculate what changed to minimize PIXI object recreation
    const existingNodeIds = new Set(enhancedNodesRef.current.keys());
    const newNodeIds = new Set(currentGraphData.nodes.map(n => n.id));
    const existingEdgeIds = new Set(enhancedEdgesRef.current.keys());
    const newEdgeIds = new Set(currentGraphData.edges.map(e => e.id));

    // Identify changes
    const nodesToAdd = currentGraphData.nodes.filter(n => !existingNodeIds.has(n.id));
    const nodesToRemove = Array.from(existingNodeIds).filter(id => !newNodeIds.has(id));
    const nodesToUpdate = currentGraphData.nodes.filter(n => existingNodeIds.has(n.id));

    const edgesToAdd = currentGraphData.edges.filter(e => !existingEdgeIds.has(e.id));
    const edgesToRemove = Array.from(existingEdgeIds).filter(id => !newEdgeIds.has(id));

    // Track if we need full rebuild (for initial load or major changes)
    const needsFullRebuild = wasEmpty ||
                             nodesToRemove.length > existingNodeIds.size * 0.3 || // >30% nodes removed
                             nodesToAdd.length > newNodeIds.size * 0.3;            // >30% nodes added

    if (needsFullRebuild) {
      // Full rebuild path (original logic for major changes)
      if (nodesContainerRef.current) {
        nodesContainerRef.current.children.forEach(child => {
          child.removeAllListeners();
          if (child.destroy) {
            child.destroy({ children: true, texture: false });
          }
        });
        nodesContainerRef.current.removeChildren();
      }

      if (edgesContainerRef.current) {
        edgesContainerRef.current.children.forEach(child => {
          child.removeAllListeners();
          if (child.destroy) {
            child.destroy({ children: true, texture: false });
          }
        });
        edgesContainerRef.current.removeChildren();
      }

      enhancedNodesRef.current.clear();
      enhancedEdgesRef.current.clear();

      // Create all nodes fresh
      const nodeMap = new Map<string, EnhancedGraphNode>();
      currentGraphData.nodes.forEach(nodeData => {
        const node = createEnhancedNode(nodeData);
        const pixiContainer = createPixiNode(node);
        nodesContainerRef.current!.addChild(pixiContainer);
        nodeMap.set(node.id, node);
        enhancedNodesRef.current.set(node.id, node);
      });

      // Continue with edges in the existing code flow below
    } else {
      // ✅ INCREMENTAL UPDATE PATH: Only modify what changed

      // Remove deleted nodes
      nodesToRemove.forEach(nodeId => {
        const node = enhancedNodesRef.current.get(nodeId);
        if (node?.pixiNode) {
          node.pixiNode.removeAllListeners();
          node.pixiNode.destroy({ children: true, texture: false });
          nodesContainerRef.current!.removeChild(node.pixiNode);
        }
        enhancedNodesRef.current.delete(nodeId);
      });

      // Add new nodes
      nodesToAdd.forEach(nodeData => {
        const node = createEnhancedNode(nodeData);
        const pixiContainer = createPixiNode(node);
        nodesContainerRef.current!.addChild(pixiContainer);
        enhancedNodesRef.current.set(node.id, node);
      });

      // Update existing nodes (metadata changes, etc.)
      nodesToUpdate.forEach(nodeData => {
        const existingNode = enhancedNodesRef.current.get(nodeData.id);
        if (existingNode) {
          // Update node properties without recreating PIXI objects
          Object.assign(existingNode, nodeData);
          // Visual updates will happen in renderFrame
        }
      });

      // Remove deleted edges
      edgesToRemove.forEach(edgeId => {
        const edge = enhancedEdgesRef.current.get(edgeId);
        if (edge?.pixiEdge) {
          edge.pixiEdge.destroy();
          edgesContainerRef.current!.removeChild(edge.pixiEdge);
        }
        enhancedEdgesRef.current.delete(edgeId);
      });

      // Add new edges
      edgesToAdd.forEach(edgeData => {
        const edge = createEnhancedEdge(edgeData, enhancedNodesRef.current);
        if (edge) {
          const pixiGraphics = createPixiEdge(edge);
          edgesContainerRef.current!.addChild(pixiGraphics);
          enhancedEdgesRef.current.set(edge.id, edge);
        }
      });
    }

    // Create node map for the rest of the function
    const nodeMap = enhancedNodesRef.current;

    // Only process edges for full rebuild (incremental path already handled them)
    if (needsFullRebuild) {
      // Filter out invalid edges before processing
      // This is a good place to add robust error handling for API calls,
      // similar to what's needed in ArtistAttributionManager.tsx.
      // The pattern below shows how to handle non-JSON responses gracefully.
      /*
      fetch('/api/v1/artists/some-id', { method: 'DELETE' })
        .then(async response => {
          if (!response.ok) {
            // Handle HTTP errors like 500, 504, 404, etc.
            const errorText = await response.text(); // Read response as text to avoid JSON parse error
            try {
              // See if the error text is actually JSON with a 'detail' message
              const errorJson = JSON.parse(errorText);
              throw new Error(errorJson.detail || `Server responded with ${response.status}.`);
            } catch (e) {
              // If not JSON, use the raw text (which might be the PG error)
              throw new Error(errorText || `Server responded with ${response.status}.`);
            }
          }
          // If response is OK, but there's no content (common for DELETE)
          if (response.status === 204) {
            return { success: true };
          }
          return response.json(); // Otherwise, parse the JSON body
        })
        .then(data => {
          console.log('Successfully deleted artist:', data);
        })
        .catch(error => {
          // This will catch network errors and the errors we threw above
          console.error('Error deleting artist:', error.message);
          // Here you would show a user-friendly error message in the UI
        });
      */

      const seenEdgeIds = new Set<string>();
      const nodeIds = new Set(currentGraphData.nodes.map(n => n.id));
      const validEdges = currentGraphData.edges.filter(edge => {
        const sourceExists = nodeIds.has(edge.source);
        const targetExists = nodeIds.has(edge.target);
        // Create a canonical, order-independent ID for deduplication
        const canonicalId = [edge.source, edge.target].sort().join('__');

        if (!sourceExists || !targetExists) {
          console.warn(`Filtering out edge ${edge.id} due to missing nodes. Source: ${edge.source} (exists: ${sourceExists}), Target: ${edge.target} (exists: ${targetExists})`);
          return false;
        }
        if (seenEdgeIds.has(canonicalId)) {
          console.warn(`Filtering out duplicate edge: ${edge.id} (canonical: ${canonicalId})`);
          return false;
        }
        seenEdgeIds.add(canonicalId);
        return true;
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
    }

    // PRE-COMPUTE LAYOUT: Position nodes before showing them
    // This prevents LOD from culling nodes that start at random positions
    const nodes = Array.from(nodeMap.values());

    // ✅ OPTIMIZATION: Only pre-compute for new nodes in incremental updates
    if (needsFullRebuild) {
      if (process.env.NODE_ENV === 'development') {
        // DEBUG: Pre-computation logging disabled (too noisy)
        // console.log(`🚀 Layout: Pre-computing ${nodes.length} nodes (full rebuild)...`);
      }
      preComputeLayout(nodes, 50); // OPTIMIZED: Reduced from 300 for faster initial load
    } else if (nodesToAdd.length > 0) {
      // Only pre-compute positions for newly added nodes
      const newNodes = nodesToAdd.map(n => enhancedNodesRef.current.get(n.id)).filter(Boolean) as EnhancedGraphNode[];
      if (newNodes.length > 0) {
        preComputeLayout(newNodes, 30); // Even faster for incremental additions
      }
    }

    // START DYNAMIC SIMULATION: Begin continuous movement
    // Update simulation with nodes/edges and START it
    simulation.nodes(nodes);
    const linkForce = simulation.force('link') as ForceLink<EnhancedGraphNode, EnhancedGraphEdge>;
    if (linkForce) {
      linkForce.links(Array.from(enhancedEdgesRef.current.values()));
    }

    // START simulation for dynamic movement
    // CRITICAL FIX: Check the ref, not the state, to avoid closure issues
    if (!isSimulationPausedRef.current) {
      // Reset simulation settled state when restarting with new data
      useStore.getState().simulation.setSimulationSettled(false);

      simulation.alpha(1.0).restart(); // Start with maximum energy
      animationStateRef.current.isActive = true;
      if (process.env.NODE_ENV === 'development') {
        // DEBUG: Simulation start logging disabled (too noisy)
        // console.log('✅ Simulation started');
      }
    }

    // Rebuild spatial index
    spatialIndexRef.current.rebuild(Array.from(nodeMap.values()));

    frameRef.current++;
  }, [createEnhancedNode, createPixiNode, createEnhancedEdge, createPixiEdge, generateDataHash, startAnimation]);

  // CRITICAL FIX: Keep graphDataRef in sync with graphData state
  // This allows updateGraphData to access current data without being recreated on every state change
  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  // CRITICAL FIX: Memoize data hash to detect content changes (not just length changes)
  // This ensures graph updates when data content changes, even if array lengths stay the same
  const currentDataHash = useMemo(() =>
    generateDataHash(graphData.nodes, graphData.edges),
    [graphData.nodes, graphData.edges, generateDataHash]
  );

  // Effects

  // Initialize on mount - delayed to ensure container is properly mounted
  useEffect(() => {
    const initializeAfterMount = () => {
      // DEBUG: PIXI initialization attempt logging disabled (too noisy)
      // console.log('Attempting PIXI initialization after component mount');
      // NO automatic animation - use instant positioning when data loads
      initializePixi();
    };

    // Use a small delay to ensure the DOM is fully rendered
    const timeoutId = setTimeout(initializeAfterMount, 0);

    return () => {
      clearTimeout(timeoutId);

      // Comprehensive PIXI.js v8 cleanup (2025 best practices)
      if (pixiAppRef.current) {

        // Stop ticker safely (PIXI v8 compatibility)
        if (pixiAppRef.current.ticker) {
          try {
            pixiAppRef.current.ticker.stop();
            // Don't manually remove ticker listeners - let app.destroy() handle it
          } catch (error) {
            console.warn('⚠️ Ticker stop warning:', error);
          }
        }

        // ✅ REMOVED: TextLabelPool cleanup - no longer used
        // Labels are destroyed as part of their parent containers

        // Clean up all containers and their children safely
        [nodesContainerRef, edgesContainerRef, labelsContainerRef, interactionContainerRef].forEach((containerRef, index) => {
          if (containerRef.current) {
            try {
              // Remove all event listeners from container children
              containerRef.current.children.forEach(child => {
                try {
                  child.removeAllListeners?.();
                  if (child.destroy) {
                    child.destroy({ children: true, texture: false });
                  }
                } catch (childError) {
                  console.warn(`⚠️ Child cleanup warning in container ${index}:`, childError);
                }
              });
              containerRef.current.destroy({ children: true });
              containerRef.current = null;
            } catch (containerError) {
              console.warn(`⚠️ Container ${index} cleanup warning:`, containerError);
              containerRef.current = null; // Clear reference even if cleanup failed
            }
          }
        });

        // Stop D3 simulation FIRST (before clearing data)
        if (simulationRef.current) {
          simulationRef.current.stop();
          simulationRef.current = null;
        }

        // Clear enhanced data maps (after simulation is stopped)
        enhancedNodesRef.current.clear();
        enhancedEdgesRef.current.clear();

        // Destroy PIXI app with comprehensive options (v8 memory leak fix)
        // The destroy method will handle ticker cleanup internally
        pixiAppRef.current.destroy(true, {
          children: true,
          texture: true
        });

        // Manual v8 renderGroup cleanup (known issue workaround)
        // Note: Do this BEFORE nulling pixiAppRef
        try {
          if (pixiAppRef.current?.stage?.renderGroup) {
            const renderGroup = pixiAppRef.current.stage.renderGroup as any;
            renderGroup.childrenRenderablesToUpdate = {};
            renderGroup.childrenToUpdate = {};
            renderGroup.instructionSet = null;
          }
        } catch (e) {
          console.warn('Could not clean renderGroup:', e);
        }

        pixiAppRef.current = null;
      }

      // Destroy texture atlas (2025 optimization cleanup)
      // Note: Label pool is destroyed earlier to prevent race conditions
      if (textureAtlasRef.current) {
        textureAtlasRef.current.destroy();
        textureAtlasRef.current = null;
      }

      // ✅ REMOVED: TextLabelPool late cleanup check - no longer used

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
            if ((pixiAppRef.current?.renderer as any)?.gl) {
              const gl = (pixiAppRef.current.renderer as any).gl;
              const webglMemory = {
                buffers: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                textures: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
                programs: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)
              };
              memoryStatsRef.current.webglMemory = webglMemory;
            }

            // Log significant memory increases (> 20MB to reduce noise) - debug only
            if (memoryDiff > 20 * 1024 * 1024 && showDebugInfo) {
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
  // CRITICAL FIX: Trigger on data hash instead of array lengths
  // This ensures updates when content changes, not just when array sizes change
  useEffect(() => {
    if (isInitialized && graphData.nodes.length > 0) {
      updateGraphData();
    }
  }, [isInitialized, currentDataHash, updateGraphData]);

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
            if (newValue) {
              console.group('🔍 Debug Information');
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
          console.groupEnd();
          break;

        case ' ':
          // Space bar - pause/resume animation
          event.preventDefault();
          const wasPaused = isSimulationPausedRef.current;
          isSimulationPausedRef.current = !wasPaused;
          break;

        case 'escape':
          // Clear all selections
          graph.clearSelection?.();
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
          }
          break;

        case 'tab':
          // Tab navigation between selected nodes
          event.preventDefault();
          const selectedNodes = Array.from(viewState.selectedNodes);
          if (selectedNodes.length > 0) {
            // Cycle through selected nodes (forward with Tab, backward with Shift+Tab)
            const direction = event.shiftKey ? -1 : 1;
            focusedNodeIndexRef.current = (focusedNodeIndexRef.current + direction + selectedNodes.length) % selectedNodes.length;

            const focusedNodeId = selectedNodes[focusedNodeIndexRef.current];

            // Navigate to the focused node with highlight (but no modal)
            navigateToNode(focusedNodeId, { highlight: true, openModal: false });
          } else {
          }
          break;

        case 'enter':
          // Enter - open track modal for focused node
          if (viewState.hoveredNode) {
            const node = enhancedNodesRef.current.get(viewState.hoveredNode);
            if (node?.track && onTrackSelect) {
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

          // Pan viewport using arrow keys
          if (zoomBehaviorRef.current && containerRef.current) {
            const panAmount = 50; // pixels to pan
            const currentTransform = zoomTransform(containerRef.current);

            let dx = 0, dy = 0;
            switch (event.key.toLowerCase()) {
              case 'arrowup':
                dy = panAmount;
                break;
              case 'arrowdown':
                dy = -panAmount;
                break;
              case 'arrowleft':
                dx = panAmount;
                break;
              case 'arrowright':
                dx = -panAmount;
                break;
            }

            const newTransform = currentTransform.translate(dx, dy);
            select(containerRef.current)
              .transition()
              .duration(200)
              .call(zoomBehaviorRef.current.transform, newTransform);
          }
          break;

        case '+':
        case '=':
          // Zoom in
          event.preventDefault();
          break;

        case '-':
        case '_':
          // Zoom out
          event.preventDefault();
          break;

        default:
          // Log unhandled keys for debugging
          if (showDebugInfo) {
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState, showDebugInfo, graph, onTrackSelect, navigateToNode]);

  // Handle view state changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [viewState.showLabels, viewState.showEdges, viewState.nodeSize, viewState.edgeOpacity, scheduleFrameUpdate]);

  // CRITICAL: Update PIXI ticker callback when renderFrame changes
  // This ensures the ticker uses the latest closure with current viewState
  useEffect(() => {
    if (pixiAppRef.current?.ticker) {
      // Remove old callback and add new one
      pixiAppRef.current.ticker.remove(renderFrame as any);
      pixiAppRef.current.ticker.add(renderFrame as any);
      // DEBUG: PIXI ticker update logging disabled (too noisy - fires on every render)
      // console.log('🔄 Updated PIXI ticker with latest renderFrame callback');
    }
  }, [renderFrame]);

  // Handle selected nodes changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [viewState.selectedNodes, scheduleFrameUpdate]);

  // Reset focused node index when selection changes
  useEffect(() => {
    // Reset to 0 whenever the selection changes
    focusedNodeIndexRef.current = 0;
  }, [viewState.selectedNodes]);

  // Handle hovered node changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [viewState.hoveredNode, scheduleFrameUpdate]);

  // Handle pathfinding state changes with throttling
  useEffect(() => {
    scheduleFrameUpdate();
  }, [pathfindingState.currentPath, pathfindingState.selectedWaypoints, scheduleFrameUpdate]);

  // Handle navigation requests from store (e.g., track selection from library/browser)
  useEffect(() => {
    const navRequest = viewState.navigationRequest;
    if (!navRequest) return;

    // Execute navigation
    navigateToNode(navRequest.nodeId, navRequest.options);

    // Optionally select the node
    if (navRequest.options?.selectNode !== false) {
      graph.selectNode(navRequest.nodeId);
    }
  }, [viewState.navigationRequest, navigateToNode, graph]);


  // Handle right-click on canvas to show context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Check if a node was just right-clicked (prevents double context menu)
    if (nodeRightClickedRef.current) {
      e.preventDefault();
      return; // Node context menu already opened, skip empty space menu
    }

    // Only show context menu if clicking on empty space (not on a node)
    const target = e.target as HTMLElement;
    if (target.tagName === 'CANVAS' || target.classList.contains('graph-container')) {
      openContextMenu(e, 'empty', {
        forceSettings,
        setForceSettings,
        useSpriteMode,
        setUseSpriteMode,
        initializeSimulation,
        simulationRef,
        enhancedNodesRef,
        enhancedEdgesRef,
        zoomBehaviorRef,
        containerRef,
        fitToContent,  // ✅ Pass fitToContent function
        centerOnNode,  // ✅ Pass centerOnNode function
      });
    }
  }, [openContextMenu, forceSettings, setForceSettings, useSpriteMode, setUseSpriteMode, fitToContent, centerOnNode]);

  // Handle left-click on canvas to close context menu
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Close context menu if clicking on empty space
    const target = e.target as HTMLElement;
    if (target.tagName === 'CANVAS' || target.classList.contains('graph-container')) {
      if (contextMenu) {
        closeContextMenu();
      }
    }
  }, [contextMenu, closeContextMenu]);

  return (
    <div
      ref={containerRef}
      className="graph-canvas graph-container graph-visualization graph-component w-full h-full overflow-hidden bg-gray-900 relative"
      style={{ touchAction: 'none' }}
      onContextMenu={handleContextMenu}
      onClick={handleCanvasClick}
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


      {/* DISABLED: Mini-map commented out */}
      {/* {isInitialized && mainGraphWidth > 0 && mainGraphHeight > 0 && (
        <GraphMiniMap mainGraphWidth={mainGraphWidth} mainGraphHeight={mainGraphHeight} />
      )} */}

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
            <div>FPS: {performanceMetrics?.frameRate?.toFixed(0) || 'N/A'}</div>
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

      {/* Context Menu for layout mode and graph options */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetType={contextMenu.targetType}
          targetData={{
            forceSettings,
            setForceSettings,
            useSpriteMode,
            setUseSpriteMode,
            initializeSimulation,
            simulationRef,
            enhancedNodesRef,
            enhancedEdgesRef
          }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};

export default GraphVisualization;