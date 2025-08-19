import {
  GetGraphRequest,
  GetNodeRequest,
  GetRelationshipsRequest,
  ApiResponse,
  ApiError,
} from '@types/api';
import { Graph, SongNode } from '@types/graph';

class GraphService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = '/api/v1', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  async getGraph(request: GetGraphRequest = {}): Promise<ApiResponse<Graph>> {
    const searchParams = new URLSearchParams();
    
    if (request.limit) searchParams.set('limit', request.limit.toString());
    if (request.offset) searchParams.set('offset', request.offset.toString());
    if (request.layout) searchParams.set('layout', request.layout);
    
    // Handle filters
    if (request.filters) {
      if (request.filters.genres) {
        searchParams.set('genres', request.filters.genres.join(','));
      }
      if (request.filters.artists) {
        searchParams.set('artists', request.filters.artists.join(','));
      }
      if (request.filters.yearRange) {
        searchParams.set('yearFrom', request.filters.yearRange[0].toString());
        searchParams.set('yearTo', request.filters.yearRange[1].toString());
      }
      if (request.filters.bpmRange) {
        searchParams.set('bpmFrom', request.filters.bpmRange[0].toString());
        searchParams.set('bpmTo', request.filters.bpmRange[1].toString());
      }
      if (request.filters.popularity) {
        searchParams.set('popularityMin', request.filters.popularity.toString());
      }
    }
    
    // Handle include options
    if (request.include) {
      if (request.include.relationships !== undefined) {
        searchParams.set('includeRelationships', request.include.relationships.toString());
      }
      if (request.include.audioFeatures !== undefined) {
        searchParams.set('includeAudioFeatures', request.include.audioFeatures.toString());
      }
      if (request.include.metadata !== undefined) {
        searchParams.set('includeMetadata', request.include.metadata.toString());
      }
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/visualization/graph${queryString ? `?${queryString}` : ''}`;
    
    return this.request<Graph>(endpoint);
  }

  async getNodeDetails(nodeId: string, options: Omit<GetNodeRequest, 'nodeId'> = {}): Promise<ApiResponse<{ node: SongNode }>> {
    const searchParams = new URLSearchParams();
    
    if (options.includeRelationships !== undefined) {
      searchParams.set('includeRelationships', options.includeRelationships.toString());
    }
    if (options.relationshipDepth !== undefined) {
      searchParams.set('relationshipDepth', options.relationshipDepth.toString());
    }
    if (options.includeAudioAnalysis !== undefined) {
      searchParams.set('includeAudioAnalysis', options.includeAudioAnalysis.toString());
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/visualization/node/${nodeId}${queryString ? `?${queryString}` : ''}`;
    
    return this.request<{ node: SongNode }>(endpoint);
  }

  async getRelationships(request: GetRelationshipsRequest): Promise<ApiResponse<any>> {
    const { nodeId, ...params } = request;
    const searchParams = new URLSearchParams();
    
    if (params.depth !== undefined) {
      searchParams.set('depth', params.depth.toString());
    }
    if (params.types) {
      searchParams.set('types', params.types.join(','));
    }
    if (params.minWeight !== undefined) {
      searchParams.set('minWeight', params.minWeight.toString());
    }
    if (params.direction) {
      searchParams.set('direction', params.direction);
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params.includeIndirect !== undefined) {
      searchParams.set('includeIndirect', params.includeIndirect.toString());
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/visualization/relationships/${nodeId}${queryString ? `?${queryString}` : ''}`;
    
    return this.request<any>(endpoint);
  }

  async getSimilarSongs(nodeId: string, options: {
    limit?: number;
    threshold?: number;
    attributes?: string[];
    includeReasons?: boolean;
  } = {}): Promise<ApiResponse<{ results: SongNode[] }>> {
    const searchParams = new URLSearchParams();
    
    if (options.limit !== undefined) {
      searchParams.set('limit', options.limit.toString());
    }
    if (options.threshold !== undefined) {
      searchParams.set('threshold', options.threshold.toString());
    }
    if (options.attributes) {
      searchParams.set('attributes', options.attributes.join(','));
    }
    if (options.includeReasons !== undefined) {
      searchParams.set('includeReasons', options.includeReasons.toString());
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/visualization/similar/${nodeId}${queryString ? `?${queryString}` : ''}`;
    
    return this.request<{ results: SongNode[] }>(endpoint);
  }

  async getGraphStatistics(): Promise<ApiResponse<any>> {
    return this.request<any>('/visualization/analytics/statistics');
  }

  async detectClusters(options: {
    algorithm?: 'louvain' | 'kmeans' | 'hierarchical' | 'spectral';
    resolution?: number;
    minSize?: number;
    maxClusters?: number;
  } = {}): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    
    if (options.algorithm) {
      searchParams.set('algorithm', options.algorithm);
    }
    if (options.resolution !== undefined) {
      searchParams.set('resolution', options.resolution.toString());
    }
    if (options.minSize !== undefined) {
      searchParams.set('minSize', options.minSize.toString());
    }
    if (options.maxClusters !== undefined) {
      searchParams.set('maxClusters', options.maxClusters.toString());
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/visualization/analytics/clusters${queryString ? `?${queryString}` : ''}`;
    
    return this.request<any>(endpoint);
  }

  async getGraphInsights(options: {
    types?: string[];
    limit?: number;
    context?: string;
  } = {}): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    
    if (options.types) {
      searchParams.set('types', options.types.join(','));
    }
    if (options.limit !== undefined) {
      searchParams.set('limit', options.limit.toString());
    }
    if (options.context) {
      searchParams.set('context', options.context);
    }
    
    const queryString = searchParams.toString();
    const endpoint = `/visualization/analytics/insights${queryString ? `?${queryString}` : ''}`;
    
    return this.request<any>(endpoint);
  }

  // Utility methods
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<any>('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
export const graphService = new GraphService();
export default graphService;