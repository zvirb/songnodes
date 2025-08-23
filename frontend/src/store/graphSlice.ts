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

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
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
        node.visible = visibleIds.includes(node.id);
      });
    },
    
    setVisibleEdges: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      state.visibleEdges = payload;
      // Use array includes instead of Set for Redux serialization compatibility
      const visibleIds = payload;
      state.edges.forEach(edge => {
        edge.visible = visibleIds.includes(edge.id);
      });
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
        
        // Convert nodes to visual nodes
        const nodeVisuals: NodeVisual[] = graph.nodes.map(node => ({
          ...node,
          title: node.title || node.metadata?.title || 'Unknown Track',
          artist: node.artist || node.metadata?.artist || 'Unknown Artist',
          trackId: node.trackId || node.track_id,
          genres: node.genres || node.metadata?.genres || ['unknown'], // Ensure genres array exists
          x: node.position?.x ?? Math.random() * 1000,
          y: node.position?.y ?? Math.random() * 1000,
          radius: 8,
          color: '#4F46E5',
          opacity: 1,
          selected: false,
          highlighted: false,
          visible: true,
          level: 0,
        }));
        
        // Convert edges to visual edges - guard against missing edges
        const edgeVisuals: EdgeVisual[] = (graph.edges && Array.isArray(graph.edges) ? graph.edges : []).map(edge => {
          const sourceNode = nodeVisuals.find(n => n.id === (edge.source || edge.source_id));
          const targetNode = nodeVisuals.find(n => n.id === (edge.target || edge.target_id));
          
          return {
            ...edge,
            source: edge.source || edge.source_id,
            target: edge.target || edge.target_id,
            sourceNode: sourceNode!,
            targetNode: targetNode!,
            visible: true,
            opacity: 0.6,
            width: Math.max(1, edge.weight * 3),
            color: '#94A3B8',
          };
        });
        
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
} = graphSlice.actions;

export default graphSlice.reducer;