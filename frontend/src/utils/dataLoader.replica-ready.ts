// ================================================
// DATA LOADER FOR REPLICA-READY DEPLOYMENT
// ================================================
// This version uses relative URLs that work through nginx
// No hardcoded service names or ports
// Supports load balancing and failover
// ================================================

export interface GraphData {
  nodes: Array<{
    id: string;
    label?: string;
    type?: string;
    x?: number;
    y?: number;
    size?: number;
    color?: string;
    metadata?: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    weight?: number;
    metadata?: Record<string, any>;
  }>;
}

const isSongNode = (n: { type?: string; metadata?: any }) => {
  const nodeType = n?.type || n?.metadata?.type || '';
  const t = nodeType.toString().toLowerCase();
  return t === 'track' || t === 'song';
};

const isSequentialEdge = (e: { type?: string }) => {
  const t = (e?.type || '').toLowerCase();
  return [
    'playlist_sequence',
    'dj_mix_transition',
    'song_transition',
    'played_next',
    'next',
    'previous',
    'follows',
    'sequential'
  ].includes(t);
};

/**
 * Load graph data from the API
 * Uses relative URLs that work through nginx load balancer
 * Automatically retries on failure for resilience
 */
export const loadGraphData = async (maxRetries: number = 3): Promise<GraphData | null> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎵 Loading graph data (attempt ${attempt}/${maxRetries})...`);

      // Use relative URL - nginx will route to appropriate service replica
      const apiUrl = '/api/v1/graph';

      const apiResponse = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'omit', // No credentials needed for graph data
      });

      if (!apiResponse.ok) {
        throw new Error(`API responded with status ${apiResponse.status}: ${apiResponse.statusText}`);
      }

      const apiData = await apiResponse.json();

      if (!apiData || !apiData.nodes || !apiData.edges) {
        throw new Error('Invalid API response structure');
      }

      console.log('✅ Loaded graph data:', {
        nodes: apiData.nodes.length,
        edges: apiData.edges.length,
        source: 'API'
      });

      // Filter and transform data
      const processedData = processGraphData(apiData);

      console.log('📊 Processed graph data:', {
        nodes: processedData.nodes.length,
        edges: processedData.edges.length,
        filteredNodes: apiData.nodes.length - processedData.nodes.length,
        filteredEdges: apiData.edges.length - processedData.edges.length
      });

      return processedData;

    } catch (error) {
      console.warn(`❌ Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        console.error('🚫 All attempts failed. Using fallback data.');
        return getFallbackData();
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return null;
};

/**
 * Process and filter graph data
 * Removes non-song nodes and invalid edges
 */
function processGraphData(data: any): GraphData {
  // Filter nodes to only include songs/tracks
  const validNodes = data.nodes.filter((node: any) => {
    const isValidSong = isSongNode(node);
    if (!isValidSong) {
      console.log('Filtering out non-song node:', {
        id: node.id,
        type: node.type,
        metadataType: node.metadata?.type,
        label: node.label || node.title
      });
    }
    return isValidSong;
  });

  const validNodeIds = new Set(validNodes.map((n: any) => n.id));

  // Filter edges to only connect valid nodes
  const validEdges = data.edges.filter((edge: any) => {
    const hasValidNodes = validNodeIds.has(edge.source) && validNodeIds.has(edge.target);
    const isValidEdgeType = isSequentialEdge(edge);

    return hasValidNodes && isValidEdgeType;
  });

  // Ensure nodes have required properties
  const processedNodes = validNodes.map((node: any) => ({
    id: node.id,
    label: node.label || node.title || node.metadata?.title || 'Unknown',
    type: node.type || node.metadata?.type || 'track',
    x: node.position?.x || node.x || Math.random() * 800 - 400,
    y: node.position?.y || node.y || Math.random() * 600 - 300,
    size: node.size || 5,
    color: node.color || '#8B5CF6',
    metadata: {
      ...node.metadata,
      title: node.title || node.label || node.metadata?.title || 'Unknown',
      artist: node.artist || node.metadata?.artist || 'Unknown Artist',
      type: node.type || node.metadata?.type || 'track'
    }
  }));

  // Ensure edges have required properties
  const processedEdges = validEdges.map((edge: any) => ({
    id: edge.id || `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'sequence',
    weight: edge.weight || 1,
    metadata: edge.metadata || {}
  }));

  return {
    nodes: processedNodes,
    edges: processedEdges
  };
}

/**
 * Fallback data for when API is unavailable
 * Provides minimal test data to keep application functional
 */
function getFallbackData(): GraphData {
  console.log('📦 Using fallback data');

  return {
    nodes: [
      {
        id: 'fallback-1',
        label: 'Fallback Track 1',
        type: 'track',
        x: -100,
        y: 0,
        size: 8,
        color: '#FF6B6B',
        metadata: {
          title: 'Fallback Track 1',
          artist: 'System',
          type: 'track'
        }
      },
      {
        id: 'fallback-2',
        label: 'Fallback Track 2',
        type: 'track',
        x: 100,
        y: 0,
        size: 8,
        color: '#4ECDC4',
        metadata: {
          title: 'Fallback Track 2',
          artist: 'System',
          type: 'track'
        }
      }
    ],
    edges: [
      {
        id: 'fallback-edge-1',
        source: 'fallback-1',
        target: 'fallback-2',
        type: 'sequence',
        weight: 1,
        metadata: {}
      }
    ]
  };
}

/**
 * Test API connectivity
 * Used for health checks and debugging
 */
export const testApiConnectivity = async (): Promise<boolean> => {
  try {
    const response = await fetch('/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    console.warn('API connectivity test failed:', error);
    return false;
  }
};

/**
 * Get API status information
 * Useful for debugging and monitoring
 */
export const getApiStatus = async (): Promise<any> => {
  try {
    const response = await fetch('/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      return await response.json();
    } else {
      return { status: 'error', statusCode: response.status };
    }
  } catch (error) {
    return { status: 'error', error: error.message };
  }
};