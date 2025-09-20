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

  // Track played songs
  playedTracks: string[];

  // Undo history for last action
  lastAction: {
    type: 'setStart' | 'setEnd' | 'addWaypoint' | null;
    previousValue: string | null;
    nodeId: string | null;
  } | null;

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
      preventCycles: true,
    },
  },
  progress: 0,
  error: null,

  isPathModeActive: false,
  startNode: null,
  endNode: null,
  waypoints: [],

  playedTracks: [],
  lastAction: null,

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
      // If there are played tracks, prevent changing the first one
      if (state.playedTracks.length > 0 && action.payload !== state.startNode) {
        state.error = 'Cannot change start track after tracks have been played';
        return;
      }

      // Store undo information
      state.lastAction = {
        type: 'setStart',
        previousValue: state.startNode,
        nodeId: action.payload
      };

      state.startNode = action.payload;
      state.error = null;
    },

    setEndNode: (state, action: PayloadAction<string | null>) => {
      const previousEnd = state.endNode;

      // Store undo information
      state.lastAction = {
        type: 'setEnd',
        previousValue: previousEnd,
        nodeId: action.payload
      };

      // If there was a previous end node, convert it to a waypoint
      if (previousEnd && action.payload && previousEnd !== action.payload) {
        if (!state.waypoints.includes(previousEnd)) {
          state.waypoints.push(previousEnd);
        }
      }

      state.endNode = action.payload;
      state.error = null;
    },

    addWaypoint: (state, action: PayloadAction<string>) => {
      if (!state.waypoints.includes(action.payload)) {
        // Find the position to insert the waypoint
        // It should come after all played tracks
        const lastPlayedIndex = state.playedTracks.length > 0
          ? state.waypoints.findIndex(wp => state.playedTracks.includes(wp))
          : -1;

        // Store undo information
        state.lastAction = {
          type: 'addWaypoint',
          previousValue: null,
          nodeId: action.payload
        };

        // Insert after last played track or at the beginning if no played tracks
        if (lastPlayedIndex >= 0) {
          state.waypoints.splice(lastPlayedIndex + 1, 0, action.payload);
        } else {
          state.waypoints.push(action.payload);
        }
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

    // Undo last pathfinding action
    undoLastAction: (state) => {
      if (!state.lastAction) return;

      switch (state.lastAction.type) {
        case 'setStart':
          state.startNode = state.lastAction.previousValue;
          break;
        case 'setEnd':
          // Restore previous end node
          const currentEnd = state.endNode;
          state.endNode = state.lastAction.previousValue;
          // Remove current end from waypoints if it was added there
          if (currentEnd) {
            state.waypoints = state.waypoints.filter(id => id !== currentEnd);
          }
          break;
        case 'addWaypoint':
          // Remove the added waypoint
          if (state.lastAction.nodeId) {
            state.waypoints = state.waypoints.filter(id => id !== state.lastAction.nodeId);
          }
          break;
      }

      state.lastAction = null;
    },

    // Track played songs
    setPlayedTracks: (state, action: PayloadAction<string[]>) => {
      state.playedTracks = action.payload;
    },

    addPlayedTrack: (state, action: PayloadAction<string>) => {
      if (!state.playedTracks.includes(action.payload)) {
        state.playedTracks.push(action.payload);
      }
    },

    clearPlayedTracks: (state) => {
      state.playedTracks = [];
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
  undoLastAction,
  setPlayedTracks,
  addPlayedTrack,
  clearPlayedTracks,
} = pathfindingSlice.actions;

export default pathfindingSlice.reducer;
