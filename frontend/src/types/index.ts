// Core music data types
export interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  duration?: number;
  bpm?: number;
  key?: string;
  camelotKey?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  genre?: string;
  year?: number;
  popularity?: number;
  preview_url?: string;
  spotify_id?: string;
  apple_music_id?: string;
  beatport_id?: string;
  isrc?: string;
  title?: string; // Alias for name for compatibility
}

// Graph visualization types
export interface GraphNode {
  id: string;
  label: string;
  type: 'track' | 'artist' | 'album' | 'genre';
  track?: Track;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius?: number;
  color?: string;
  selected?: boolean;
  highlighted?: boolean;
  opacity?: number;
  weight?: number;
  degree?: number;
  // Legacy compatibility properties for components
  title?: string;
  artist?: string;
  bpm?: number;
  key?: string;
  genre?: string;
  name?: string;
  energy?: number;
  year?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  type: 'adjacency' | 'similarity' | 'collaboration' | 'genre' | 'key_compatibility';
  strength?: number;
  color?: string;
  opacity?: number;
  distance?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// DJ/Performance types
export interface SetlistTrack {
  id: string;
  track: Track;
  position: number;
  transition_notes?: string;
  key_shift?: number;
  tempo_change?: number;
  mix_cue_in?: number;
  mix_cue_out?: number;
  selected?: boolean;
}

export interface Setlist {
  id: string;
  name: string;
  tracks: SetlistTrack[];
  created_at: Date;
  updated_at: Date;
  duration?: number;
  description?: string;
  tags?: string[];
}

// Search and filtering types
export interface SearchFilters {
  genre?: string[];
  keyRange?: string[];
  bpmRange?: [number, number];
  energyRange?: [number, number];
  yearRange?: [number, number];
  artist?: string[];
  minPopularity?: number;
  hasPreview?: boolean;
}

export interface SearchResult {
  track: Track;
  score: number;
  matches: Array<{
    field: string;
    value: string;
    indices: number[][];
  }>;
}

// UI state types
export interface ViewState {
  selectedTool: 'select' | 'path' | 'setlist' | 'filter';
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  zoom: number;
  pan: { x: number; y: number };
  showLabels: boolean;
  showEdges: boolean;
  nodeSize: number;
  edgeOpacity: number;
  colorBy?: 'genre' | 'bpm' | 'energy' | 'key' | 'artist';
  sizeBy?: 'degree' | 'popularity' | 'energy' | 'uniform';
  edgeDisplay?: 'all' | 'strong' | 'selected' | 'none';
  performanceMode?: 'high' | 'balanced' | 'low';
  showStats?: boolean;
}

export interface PanelState {
  leftPanel: 'search' | 'filters' | 'setlist' | 'path' | 'graph' | 'targets' | null;
  rightPanel: 'stats' | 'details' | 'history' | null;
  bottomPanel: 'player' | 'timeline' | null;
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;
}

// Performance and analytics types
export interface PerformanceMetrics {
  frameRate: number;
  renderTime: number;
  nodeCount: number;
  edgeCount: number;
  visibleNodes: number;
  visibleEdges: number;
  memoryUsage: number;
  lastUpdate: number;
  fps?: number;
}

export interface UserInteraction {
  type: 'node_click' | 'node_hover' | 'edge_click' | 'drag' | 'zoom' | 'pan';
  timestamp: number;
  nodeId?: string;
  edgeId?: string;
  position?: { x: number; y: number };
  duration?: number;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
  timestamp: number;
  requestId?: string;
}

export interface GraphApiResponse extends ApiResponse<GraphData> {
  metadata: {
    totalNodes: number;
    totalEdges: number;
    filters?: SearchFilters;
    searchQuery?: string;
    processingTime: number;
  };
}

export interface TrackSearchResponse extends ApiResponse<SearchResult[]> {
  metadata: {
    query: string;
    totalResults: number;
    searchTime: number;
    filters?: SearchFilters;
  };
}

// Event types for inter-component communication
export type GraphEvent =
  | { type: 'node_selected'; nodeId: string }
  | { type: 'node_deselected'; nodeId: string }
  | { type: 'nodes_cleared' }
  | { type: 'edge_selected'; edgeId: string }
  | { type: 'graph_updated'; data: GraphData }
  | { type: 'layout_updated'; positions: Array<{ id: string; x: number; y: number }> }
  | { type: 'view_changed'; view: Partial<ViewState> };

export type UIEvent =
  | { type: 'panel_toggled'; panel: keyof PanelState; visible: boolean }
  | { type: 'tool_changed'; tool: ViewState['selectedTool'] }
  | { type: 'filter_applied'; filters: SearchFilters }
  | { type: 'search_performed'; query: string; results: SearchResult[] };

export type SetlistEvent =
  | { type: 'track_added'; track: Track; position?: number }
  | { type: 'track_removed'; trackId: string }
  | { type: 'track_moved'; trackId: string; newPosition: number }
  | { type: 'setlist_saved'; setlist: Setlist }
  | { type: 'setlist_loaded'; setlist: Setlist }
  | { type: 'setlist_cleared' };

// Configuration types
export interface AppConfig {
  api: {
    baseUrl: string;
    graphEndpoint: string;
    searchEndpoint: string;
    timeout: number;
  };
  graph: {
    maxNodes: number;
    maxEdges: number;
    defaultRadius: number;
    minRadius: number;
    maxRadius: number;
    edgeThreshold: number;
    animationDuration: number;
  };
  performance: {
    enableWebGL: boolean;
    targetFPS: number;
    maxRenderNodes: number;
    cullDistanceThreshold: number;
    enableMetrics: boolean;
  };
  ui: {
    defaultZoom: number;
    minZoom: number;
    maxZoom: number;
    panelAnimationDuration: number;
    debounceDelay: number;
  };
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventCallback<T> = (event: T) => void;

export type Disposable = {
  dispose: () => void;
};

export type Point = {
  x: number;
  y: number;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Color = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

// Export default app configuration
export const DEFAULT_CONFIG: AppConfig = {
  api: {
    baseUrl: '/api',
    graphEndpoint: '/v1/graph',
    searchEndpoint: '/v1/search',
    timeout: 30000,
  },
  graph: {
    maxNodes: 5000,
    maxEdges: 10000,
    defaultRadius: 8,
    minRadius: 4,
    maxRadius: 20,
    edgeThreshold: 0.1,
    animationDuration: 300,
  },
  performance: {
    enableWebGL: true,
    targetFPS: 60,
    maxRenderNodes: 2000,
    cullDistanceThreshold: 1000,
    enableMetrics: true,
  },
  ui: {
    defaultZoom: 1.0,
    minZoom: 0.1,
    maxZoom: 5.0,
    panelAnimationDuration: 200,
    debounceDelay: 300,
  },
};