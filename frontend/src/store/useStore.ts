import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';
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
import { filterNodes, filterEdges } from '../utils/filterNodes';
import { Community, CommunityDetectionResult } from '../utils/communityDetection';

// Music service credentials interface
interface MusicServiceCredentials {
  tidal?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    isConnected?: boolean;
    lastValidated?: number;
  };
  spotify?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    isConnected?: boolean;
    lastValidated?: number;
  };
}

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

  // Music service credentials
  musicCredentials: MusicServiceCredentials;

  // Community detection state
  communityState: {
    communities: Community[];
    nodesCommunityMap: Map<string, number>;
    modularity: number;
    communityCount: number;
    expandedCommunities: Set<number>;
    highlightedNode: string | null;
    highlightedNeighbors: Set<string>;
    isDetecting: boolean;
    lastDetectionTime: number | null;
  };

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
  navigateToNode: (nodeId: string, options?: { highlight?: boolean; openModal?: boolean; selectNode?: boolean }) => void;
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

interface CredentialActions {
  updateCredentials: (service: keyof MusicServiceCredentials, credentials: any) => void;
  clearCredentials: (service?: keyof MusicServiceCredentials) => void;
  testConnection: (service: keyof MusicServiceCredentials) => Promise<boolean>;
  loadCredentialsFromStorage: () => void;
  saveCredentialsToStorage: () => void;
  setConnectionStatus: (service: keyof MusicServiceCredentials, isConnected: boolean) => void;
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

interface CommunityActions {
  detectCommunities: (resolution?: number) => void;
  setCommunityResults: (results: CommunityDetectionResult) => void;
  toggleCommunityExpanded: (communityId: number) => void;
  expandCommunity: (communityId: number) => void;
  collapseCommunity: (communityId: number) => void;
  highlightNeighborhood: (nodeId: string, neighborIds: string[]) => void;
  clearHighlight: () => void;
  filterByCommunities: (communityIds: number[]) => void;
  resetCommunities: () => void;
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
  credentials: CredentialActions;
  community: CommunityActions;

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
    showLabels: true, // PERMANENT: Always show labels
    showEdges: true,  // PERMANENT: Always show edges
    nodeSize: DEFAULT_CONFIG.graph.defaultRadius,
    edgeOpacity: 0.6,
    colorBy: 'genre',
    sizeBy: 'uniform',
    edgeDisplay: 'all',
    performanceMode: 'balanced',
    showStats: false,
    navigationRequest: null,
    viewMode: '2d', // Default to 2D view
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

  musicCredentials: {},

  communityState: {
    communities: [],
    nodesCommunityMap: new Map(),
    modularity: 0,
    communityCount: 0,
    expandedCommunities: new Set(),
    highlightedNode: null,
    highlightedNeighbors: new Set(),
    isDetecting: false,
    lastDetectionTime: null,
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
              let rejectedCount = 0;

              positions.forEach(({ id, x, y }) => {
                const node = nodeMap.get(id);
                if (node) {
                  // ✅ CRITICAL: Validate positions from localStorage - reject exploded positions
                  const maxReasonablePosition = 5000;
                  if (Math.abs(x) > maxReasonablePosition || Math.abs(y) > maxReasonablePosition) {
                    rejectedCount++;
                    // Don't set exploded positions - let simulation initialize them
                    return;
                  }
                  node.x = x;
                  node.y = y;
                }
              });

              // Silently reject exploded positions without logging noise

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
            // DISABLED: Labels permanently enabled
          },

          toggleEdges: () => {
            // DISABLED: Edges permanently enabled
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

          navigateToNode: (nodeId, options) => {
            set((state) => ({
              ...state,
              viewState: {
                ...state.viewState,
                navigationRequest: {
                  nodeId,
                  timestamp: Date.now(),
                  options: options || {},
                },
              },
            }), false, 'view/navigateToNode');
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
            // Update filters
            get().search.setSearchFilters(filters);

            // Apply filters to graph data using unified filter utilities
            const state = get();
            const originalData = state.originalGraphData || state.graphData;

            // Use unified filterNodes function for consistency with PathfinderPanel
            const filteredNodes = filterNodes(originalData.nodes, filters);

            // Create a set of visible node IDs for edge filtering
            const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

            // Use unified filterEdges function for consistency with PathfinderPanel
            const filteredEdges = filterEdges(originalData.edges, visibleNodeIds);

            // Update graph data with filtered results
            get().graph.setGraphData({
              nodes: filteredNodes,
              edges: filteredEdges
            });
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

        // Credential management actions
        credentials: {
          updateCredentials: (service, credentials) => {
            const currentServiceCreds = get().musicCredentials[service] || {};
            const newCredentials = {
              ...get().musicCredentials,
              [service]: {
                ...currentServiceCreds,
                ...credentials,
              },
            };

            // ✅ 2025 Best Practice: Zustand persist auto-saves to localStorage
            set((state) => ({
              ...state,
              musicCredentials: newCredentials,
            }), false, `credentials/update${service.charAt(0).toUpperCase() + service.slice(1)}`);
          },

          clearCredentials: (service) => {
            const state = get();
            let newCredentials;

            if (service) {
              newCredentials = { ...state.musicCredentials };
              delete newCredentials[service];
            } else {
              newCredentials = {};
            }

            // ✅ 2025 Best Practice: Zustand persist auto-handles localStorage
            set({
              musicCredentials: newCredentials,
            }, false, 'credentials/clear');
          },

          testConnection: async (service) => {
            const state = get();
            const credentials = state.musicCredentials[service];

            if (!credentials) {
              return false;
            }

            try {
              // Set loading state
              set((state) => ({
                ...state,
                isLoading: true,
              }), false, 'credentials/testConnectionStart');

              // Implement actual connection testing based on service
              const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

              switch (service) {
                case 'tidal':
                  try {
                    const response = await fetch(`${API_BASE_URL}/api/v1/music-auth/test/tidal`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        client_id: credentials.clientId,
                        client_secret: credentials.clientSecret,
                      }),
                    });

                    if (response.ok) {
                      const result = await response.json();
                      const isValid = result.valid;
                      get().credentials.setConnectionStatus(service, isValid);
                      return isValid;
                    } else {
                      const errorResult = await response.json();
                      console.error('Tidal connection test failed:', errorResult);
                      get().credentials.setConnectionStatus(service, false);
                      return false;
                    }
                  } catch (error) {
                    console.error('Tidal connection test failed:', error);
                    get().credentials.setConnectionStatus(service, false);
                    return false;
                  }

                case 'spotify':
                  try {
                    const response = await fetch(`${API_BASE_URL}/api/v1/music-auth/test/spotify`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        client_id: credentials.clientId,
                        client_secret: credentials.clientSecret,
                      }),
                    });

                    if (response.ok) {
                      const result = await response.json();
                      const isValid = result.valid;
                      get().credentials.setConnectionStatus(service, isValid);
                      return isValid;
                    } else {
                      get().credentials.setConnectionStatus(service, false);
                      return false;
                    }
                  } catch (error) {
                    console.error('Spotify connection test failed:', error);
                    get().credentials.setConnectionStatus(service, false);
                    return false;
                  }

                default:
                  return false;
              }
            } catch (error) {
              console.error(`Failed to test ${service} connection:`, error);
              get().credentials.setConnectionStatus(service, false);
              return false;
            } finally {
              set((state) => ({
                ...state,
                isLoading: false,
              }), false, 'credentials/testConnectionEnd');
            }
          },

          loadCredentialsFromStorage: () => {
            // ✅ 2025 Best Practice: Zustand persist automatically loads on hydration
            // This function is kept for backward compatibility but does nothing
          },

          saveCredentialsToStorage: () => {
            // ✅ 2025 Best Practice: Zustand persist automatically saves on state changes
            // This function is kept for backward compatibility but does nothing
          },

          setConnectionStatus: (service, isConnected) => {
            const newCredentials = {
              ...get().musicCredentials,
              [service]: {
                ...get().musicCredentials[service],
                isConnected,
                lastValidated: Date.now(),
              },
            };

            // ✅ 2025 Best Practice: Zustand persist auto-handles localStorage
            set((state) => ({
              ...state,
              musicCredentials: newCredentials,
            }), false, `credentials/setConnectionStatus${service.charAt(0).toUpperCase() + service.slice(1)}`);

            // Verify persistence worked
            setTimeout(() => {
              const stored = localStorage.getItem('songnodes-store');
              if (stored) {
                try {
                  const parsed = JSON.parse(stored);
                  const hasCreds = parsed?.state?.musicCredentials?.[service]?.isConnected;
                  // Persistence verified silently
                } catch (e) {
                  console.error('❌ Failed to verify persistence:', e);
                }
              }
            }, 100);
          },
        },

        // Community detection actions
        community: {
          detectCommunities: async (resolution = 1.0) => {
            set((state) => ({
              ...state,
              communityState: {
                ...state.communityState,
                isDetecting: true,
              },
            }), false, 'community/detectStart');

            try {
              // Import detection function dynamically
              const { detectCommunities } = await import('../utils/communityDetection');

              const graphData = get().graphData;
              const result = detectCommunities(graphData, { resolution });

              get().community.setCommunityResults(result);
            } catch (error) {
              console.error('Community detection failed:', error);
              set((state) => ({
                ...state,
                communityState: {
                  ...state.communityState,
                  isDetecting: false,
                },
                error: error instanceof Error ? error.message : 'Community detection failed',
              }), false, 'community/detectError');
            }
          },

          setCommunityResults: (results) => {
            set((state) => ({
              ...state,
              communityState: {
                ...state.communityState,
                communities: results.communities,
                nodesCommunityMap: results.nodesCommunityMap,
                modularity: results.modularity,
                communityCount: results.communityCount,
                isDetecting: false,
                lastDetectionTime: Date.now(),
              },
            }), false, 'community/setResults');
          },

          toggleCommunityExpanded: (communityId) => {
            set((state) => {
              const newExpanded = new Set(state.communityState.expandedCommunities);

              if (newExpanded.has(communityId)) {
                newExpanded.delete(communityId);
              } else {
                newExpanded.add(communityId);
              }

              return {
                ...state,
                communityState: {
                  ...state.communityState,
                  expandedCommunities: newExpanded,
                },
              };
            }, false, 'community/toggleExpanded');
          },

          expandCommunity: (communityId) => {
            set((state) => ({
              ...state,
              communityState: {
                ...state.communityState,
                expandedCommunities: new Set([...state.communityState.expandedCommunities, communityId]),
              },
            }), false, 'community/expand');
          },

          collapseCommunity: (communityId) => {
            set((state) => {
              const newExpanded = new Set(state.communityState.expandedCommunities);
              newExpanded.delete(communityId);

              return {
                ...state,
                communityState: {
                  ...state.communityState,
                  expandedCommunities: newExpanded,
                },
              };
            }, false, 'community/collapse');
          },

          highlightNeighborhood: (nodeId, neighborIds) => {
            set((state) => ({
              ...state,
              communityState: {
                ...state.communityState,
                highlightedNode: nodeId,
                highlightedNeighbors: new Set(neighborIds),
              },
            }), false, 'community/highlightNeighborhood');
          },

          clearHighlight: () => {
            set((state) => ({
              ...state,
              communityState: {
                ...state.communityState,
                highlightedNode: null,
                highlightedNeighbors: new Set(),
              },
            }), false, 'community/clearHighlight');
          },

          filterByCommunities: async (communityIds) => {
            try {
              const { filterByCommunities } = await import('../utils/communityDetection');

              const state = get();
              const originalData = state.originalGraphData || state.graphData;

              const filteredData = filterByCommunities(
                originalData,
                communityIds,
                state.communityState.nodesCommunityMap
              );

              get().graph.setGraphData(filteredData);
            } catch (error) {
              console.error('Failed to filter by communities:', error);
              set((state) => ({
                ...state,
                error: error instanceof Error ? error.message : 'Failed to filter communities',
              }), false, 'community/filterError');
            }
          },

          resetCommunities: () => {
            set((state) => ({
              ...state,
              communityState: {
                ...initialState.communityState,
              },
            }), false, 'community/reset');
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
        version: 6, // v6: 2025 best practice - include musicCredentials in Zustand persist
        storage: createJSONStorage(() => localStorage), // ✅ 2025 Required: Explicit storage adapter
        skipHydration: false, // Ensure we hydrate from storage
        partialize: (state) => {
          const partialState = {
            // Only persist certain parts of state
            panelState: state.panelState,
            viewState: {
              ...state.viewState,
              selectedNodes: [], // Convert Set to Array for JSON serialization
              hoveredNode: null, // Don't persist hover state
            },
            searchFilters: state.searchFilters,
            savedSetlists: state.savedSetlists,
            pathfindingState: {
              ...state.pathfindingState,
              selectedWaypoints: [], // Convert Set to Array for JSON serialization
              isCalculating: false, // Don't persist calculating state
              currentPath: null, // Don't persist current path
              alternatives: [],
              previewPath: [],
              error: null,
            },
            // ✅ 2025 Best Practice: Let Zustand persist handle credentials
            musicCredentials: { ...state.musicCredentials }, // Create new object reference
          };

          return partialState;
        },
        // ✅ CRITICAL: Zustand v4+ persist needs a merge function
        // Use Object.assign to merge persisted data into currentState without triggering getters
        merge: (persistedState, currentState) => {
          // Object.assign mutates currentState with persistedState properties
          // This avoids spreading currentState (which would trigger getters)
          return Object.assign(currentState, persistedState || {});
        },
        onRehydrateStorage: () => {
          return (state) => {
            // Convert arrays back to Sets after rehydration
            if (state) {
              if (Array.isArray(state.viewState?.selectedNodes)) {
                state.viewState.selectedNodes = new Set(state.viewState.selectedNodes);
              }
              if (Array.isArray(state.pathfindingState?.selectedWaypoints)) {
                state.pathfindingState.selectedWaypoints = new Set(state.pathfindingState.selectedWaypoints);
              }

              // ✅ CRITICAL FIX: Validate and reset bad viewport pan AND zoom values
              // Extreme pan values (> 2000 or < -2000) OR extreme zoom (< 0.5 or > 3) cause LOD culling issues
              // This happens when users zoom/pan way out and the state is persisted
              if (state.viewState?.pan || state.viewState?.zoom) {
                const maxPan = 2000;
                const minReasonableZoom = 0.5; // Below this, everything gets culled
                const maxReasonableZoom = 3.0; // Above this is excessive

                const badPan =
                  Math.abs(state.viewState.pan?.x || 0) > maxPan ||
                  Math.abs(state.viewState.pan?.y || 0) > maxPan;

                const badZoom =
                  (state.viewState.zoom || 1) < minReasonableZoom ||
                  (state.viewState.zoom || 1) > maxReasonableZoom;

                if (badPan || badZoom) {
                  console.warn('⚠️ Detected extreme viewport values, resetting to defaults:', {
                    pan: state.viewState.pan,
                    zoom: state.viewState.zoom,
                    reasons: { badPan, badZoom }
                  });
                  state.viewState.pan = { x: 0, y: 0 };
                  state.viewState.zoom = DEFAULT_CONFIG.ui.defaultZoom;

                  // Force save the corrected state back to localStorage
                  setTimeout(() => {
                    const storeData = localStorage.getItem('songnodes-store');
                    if (storeData) {
                      try {
                        const parsed = JSON.parse(storeData);
                        if (parsed.state?.viewState) {
                          parsed.state.viewState.pan = { x: 0, y: 0 };
                          parsed.state.viewState.zoom = DEFAULT_CONFIG.ui.defaultZoom;
                          localStorage.setItem('songnodes-store', JSON.stringify(parsed));
                        }
                      } catch (e) {
                        console.error('Failed to update localStorage:', e);
                      }
                    }
                  }, 100);
                }
              }

              // Credentials restored silently
            }
          };
        },
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

// Debugging utility - exposed to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugZustand = {
    getState: () => useStore.getState(),
    getMusicCredentials: () => useStore.getState().musicCredentials,
    getLocalStorage: () => {
      const stored = localStorage.getItem('songnodes-store');
      return stored ? JSON.parse(stored) : null;
    },
    injectTestCredentials: () => {
      useStore.getState().credentials.updateCredentials('tidal', {
        clientId: 'console-test-client',
        clientSecret: 'console-test-secret'
      });
    },
    verifyPersistence: () => {
      const state = useStore.getState().musicCredentials;
      const stored = localStorage.getItem('songnodes-store');
      const parsed = stored ? JSON.parse(stored) : null;

      return {
        zustandState: state,
        localStorageState: parsed?.state?.musicCredentials,
        match: JSON.stringify(state) === JSON.stringify(parsed?.state?.musicCredentials)
      };
    }
  };

  // Debug utilities are available at window.debugZustand
}