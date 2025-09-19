// API types for backend integration
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  meta?: {
    requestId?: string;
    timestamp?: string;
    processingTime?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    suggestions?: string[];
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

// Graph API
export interface GetGraphRequest {
  limit?: number;
  offset?: number;
  centerNodeId?: string;
  depth?: number;
  filters?: {
    genres?: string[];
    artists?: string[];
    yearRange?: [number, number];
    bpmRange?: [number, number];
    popularity?: number;
  };
  include?: {
    relationships?: boolean;
    audioFeatures?: boolean;
    metadata?: boolean;
  };
  layout?: 'force' | 'hierarchical' | 'circular' | 'spectral';
}

export interface GetNodeRequest {
  nodeId: string;
  includeRelationships?: boolean;
  relationshipDepth?: number;
  includeAudioAnalysis?: boolean;
}

export interface GetRelationshipsRequest {
  nodeId: string;
  depth?: number;
  types?: string[];
  minWeight?: number;
  direction?: 'incoming' | 'outgoing' | 'both';
  limit?: number;
  includeIndirect?: boolean;
}

// Path finding API
export interface FindShortestPathRequest {
  startId: string;
  endId: string;
  algorithm: 'dijkstra' | 'astar';
  constraints?: {
    maxLength: number;
    minWeight: number;
    allowedTypes: string[];
    avoidNodes: string[];
    preferredAttributes?: {
      bpmTolerance: number;
      keyCompatibility: boolean;
      energyProgression: 'ascending' | 'descending';
    };
  };
  options?: {
    returnAlternatives: boolean;
    maxAlternatives: number;
    includeMetrics: boolean;
  };
}

export interface FindKShortestPathsRequest {
  startId: string;
  endId: string;
  k: number;
  diversityFactor: number;
  constraints?: {
    maxLength: number;
    minWeight: number;
  };
}

export interface MultiWaypointPathRequest {
  waypoints: string[];
  optimization: 'shortest' | 'smoothest' | 'diverse';
  constraints?: {
    allowReordering: boolean;
    returnToStart: boolean;
    maxTotalDistance: number;
    smoothnessWeight: number;
    diversityWeight: number;
  };
}

// Search API
export interface SearchRequest {
  q: string;
  type?: 'fuzzy' | 'exact' | 'prefix';
  fields?: string[];
  limit?: number;
  offset?: number;
}

export interface AdvancedSearchRequest {
  criteria: {
    text?: {
      query: string;
      fields: string[];
      fuzzy: boolean;
    };
    filters?: {
      bpmRange?: [number, number];
      yearRange?: [number, number];
      genres?: string[];
      key?: string[];
      energy?: {
        min: number;
        max: number;
      };
    };
    similarity?: {
      referenceNodeId: string;
      threshold: number;
      attributes: string[];
    };
  };
  options?: {
    limit: number;
    offset: number;
    sortBy: 'relevance' | 'popularity' | 'date';
    includeFacets: boolean;
  };
}

export interface SearchResponse {
  results: Array<{
    id: string;
    title: string;
    type: string;
    description: string;
    metadata: Record<string, any>;
    score?: number;
    highlights?: Record<string, string>;
  }>;
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  query: string;
  suggestions?: string[];
  facets?: Record<string, Array<{ value: string; count: number }>>;
  status?: string;
}

export interface SimilarSongsRequest {
  nodeId: string;
  limit?: number;
  threshold?: number;
  attributes?: string[];
  includeReasons?: boolean;
}

// Analytics API
export interface GraphStatisticsResponse {
  graph: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    avgDegree: number;
    diameter: number;
    radius: number;
    clusteringCoefficient: number;
    connectedComponents: number;
  };
  distributions: {
    degree: {
      min: number;
      max: number;
      mean: number;
      median: number;
      std: number;
    };
    genres: Record<string, number>;
    years: Record<string, number>;
  };
}

export interface ClusterDetectionRequest {
  algorithm?: 'louvain' | 'kmeans' | 'hierarchical' | 'spectral';
  resolution?: number;
  minSize?: number;
  maxClusters?: number;
}

export interface ClusterDetectionResponse {
  clusters: Array<{
    id: string;
    nodes: string[];
    centroid?: number[];
    size: number;
    cohesion: number;
    separation: number;
    label?: string;
  }>;
  modularity: number;
  silhouette: number;
}

export interface GraphInsightsRequest {
  types?: string[];
  limit?: number;
  context?: string;
}

export interface GraphInsightsResponse {
  insights: Array<{
    type: string;
    title: string;
    description: string;
    importance: number;
    items: Array<{
      nodeId?: string;
      path?: string[];
      title?: string;
      reason: string;
      score: number;
    }>;
  }>;
}

// Playlist API
export interface GeneratePlaylistRequest {
  criteria: {
    seedSongs: string[];
    duration: number;
    songCount: number;
    mood: string;
    genres: string[];
    era: string;
    diversity: number;
    familiarity: number;
  };
  constraints: {
    noDuplicateArtists: boolean;
    smoothTransitions: boolean;
    energyProfile: 'ascending' | 'descending' | 'wave' | 'steady';
    excludeSongs: string[];
  };
}

export interface OptimizePlaylistRequest {
  playlist: string[];
  optimization: {
    goals: string[];
    weights: {
      transition: number;
      diversity: number;
      popularity: number;
    };
  };
  constraints: {
    preserveFirst: boolean;
    preserveLast: boolean;
    maxReorder: number;
  };
}

// WebSocket API
export interface WebSocketMessage {
  type: string;
  requestId?: string;
  data?: unknown;
  timestamp: string;
}

export interface SubscribeMessage extends WebSocketMessage {
  type: 'subscribe';
  channel: string;
  params?: {
    nodeIds?: string[];
    depth?: number;
    includeRelationships?: boolean;
  };
}

export interface GraphUpdateMessage extends WebSocketMessage {
  type: 'graph_update';
  data: {
    added: SongNode[];
    modified: Array<{
      id: string;
      changes: Partial<SongNode>;
    }>;
    removed: string[];
  };
}

export interface PathProgressMessage extends WebSocketMessage {
  type: 'path_progress';
  data: {
    status: 'calculating' | 'complete' | 'error';
    progress: number;
    nodesExplored: number;
    currentBest?: {
      distance: number;
      nodes: number;
    };
    estimatedTimeRemaining?: number;
  };
}

export interface SessionUpdateMessage extends WebSocketMessage {
  type: 'session_update';
  data: {
    sessionId: string;
    event: string;
    userId: string;
    action: string;
    nodeId?: string;
    data?: unknown;
  };
}

// Export formats
export interface ExportRequest {
  format: 'json' | 'graphml' | 'gexf' | 'csv' | 'cytoscape';
  nodes?: string[];
  includeRelationships?: boolean;
  options?: {
    compression?: 'gzip';
    includeMetadata?: boolean;
  };
}

export interface ExportPlaylistRequest {
  playlist: string[];
  platform: 'spotify' | 'apple' | 'youtube' | 'soundcloud';
  options: {
    name: string;
    description: string;
    public: boolean;
  };
}