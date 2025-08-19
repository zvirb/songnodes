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
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  highlightedPath: string[];
  
  // Visibility and LOD
  visibleNodes: Set<string>;
  visibleEdges: Set<string>;
  lodLevel: number;
  
  // Loading states
  loading: boolean;
  error: string | null;
  loadingProgress: number;
  
  // Cache
  nodeMap: Map<string, NodeVisual>;
  edgeMap: Map<string, EdgeVisual>;
  adjacencyList: Map<string, Set<string>>;
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
  
  selectedNodes: new Set(),
  hoveredNode: null,
  highlightedPath: [],
  
  visibleNodes: new Set(),
  visibleEdges: new Set(),
  lodLevel: 0,
  
  loading: false,
  error: null,
  loadingProgress: 0,
  
  nodeMap: new Map(),
  edgeMap: new Map(),
  adjacencyList: new Map(),
};

// Async thunks
export const fetchGraph = createAsyncThunk(
  'graph/fetchGraph',
  async (request: GetGraphRequest, { rejectWithValue }) => {
    try {
      const response = await graphService.getGraph(request);
      return response.data;
    } catch (error) {
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
        const node = state.nodeMap.get(id);
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
        const node = state.nodeMap.get(id);
        if (node) {
          Object.assign(node, updates);
        }
      });
    },
    
    setSelectedNodes: (state, action: PayloadAction<string[]>) => {
      // Clear previous selection
      state.selectedNodes.forEach(nodeId => {
        const node = state.nodeMap.get(nodeId);
        if (node) node.selected = false;
      });
      
      // Set new selection
      state.selectedNodes = new Set(action.payload);
      state.selectedNodes.forEach(nodeId => {
        const node = state.nodeMap.get(nodeId);
        if (node) node.selected = true;
      });
    },
    
    addToSelection: (state, action: PayloadAction<string>) => {
      state.selectedNodes.add(action.payload);
      const node = state.nodeMap.get(action.payload);
      if (node) node.selected = true;
    },
    
    removeFromSelection: (state, action: PayloadAction<string>) => {
      state.selectedNodes.delete(action.payload);
      const node = state.nodeMap.get(action.payload);
      if (node) node.selected = false;
    },
    
    clearSelection: (state) => {
      state.selectedNodes.forEach(nodeId => {
        const node = state.nodeMap.get(nodeId);
        if (node) node.selected = false;
      });
      state.selectedNodes.clear();
    },
    
    setHoveredNode: (state, action: PayloadAction<string | null>) => {
      // Clear previous hover
      if (state.hoveredNode) {
        const prevNode = state.nodeMap.get(state.hoveredNode);
        if (prevNode) prevNode.highlighted = false;
      }
      
      // Set new hover
      state.hoveredNode = action.payload;
      if (action.payload) {
        const node = state.nodeMap.get(action.payload);
        if (node) node.highlighted = true;
      }
    },
    
    setHighlightedPath: (state, action: PayloadAction<string[]>) => {
      // Clear previous highlights
      state.highlightedPath.forEach(nodeId => {
        const node = state.nodeMap.get(nodeId);
        if (node) node.highlighted = false;
      });
      
      // Set new highlights
      state.highlightedPath = action.payload;
      state.highlightedPath.forEach(nodeId => {
        const node = state.nodeMap.get(nodeId);
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
      state.visibleNodes = new Set(action.payload);
      state.nodes.forEach(node => {
        node.visible = state.visibleNodes.has(node.id);
      });
    },
    
    setVisibleEdges: (state, action: PayloadAction<string[]>) => {
      state.visibleEdges = new Set(action.payload);
      state.edges.forEach(edge => {
        edge.visible = state.visibleEdges.has(edge.id);
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
        
        // Convert nodes to visual nodes
        const nodeVisuals: NodeVisual[] = graph.nodes.map(node => ({
          ...node,
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
        
        // Convert edges to visual edges
        const edgeVisuals: EdgeVisual[] = graph.edges.map(edge => {
          const sourceNode = nodeVisuals.find(n => n.id === edge.source);
          const targetNode = nodeVisuals.find(n => n.id === edge.target);
          
          return {
            ...edge,
            sourceNode: sourceNode!,
            targetNode: targetNode!,
            visible: true,
            opacity: 0.6,
            width: Math.max(1, edge.weight * 3),
            color: '#94A3B8',
          };
        });
        
        // Update state
        state.nodes = nodeVisuals;
        state.edges = edgeVisuals;
        state.originalGraph = graph;
        
        // Rebuild maps
        state.nodeMap = new Map(nodeVisuals.map(node => [node.id, node]));
        state.edgeMap = new Map(edgeVisuals.map(edge => [edge.id, edge]));
        
        // Build adjacency list
        state.adjacencyList = new Map();
        nodeVisuals.forEach(node => {
          state.adjacencyList.set(node.id, new Set());
        });
        edgeVisuals.forEach(edge => {
          state.adjacencyList.get(edge.source)?.add(edge.target);
          state.adjacencyList.get(edge.target)?.add(edge.source);
        });
        
        // Set all as visible initially
        state.visibleNodes = new Set(nodeVisuals.map(n => n.id));
        state.visibleEdges = new Set(edgeVisuals.map(e => e.id));
        
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
        const existingNode = state.nodeMap.get(updatedNode.id);
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