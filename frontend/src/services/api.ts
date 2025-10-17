import {
  GraphData,
  GraphApiResponse,
  TrackSearchResponse,
  SearchFilters,
  ApiResponse,
  Track,
  DEFAULT_CONFIG
} from '../types';

// Base API configuration
class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private requestId: number = 0;

  constructor(baseUrl: string = DEFAULT_CONFIG.api.baseUrl, timeout: number = DEFAULT_CONFIG.api.timeout) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  // Generate unique request ID
  private getRequestId(): string {
    return `req_${Date.now()}_${++this.requestId}`;
  }

  // Create AbortController with timeout
  private createAbortController(timeoutMs?: number): AbortController {
    const controller = new AbortController();
    const timeout = timeoutMs || this.timeout;

    setTimeout(() => {
      controller.abort();
    }, timeout);

    return controller;
  }

  // Generic fetch wrapper with error handling
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs?: number
  ): Promise<ApiResponse<T>> {
    const requestId = this.getRequestId();
    const controller = this.createAbortController(timeoutMs);
    const startTime = Date.now();

    try {
      const url = `${this.baseUrl}${endpoint}`;
      // Debug logging disabled - too verbose
      // console.log(`[API] ${options.method || 'GET'} ${url} (${requestId})`);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          ...options.headers,
        },
      });

      const responseTime = Date.now() - startTime;
      // Debug logging disabled - too verbose
      // console.log(`[API] Response ${response.status} in ${responseTime}ms (${requestId})`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        data,
        status: 'success',
        timestamp: Date.now(),
        requestId,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[API] Error in ${responseTime}ms (${requestId}):`, error);

      let message = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message = 'Request timed out';
        } else {
          message = error.message;
        }
      }

      return {
        data: {} as T,
        status: 'error',
        message,
        timestamp: Date.now(),
        requestId,
      };
    }
  }

  // GET request
  async get<T>(endpoint: string, params?: Record<string, any>, timeoutMs?: number): Promise<ApiResponse<T>> {
    let fullUrl: string;
    let queryString = '';

    // Handle params manually to avoid URL constructor issues with relative baseUrl
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v.toString()));
          } else {
            searchParams.set(key, value.toString());
          }
        }
      });
      queryString = searchParams.toString();
    }

    // Construct full URL manually
    if (this.baseUrl.startsWith('http')) {
      // Absolute base URL
      const url = new URL(endpoint, this.baseUrl);
      if (queryString) {
        url.search = queryString;
      }
      fullUrl = url.pathname + (queryString ? '?' + queryString : '');
    } else {
      // Relative base URL (like '/api')
      fullUrl = endpoint + (queryString ? '?' + queryString : '');
    }

    return this.request<T>(fullUrl, {
      method: 'GET',
    }, timeoutMs);
  }

  // POST request
  async post<T>(endpoint: string, data?: any, timeoutMs?: number): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, timeoutMs);
  }

  // PUT request
  async put<T>(endpoint: string, data?: any, timeoutMs?: number): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, timeoutMs);
  }

  // DELETE request
  async delete<T>(endpoint: string, timeoutMs?: number): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    }, timeoutMs);
  }
}

// Create API client instances
// For containerized deployment, use proxy through API Gateway
const apiClient = new ApiClient('/api'); // API Gateway for main services
const graphApiClient = new ApiClient('/api'); // Proxied through API Gateway

// Graph data API
export const graphApi = {
  // Get full graph data
  async getGraphData(filters?: SearchFilters): Promise<GraphApiResponse> {
    try {
      // Fetch nodes and edges separately from working endpoints
      const [nodesResponse, edgesResponse] = await Promise.all([
        graphApiClient.get<{nodes: any[], total: number}>('/api/graph/nodes?limit=500'),
        graphApiClient.get<{edges: any[], total: number}>('/api/graph/edges?limit=5000')
      ]);

      if (nodesResponse.status === 'error' || edgesResponse.status === 'error') {
        return {
          data: { nodes: [], edges: [] },
          status: 'error',
          message: 'Failed to fetch graph data',
          timestamp: Date.now(),
          metadata: {
            totalNodes: 0,
            totalEdges: 0,
            filters,
            processingTime: 0,
          },
        };
      }

      // Transform data to expected format
      const nodes = nodesResponse.data.nodes?.map((node: any) => ({
        id: node.id,
        label: node.metadata?.title || node.metadata?.label || node.id,
        type: 'track' as const,
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        // Map metadata to node properties for compatibility
        title: node.metadata?.title,
        artist: node.metadata?.artist,
        name: node.metadata?.title,
        genre: node.metadata?.category,
        track: {
          id: node.track_id || node.id,
          name: node.metadata?.title || node.metadata?.label || '',
          artist: node.metadata?.artist || '',
          genre: node.metadata?.category,
        }
      })) || [];

      // Create a set of loaded node IDs for efficient filtering
      const nodeIds = new Set(nodes.map(n => n.id));

      // Filter edges to only include those connecting loaded nodes
      // The API returns edges with source/target fields
      const edges = (edgesResponse.data.edges || [])
        .filter((edge: any) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge: any) => ({
          id: edge.id,
          source: edge.source,  // Note: API returns 'source' not 'source_id'
          target: edge.target,  // Note: API returns 'target' not 'target_id'
          weight: edge.weight || 1,
          type: edge.edge_type as any || edge.type || 'adjacency',
        }));

      // Debug: Edge filtering info (disabled - too verbose)
      // console.log(`Filtered ${edges.length} edges from ${edgesResponse.data.edges?.length || 0} total for ${nodes.length} nodes`);

      const graphData: GraphData = { nodes, edges };

      return {
        data: graphData,
        status: 'success',
        timestamp: Date.now(),
        metadata: {
          totalNodes: graphData.nodes.length,
          totalEdges: graphData.edges.length,
          filters,
          processingTime: 0,
        },
      };
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
      return {
        data: { nodes: [], edges: [] },
        status: 'error',
        message: 'Failed to fetch graph data',
        timestamp: Date.now(),
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          filters,
          processingTime: 0,
        },
      };
    }
  },

  // Get graph data for specific tracks
  async getTrackGraph(trackIds: string[], maxDepth: number = 2): Promise<GraphApiResponse> {
    const response = await graphApiClient.post<GraphData>('/api/graph/tracks', {
      trackIds,
      maxDepth,
    });

    return {
      ...response,
      metadata: {
        totalNodes: response.data.nodes?.length || 0,
        totalEdges: response.data.edges?.length || 0,
        processingTime: 0,
      },
    };
  },

  // Get neighborhood around specific node
  async getNodeNeighborhood(nodeId: string, radius: number = 1): Promise<GraphApiResponse> {
    const response = await graphApiClient.get<GraphData>(`/api/graph/neighborhood/${nodeId}`, {
      radius,
    });

    return {
      ...response,
      metadata: {
        totalNodes: response.data.nodes?.length || 0,
        totalEdges: response.data.edges?.length || 0,
        processingTime: 0,
      },
    };
  },

  // Update node positions (for layout persistence)
  async updateNodePositions(positions: Array<{ id: string; x: number; y: number }>): Promise<ApiResponse<boolean>> {
    return graphApiClient.post<boolean>('/api/graph/positions', { positions });
  },

  // Get graph statistics
  async getGraphStats(): Promise<ApiResponse<{
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    density: number;
    components: number;
  }>> {
    return graphApiClient.get('/api/graph/stats');
  },
};

// Search API
export const searchApi = {
  // Search tracks
  // NOTE: This endpoint doesn't exist on the backend yet, so this will fall back to
  // local Fuse.js search in TrackSearch.tsx component. This is intentional because:
  // 1. Local search only searches loaded graph nodes (required for camera centering)
  // 2. Backend would search entire DB (~31k tracks) vs loaded nodes (~5k)
  // 3. Camera centering requires the track to exist in the loaded graph data
  async searchTracks(query: string, filters?: SearchFilters): Promise<TrackSearchResponse> {
    const response = await apiClient.post<Array<{
      track: Track;
      score: number;
      matches: Array<{
        field: string;
        value: string;
        indices: number[][];
      }>;
    }>>('/v1/search/tracks', {
      query,
      filters,
    });

    return {
      data: response.data || [],
      status: response.status,
      timestamp: Date.now(),
      metadata: {
        query,
        totalResults: response.data?.length || 0,
        searchTime: 0,
        filters,
      },
    };
  },

  // Get search suggestions
  async getSearchSuggestions(query: string): Promise<ApiResponse<string[]>> {
    return apiClient.get('/v1/search/suggestions', { query });
  },

  // Get popular searches
  async getPopularSearches(): Promise<ApiResponse<string[]>> {
    return apiClient.get('/v1/search/popular');
  },

  // Get filters metadata (available genres, key ranges, etc.)
  async getFilterMetadata(): Promise<ApiResponse<{
    genres: string[];
    keyRanges: string[];
    bpmRange: [number, number];
    yearRange: [number, number];
    artists: { name: string; count: number }[];
  }>> {
    return apiClient.get('/v1/search/filters');
  },
};

// Track API
export const trackApi = {
  // Get track details
  async getTrackDetails(trackId: string): Promise<ApiResponse<Track>> {
    return apiClient.get(`/v1/tracks/${trackId}`);
  },

  // Get track relationships
  async getTrackRelationships(trackId: string): Promise<ApiResponse<{
    similar: Track[];
    collaborations: Track[];
    sameArtist: Track[];
    sameAlbum: Track[];
    keyCompatible: Track[];
  }>> {
    return apiClient.get(`/v1/tracks/${trackId}/relationships`);
  },

  // Get track audio features
  async getTrackFeatures(trackId: string): Promise<ApiResponse<{
    bpm: number;
    key: string;
    camelotKey: string;
    energy: number;
    danceability: number;
    valence: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    speechiness: number;
  }>> {
    return apiClient.get(`/v1/tracks/${trackId}/features`);
  },

  // Batch get multiple tracks
  async getTracks(trackIds: string[]): Promise<ApiResponse<Track[]>> {
    return apiClient.post('/v1/tracks/batch', { trackIds });
  },

  async getTrackPreview(trackId: string): Promise<ApiResponse<{ previewUrl: string }>> {
    return apiClient.get(`/v1/tracks/${trackId}/preview`);
  },
};

// Pathfinding API
export const pathfindingApi = {
  // Find path between tracks
  async findPath(
    startTrackId: string,
    endTrackId: string,
    waypoints: string[] = [],
    constraints?: any
  ): Promise<ApiResponse<{
    path: Array<{ trackId: string; weight: number; position: number }>;
    totalWeight: number;
    metadata: {
      searchTime: number;
      nodesExplored: number;
      algorithm: string;
    };
  }>> {
    return apiClient.post('/v1/pathfinding/find', {
      startTrackId,
      endTrackId,
      waypoints,
      constraints,
    });
  },

  // Validate waypoints reachability
  async validateWaypoints(
    startTrackId: string,
    endTrackId: string,
    waypoints: string[]
  ): Promise<ApiResponse<Array<{
    waypointId: string;
    isReachable: boolean;
    reachabilityScore: number;
    alternativeSuggestions?: string[];
  }>>> {
    return apiClient.post('/v1/pathfinding/validate', {
      startTrackId,
      endTrackId,
      waypoints,
    });
  },

  // Get path alternatives
  async getPathAlternatives(
    startTrackId: string,
    endTrackId: string,
    waypoints: string[] = [],
    count: number = 3
  ): Promise<ApiResponse<Array<{
    path: Array<{ trackId: string; weight: number; position: number }>;
    totalWeight: number;
    quality: number;
  }>>> {
    return apiClient.post('/v1/pathfinding/alternatives', {
      startTrackId,
      endTrackId,
      waypoints,
      count,
    });
  },
};

// Setlist API
export const setlistApi = {
  // Save setlist
  async saveSetlist(setlist: {
    name: string;
    tracks: Array<{ trackId: string; position: number }>;
    description?: string;
    tags?: string[];
  }): Promise<ApiResponse<{ id: string }>> {
    return apiClient.post('/v1/setlists', setlist);
  },

  // Get saved setlists
  async getSetlists(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    trackCount: number;
    duration: number;
    created_at: string;
    updated_at: string;
  }>>> {
    return apiClient.get('/v1/setlists');
  },

  // Get setlist details
  async getSetlist(setlistId: string): Promise<ApiResponse<{
    id: string;
    name: string;
    tracks: Array<{
      track: Track;
      position: number;
      transition_notes?: string;
    }>;
    created_at: string;
    updated_at: string;
  }>> {
    return apiClient.get(`/v1/setlists/${setlistId}`);
  },

  // Delete setlist
  async deleteSetlist(setlistId: string): Promise<ApiResponse<boolean>> {
    return apiClient.delete(`/v1/setlists/${setlistId}`);
  },

  // Export setlist to various formats
  async exportSetlist(setlistId: string, format: 'json' | 'csv' | 'txt' | 'm3u'): Promise<ApiResponse<string>> {
    return apiClient.get(`/v1/setlists/${setlistId}/export`, { format });
  },
};

// Health check API
export const healthApi = {
  // Check API health
  async checkHealth(): Promise<ApiResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;
    services: Record<string, 'up' | 'down'>;
  }>> {
    return apiClient.get('/health');
  },

  // Get system metrics
  async getMetrics(): Promise<ApiResponse<{
    requests: number;
    errors: number;
    avgResponseTime: number;
    memory: number;
    cpu: number;
  }>> {
    return apiClient.get('/metrics');
  },
};

// Create simple HTTP client for target tracks API
const createTargetTracksClient = () => {
  const baseURL = 'http://localhost:8080/api/v1';

  const request = async (method: string, url: string, data?: any) => {
    const response = await fetch(`${baseURL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  return {
    get: (url: string, params?: Record<string, any>) => {
      let fullUrl = url;
      if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.set(key, value.toString());
          }
        });
        const queryString = searchParams.toString();
        fullUrl = queryString ? `${url}?${queryString}` : url;
      }
      return request('GET', fullUrl);
    },
    post: (url: string, data?: any) => request('POST', url, data),
    put: (url: string, data?: any) => request('PUT', url, data),
    delete: (url: string) => request('DELETE', url),
  };
};

// Combined API object for easy importing
export const api = {
  graph: graphApi,
  search: searchApi,
  tracks: trackApi,
  pathfinding: pathfindingApi,
  setlist: setlistApi,
  health: healthApi,
  ...createTargetTracksClient(), // Add HTTP methods directly to api object
};

// Export individual APIs as well
export default api;
