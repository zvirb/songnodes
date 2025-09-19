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

  constructor(baseUrl: string = 'http://localhost:8090/api/v1', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    fallback?: T
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
        if (response.status === 404 || response.status === 405) {
          // Endpoint not found or method not allowed - return fallback if provided
          if (fallback !== undefined) {
            console.warn(`Endpoint ${endpoint} not available (${response.status}), using fallback`);
            return { data: fallback, success: true, message: 'Using fallback data' };
          }
        }
        
        let errorMessage;
        try {
          const errorData: ApiError = await response.json();
          errorMessage = errorData.error?.message || errorData.detail || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const jsonData = await response.json();
      
      // Check if the response is already in ApiResponse format
      if (jsonData && typeof jsonData === 'object' && 'data' in jsonData && 'success' in jsonData) {
        return jsonData;
      }
      
      // Wrap raw data in ApiResponse format
      return {
        data: jsonData,
        success: true,
        message: 'Success'
      };
    } catch (error) {
      if (error instanceof Error) {
        // If it's a network error and we have a fallback, use it
        if (fallback !== undefined && (error.name === 'TypeError' || error.message.includes('fetch'))) {
          console.warn(`Network error for ${endpoint}, using fallback:`, error.message);
          return { data: fallback, success: false, message: `Service unavailable: ${error.message}` };
        }
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  async getGraph(request: GetGraphRequest = {}): Promise<ApiResponse<Graph>> {
    const endpoint = `/visualization/graph`;
    
    // Convert frontend request format to backend format
    const body = {
      center_node_id: request.centerNodeId,
      max_depth: request.depth || 3,
      max_nodes: request.limit || 100,
      filters: request.filters || {},
    };
    
    // Remove undefined values
    Object.keys(body).forEach(key => {
      if (body[key as keyof typeof body] === undefined) {
        delete body[key as keyof typeof body];
      }
    });
    
    // Fallback empty graph
    const fallbackGraph: Graph = {
      nodes: [],
      edges: [],
      metadata: {
        total_nodes: 0,
        total_edges: 0,
        center_node: null,
        max_depth: 3,
        generated_at: new Date().toISOString()
      }
    };
    
    return this.request<Graph>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }, fallbackGraph);
  }

  async getNodeDetails(nodeId: string, options: Omit<GetNodeRequest, 'nodeId'> = {}): Promise<ApiResponse<{ node: SongNode }>> {
    // This endpoint doesn't exist in the backend, so we'll try to get the node from the graph
    // No fallback data - return error if node is not found
    
    try {
      // Try to get the node by requesting a graph centered on this node
      const graphResponse = await this.getGraph({
        centerNodeId: nodeId,
        limit: 1,
        depth: 1
      });

      if (graphResponse.data.nodes.length > 0) {
        const node = graphResponse.data.nodes.find(n => n.id === nodeId) || graphResponse.data.nodes[0];
        return {
          data: { node },
          success: true,
          message: 'Node found via graph query'
        };
      }
    } catch (error) {
      console.warn('Failed to get node via graph query:', error);
    }

    // Return error instead of fallback
    throw new Error('Node not found and no fallback data available');
  }

  async getRelationships(request: GetRelationshipsRequest): Promise<ApiResponse<any>> {
    const { nodeId, ...params } = request;
    
    // This endpoint doesn't exist, so we'll get relationships via graph query
    try {
      const graphResponse = await this.getGraph({
        centerNodeId: nodeId,
        limit: params.limit || 50,
        depth: params.depth || 2
      });
      
      // Filter edges related to this node
      const relationships = graphResponse.data.edges.filter(edge => 
        edge.source_id === nodeId || edge.target_id === nodeId
      );
      
      return {
        data: {
          relationships,
          total: relationships.length,
          node_id: nodeId
        },
        success: true,
        message: 'Relationships found via graph query'
      };
    } catch (error) {
      console.warn('Failed to get relationships:', error);
      return {
        data: {
          relationships: [],
          total: 0,
          node_id: nodeId
        },
        success: false,
        message: 'Relationships service unavailable'
      };
    }
  }

  async getSimilarSongs(nodeId: string, options: {
    limit?: number;
    threshold?: number;
    attributes?: string[];
    includeReasons?: boolean;
  } = {}): Promise<ApiResponse<{ results: SongNode[] }>> {
    // This endpoint doesn't exist, so we'll find similar songs via graph connectivity
    try {
      const graphResponse = await this.getGraph({
        centerNodeId: nodeId,
        limit: options.limit || 20,
        depth: 2
      });
      
      // Find connected nodes (similar songs)
      const connectedNodes = graphResponse.data.nodes.filter(node => 
        node.id !== nodeId && graphResponse.data.edges.some(edge =>
          (edge.source_id === nodeId && edge.target_id === node.id) ||
          (edge.target_id === nodeId && edge.source_id === node.id)
        )
      );
      
      return {
        data: { results: connectedNodes },
        success: true,
        message: 'Similar songs found via graph connectivity'
      };
    } catch (error) {
      console.warn('Failed to get similar songs:', error);
      return {
        data: { results: [] },
        success: false,
        message: 'Similar songs service unavailable'
      };
    }
  }

  async getGraphStatistics(): Promise<ApiResponse<any>> {
    const fallbackStats = {
      total_nodes: 0,
      total_edges: 0,
      avg_degree: 0,
      max_degree: 0,
      connected_components: 1,
      clustering_coefficient: 0,
      status: 'Statistics service offline'
    };
    
    // Try to compute basic stats from a graph query
    try {
      const graphResponse = await this.getGraph({ limit: 1000 });
      const stats = {
        total_nodes: graphResponse.data.nodes.length,
        total_edges: graphResponse.data.edges.length,
        avg_degree: graphResponse.data.edges.length > 0 ? (graphResponse.data.edges.length * 2) / graphResponse.data.nodes.length : 0,
        max_degree: 0, // Would need more complex calculation
        connected_components: 1, // Simplified
        clustering_coefficient: 0, // Would need complex calculation
        computed_from: 'graph_sample'
      };
      
      return {
        data: stats,
        success: true,
        message: 'Basic statistics computed from graph sample'
      };
    } catch (error) {
      console.warn('Failed to compute graph statistics:', error);
    }
    
    return {
      data: fallbackStats,
      success: false,
      message: 'Statistics service unavailable'
    };
  }

  async detectClusters(options: {
    algorithm?: 'louvain' | 'kmeans' | 'hierarchical' | 'spectral';
    resolution?: number;
    minSize?: number;
    maxClusters?: number;
  } = {}): Promise<ApiResponse<any>> {
    const fallbackClusters = {
      clusters: [],
      algorithm: options.algorithm || 'unavailable',
      total_clusters: 0,
      modularity: 0,
      status: 'Cluster detection service offline'
    };
    
    return {
      data: fallbackClusters,
      success: false,
      message: 'Cluster detection service unavailable - would need advanced analytics backend'
    };
  }

  async getGraphInsights(options: {
    types?: string[];
    limit?: number;
    context?: string;
  } = {}): Promise<ApiResponse<any>> {
    const fallbackInsights = {
      insights: [],
      total: 0,
      context: options.context || 'general',
      status: 'Insights service offline'
    };
    
    return {
      data: fallbackInsights,
      success: false,
      message: 'Graph insights service unavailable - would need AI analytics backend'
    };
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
      // Health endpoint is at root level, not under /api/v1
      // In development, use proxy; in production, use direct backend URL
      const healthUrl = process.env.NODE_ENV === 'production' 
        ? 'http://localhost:8084/health' 
        : '/health';
      const response = await fetch(healthUrl);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
export const graphService = new GraphService();
export default graphService;