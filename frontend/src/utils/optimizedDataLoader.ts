/**
 * Optimized data loader with progressive loading and memory management
 */

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  metadata?: Record<string, any>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  metadata?: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalNodes?: number;
  totalEdges?: number;
  hasMore?: boolean;
}

interface LoadOptions {
  offset?: number;
  limit?: number;
  filterToSongs?: boolean;
  progressCallback?: (progress: number) => void;
}

class DataCache {
  private nodeCache: Map<string, GraphNode> = new Map();
  private edgeCache: Map<string, GraphEdge> = new Map();
  private lastFetch: number = 0;
  private cacheDuration: number = 5 * 60 * 1000; // 5 minutes

  isExpired(): boolean {
    return Date.now() - this.lastFetch > this.cacheDuration;
  }

  clear(): void {
    this.nodeCache.clear();
    this.edgeCache.clear();
    this.lastFetch = 0;
  }

  setNodes(nodes: GraphNode[]): void {
    nodes.forEach(node => this.nodeCache.set(node.id, node));
    this.lastFetch = Date.now();
  }

  setEdges(edges: GraphEdge[]): void {
    edges.forEach(edge => this.edgeCache.set(edge.id, edge));
    this.lastFetch = Date.now();
  }

  getNodes(): GraphNode[] {
    return Array.from(this.nodeCache.values());
  }

  getEdges(): GraphEdge[] {
    return Array.from(this.edgeCache.values());
  }

  hasData(): boolean {
    return this.nodeCache.size > 0 || this.edgeCache.size > 0;
  }
}

class ProgressiveDataLoader {
  private cache: DataCache = new DataCache();
  private loadingPromise: Promise<GraphData> | null = null;
  private currentOffset: number = 0;
  private pageSize: number = 100;
  private totalNodes: number = 0;
  private totalEdges: number = 0;

  private isSongNode(node: { type?: string }): boolean {
    const type = (node?.type || '').toLowerCase();
    return type === 'track' || type === 'song';
  }

  private isSequentialEdge(edge: { type?: string }): boolean {
    const type = (edge?.type || '').toLowerCase();
    return [
      'playlist_sequence',
      'dj_mix_transition',
      'song_transition',
      'played_next',
      'next',
      'previous',
      'followed_by',
      'preceded_by',
      'adjacent',
      'setlist_adjacent',
      'track_adjacency',
      'adjacency'
    ].includes(type);
  }

  async loadInitialData(options: LoadOptions = {}): Promise<GraphData> {
    const { limit = 100, progressCallback } = options;

    if (this.cache.hasData() && !this.cache.isExpired()) {
      console.log('📦 Using cached data');
      return {
        nodes: this.cache.getNodes(),
        edges: this.cache.getEdges(),
        totalNodes: this.totalNodes,
        totalEdges: this.totalEdges,
        hasMore: this.currentOffset < this.totalNodes
      };
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadData(0, limit, progressCallback);
    const result = await this.loadingPromise;
    this.loadingPromise = null;
    return result;
  }

  async loadMoreData(options: LoadOptions = {}): Promise<GraphData> {
    const { limit = 100, progressCallback } = options;

    if (this.currentOffset >= this.totalNodes) {
      return {
        nodes: [],
        edges: [],
        totalNodes: this.totalNodes,
        totalEdges: this.totalEdges,
        hasMore: false
      };
    }

    return this.loadData(this.currentOffset, limit, progressCallback);
  }

  private async loadData(
    offset: number,
    limit: number,
    progressCallback?: (progress: number) => void
  ): Promise<GraphData> {
    try {
      console.log(`🔄 Loading data: offset=${offset}, limit=${limit}`);

      progressCallback?.(0);

      // Fetch nodes with pagination
      const nodesResponse = await fetch(`/api/v1/graph/nodes?offset=${offset}&limit=${limit}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      progressCallback?.(25);

      if (!nodesResponse.ok) {
        throw new Error(`Failed to fetch nodes: ${nodesResponse.statusText}`);
      }

      const nodesData = await nodesResponse.json();
      const nodes = nodesData.nodes || [];
      this.totalNodes = nodesData.total || nodes.length;

      progressCallback?.(50);

      // Calculate edge limit based on node count (roughly n^1.5 edges expected)
      const edgeLimit = Math.min(limit * 10, 10000);
      const edgeOffset = offset * 10;

      // Fetch edges with pagination
      const edgesResponse = await fetch(
        `/api/v1/graph/edges?offset=${edgeOffset}&limit=${edgeLimit}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      progressCallback?.(75);

      if (!edgesResponse.ok) {
        throw new Error(`Failed to fetch edges: ${edgesResponse.statusText}`);
      }

      const edgesData = await edgesResponse.json();
      const edges = edgesData.edges || [];
      this.totalEdges = edgesData.total || edges.length;

      // Process and format data
      const processedNodes = this.processNodes(nodes);
      const processedEdges = this.processEdges(edges, processedNodes);

      // Update cache
      if (offset === 0) {
        this.cache.clear();
      }
      this.cache.setNodes(processedNodes);
      this.cache.setEdges(processedEdges);

      this.currentOffset = offset + limit;

      progressCallback?.(100);

      console.log(`✅ Loaded ${processedNodes.length} nodes, ${processedEdges.length} edges`);

      return {
        nodes: processedNodes,
        edges: processedEdges,
        totalNodes: this.totalNodes,
        totalEdges: this.totalEdges,
        hasMore: this.currentOffset < this.totalNodes
      };
    } catch (error) {
      console.error('❌ Error loading graph data:', error);
      progressCallback?.(100);
      return {
        nodes: [],
        edges: [],
        totalNodes: 0,
        totalEdges: 0,
        hasMore: false
      };
    }
  }

  private processNodes(nodes: any[]): GraphNode[] {
    return nodes.map((node: any) => {
      const label = node.metadata?.label || '';
      let title = label;
      let artist = '';

      // Extract artist and title from label
      if (label.includes(' - ')) {
        const parts = label.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      } else if (label.includes(' – ')) {
        const parts = label.split(' – ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' – ').trim();
      }

      return {
        id: node.id,
        label: label || `${node.metadata?.title || 'Unknown'} - ${node.metadata?.artist || 'Unknown'}`,
        title: title || node.metadata?.title || label || 'Unknown',
        artist: artist || node.metadata?.artist || '',
        type: 'track',
        size: 12,
        x: node.position?.x || node.x_position,
        y: node.position?.y || node.y_position,
        metadata: {
          ...node.metadata,
          title: title || node.metadata?.title,
          artist: artist || node.metadata?.artist
        }
      };
    });
  }

  private processEdges(edges: any[], nodes: GraphNode[]): GraphEdge[] {
    const nodeSet = new Set(nodes.map(n => n.id));

    return edges
      .filter((edge: any) => {
        // Only include edges where both nodes are in current set
        return nodeSet.has(edge.source_id) && nodeSet.has(edge.target_id);
      })
      .map((edge: any) => ({
        id: edge.id,
        source: edge.source_id,
        target: edge.target_id,
        type: edge.edge_type || 'adjacency',
        weight: edge.weight || 1,
        metadata: edge.metadata || {}
      }));
  }

  clearCache(): void {
    this.cache.clear();
    this.currentOffset = 0;
    this.totalNodes = 0;
    this.totalEdges = 0;
  }

  async preloadNextPage(): Promise<void> {
    if (this.currentOffset >= this.totalNodes) return;

    // Preload next page in background
    this.loadData(this.currentOffset, this.pageSize).catch(err => {
      console.warn('Background preload failed:', err);
    });
  }
}

// Singleton instance
const dataLoader = new ProgressiveDataLoader();

// Export convenient functions
export const loadGraphData = async (options: LoadOptions = {}): Promise<GraphData> => {
  return dataLoader.loadInitialData(options);
};

export const loadMoreGraphData = async (options: LoadOptions = {}): Promise<GraphData> => {
  return dataLoader.loadMoreData(options);
};

export const preloadNextPage = async (): Promise<void> => {
  return dataLoader.preloadNextPage();
};

export const clearDataCache = (): void => {
  dataLoader.clearCache();
};

// Memory monitoring utilities
export const getMemoryUsage = (): { used: number; limit: number; percentage: number } | null => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize;
    const limit = memory.jsHeapSizeLimit;
    return {
      used: Math.round(used / 1048576), // Convert to MB
      limit: Math.round(limit / 1048576), // Convert to MB
      percentage: Math.round((used / limit) * 100)
    };
  }
  return null;
};

export const shouldReduceMemory = (): boolean => {
  const memory = getMemoryUsage();
  if (!memory) return false;
  return memory.percentage > 80; // Reduce if using more than 80% of heap
};