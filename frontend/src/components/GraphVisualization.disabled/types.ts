/**
 * Type definitions for GraphVisualization component
 * 2025 Best Practices: Strict TypeScript typing for graph rendering
 */

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type * as PIXI from 'pixi.js';

/* ============================================
   CORE DATA TYPES
   ============================================ */

/**
 * Track data from the API
 */
export interface Track {
  id: string;
  title: string;
  artist_name: string;
  album?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  duration_ms?: number;
  release_date?: string;
  spotify_id?: string;
  isrc?: string;
  album_art_url?: string;
}

/**
 * Base graph node structure
 */
export interface GraphNode {
  id: string;
  track: Track;
  degree: number;
  betweenness?: number;
  clustering?: number;
  community?: number;
  color?: number;
  size?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * Base graph edge structure
 */
export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
  transition_count?: number;
  avg_harmonic_distance?: number;
  avg_bpm_difference?: number;
  transition_quality?: number;
}

/**
 * Complete graph data structure
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: {
    total_tracks: number;
    total_transitions: number;
    date_range?: {
      start: string;
      end: string;
    };
  };
}

/* ============================================
   ENHANCED RENDERING TYPES
   ============================================ */

/**
 * Enhanced node with PIXI rendering properties
 */
export interface EnhancedGraphNode extends GraphNode, SimulationNodeDatum {
  pixiNode?: PIXI.Container;
  pixiCircle?: PIXI.Graphics | PIXI.Sprite;
  pixiLabel?: PIXI.Text;
  pixiGlow?: PIXI.Sprite;
  lodLevel: number;
  lastUpdateFrame: number;
  isVisible: boolean;
  screenRadius: number;
  hitBoxRadius: number;
  isSelected?: boolean;
  isHovered?: boolean;
  isInPath?: boolean;
  isPlaying?: boolean;
}

/**
 * Enhanced edge with PIXI rendering properties
 */
export interface EnhancedGraphEdge extends Omit<GraphEdge, 'source' | 'target'>, SimulationLinkDatum<EnhancedGraphNode> {
  pixiEdge?: PIXI.Graphics;
  sourceNode?: EnhancedGraphNode;
  targetNode?: EnhancedGraphNode;
  lodLevel: number;
  lastUpdateFrame: number;
  isVisible: boolean;
  screenWidth: number;
  isSelected?: boolean;
  isInPath?: boolean;
  lastSourceX?: number;
  lastSourceY?: number;
  lastTargetX?: number;
  lastTargetY?: number;
  lastPathState?: boolean;
}

/* ============================================
   VIEWPORT & CAMERA TYPES
   ============================================ */

/**
 * Viewport bounds in world coordinates
 */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Rectangle for spatial queries
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Viewport state for rendering
 */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  bounds: Bounds;
}

/**
 * Camera position bookmark
 */
export interface CameraBookmark {
  id: string;
  name: string;
  position: Point;
  zoom: number;
  timestamp: number;
}

/* ============================================
   LEVEL OF DETAIL (LOD) TYPES
   ============================================ */

/**
 * LOD level definitions
 * 0: Full detail (near camera)
 * 1: Medium detail (mid-range)
 * 2: Low detail (far from camera)
 * 3: Culled (outside viewport)
 */
export type LODLevel = 0 | 1 | 2 | 3;

/**
 * LOD configuration
 */
export interface LODConfig {
  thresholds: {
    near: number;    // Normalized distance for full detail
    medium: number;  // Normalized distance for medium detail
    far: number;     // Normalized distance for low detail
  };
  nodeCountAdjustment: boolean; // Adjust thresholds based on node count
  transitionDuration: number;   // ms for LOD transitions
}

/* ============================================
   PHYSICS SIMULATION TYPES
   ============================================ */

/**
 * Physics simulation configuration
 */
export interface SimulationConfig {
  charge: number;
  linkDistance: number;
  linkStrength: number;
  centerStrength: number;
  collideRadius: number;
  alphaDecay: number;
  velocityDecay: number;
  alphaMin: number;
}

/**
 * Physics simulation state
 */
export interface SimulationState {
  isRunning: boolean;
  alpha: number;
  iterations: number;
  temperature: number;
}

/**
 * Worker message types
 */
export type WorkerMessageType =
  | 'init'
  | 'update'
  | 'tick'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'configure'
  | 'reheat';

/**
 * Worker message structure
 */
export interface WorkerMessage {
  type: WorkerMessageType;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  config?: Partial<SimulationConfig>;
  alpha?: number;
}

/**
 * Worker response structure
 */
export interface WorkerResponse {
  type: WorkerMessageType;
  nodes?: Array<{ id: string; x: number; y: number; vx: number; vy: number }>;
  state?: SimulationState;
  error?: string;
}

/* ============================================
   RENDERING TYPES
   ============================================ */

/**
 * Texture atlas entry
 */
export interface TextureEntry {
  texture: PIXI.Texture;
  radius: number;
  color: number;
  state: 'default' | 'selected' | 'hovered' | 'playing' | 'path';
}

/**
 * Render statistics
 */
export interface RenderStats {
  fps: number;
  frameTime: number;
  visibleNodes: number;
  visibleEdges: number;
  drawCalls: number;
  triangles: number;
  memoryUsage?: number;
}

/**
 * Performance thresholds
 */
export interface PerformanceThresholds {
  NODE_COUNT_HIGH: number;
  NODE_COUNT_MEDIUM: number;
  EDGE_COUNT_HIGH: number;
  EDGE_COUNT_MEDIUM: number;
  LOD_DISTANCE_1: number;
  LOD_DISTANCE_2: number;
  MIN_NODE_SIZE: number;
  MAX_NODE_SIZE: number;
  MIN_EDGE_WIDTH: number;
  MAX_EDGE_WIDTH: number;
  VIEWPORT_BUFFER: number;
}

/* ============================================
   COLOR SCHEMES
   ============================================ */

/**
 * Node color scheme
 */
export interface NodeColorScheme {
  default: number;
  selected: number;
  hovered: number;
  nowPlaying: number;
  path: number;
  waypoint: number;
  startPoint: number;
  endPoint: number;
}

/**
 * Edge color scheme
 */
export interface EdgeColorScheme {
  default: number;
  selected: number;
  path: number;
  strong: number;
}

/**
 * Genre color mapping
 */
export type GenreColorMap = Record<string, number>;

/**
 * Complete color schemes
 */
export interface ColorSchemes {
  node: NodeColorScheme;
  edge: EdgeColorScheme;
  genre: GenreColorMap;
}

/* ============================================
   INTERACTION TYPES
   ============================================ */

/**
 * Selection state
 */
export interface SelectionState {
  selectedNodes: Set<string>;
  selectedEdges: Set<string>;
  hoveredNode: string | null;
  hoveredEdge: string | null;
  focusedNode: string | null;
}

/**
 * Interaction mode
 */
export type InteractionMode = 'select' | 'pan' | 'zoom' | 'path';

/**
 * Keyboard shortcut action
 */
export type KeyboardAction =
  | 'selectAll'
  | 'deselectAll'
  | 'deleteSelected'
  | 'fitToScreen'
  | 'resetView'
  | 'toggleDebug'
  | 'togglePhysics'
  | 'zoomIn'
  | 'zoomOut'
  | 'panUp'
  | 'panDown'
  | 'panLeft'
  | 'panRight';

/* ============================================
   CONFIGURATION TYPES
   ============================================ */

/**
 * Graph visualization configuration
 */
export interface GraphConfig {
  width: number;
  height: number;
  performance: {
    targetFPS: number;
    enableCulling: boolean;
    enableLOD: boolean;
    enableObjectPooling: boolean;
    maxNodes: number;
    maxEdges: number;
  };
  physics: SimulationConfig;
  rendering: {
    antialias: boolean;
    resolution: number;
    powerPreference: 'high-performance' | 'low-power' | 'default';
    backgroundAlpha: number;
  };
  interaction: {
    enablePan: boolean;
    enableZoom: boolean;
    enableDrag: boolean;
    enableKeyboard: boolean;
    multiSelect: boolean;
    zoomSpeed: number;
    panSpeed: number;
  };
  styling: {
    nodeSize: number;
    edgeWidth: number;
    labelFontSize: number;
    labelFontFamily: string;
    showLabels: boolean;
    showEdges: boolean;
  };
}

/* ============================================
   EVENT TYPES
   ============================================ */

/**
 * Node click event
 */
export interface NodeClickEvent {
  node: EnhancedGraphNode;
  originalEvent: PointerEvent;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
  };
}

/**
 * Edge click event
 */
export interface EdgeClickEvent {
  edge: EnhancedGraphEdge;
  originalEvent: PointerEvent;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
  };
}

/**
 * Viewport change event
 */
export interface ViewportChangeEvent {
  viewport: Viewport;
  delta: {
    x: number;
    y: number;
    zoom: number;
  };
}

/* ============================================
   COMPONENT PROPS
   ============================================ */

/**
 * Main GraphVisualization component props
 */
export interface GraphVisualizationProps {
  data: GraphData;
  config?: Partial<GraphConfig>;
  selectedNodes?: Set<string>;
  pathNodes?: Set<string>;
  nowPlayingNodeId?: string;
  onNodeClick?: (event: NodeClickEvent) => void;
  onNodeHover?: (node: EnhancedGraphNode | null) => void;
  onEdgeClick?: (event: EdgeClickEvent) => void;
  onSelectionChange?: (selectedNodes: Set<string>) => void;
  onViewportChange?: (event: ViewportChangeEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * PIXIGraph component props (internal)
 */
export interface PIXIGraphProps {
  data: GraphData;
  config: GraphConfig;
  viewport: Viewport;
  selection: SelectionState;
  onNodeClick?: (event: NodeClickEvent) => void;
  onNodeHover?: (node: EnhancedGraphNode | null) => void;
  onEdgeClick?: (event: EdgeClickEvent) => void;
  onViewportChange?: (viewport: Viewport) => void;
}

/**
 * GraphControls component props
 */
export interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitToScreen: () => void;
  onTogglePhysics: () => void;
  isPhysicsRunning: boolean;
  currentZoom: number;
  minZoom: number;
  maxZoom: number;
  stats?: RenderStats;
}

/**
 * Minimap component props
 */
export interface MinimapProps {
  nodes: EnhancedGraphNode[];
  viewport: Viewport;
  graphBounds: Bounds;
  onViewportChange: (viewport: Viewport) => void;
  width?: number;
  height?: number;
}

/**
 * NodeDetailsPanel component props
 */
export interface NodeDetailsPanelProps {
  node: EnhancedGraphNode | null;
  neighbors: EnhancedGraphNode[];
  onClose: () => void;
  onNodeClick?: (node: EnhancedGraphNode) => void;
}

/* ============================================
   EXPORT DEFAULT TYPE
   ============================================ */

export type {
  PIXI,
};
