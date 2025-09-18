import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PathResult, PathFindingOptions } from '@types/graph';

interface PathfindingState {
  isCalculating: boolean;
  currentPath: PathResult | null;
  pathHistory: PathResult[];
  pathOptions: PathFindingOptions;
  progress: number;
  error: string | null;
  
  // UI state
  isPathModeActive: boolean;
  startNode: string | null;
  endNode: string | null;
  waypoints: string[];
  
  // Multiple paths
  alternativePaths: PathResult[];
  selectedPathIndex: number;
  
  // Path analysis
  pathMetrics: {
    totalDistance: number;
    avgWeight: number;
    smoothness: number;
    diversity: number;
  } | null;
}

const initialState: PathfindingState = {
  isCalculating: false,
  currentPath: null,
  pathHistory: [],
  pathOptions: {
    algorithm: 'dijkstra',
    heuristic: 'euclidean',
    constraints: {
      maxLength: 10,
      minWeight: 0.1,
      allowedTypes: [],
      avoidNodes: [],
    },
  },
  progress: 0,
  error: null,
  
  isPathModeActive: false,
  startNode: null,
  endNode: null,
  waypoints: [],
  
  alternativePaths: [],
  selectedPathIndex: 0,
  
  pathMetrics: null,
};

const pathfindingSlice = createSlice({
  name: 'pathfinding',
  initialState,
  reducers: {
    // Path calculation
    startPathCalculation: (state) => {
      state.isCalculating = true;
      state.progress = 0;
      state.error = null;
    },
    
    updatePathProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload;
    },
    
    setPathResult: (state, action: PayloadAction<PathResult>) => {
      state.currentPath = action.payload;
      state.isCalculating = false;
      state.progress = 100;
      
      // Add to history
      if (state.pathHistory.length >= 10) {
        state.pathHistory.shift();
      }
      state.pathHistory.push(action.payload);
    },
    
    setPathError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isCalculating = false;
      state.progress = 0;
    },
    
    clearPath: (state) => {
      state.currentPath = null;
      state.alternativePaths = [];
      state.selectedPathIndex = 0;
      state.pathMetrics = null;
    },
    
    // Path options
    setPathOptions: (state, action: PayloadAction<Partial<PathFindingOptions>>) => {
      state.pathOptions = { ...state.pathOptions, ...action.payload };
    },
    
    // UI state
    setPathModeActive: (state, action: PayloadAction<boolean>) => {
      state.isPathModeActive = action.payload;
      if (!action.payload) {
        state.startNode = null;
        state.endNode = null;
        state.waypoints = [];
      }
    },
    
    setStartNode: (state, action: PayloadAction<string | null>) => {
      state.startNode = action.payload;
    },
    
    setEndNode: (state, action: PayloadAction<string | null>) => {
      state.endNode = action.payload;
    },
    
    addWaypoint: (state, action: PayloadAction<string>) => {
      if (!state.waypoints.includes(action.payload)) {
        state.waypoints.push(action.payload);
      }
    },
    
    removeWaypoint: (state, action: PayloadAction<string>) => {
      state.waypoints = state.waypoints.filter(id => id !== action.payload);
    },
    
    clearWaypoints: (state) => {
      state.waypoints = [];
    },
    setWaypoints: (state, action: PayloadAction<string[]>) => {
      state.waypoints = action.payload || [];
    },
    moveWaypoint: (state, action: PayloadAction<{ index: number; direction: 'up' | 'down' }>) => {
      const { index, direction } = action.payload;
      const wp = state.waypoints.slice();
      const j = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || index >= wp.length || j < 0 || j >= wp.length) return;
      const tmp = wp[index]; wp[index] = wp[j]; wp[j] = tmp;
      state.waypoints = wp;
    },
    
    // Multiple paths
    setAlternativePaths: (state, action: PayloadAction<PathResult[]>) => {
      state.alternativePaths = action.payload;
      state.selectedPathIndex = 0;
    },
    
    selectPath: (state, action: PayloadAction<number>) => {
      if (action.payload >= 0 && action.payload < state.alternativePaths.length) {
        state.selectedPathIndex = action.payload;
        state.currentPath = state.alternativePaths[action.payload];
      }
    },
    
    // Path metrics
    setPathMetrics: (state, action: PayloadAction<PathfindingState['pathMetrics']>) => {
      state.pathMetrics = action.payload;
    },
    
    // History
    clearPathHistory: (state) => {
      state.pathHistory = [];
    },
    
    restorePathFromHistory: (state, action: PayloadAction<number>) => {
      const path = state.pathHistory[action.payload];
      if (path) {
        state.currentPath = path;
      }
    },
  },
});

export const {
  startPathCalculation,
  updatePathProgress,
  setPathResult,
  setPathError,
  clearPath,
  setPathOptions,
  setPathModeActive,
  setStartNode,
  setEndNode,
  addWaypoint,
  removeWaypoint,
  clearWaypoints,
  setWaypoints,
  moveWaypoint,
  setAlternativePaths,
  selectPath,
  setPathMetrics,
  clearPathHistory,
  restorePathFromHistory,
} = pathfindingSlice.actions;

export default pathfindingSlice.reducer;
