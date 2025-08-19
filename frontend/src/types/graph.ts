// Core graph data structures
export interface SongNode {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genres: string[];
  releaseDate?: string;
  duration?: number;
  bpm?: number;
  key?: string;
  energy?: number;
  valence?: number;
  popularity?: number;
  
  // Audio features for analysis
  audioFeatures?: {
    acousticness: number;
    danceability: number;
    energy: number;
    instrumentalness: number;
    liveness: number;
    loudness: number;
    speechiness: number;
    tempo: number;
    valence: number;
    key: number;
    mode: number;
    timeSignature: number;
  };
  
  // Visualization properties
  position?: {
    x: number;
    y: number;
  };
  
  // Graph metrics
  metrics?: {
    centrality: number;
    clustering: number;
    pageRank: number;
    degree: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  type: RelationshipType;
  confidence?: number;
  context?: RelationshipContext[];
  metadata?: Record<string, unknown>;
}

export interface Graph {
  nodes: SongNode[];
  edges: GraphEdge[];
  statistics: {
    totalNodes: number;
    totalEdges: number;
    filteredNodes: number;
    filteredEdges: number;
    density: number;
    avgDegree: number;
    diameter?: number;
    clusteringCoefficient?: number;
  };
}

export enum RelationshipType {
  PLAYLIST_SEQUENCE = 'playlist_sequence',
  GENRE_SIMILARITY = 'genre_similarity',
  ARTIST_COLLABORATION = 'artist_collaboration',
  REMIX_VARIANT = 'remix_variant',
  BPM_HARMONIC = 'bpm_harmonic',
  KEY_COMPATIBLE = 'key_compatible',
  ENERGY_MATCH = 'energy_match',
  USER_PREFERENCE = 'user_preference',
  DJ_MIX_TRANSITION = 'dj_mix_transition',
}

export interface RelationshipContext {
  type: 'playlist' | 'setlist' | 'mix' | 'recommendation';
  source: string;
  frequency: number;
  rating?: number;
}

// Visualization-specific types
export interface NodeVisual extends SongNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius: number;
  color: string;
  opacity: number;
  selected: boolean;
  highlighted: boolean;
  visible: boolean;
  level?: number; // For LOD system
}

export interface EdgeVisual extends GraphEdge {
  sourceNode: NodeVisual;
  targetNode: NodeVisual;
  visible: boolean;
  opacity: number;
  width: number;
  color: string;
}

export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

// Layout algorithms
export enum LayoutAlgorithm {
  FORCE_DIRECTED = 'force_directed',
  HIERARCHICAL = 'hierarchical',
  CIRCULAR = 'circular',
  SPECTRAL = 'spectral',
  GRID = 'grid',
  CLUSTER = 'cluster',
}

export interface LayoutOptions {
  algorithm: LayoutAlgorithm;
  
  // Force-directed options
  forceDirected?: {
    linkDistance: number;
    linkStrength: number;
    chargeStrength: number;
    chargeTheta: number;
    alpha: number;
    alphaDecay: number;
    velocityDecay: number;
    iterations: number;
    centering: boolean;
    collisionRadius: number;
  };
  
  // Hierarchical options
  hierarchical?: {
    direction: 'TB' | 'BT' | 'LR' | 'RL';
    levelSeparation: number;
    nodeSeparation: number;
    treeSpacing: number;
    blockShifting: boolean;
    edgeMinimization: boolean;
  };
  
  // Circular options
  circular?: {
    radius: number;
    startAngle: number;
    ordering: 'degree' | 'clustering' | 'betweenness' | 'pagerank';
    grouping?: string; // Field to group by
  };
}

// Performance and rendering
export interface RenderSettings {
  maxNodes: number;
  maxEdges: number;
  nodeSize: {
    min: number;
    max: number;
    scale: 'linear' | 'sqrt' | 'log';
    basedOn: 'degree' | 'popularity' | 'centrality' | 'fixed';
  };
  edgeWidth: {
    min: number;
    max: number;
    scale: 'linear' | 'sqrt';
    basedOn: 'weight' | 'confidence' | 'fixed';
  };
  lodSystem: {
    enabled: boolean;
    levels: number;
    thresholds: number[];
    nodeSimplification: boolean;
    edgeCulling: boolean;
  };
  culling: {
    frustum: boolean;
    occlusion: boolean;
    distance: boolean;
    minPixelSize: number;
  };
  antialiasing: boolean;
  transparency: boolean;
  shadows: boolean;
  bloom: boolean;
}

// Filters and search
export interface GraphFilters {
  genres?: string[];
  artists?: string[];
  yearRange?: [number, number];
  bpmRange?: [number, number];
  energyRange?: [number, number];
  popularityMin?: number;
  nodeIds?: string[];
  edgeTypes?: RelationshipType[];
  minWeight?: number;
  maxDegree?: number;
  searchQuery?: string;
}

export interface SearchResult {
  node: SongNode;
  score: number;
  highlights: Record<string, string>;
  reason: string;
}

// Path finding
export interface PathFindingOptions {
  algorithm: 'dijkstra' | 'astar' | 'bidirectional';
  heuristic?: 'euclidean' | 'manhattan' | 'musical';
  constraints?: {
    maxLength: number;
    minWeight: number;
    allowedTypes: RelationshipType[];
    avoidNodes: string[];
    bpmTolerance?: number;
    keyCompatibility?: boolean;
    energyProgression?: 'ascending' | 'descending' | 'smooth';
  };
  diversityFactor?: number;
}

export interface PathResult {
  id: string;
  nodes: string[];
  edges: string[];
  distance: number;
  metrics: {
    smoothness: number;
    diversity: number;
    feasibility: number;
    avgWeight: number;
  };
  reasoning?: string;
}

// Animation and transitions
export interface AnimationState {
  layoutTransition: {
    active: boolean;
    progress: number;
    duration: number;
    easing: string;
  };
  nodeTransitions: Map<string, {
    fromPosition: { x: number; y: number };
    toPosition: { x: number; y: number };
    progress: number;
  }>;
  cameraTransition: {
    active: boolean;
    fromTransform: { x: number; y: number; scale: number };
    toTransform: { x: number; y: number; scale: number };
    progress: number;
  };
}

// Performance metrics
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  updateTime: number;
  memoryUsage: {
    heap: number;
    total: number;
    external: number;
  };
  nodeCount: {
    total: number;
    visible: number;
    rendered: number;
  };
  edgeCount: {
    total: number;
    visible: number;
    rendered: number;
  };
  gpuMemory?: number;
  drawCalls?: number;
}