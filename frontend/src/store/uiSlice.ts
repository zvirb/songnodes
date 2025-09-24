import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  InteractionMode,
  Viewport,
  LayoutConfig,
  Theme,
  ModalState,
  LoadingState,
  ErrorState,
  Toast,
  ContextMenu,
  SelectionState,
  DragState,
  AnimationState,
  AccessibilityState,
  DeviceInfo,
  PerformanceUIState,
} from '@types/ui';

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

interface UIState {
  // Viewport and interaction
  viewport: Viewport;
  interactionMode: InteractionMode;
  
  // Layout and panels
  layout: LayoutConfig;
  theme: Theme;
  panels: {
    search: boolean;
    controls: boolean;
    trackInfo: boolean;
    navigation: boolean;
  };
  
  // Interaction states
  selection: SelectionState;
  drag: DragState;
  
  // UI states
  modals: ModalState[];
  loading: LoadingState;
  errors: ErrorState[];
  toasts: Toast[];
  contextMenu: {
    isOpen: boolean;
    x: number;
    y: number;
    items: {
      label: string;
      action: () => void;
    }[];
  };
  
  // Animation
  animation: AnimationState;
  
  // Accessibility
  accessibility: AccessibilityState;
  
  // Device info
  device: DeviceInfo;
  
  // Performance UI
  performanceUI: PerformanceUIState;
  
  // Flags
  isDragging: boolean;
  isMultiSelecting: boolean;
  showGrid: boolean;
  showLabels: boolean;
  showPerformanceOverlay: boolean;
  showDebugInfo: boolean;
  is3DMode: boolean;
}

// Default theme
const defaultTheme: Theme = {
  name: 'dark',
  isDark: true,
  colors: {
    primary: '#4F46E5',
    secondary: '#EC4899',
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    accent: '#06B6D4',
    warning: '#F59E0B',
    error: '#EF4444',
    success: '#10B981',
  },
  graph: {
    background: '#0F172A',
    grid: '#1E293B',
    nodeDefault: '#4F46E5',
    nodeSelected: '#EC4899',
    nodeHovered: '#6366F1',
    nodeHighlighted: '#F59E0B',
    edgeDefault: '#475569',
    edgeSelected: '#EC4899',
    edgeHighlighted: '#F59E0B',
  },
};

const initialState: UIState = {
  viewport: {
    x: 0,
    y: 0,
    scale: 1,
    width: 1200,
    height: 800,
  },
  interactionMode: InteractionMode.SELECT,
  
  layout: {
    showSidebar: true,
    showControlPanel: true,
    showSearchPanel: true,
    showNodeDetails: true,
    showPerformancePanel: false,
    compactMode: false,
    sidebarWidth: 320,
    panelPositions: {
      sidebar: 'left',
      controlPanel: 'top',
      searchPanel: 'top',
      nodeDetails: 'right',
      performancePanel: 'top-right',
    },
  },
  
  theme: defaultTheme,
  
  panels: {
    search: false,
    controls: false,
    trackInfo: false,
    navigation: false,
  },

  selection: {
    mode: 'single',
    nodes: [],
    edges: [],
    isMultiSelecting: false,
  },
  
  drag: {
    isDragging: false,
    dragType: 'none',
  },
  
  modals: [],
  loading: {
    global: false,
    graph: false,
    search: false,
    pathfinding: false,
    export: false,
    import: false,
  },
  errors: [],
  toasts: [],
  contextMenu: {
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  },
  
  animation: {
    layoutTransition: {
      active: false,
      progress: 0,
      duration: 1000,
      easing: 'ease-out',
    },
    viewportTransition: {
      active: false,
      fromViewport: { x: 0, y: 0, scale: 1, width: 0, height: 0 },
      toViewport: { x: 0, y: 0, scale: 1, width: 0, height: 0 },
      progress: 0,
      duration: 500,
    },
    nodeAnimations: {},
    globalAnimationsEnabled: true,
    reducedMotion: false,
  },
  
  accessibility: {
    screenReaderEnabled: false,
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium',
    keyboardNavigation: true,
    announcements: [],
  },
  
  device: {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasTouch: false,
    screenSize: 'lg',
    orientation: 'landscape',
    pixelRatio: 1,
  },
  
  performanceUI: {
    showFPS: false,
    showMemoryUsage: false,
    showNodeCount: false,
    enableDebugMode: false,
    showRenderStats: false,
    autoOptimize: true,
    qualityLevel: 'high',
  },
  
  isDragging: false,
  isMultiSelecting: false,
  showGrid: false,
  showLabels: true,
  showPerformanceOverlay: false,
  showDebugInfo: false,
  is3DMode: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggle3DMode: (state) => {
      state.is3DMode = !state.is3DMode;
    },
    openPanel: (state, action: PayloadAction<keyof UIState['panels']>) => {
      state.panels[action.payload] = true;
    },
    closePanel: (state, action: PayloadAction<keyof UIState['panels']>) => {
      state.panels[action.payload] = false;
    },
    toggleHighContrast: (state) => {
      state.accessibility.highContrast = !state.accessibility.highContrast;
    },
    toggleReducedMotion: (state) => {
      state.accessibility.reducedMotion = !state.accessibility.reducedMotion;
    },
    openContextMenu: (state, action: PayloadAction<Omit<UIState['contextMenu'], 'isOpen'>>) => {
      state.contextMenu = { ...action.payload, isOpen: true };
    },
    closeContextMenu: (state) => {
      state.contextMenu.isOpen = false;
    },
    // Viewport actions
    updateViewport: (state, action: PayloadAction<Partial<Viewport>>) => {
      state.viewport = { ...state.viewport, ...action.payload };
    },
    
    setViewportSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
      state.viewport.width = action.payload.width;
      state.viewport.height = action.payload.height;
    },
    
    zoomTo: (state, action: PayloadAction<{ scale: number; center?: { x: number; y: number } }>) => {
      const { scale, center } = action.payload;
      if (center) {
        // Zoom to specific point
        const { x, y } = center;
        const { width, height } = state.viewport;
        state.viewport.x = width / 2 - x * scale;
        state.viewport.y = height / 2 - y * scale;
      }
      state.viewport.scale = scale;
    },
    
    centerOn: (state, action: PayloadAction<{ x: number; y: number }>) => {
      const { x, y } = action.payload;
      const { width, height, scale } = state.viewport;
      state.viewport.x = width / 2 - x * scale;
      state.viewport.y = height / 2 - y * scale;
    },
    
    // Interaction mode
    setInteractionMode: (state, action: PayloadAction<InteractionMode>) => {
      state.interactionMode = action.payload;
    },
    
    // Selection actions
    setSelectionMode: (state, action: PayloadAction<SelectionState['mode']>) => {
      state.selection.mode = action.payload;
    },
    
    setMultiSelecting: (state, action: PayloadAction<boolean>) => {
      state.selection.isMultiSelecting = action.payload;
      state.isMultiSelecting = action.payload;
    },
    
    setSelectionBox: (state, action: PayloadAction<SelectionState['selectionBox']>) => {
      state.selection.selectionBox = action.payload;
    },
    
    // Selection nodes and edges actions with runtime guards
    setSelectedNodesUI: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      state.selection.nodes = payload;
    },
    
    setSelectedEdgesUI: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      state.selection.edges = payload;
    },
    
    // Drag state
    setDragState: (state, action: PayloadAction<Partial<DragState>>) => {
      state.drag = { ...state.drag, ...action.payload };
      state.isDragging = state.drag.isDragging;
    },
    
    // Layout actions
    toggleSidebar: (state) => {
      state.layout.showSidebar = !state.layout.showSidebar;
    },
    
    togglePanel: (state, action: PayloadAction<keyof Omit<LayoutConfig, 'panelPositions' | 'sidebarWidth' | 'compactMode'>>) => {
      const panel = action.payload;
      state.layout[panel] = !state.layout[panel];
    },
    
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.layout.sidebarWidth = Math.max(200, Math.min(600, action.payload));
    },
    
    setPanelPosition: (state, action: PayloadAction<{ panel: keyof LayoutConfig['panelPositions']; position: any }>) => {
      const { panel, position } = action.payload;
      state.layout.panelPositions[panel] = position;
    },
    
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.layout.compactMode = action.payload;
    },
    
    // Theme actions
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },
    
    toggleDarkMode: (state) => {
      state.theme.isDark = !state.theme.isDark;
      // Update colors based on dark mode
      if (state.theme.isDark) {
        state.theme.colors.background = '#0F172A';
        state.theme.colors.surface = '#1E293B';
        state.theme.colors.text = '#F8FAFC';
        state.theme.graph.background = '#0F172A';
      } else {
        state.theme.colors.background = '#FFFFFF';
        state.theme.colors.surface = '#F8FAFC';
        state.theme.colors.text = '#0F172A';
        state.theme.graph.background = '#FFFFFF';
      }
    },
    
    // Modal actions
    openModal: (state, action: PayloadAction<Omit<ModalState, 'isOpen'>>) => {
      const modal = { ...action.payload, isOpen: true };
      state.modals.push(modal);
    },
    
    closeModal: (state, action: PayloadAction<string>) => {
      const index = state.modals.findIndex(m => m.type === action.payload);
      if (index !== -1) {
        state.modals.splice(index, 1);
      }
    },
    
    closeAllModals: (state) => {
      state.modals = [];
    },
    
    // Loading actions
    setLoading: (state, action: PayloadAction<{ key: keyof LoadingState; value: boolean }>) => {
      const { key, value } = action.payload;
      state.loading[key] = value;
    },
    
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    
    // Error actions
    addError: (state, action: PayloadAction<Omit<ErrorState, 'timestamp'>>) => {
      const error: ErrorState = {
        ...action.payload,
        timestamp: Date.now(),
        dismissed: false,
      };
      state.errors.push(error);
    },
    
    dismissError: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      if (state.errors[index]) {
        state.errors[index].dismissed = true;
      }
    },
    
    clearErrors: (state) => {
      state.errors = [];
    },
    
    // Toast actions
    addToast: (state, action: PayloadAction<Omit<Toast, 'id' | 'createdAt'>>) => {
      const toast: Toast = {
        ...action.payload,
        id: `toast_${Date.now()}_${Math.random()}`,
        createdAt: Date.now(),
      };
      state.toasts.push(toast);
    },
    
    removeToast: (state, action: PayloadAction<string>) => {
      const index = state.toasts.findIndex(t => t.id === action.payload);
      if (index !== -1) {
        state.toasts.splice(index, 1);
      }
    },
    
    clearToasts: (state) => {
      state.toasts = [];
    },
    
    // Animation actions
    setLayoutTransition: (state, action: PayloadAction<Partial<AnimationState['layoutTransition']>>) => {
      state.animation.layoutTransition = {
        ...state.animation.layoutTransition,
        ...action.payload,
      };
    },
    
    setViewportTransition: (state, action: PayloadAction<Partial<AnimationState['viewportTransition']>>) => {
      state.animation.viewportTransition = {
        ...state.animation.viewportTransition,
        ...action.payload,
      };
    },
    
    setGlobalAnimationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.animation.globalAnimationsEnabled = action.payload;
    },
    
    // Accessibility actions
    setAccessibility: (state, action: PayloadAction<Partial<AccessibilityState>>) => {
      state.accessibility = { ...state.accessibility, ...action.payload };
    },
    
    addAnnouncement: (state, action: PayloadAction<string>) => {
      state.accessibility.announcements.push(action.payload);
      // Keep only the last 10 announcements
      if (state.accessibility.announcements.length > 10) {
        state.accessibility.announcements.shift();
      }
    },
    
    // Device info
    updateDeviceInfo: (state, action: PayloadAction<Partial<DeviceInfo>>) => {
      state.device = { ...state.device, ...action.payload };
    },
    
    // Performance UI
    setPerformanceUI: (state, action: PayloadAction<Partial<PerformanceUIState>>) => {
      state.performanceUI = { ...state.performanceUI, ...action.payload };
    },
    
    togglePerformanceOverlay: (state) => {
      state.showPerformanceOverlay = !state.showPerformanceOverlay;
      state.performanceUI.showFPS = state.showPerformanceOverlay;
      state.performanceUI.showMemoryUsage = state.showPerformanceOverlay;
      state.performanceUI.showNodeCount = state.showPerformanceOverlay;
    },
    
    // Display options
    toggleGrid: (state) => {
      state.showGrid = !state.showGrid;
    },
    
    toggleLabels: (state) => {
      state.showLabels = !state.showLabels;
    },
    
    toggleDebugInfo: (state) => {
      state.showDebugInfo = !state.showDebugInfo;
      state.performanceUI.enableDebugMode = state.showDebugInfo;
    },
    
    // Reset UI state
    resetUI: () => {
      return { ...initialState };
    },
  },
});

export const {
  toggle3DMode,
  openPanel,
  closePanel,
  toggleHighContrast,
  toggleReducedMotion,
  openContextMenu,
  closeContextMenu,
  updateViewport,
  setViewportSize,
  zoomTo,
  centerOn,
  setInteractionMode,
  setSelectionMode,
  setMultiSelecting,
  setSelectionBox,
  setSelectedNodesUI,
  setSelectedEdgesUI,
  setDragState,
  toggleSidebar,
  togglePanel,
  setSidebarWidth,
  setPanelPosition,
  setCompactMode,
  setTheme,
  toggleDarkMode,
  openModal,
  closeModal,
  closeAllModals,
  setLoading,
  setGlobalLoading,
  addError,
  dismissError,
  clearErrors,
  addToast,
  removeToast,
  clearToasts,
  setLayoutTransition,
  setViewportTransition,
  setGlobalAnimationsEnabled,
  setAccessibility,
  addAnnouncement,
  updateDeviceInfo,
  setPerformanceUI,
  togglePerformanceOverlay,
  toggleGrid,
  toggleLabels,
  toggleDebugInfo,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;