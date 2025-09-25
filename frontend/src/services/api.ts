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
      console.log(`[API] ${options.method || 'GET'} ${url} (${requestId})`);

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
      console.log(`[API] Response ${response.status} in ${responseTime}ms (${requestId})`);

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
    const url = new URL(endpoint, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, v.toString()));
          } else {
            url.searchParams.set(key, value.toString());
          }
        }
      });
    }

    return this.request<T>(url.pathname + url.search, {
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
const apiClient = new ApiClient();
const graphApiClient = new ApiClient('/graph-api'); // Proxy to graph visualization service

// Graph data API
export const graphApi = {
  // Get full graph data
  async getGraphData(filters?: SearchFilters): Promise<GraphApiResponse> {
    const params = filters ? { filters: JSON.stringify(filters) } : undefined;
    const response = await graphApiClient.get<GraphData>('/api/graph/data', params);

    return {
      ...response,
      metadata: {
        totalNodes: response.data.nodes?.length || 0,
        totalEdges: response.data.edges?.length || 0,
        filters,
        processingTime: 0, // This would come from the backend
      },
    };
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
  async searchTracks(query: string, filters?: SearchFilters): Promise<TrackSearchResponse> {
    const startTime = Date.now();

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

    const searchTime = Date.now() - startTime;

    return {
      ...response,
      metadata: {
        query,
        totalResults: response.data.length,
        searchTime,
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

// Combined API object for easy importing
export const api = {
  graph: graphApi,
  search: searchApi,
  tracks: trackApi,
  pathfinding: pathfindingApi,
  setlist: setlistApi,
  health: healthApi,
};

// Export individual APIs as well
export default api;