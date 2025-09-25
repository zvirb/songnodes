import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import {
  GraphData,
  GraphNode,
  Track,
  SearchFilters,
  SearchResult,
  ViewState,
  PanelState,
  PerformanceMetrics,
  Setlist,
  SetlistTrack,
  DEFAULT_CONFIG,
} from '../types';
import {
  PathfindingState,
  PathResult,
  PathConstraints,
  PathfindingAlgorithm,
  DEFAULT_CONSTRAINTS,
  AVAILABLE_ALGORITHMS,
} from '../types/pathfinding';

// Main application state interface
interface AppState {
  // Graph data
  graphData: GraphData;
  originalGraphData: GraphData | null; // Backup for filtering

  // UI state
  viewState: ViewState;
  panelState: PanelState;

  // Search and filtering
  searchQuery: string;
  searchResults: SearchResult[];
  searchFilters: SearchFilters;

  // Performance monitoring
  performanceMetrics: PerformanceMetrics;

  // Setlist management
  currentSetlist: Setlist | null;
  savedSetlists: Setlist[];

  // Path building
  pathfindingState: PathfindingState;

  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

// Action interfaces for complex state updates
interface GraphActions {
  setGraphData: (data: GraphData) => void;
  updateNodePositions: (positions: Array<{ id: string; x: number; y: number }>) => void;
  selectNode: (nodeId: string) => void;
  deselectNode: (nodeId: string) => void;
  clearSelection: () => void;
  toggleNodeSelection: (nodeId: string) => void;
  setHoveredNode: (nodeId: string | null) => void;
  updateNodeProperty: (nodeId: string, property: keyof GraphNode, value: any) => void;
  resetGraphData: () => void;
}

interface ViewActions {
  setSelectedTool: (tool: ViewState['selectedTool']) => void;
  updateViewport: (zoom: number, pan: { x: number; y: number }) => void;
  toggleLabels: () => void;
  toggleEdges: () => void;
  setNodeSize: (size: number) => void;
  setEdgeOpacity: (opacity: number) => void;
  resetView: () => void;
}

interface PanelActions {
  toggleLeftPanel: (panel: PanelState['leftPanel']) => void;
  toggleRightPanel: (panel: PanelState['rightPanel']) => void;
  toggleBottomPanel: (panel: PanelState['bottomPanel']) => void;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;
  setPanelHeight: (panel: 'bottom', height: number) => void;
  closeAllPanels: () => void;
}

interface SearchActions {
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  clearSearch: () => void;
  applyFilters: (filters: SearchFilters) => void;
}

interface SetlistActions {
  createNewSetlist: (name: string) => void;
  loadSetlist: (setlist: Setlist) => void;
  saveCurrentSetlist: () => void;
  addTrackToSetlist: (track: Track, position?: number) => void;
  removeTrackFromSetlist: (trackId: string) => void;
  moveTrackInSetlist: (trackId: string, newPosition: number) => void;
  updateSetlistTrack: (trackId: string, updates: Partial<SetlistTrack>) => void;
  clearSetlist: () => void;
}

interface PathfindingActions {
  setStartTrack: (trackId: string) => void;
  setEndTrack: (trackId: string) => void;
  addWaypoint: (trackId: string) => void;
  removeWaypoint: (trackId: string) => void;
  clearWaypoints: () => void;
  setPathConstraints: (constraints: Partial<PathConstraints>) => void;
  setPathAlgorithm: (algorithm: PathfindingAlgorithm) => void;
  setCurrentPath: (path: PathResult | null) => void;
  setPathCalculating: (calculating: boolean) => void;
  clearPath: () => void;
  resetPathfinding: () => void;
}

interface PerformanceActions {
  updatePerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  resetPerformanceMetrics: () => void;
}

interface GeneralActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
}

// Combined store interface
interface StoreState extends AppState {
  // Actions
  graph: GraphActions;
  view: ViewActions;
  panels: PanelActions;
  search: SearchActions;
  setlist: SetlistActions;
  pathfinding: PathfindingActions;
  performance: PerformanceActions;
  general: GeneralActions;

  // Legacy compatibility properties for components
  viewSettings: ViewState;
  updateViewSettings: (settings: Partial<ViewState>) => void;
  activePanel: PanelState['leftPanel'] | PanelState['rightPanel'] | PanelState['bottomPanel'];
  setActivePanel: (panel: PanelState['leftPanel'] | PanelState['rightPanel'] | PanelState['bottomPanel']) => void;
  metrics: PerformanceMetrics;
  updateMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  nodes: GraphNode[];
  selectNode: (nodeId: string) => void;
  updateFilter: (filters: Partial<SearchFilters>) => void;
  addToSetlist: (track: Track, position?: number) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  toggleSidebar: () => void;
  clearHighlights: () => void;
  resetFilters: () => void;
  clearSetlist: () => void;
  sidebarOpen: boolean;
  filteredNodes: GraphNode[];
  filteredEdges: any[];
  edges: any[];
}

// Initial state
const initialState: AppState = {
  graphData: { nodes: [], edges: [] },
  originalGraphData: null,

  viewState: {
    selectedTool: 'select',
    selectedNodes: new Set(),
    hoveredNode: null,
    zoom: DEFAULT_CONFIG.ui.defaultZoom,
    pan: { x: 0, y: 0 },
    showLabels: true,
    showEdges: true,
    nodeSize: DEFAULT_CONFIG.graph.defaultRadius,
    edgeOpacity: 0.6,
    colorBy: 'genre',
    sizeBy: 'uniform',
    edgeDisplay: 'all',
    performanceMode: 'balanced',
    showStats: false,
  },

  panelState: {
    leftPanel: null,
    rightPanel: null,
    bottomPanel: null,
    leftPanelWidth: 320,
    rightPanelWidth: 320,
    bottomPanelHeight: 200,
  },

  searchQuery: '',
  searchResults: [],
  searchFilters: {},

  performanceMetrics: {
    frameRate: 0,
    renderTime: 0,
    nodeCount: 0,
    edgeCount: 0,
    visibleNodes: 0,
    visibleEdges: 0,
    memoryUsage: 0,
    lastUpdate: Date.now(),
  },

  currentSetlist: null,
  savedSetlists: [],

  pathfindingState: {
    isCalculating: false,
    currentPath: null,
    alternatives: [],
    constraints: DEFAULT_CONSTRAINTS.flexible,
    selectedWaypoints: new Set(),
    startTrackId: null,
    endTrackId: null,
    previewPath: [],
    algorithm: AVAILABLE_ALGORITHMS[0],
    optimizationLevel: 'balanced',
    error: null,
  },

  isLoading: false,
  error: null,
};

// Create the store with middleware
export const useStore = create<StoreState>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        ...initialState,

        // Graph actions
        graph: {
          setGraphData: (data) => {
            set((state) => {
              const newState = {
                ...state,
                graphData: data,
                originalGraphData: state.originalGraphData || data,
                performanceMetrics: {
                  ...state.performanceMetrics,
                  nodeCount: data.nodes.length,
                  edgeCount: data.edges.length,
                  lastUpdate: Date.now(),
                },
              };
              return newState;
            }, false, 'graph/setGraphData');
          },

          updateNodePositions: (positions) => {
            set((state) => {
              const nodeMap = new Map(state.graphData.nodes.map(node => [node.id, node]));

              positions.forEach(({ id, x, y }) => {
                const node = nodeMap.get(id);
                if (node) {
                  node.x = x;
                  node.y = y;
                }
              });

              return {
                ...state,
                graphData: {
                  ...state.graphData,
                  nodes: [...nodeMap.values()],
                },
              };
            }, false, 'graph/updateNodePositions');
          },

          selectNode: (nodeId) => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                selectedNodes: new Set([...state.viewState.selectedNodes, nodeId]),
              },
            }), false, 'graph/selectNode');
          },

          deselectNode: (nodeId) => {
            set((state) => {
              const newSelection = new Set(state.viewState.selectedNodes);
              newSelection.delete(nodeId);

              return {
                ...state,
                viewState: {
                  ...state.viewState,
                  selectedNodes: newSelection,
                },
              };
            }, false, 'graph/deselectNode');
          },

          clearSelection: () => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                selectedNodes: new Set(),
              },
            }), false, 'graph/clearSelection');
          },

          toggleNodeSelection: (nodeId) => {
            const { viewState } = get();
            if (viewState.selectedNodes.has(nodeId)) {
              get().graph.deselectNode(nodeId);
            } else {
              get().graph.selectNode(nodeId);
            }
          },

          setHoveredNode: (nodeId) => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                hoveredNode: nodeId,
              },
            }), false, 'graph/setHoveredNode');
          },

          updateNodeProperty: (nodeId, property, value) => {
            set((state) => ({
              ...state,
              graphData: {
                ...state.graphData,
                nodes: state.graphData.nodes.map(node =>
                  node.id === nodeId ? { ...node, [property]: value } : node
                ),
              },
            }), false, 'graph/updateNodeProperty');
          },

          resetGraphData: () => {
            const { originalGraphData } = get();
            if (originalGraphData) {
              get().graph.setGraphData(originalGraphData);
            }
          },
        },

        // View actions
        view: {
          setSelectedTool: (tool) => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                selectedTool: tool,
              },
            }), false, 'view/setSelectedTool');
          },

          updateViewport: (zoom, pan) => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                zoom: Math.max(DEFAULT_CONFIG.ui.minZoom, Math.min(DEFAULT_CONFIG.ui.maxZoom, zoom)),
                pan,
              },
            }), false, 'view/updateViewport');
          },

          toggleLabels: () => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                showLabels: !state.viewState.showLabels,
              },
            }), false, 'view/toggleLabels');
          },

          toggleEdges: () => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                showEdges: !state.viewState.showEdges,
              },
            }), false, 'view/toggleEdges');
          },

          setNodeSize: (size) => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                nodeSize: Math.max(DEFAULT_CONFIG.graph.minRadius, Math.min(DEFAULT_CONFIG.graph.maxRadius, size)),
              },
            }), false, 'view/setNodeSize');
          },

          setEdgeOpacity: (opacity) => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                edgeOpacity: Math.max(0, Math.min(1, opacity)),
              },
            }), false, 'view/setEdgeOpacity');
          },

          resetView: () => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                zoom: DEFAULT_CONFIG.ui.defaultZoom,
                pan: { x: 0, y: 0 },
                selectedNodes: new Set(),
                hoveredNode: null,
              },
            }), false, 'view/resetView');
          },
        },

        // Panel actions
        panels: {
          toggleLeftPanel: (panel) => {
            set((state) => ({
              ...state,
              panelState: {
                ...state.panelState,
                leftPanel: state.panelState.leftPanel === panel ? null : panel,
              },
            }), false, 'panels/toggleLeftPanel');
          },

          toggleRightPanel: (panel) => {
            set((state) => ({
              ...state,
              panelState: {
                ...state.panelState,
                rightPanel: state.panelState.rightPanel === panel ? null : panel,
              },
            }), false, 'panels/toggleRightPanel');
          },

          toggleBottomPanel: (panel) => {
            set((state) => ({
              ...state,
              panelState: {
                ...state.panelState,
                bottomPanel: state.panelState.bottomPanel === panel ? null : panel,
              },
            }), false, 'panels/toggleBottomPanel');
          },

          setPanelWidth: (panel, width) => {
            set((state) => ({
              ...state,
              panelState: {
                ...state.panelState,
                [`${panel}PanelWidth`]: Math.max(200, Math.min(800, width)),
              },
            }), false, 'panels/setPanelWidth');
          },

          setPanelHeight: (panel, height) => {
            set((state) => ({
              ...state,
              panelState: {
                ...state.panelState,
                [`${panel}PanelHeight`]: Math.max(100, Math.min(600, height)),
              },
            }), false, 'panels/setPanelHeight');
          },

          closeAllPanels: () => {
            set((state) => ({
              ...state,
              panelState: {
                ...state.panelState,
                leftPanel: null,
                rightPanel: null,
                bottomPanel: null,
              },
            }), false, 'panels/closeAllPanels');
          },
        },

        // Search actions
        search: {
          setSearchQuery: (query) => {
            set((state) => ({
              ...state,
              searchQuery: query,
            }), false, 'search/setSearchQuery');
          },

          setSearchResults: (results) => {
            set((state) => ({
              ...state,
              searchResults: results,
            }), false, 'search/setSearchResults');
          },

          setSearchFilters: (filters) => {
            set((state) => ({
              ...state,
              searchFilters: {
                ...state.searchFilters,
                ...filters,
              },
            }), false, 'search/setSearchFilters');
          },

          clearSearch: () => {
            set((state) => ({
              ...state,
              searchQuery: '',
              searchResults: [],
              searchFilters: {},
            }), false, 'search/clearSearch');
          },

          applyFilters: (filters) => {
            // This would typically trigger a re-fetch of graph data
            // For now, just update the filters
            get().search.setSearchFilters(filters);
          },
        },

        // Setlist actions
        setlist: {
          createNewSetlist: (name) => {
            const newSetlist: Setlist = {
              id: crypto.randomUUID(),
              name,
              tracks: [],
              created_at: new Date(),
              updated_at: new Date(),
            };

            set((state) => ({
              ...state,
              currentSetlist: newSetlist,
            }), false, 'setlist/createNewSetlist');
          },

          loadSetlist: (setlist) => {
            set((state) => ({
              ...state,
              currentSetlist: setlist,
            }), false, 'setlist/loadSetlist');
          },

          saveCurrentSetlist: () => {
            const { currentSetlist } = get();
            if (!currentSetlist) return;

            const updatedSetlist = {
              ...currentSetlist,
              updated_at: new Date(),
            };

            set((state) => ({
              ...state,
              currentSetlist: updatedSetlist,
              savedSetlists: [
                ...state.savedSetlists.filter(s => s.id !== updatedSetlist.id),
                updatedSetlist,
              ],
            }), false, 'setlist/saveCurrentSetlist');
          },

          addTrackToSetlist: (track, position) => {
            const { currentSetlist } = get();
            if (!currentSetlist) return;

            const newTrack: SetlistTrack = {
              id: crypto.randomUUID(),
              track,
              position: position ?? currentSetlist.tracks.length,
            };

            set((state) => {
              if (!state.currentSetlist) return state;

              const tracks = [...state.currentSetlist.tracks];
              if (position !== undefined) {
                // Insert at specific position
                tracks.splice(position, 0, newTrack);
                // Update positions of subsequent tracks
                tracks.forEach((t, i) => {
                  t.position = i;
                });
              } else {
                tracks.push(newTrack);
              }

              return {
                ...state,
                currentSetlist: {
                  ...state.currentSetlist,
                  tracks,
                  updated_at: new Date(),
                },
              };
            }, false, 'setlist/addTrackToSetlist');
          },

          removeTrackFromSetlist: (trackId) => {
            set((state) => {
              if (!state.currentSetlist) return state;

              const tracks = state.currentSetlist.tracks
                .filter(t => t.id !== trackId)
                .map((t, i) => ({ ...t, position: i }));

              return {
                ...state,
                currentSetlist: {
                  ...state.currentSetlist,
                  tracks,
                  updated_at: new Date(),
                },
              };
            }, false, 'setlist/removeTrackFromSetlist');
          },

          moveTrackInSetlist: (trackId, newPosition) => {
            set((state) => {
              if (!state.currentSetlist) return state;

              const tracks = [...state.currentSetlist.tracks];
              const trackIndex = tracks.findIndex(t => t.id === trackId);

              if (trackIndex === -1) return state;

              const [movedTrack] = tracks.splice(trackIndex, 1);
              tracks.splice(newPosition, 0, movedTrack);

              // Update positions
              tracks.forEach((t, i) => {
                t.position = i;
              });

              return {
                ...state,
                currentSetlist: {
                  ...state.currentSetlist,
                  tracks,
                  updated_at: new Date(),
                },
              };
            }, false, 'setlist/moveTrackInSetlist');
          },

          updateSetlistTrack: (trackId, updates) => {
            set((state) => {
              if (!state.currentSetlist) return state;

              return {
                ...state,
                currentSetlist: {
                  ...state.currentSetlist,
                  tracks: state.currentSetlist.tracks.map(t =>
                    t.id === trackId ? { ...t, ...updates } : t
                  ),
                  updated_at: new Date(),
                },
              };
            }, false, 'setlist/updateSetlistTrack');
          },

          clearSetlist: () => {
            set((state) => ({
              ...state,
              currentSetlist: null,
            }), false, 'setlist/clearSetlist');
          },
        },

        // Pathfinding actions
        pathfinding: {
          setStartTrack: (trackId) => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                startTrackId: trackId,
              },
            }), false, 'pathfinding/setStartTrack');
          },

          setEndTrack: (trackId) => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                endTrackId: trackId,
              },
            }), false, 'pathfinding/setEndTrack');
          },

          addWaypoint: (trackId) => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                selectedWaypoints: new Set([...state.pathfindingState.selectedWaypoints, trackId]),
              },
            }), false, 'pathfinding/addWaypoint');
          },

          removeWaypoint: (trackId) => {
            set((state) => {
              const newWaypoints = new Set(state.pathfindingState.selectedWaypoints);
              newWaypoints.delete(trackId);

              return {
                ...state,
                pathfindingState: {
                  ...state.pathfindingState,
                  selectedWaypoints: newWaypoints,
                },
              };
            }, false, 'pathfinding/removeWaypoint');
          },

          clearWaypoints: () => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                selectedWaypoints: new Set(),
              },
            }), false, 'pathfinding/clearWaypoints');
          },

          setPathConstraints: (constraints) => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                constraints: {
                  ...state.pathfindingState.constraints,
                  ...constraints,
                },
              },
            }), false, 'pathfinding/setPathConstraints');
          },

          setPathAlgorithm: (algorithm) => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                algorithm,
              },
            }), false, 'pathfinding/setPathAlgorithm');
          },

          setCurrentPath: (path) => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                currentPath: path,
                isCalculating: false,
              },
            }), false, 'pathfinding/setCurrentPath');
          },

          setPathCalculating: (calculating) => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                isCalculating: calculating,
                error: calculating ? null : state.pathfindingState.error,
              },
            }), false, 'pathfinding/setPathCalculating');
          },

          clearPath: () => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...state.pathfindingState,
                currentPath: null,
                alternatives: [],
                previewPath: [],
                isCalculating: false,
                error: null,
              },
            }), false, 'pathfinding/clearPath');
          },

          resetPathfinding: () => {
            set((state) => ({
              ...state,
              pathfindingState: {
                ...initialState.pathfindingState,
              },
            }), false, 'pathfinding/resetPathfinding');
          },
        },

        // Performance actions
        performance: {
          updatePerformanceMetrics: (metrics) => {
            set((state) => ({
              ...state,
              performanceMetrics: {
                ...state.performanceMetrics,
                ...metrics,
                lastUpdate: Date.now(),
              },
            }), false, 'performance/updatePerformanceMetrics');
          },

          resetPerformanceMetrics: () => {
            set((state) => ({
              ...state,
              performanceMetrics: {
                ...initialState.performanceMetrics,
                lastUpdate: Date.now(),
              },
            }), false, 'performance/resetPerformanceMetrics');
          },
        },

        // General actions
        general: {
          setLoading: (loading) => {
            set((state) => ({
              ...state,
              isLoading: loading,
            }), false, 'general/setLoading');
          },

          setError: (error) => {
            set((state) => ({
              ...state,
              error,
            }), false, 'general/setError');
          },

          resetState: () => {
            set(initialState, false, 'general/resetState');
          },
        },

        // Legacy compatibility properties for components
        get viewSettings() {
          return get().viewState;
        },

        updateViewSettings: (settings) => {
          set((state) => ({
            ...state,
            viewState: {
              ...state.viewState,
              ...settings,
            },
          }), false, 'legacy/updateViewSettings');
        },

        get activePanel() {
          const { panelState } = get();
          return panelState.leftPanel || panelState.rightPanel || panelState.bottomPanel;
        },

        setActivePanel: (panel) => {
          const currentPanel = get().activePanel;
          if (currentPanel === panel) {
            get().panels.closeAllPanels();
          } else {
            get().panels.toggleLeftPanel(panel as any);
          }
        },

        get metrics() {
          return get().performanceMetrics;
        },

        updateMetrics: (metrics) => {
          get().performance.updatePerformanceMetrics(metrics);
        },

        get nodes() {
          return get().graphData.nodes;
        },

        selectNode: (nodeId) => {
          get().graph.selectNode(nodeId);
        },

        updateFilter: (filters) => {
          get().search.setSearchFilters(filters);
        },

        addToSetlist: (track, position) => {
          get().setlist.addTrackToSetlist(track, position);
        },

        updateNodePosition: (nodeId, position) => {
          get().graph.updateNodePositions([{ id: nodeId, ...position }]);
        },

        toggleSidebar: () => {
          const { panelState } = get();
          if (panelState.leftPanel) {
            get().panels.toggleLeftPanel(panelState.leftPanel);
          } else {
            get().panels.toggleLeftPanel('search');
          }
        },

        clearHighlights: () => {
          get().graph.clearSelection();
          get().graph.setHoveredNode(null);
        },

        resetFilters: () => {
          get().search.clearSearch();
        },

        get clearSetlist() {
          return get().setlist.clearSetlist;
        },

        get sidebarOpen() {
          const { panelState } = get();
          return panelState.leftPanel !== null;
        },

        get filteredNodes() {
          return get().graphData.nodes; // In a real implementation, this would be filtered
        },

        get filteredEdges() {
          return get().graphData.edges; // In a real implementation, this would be filtered
        },

        get edges() {
          return get().graphData.edges;
        },
      })),
      {
        name: 'songnodes-store',
        version: 1,
        partialize: (state) => ({
          // Only persist certain parts of state
          panelState: state.panelState,
          viewState: {
            ...state.viewState,
            selectedNodes: new Set(), // Don't persist selected nodes
            hoveredNode: null, // Don't persist hover state
          },
          searchFilters: state.searchFilters,
          savedSetlists: state.savedSetlists,
          pathfindingState: {
            ...state.pathfindingState,
            isCalculating: false, // Don't persist calculating state
            currentPath: null, // Don't persist current path
            alternatives: [],
            previewPath: [],
            error: null,
          },
        }),
      }
    ),
    {
      name: 'SongNodes Store',
    }
  )
);

// Selectors for commonly used derived state
export const useGraphNodes = () => useStore(state => state.graphData.nodes);
export const useGraphEdges = () => useStore(state => state.graphData.edges);
export const useSelectedNodes = () => useStore(state => state.viewState.selectedNodes);
export const useSelectedTool = () => useStore(state => state.viewState.selectedTool);
export const useCurrentSetlist = () => useStore(state => state.currentSetlist);
export const usePathfindingState = () => useStore(state => state.pathfindingState);
export const usePerformanceMetrics = () => useStore(state => state.performanceMetrics);

// Export store for external access (useful for debugging)
export default useStore;