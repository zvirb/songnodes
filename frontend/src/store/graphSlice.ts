import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  Graph, 
  SongNode, 
  GraphEdge, 
  NodeVisual, 
  EdgeVisual, 
  LayoutAlgorithm,
  LayoutOptions,
  GraphBounds
} from '@types/graph';
import { GetGraphRequest, ApiResponse } from '@types/api';
import { graphService } from '@services/graphService';

// Utility function to ensure arrays for Redux serialization
function ensureArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object' && 'has' in value) {
    // Handle Set-like objects
    return Array.from(value as any);
  }
  if (value && typeof value === 'object' && 'keys' in value) {
    // Handle Map-like objects
    return Array.from((value as any).keys());
  }
  return [];
}

interface GraphState {
  // Data
  nodes: NodeVisual[];
  edges: EdgeVisual[];
  originalGraph: Graph | null;
  
  // Layout
  layoutAlgorithm: LayoutAlgorithm;
  layoutOptions: LayoutOptions;
  layoutInProgress: boolean;
  bounds: GraphBounds | null;
  
  // Selection and interaction
  selectedNodes: string[];
  hoveredNode: string | null;
  highlightedPath: string[];
  
  // Visibility and LOD
  visibleNodes: string[];
  visibleEdges: string[];
  lodLevel: number;
  
  // Loading states
  loading: boolean;
  error: string | null;
  loadingProgress: number;
  
  // Cache (stored as objects for Redux serialization)
  nodeMap: Record<string, NodeVisual>;
  edgeMap: Record<string, EdgeVisual>;
  adjacencyList: Record<string, string[]>;
  excludedNodes: string[];
}

const initialState: GraphState = {
  nodes: [],
  edges: [],
  originalGraph: null,
  
  layoutAlgorithm: LayoutAlgorithm.FORCE_DIRECTED,
  layoutOptions: {
    algorithm: LayoutAlgorithm.FORCE_DIRECTED,
    forceDirected: {
      linkDistance: 100,
      linkStrength: 0.1,
      chargeStrength: -300,
      chargeTheta: 0.8,
      alpha: 1,
      alphaDecay: 0.0228,
      velocityDecay: 0.4,
      iterations: 300,
      centering: true,
      collisionRadius: 10,
    },
  },
  layoutInProgress: false,
  bounds: null,
  
  selectedNodes: [],
  hoveredNode: null,
  highlightedPath: [],
  
  visibleNodes: [],
  visibleEdges: [],
  lodLevel: 0,
  
  loading: false,
  error: null,
  loadingProgress: 0,
  
  nodeMap: {},
  edgeMap: {},
  adjacencyList: {},
  excludedNodes: [],
};

// Async thunks
export const fetchGraph = createAsyncThunk(
  'graph/fetchGraph',
  async (request: GetGraphRequest, { rejectWithValue }) => {
    try {
      console.log('🚀 Fetching graph with request:', request);
      const response = await graphService.getGraph(request);
      console.log('📊 Graph API response:', response);
      console.log('🎵 Number of nodes received:', response.data?.nodes?.length || 0);
      console.log('🔗 Number of edges received:', response.data?.edges?.length || 0);
      return response.data;
    } catch (error) {
      console.error('❌ Graph fetch error:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch graph'
      );
    }
  }
);

export const fetchNodeDetails = createAsyncThunk(
  'graph/fetchNodeDetails',
  async (nodeId: string, { rejectWithValue }) => {
    try {
      const response = await graphService.getNodeDetails(nodeId);
      return response.data.node;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch node details'
      );
    }
  }
);

export const fetchRelationships = createAsyncThunk(
  'graph/fetchRelationships',
  async (
    { nodeId, depth = 1 }: { nodeId: string; depth?: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await graphService.getRelationships({
        nodeId,
        depth,
        direction: 'both',
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch relationships'
      );
    }
  }
);

// Helper: determine if an edge represents a valid song-to-song sequential relationship
function isSequentialSongEdge(
  edge: any,
  nodeMap: Record<string, NodeVisual>
): boolean {
  const sourceId = edge.source || edge.source_id;
  const targetId = edge.target || edge.target_id;
  if (!sourceId || !targetId) return false;

  const source = nodeMap[sourceId];
  const target = nodeMap[targetId];
  if (!source || !target) return false;

  // Only connect track/song nodes
  const trackTypes = new Set(['track', 'song']);
  if (!trackTypes.has((source as any).type) || !trackTypes.has((target as any).type)) {
    return false;
  }

  // Accept only edges that explicitly denote sequential transitions
  const edgeType = (edge.type || edge.edge_type || '').toString().toLowerCase();
  const allowedTypes = new Set([
    'playlist_sequence',
    'dj_mix_transition',
    'song_transition',
    'played_next',
    'next',
    'previous',
    'followed_by',
    'preceded_by',
    'adjacent',
  ]);

  if (allowedTypes.has(edgeType)) return true;

  // Fallback: metadata hint
  const md = edge.metadata || {};
  if (md?.relation === 'adjacent' || md?.sequence === 'next' || md?.sequence === 'previous') {
    return true;
  }

  return false;
}

// Helper: hide pure location nodes from visualization
function shouldIncludeNode(node: any): boolean {
  const t = (node?.type || node?.metadata?.type || '').toString().toLowerCase();
  // Only include songs/tracks; hide artists, venues, locations, events, etc.
  return t === 'track' || t === 'song';
}

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    // Data management
    setNodes: (state, action: PayloadAction<NodeVisual[]>) => {
      const nodes = (action.payload || []).filter(shouldIncludeNode) as NodeVisual[];
      state.nodes = nodes;

      // Update node map for quick lookups
      state.nodeMap = {};
      nodes.forEach(node => {
        state.nodeMap[node.id] = node;
      });

      // Update visible nodes
      state.visibleNodes = nodes.map(n => n.id);

      console.log('🎯 Redux setNodes: Set', nodes.length, 'nodes');
    },

    setEdges: (state, action: PayloadAction<EdgeVisual[]>) => {
      // Normalize/Filter edges to only include sequential song transitions
      const incomingEdges = action.payload || [];

      // Generate deterministic IDs if missing to keep Redux maps stable
      const withIds = incomingEdges.map((e: any, idx: number) => ({
        id: e.id || `${e.source || e.source_id}->${e.target || e.target_id}` || `edge_${idx}`,
        ...e,
        source: e.source || e.source_id,
        target: e.target || e.target_id,
      }));

      // Filter to sequential song edges when possible; if none match but input had edges,
      // keep original edges to avoid rendering an empty demo unintentionally.
      const filtered = withIds.filter(edge => isSequentialSongEdge(edge, state.nodeMap));
      const edges = filtered.length > 0 ? filtered : withIds.filter(edge => {
        // Exclude location/venue/artist structural edges explicitly
        const t = (edge.type || edge.edge_type || '').toString().toLowerCase();
        return !(t === 'located_in' || t === 'performed_at' || t === 'played_at' || t === 'performed');
      });

      state.edges = edges as any;

      // Update edge map for quick lookups
      state.edgeMap = {};
      edges.forEach(edge => {
        state.edgeMap[edge.id] = edge;
      });

      // Update visible edges
      state.visibleEdges = edges.map(e => e.id);

      // Update adjacency list for relationships
      state.adjacencyList = {};
      edges.forEach(edge => {
        if (!state.adjacencyList[edge.source]) {
          state.adjacencyList[edge.source] = [];
        }
        if (!state.adjacencyList[edge.target]) {
          state.adjacencyList[edge.target] = [];
        }
        state.adjacencyList[edge.source].push(edge.target);
        state.adjacencyList[edge.target].push(edge.source);
      });

      console.log('🔗 Redux setEdges: Set', edges.length, 'edges');
    },

    // Node management
    updateNodePositions: (
      state,
      action: PayloadAction<Array<{ id: string; x: number; y: number }>>
    ) => {
      action.payload.forEach(({ id, x, y }) => {
        const node = state.nodeMap[id];
        if (node) {
          node.x = x;
          node.y = y;
        }
      });
    },
    
    updateNodeVisuals: (
      state,
      action: PayloadAction<Array<{ id: string; updates: Partial<NodeVisual> }>>
    ) => {
      action.payload.forEach(({ id, updates }) => {
        const node = state.nodeMap[id];
        if (node) {
          Object.assign(node, updates);
        }
      });
    },
    
    setSelectedNodes: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      // Clear previous selection
      state.selectedNodes.forEach(nodeId => {
        const node = state.nodeMap[nodeId];
        if (node) node.selected = false;
      });
      
      // Set new selection
      state.selectedNodes = payload;
      state.selectedNodes.forEach(nodeId => {
        const node = state.nodeMap[nodeId];
        if (node) node.selected = true;
      });
    },
    
    addToSelection: (state, action: PayloadAction<string>) => {
      if (!state.selectedNodes.includes(action.payload)) {
        state.selectedNodes.push(action.payload);
      }
      const node = state.nodeMap[action.payload];
      if (node) node.selected = true;
    },
    
    removeFromSelection: (state, action: PayloadAction<string>) => {
      state.selectedNodes = state.selectedNodes.filter(id => id !== action.payload);
      const node = state.nodeMap[action.payload];
      if (node) node.selected = false;
    },
    
    clearSelection: (state) => {
      state.selectedNodes.forEach(nodeId => {
        const node = state.nodeMap[nodeId];
        if (node) node.selected = false;
      });
      state.selectedNodes = [];
    },
    
    setHoveredNode: (state, action: PayloadAction<string | null>) => {
      // Clear previous hover
      if (state.hoveredNode) {
        const prevNode = state.nodeMap[state.hoveredNode];
        if (prevNode) prevNode.highlighted = false;
      }
      
      // Set new hover
      state.hoveredNode = action.payload;
      if (action.payload) {
        const node = state.nodeMap[action.payload];
        if (node) node.highlighted = true;
      }
    },
    
    setHighlightedPath: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      // Clear previous highlights
      state.highlightedPath.forEach(nodeId => {
        const node = state.nodeMap[nodeId];
        if (node) node.highlighted = false;
      });
      
      // Set new highlights
      state.highlightedPath = payload;
      state.highlightedPath.forEach(nodeId => {
        const node = state.nodeMap[nodeId];
        if (node) node.highlighted = true;
      });
    },
    
    // Layout management
    setLayoutAlgorithm: (state, action: PayloadAction<LayoutAlgorithm>) => {
      state.layoutAlgorithm = action.payload;
      state.layoutOptions.algorithm = action.payload;
    },
    
    updateLayoutOptions: (state, action: PayloadAction<Partial<LayoutOptions>>) => {
      state.layoutOptions = { ...state.layoutOptions, ...action.payload };
    },
    
    setLayoutInProgress: (state, action: PayloadAction<boolean>) => {
      state.layoutInProgress = action.payload;
    },
    
    updateBounds: (state, action: PayloadAction<GraphBounds>) => {
      state.bounds = action.payload;
    },
    
    // Visibility and LOD
    setVisibleNodes: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      state.visibleNodes = payload;
      // Use array includes instead of Set for Redux serialization compatibility
      const visibleIds = payload;
      state.nodes.forEach(node => {
        node.visible = visibleIds.includes(node.id) && !state.excludedNodes.includes(node.id);
      });
    },
    
    setVisibleEdges: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      state.visibleEdges = payload;
      // Use array includes instead of Set for Redux serialization compatibility
      const visibleIds = payload;
      state.edges.forEach(edge => {
        const hide = state.excludedNodes.includes(edge.source) || state.excludedNodes.includes(edge.target);
        edge.visible = visibleIds.includes(edge.id) && !hide;
      });
    },

    setExcludedNodes: (state, action: PayloadAction<string[]>) => {
      state.excludedNodes = ensureArray(action.payload);
      // Recompute node and edge visibility based on exclusions
      state.nodes.forEach(n => { n.visible = !state.excludedNodes.includes(n.id); });
      state.visibleNodes = state.nodes.filter(n => n.visible).map(n => n.id);
      state.edges.forEach(e => { e.visible = !state.excludedNodes.includes(e.source) && !state.excludedNodes.includes(e.target); });
      state.visibleEdges = state.edges.filter(e => e.visible).map(e => e.id);
    },
    
    setLodLevel: (state, action: PayloadAction<number>) => {
      state.lodLevel = action.payload;
    },
    
    // Utility
    resetGraph: (state) => {
      return { ...initialState };
    },
    
    setLoadingProgress: (state, action: PayloadAction<number>) => {
      state.loadingProgress = action.payload;
    },

    // Real-time WebSocket updates
    addNodesRealtime: (state, action: PayloadAction<NodeVisual[]>) => {
      const newNodes = (action.payload || []).filter(shouldIncludeNode) as NodeVisual[];
      console.log('🔥 Real-time nodes added:', newNodes.length);

      newNodes.forEach(node => {
        // Add only if doesn't already exist
        if (!state.nodeMap[node.id]) {
          state.nodes.push(node);
          state.nodeMap[node.id] = node;
          state.visibleNodes.push(node.id);

          // Initialize adjacency list entry
          if (!state.adjacencyList[node.id]) {
            state.adjacencyList[node.id] = [];
          }
        }
      });
    },

    updateNodesRealtime: (state, action: PayloadAction<Array<{ id: string; updates: Partial<NodeVisual> }>>) => {
      const nodeUpdates = action.payload;
      console.log('🔄 Real-time nodes updated:', nodeUpdates.length);

      nodeUpdates.forEach(({ id, updates }) => {
        const node = state.nodeMap[id];
        if (node) {
          Object.assign(node, updates);
        }
      });
    },

    removeNodesRealtime: (state, action: PayloadAction<string[]>) => {
      const nodeIds = action.payload;
      console.log('🗑️ Real-time nodes removed:', nodeIds.length);

      nodeIds.forEach(nodeId => {
        // Remove from nodes array
        state.nodes = state.nodes.filter(node => node.id !== nodeId);

        // Remove from maps
        delete state.nodeMap[nodeId];
        delete state.adjacencyList[nodeId];

        // Remove from visibility arrays
        state.visibleNodes = state.visibleNodes.filter(id => id !== nodeId);
        state.selectedNodes = state.selectedNodes.filter(id => id !== nodeId);

        // Remove from adjacency lists of other nodes
        Object.keys(state.adjacencyList).forEach(key => {
          state.adjacencyList[key] = state.adjacencyList[key].filter(id => id !== nodeId);
        });

        // Remove edges connected to this node
        state.edges = state.edges.filter(edge =>
          edge.source !== nodeId && edge.target !== nodeId
        );
        state.visibleEdges = state.visibleEdges.filter(edgeId => {
          const edge = state.edgeMap[edgeId];
          return edge && edge.source !== nodeId && edge.target !== nodeId;
        });
      });
    },

    addEdgesRealtime: (state, action: PayloadAction<EdgeVisual[]>) => {
      const newEdges = (action.payload || []).map((e: any, idx) => ({
        id: e.id || `${e.source || e.source_id}->${e.target || e.target_id}` || `re_${idx}`,
        ...e,
        source: e.source || e.source_id,
        target: e.target || e.target_id,
      })).filter(e => isSequentialSongEdge(e, state.nodeMap));
      console.log('🔗 Real-time edges added:', newEdges.length);

      newEdges.forEach(edge => {
        // Add only if doesn't already exist
        if (!state.edgeMap[edge.id]) {
          state.edges.push(edge);
          state.edgeMap[edge.id] = edge;
          state.visibleEdges.push(edge.id);

          // Update adjacency list
          const sourceId = edge.source;
          const targetId = edge.target;

          if (!state.adjacencyList[sourceId]) {
            state.adjacencyList[sourceId] = [];
          }
          if (!state.adjacencyList[targetId]) {
            state.adjacencyList[targetId] = [];
          }

          if (!state.adjacencyList[sourceId].includes(targetId)) {
            state.adjacencyList[sourceId].push(targetId);
          }
          if (!state.adjacencyList[targetId].includes(sourceId)) {
            state.adjacencyList[targetId].push(sourceId);
          }
        }
      });
    },

    updateEdgesRealtime: (state, action: PayloadAction<Array<{ id: string; updates: Partial<EdgeVisual> }>>) => {
      const edgeUpdates = action.payload;
      console.log('🔄 Real-time edges updated:', edgeUpdates.length);

      edgeUpdates.forEach(({ id, updates }) => {
        const edge = state.edgeMap[id];
        if (edge) {
          Object.assign(edge, updates);
        }
      });
    },

    removeEdgesRealtime: (state, action: PayloadAction<string[]>) => {
      const edgeIds = action.payload;
      console.log('🗑️ Real-time edges removed:', edgeIds.length);

      edgeIds.forEach(edgeId => {
        const edge = state.edgeMap[edgeId];
        if (edge) {
          // Remove from adjacency list
          const sourceId = edge.source;
          const targetId = edge.target;

          if (state.adjacencyList[sourceId]) {
            state.adjacencyList[sourceId] = state.adjacencyList[sourceId].filter(id => id !== targetId);
          }
          if (state.adjacencyList[targetId]) {
            state.adjacencyList[targetId] = state.adjacencyList[targetId].filter(id => id !== sourceId);
          }

          // Remove from edges array
          state.edges = state.edges.filter(e => e.id !== edgeId);

          // Remove from maps
          delete state.edgeMap[edgeId];

          // Remove from visibility arrays
          state.visibleEdges = state.visibleEdges.filter(id => id !== edgeId);
        }
      });
    },

    handleGraphSnapshot: (state, action: PayloadAction<{ nodes: NodeVisual[]; edges: EdgeVisual[]; metadata: any }>) => {
      const { nodes, edges, metadata } = action.payload;
      console.log('📸 Real-time graph snapshot received:', { nodes: nodes.length, edges: edges.length });

      // Replace current graph data with snapshot (filter out location-only nodes)
      const filteredNodes = (nodes || []).filter(shouldIncludeNode) as NodeVisual[];
      state.nodes = filteredNodes;
      // Normalize and filter snapshot edges
      const normalizedEdges = (edges || []).map((e: any, idx: number) => ({
        id: e.id || `${e.source || e.source_id}->${e.target || e.target_id}` || `snap_${idx}`,
        ...e,
        source: e.source || e.source_id,
        target: e.target || e.target_id,
      })).filter(e => isSequentialSongEdge(e, state.nodeMap));

      state.edges = normalizedEdges as any;

      // Rebuild maps
      state.nodeMap = {};
      filteredNodes.forEach(node => {
        state.nodeMap[node.id] = node;
      });

      state.edgeMap = {};
      normalizedEdges.forEach(edge => {
        state.edgeMap[edge.id] = edge;
      });

      // Rebuild adjacency list
      state.adjacencyList = {};
      filteredNodes.forEach(node => {
        state.adjacencyList[node.id] = [];
      });
      normalizedEdges.forEach(edge => {
        const sourceId = edge.source;
        const targetId = edge.target;
        if (sourceId && targetId) {
          if (!state.adjacencyList[sourceId].includes(targetId)) {
            state.adjacencyList[sourceId].push(targetId);
          }
          if (!state.adjacencyList[targetId].includes(sourceId)) {
            state.adjacencyList[targetId].push(sourceId);
          }
        }
      });

      // Set all as visible
      state.visibleNodes = filteredNodes.map(n => n.id);
      state.visibleEdges = normalizedEdges.map(e => e.id);
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch graph
      .addCase(fetchGraph.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.loadingProgress = 0;
      })
      .addCase(fetchGraph.fulfilled, (state, action) => {
        const graph = action.payload;
        console.log('✅ fetchGraph.fulfilled - Processing graph data:', graph);
        
        // Guard against malformed or empty graph data
        if (!graph || !graph.nodes || !Array.isArray(graph.nodes)) {
          console.error('🚫 Invalid graph data structure:', { graph, hasNodes: !!graph?.nodes, isArray: Array.isArray(graph?.nodes) });
          state.loading = false;
          state.error = 'Invalid graph data received';
          state.loadingProgress = 0;
          return;
        }
        
        // Convert nodes to visual nodes, then filter out location-only nodes
        const nodeVisuals: NodeVisual[] = graph.nodes
          .filter(node => {
            // Only filter out nodes with explicit "Unknown Artist" or "Unknown Track" placeholders
            const artist = node.artist || node.metadata?.artist;
            const title = node.title || node.metadata?.title;
            return !(artist === 'Unknown Artist' || title === 'Unknown Track' || title === 'Unknown Title');
          })
          .map(node => ({
            ...node,
            title: node.title || node.metadata?.title || 'Untitled',
            artist: node.artist || node.metadata?.artist || 'Various Artists',
            trackId: node.trackId || node.track_id,
            genres: node.genres || node.metadata?.genres || [],
            x: node.position?.x ?? Math.random() * 1000,
          y: node.position?.y ?? Math.random() * 1000,
          radius: 8,
          color: '#4F46E5',
          opacity: 1,
          selected: false,
          highlighted: false,
          visible: true,
          level: 0,
        })).filter(shouldIncludeNode);
        
        // Convert edges to visual edges - guard against missing edges
        const edgeVisuals: EdgeVisual[] = (graph.edges && Array.isArray(graph.edges) ? graph.edges : [])
          .map(edge => {
            const sourceId = edge.source || edge.source_id;
            const targetId = edge.target || edge.target_id;
            const sourceNode = nodeVisuals.find(n => n.id === sourceId);
            const targetNode = nodeVisuals.find(n => n.id === targetId);
            if (!sourceNode || !targetNode) return null as any;
            return {
              ...edge,
              id: edge.id || `${sourceId}->${targetId}`,
              source: sourceId,
              target: targetId,
              sourceNode,
              targetNode,
              visible: true,
              opacity: 0.6,
              width: Math.max(1, edge.weight * 3),
              color: '#94A3B8',
            } as EdgeVisual;
          })
          .filter(Boolean) as EdgeVisual[];
        
        // Update state
        console.log('🎨 Created visual nodes:', nodeVisuals.length, 'edges:', edgeVisuals.length);
        console.log('🎵 Sample visual node:', nodeVisuals[0]);
        state.nodes = nodeVisuals;
        state.edges = edgeVisuals;
        state.originalGraph = graph;
        
        // Rebuild maps (as objects for Redux serialization)
        state.nodeMap = {};
        nodeVisuals.forEach(node => {
          state.nodeMap[node.id] = node;
        });
        
        state.edgeMap = {};
        edgeVisuals.forEach(edge => {
          state.edgeMap[edge.id] = edge;
        });
        
        // Build adjacency list (as object with arrays)
        state.adjacencyList = {};
        nodeVisuals.forEach(node => {
          state.adjacencyList[node.id] = [];
        });
        edgeVisuals.forEach(edge => {
          const sourceId = edge.source || edge.source_id;
          const targetId = edge.target || edge.target_id;
          if (sourceId && targetId) {
            if (!state.adjacencyList[sourceId].includes(targetId)) {
              state.adjacencyList[sourceId].push(targetId);
            }
            if (!state.adjacencyList[targetId].includes(sourceId)) {
              state.adjacencyList[targetId].push(sourceId);
            }
          }
        });
        
        // Set all as visible initially (as arrays)
        state.visibleNodes = nodeVisuals.map(n => n.id);
        state.visibleEdges = edgeVisuals.map(e => e.id);
        
        state.loading = false;
        state.loadingProgress = 100;
      })
      .addCase(fetchGraph.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.loadingProgress = 0;
      })
      
      // Fetch node details
      .addCase(fetchNodeDetails.fulfilled, (state, action) => {
        const updatedNode = action.payload;
        const existingNode = state.nodeMap[updatedNode.id];
        if (existingNode) {
          Object.assign(existingNode, updatedNode);
        }
      })
      
      // Fetch relationships
      .addCase(fetchRelationships.fulfilled, (state, action) => {
        // Handle new relationships
        // This would update the graph with additional edges
        // Implementation depends on the API response structure
      });
  },
});

export const {
  setNodes,
  setEdges,
  updateNodePositions,
  updateNodeVisuals,
  setSelectedNodes,
  addToSelection,
  removeFromSelection,
  clearSelection,
  setHoveredNode,
  setHighlightedPath,
  setLayoutAlgorithm,
  updateLayoutOptions,
  setLayoutInProgress,
  updateBounds,
  setVisibleNodes,
  setVisibleEdges,
  setLodLevel,
  resetGraph,
  setLoadingProgress,
  setExcludedNodes,
  // Real-time actions
  addNodesRealtime,
  updateNodesRealtime,
  removeNodesRealtime,
  addEdgesRealtime,
  updateEdgesRealtime,
  removeEdgesRealtime,
  handleGraphSnapshot,
} = graphSlice.actions;

export default graphSlice.reducer;
