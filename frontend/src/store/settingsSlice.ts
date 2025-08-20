import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  // Performance settings
  enablePerformanceMonitoring: boolean;
  showFPS: boolean;
  autoOptimization: boolean;
  maxNodes: number;
  maxEdges: number;
  lodEnabled: boolean;
  cullingEnabled: boolean;
  
  // Visual settings
  theme: 'light' | 'dark' | 'auto';
  colorScheme: 'default' | 'high-contrast' | 'colorblind-friendly';
  nodeSize: number;
  edgeOpacity: number;
  showLabels: boolean;
  showGrid: boolean;
  animationsEnabled: boolean;
  
  // Interaction settings
  defaultInteractionMode: 'select' | 'pan' | 'zoom';
  multiSelectModifier: 'ctrl' | 'shift';
  zoomSpeed: number;
  panSpeed: number;
  doubleClickZoom: boolean;
  
  // Audio settings (for future audio features)
  masterVolume: number;
  previewVolume: number;
  enableAudioPreview: boolean;
  audioFormat: 'mp3' | 'wav' | 'flac';
  
  // Accessibility settings
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderEnabled: boolean;
  keyboardNavigation: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  
  // Layout settings
  sidebarPosition: 'left' | 'right';
  sidebarWidth: number;
  compactMode: boolean;
  showMinimap: boolean;
  showToolbar: boolean;
  
  // Data settings
  cacheEnabled: boolean;
  cacheSize: number; // MB
  autoSave: boolean;
  saveInterval: number; // seconds
  maxHistory: number;
  
  // Privacy settings
  analyticsEnabled: boolean;
  crashReporting: boolean;
  usageTracking: boolean;
  shareAnonymousData: boolean;
  
  // Export settings
  defaultExportFormat: 'png' | 'svg' | 'pdf' | 'json';
  exportQuality: 'low' | 'medium' | 'high' | 'ultra';
  includeMetadata: boolean;
  
  // Advanced settings
  debugMode: boolean;
  experimentalFeatures: boolean;
  betaFeatures: boolean;
  developerMode: boolean;
  
  // Keyboard shortcuts
  shortcuts: Record<string, string>;
  
  // User preferences
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  
  // Recent files/sessions
  recentFiles: Array<{
    path: string;
    name: string;
    lastModified: number;
  }>;
  
  maxRecentFiles: number;
}

const defaultShortcuts = {
  // Navigation
  'zoom_in': 'ctrl+=',
  'zoom_out': 'ctrl+-',
  'zoom_reset': 'ctrl+0',
  'pan_up': 'ArrowUp',
  'pan_down': 'ArrowDown',
  'pan_left': 'ArrowLeft',
  'pan_right': 'ArrowRight',
  
  // Selection
  'select_all': 'ctrl+a',
  'deselect_all': 'Escape',
  'invert_selection': 'ctrl+i',
  
  // Tools
  'toggle_search': 'ctrl+f',
  'toggle_filters': 'ctrl+shift+f',
  'toggle_sidebar': 'ctrl+b',
  'toggle_minimap': 'ctrl+m',
  
  // Layout
  'force_layout': 'f',
  'hierarchical_layout': 'h',
  'circular_layout': 'c',
  
  // General
  'save': 'ctrl+s',
  'export': 'ctrl+e',
  'fullscreen': 'F11',
  'help': 'F1',
};

const initialState: SettingsState = {
  // Performance
  enablePerformanceMonitoring: false,
  showFPS: false,
  autoOptimization: true,
  maxNodes: 5000,
  maxEdges: 10000,
  lodEnabled: true,
  cullingEnabled: true,
  
  // Visual
  theme: 'dark',
  colorScheme: 'default',
  nodeSize: 1.0,
  edgeOpacity: 0.6,
  showLabels: true,
  showGrid: false,
  animationsEnabled: true,
  
  // Interaction
  defaultInteractionMode: 'select',
  multiSelectModifier: 'ctrl',
  zoomSpeed: 1.0,
  panSpeed: 1.0,
  doubleClickZoom: true,
  
  // Audio
  masterVolume: 0.7,
  previewVolume: 0.5,
  enableAudioPreview: true,
  audioFormat: 'mp3',
  
  // Accessibility
  reducedMotion: false,
  highContrast: false,
  screenReaderEnabled: false,
  keyboardNavigation: true,
  fontSize: 'medium',
  
  // Layout
  sidebarPosition: 'left',
  sidebarWidth: 320,
  compactMode: false,
  showMinimap: false,
  showToolbar: true,
  
  // Data
  cacheEnabled: true,
  cacheSize: 100,
  autoSave: true,
  saveInterval: 30,
  maxHistory: 50,
  
  // Privacy
  analyticsEnabled: false,
  crashReporting: true,
  usageTracking: false,
  shareAnonymousData: false,
  
  // Export
  defaultExportFormat: 'png',
  exportQuality: 'high',
  includeMetadata: true,
  
  // Advanced
  debugMode: false,
  experimentalFeatures: false,
  betaFeatures: false,
  developerMode: false,
  
  // Shortcuts
  shortcuts: defaultShortcuts,
  
  // User preferences
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  numberFormat: 'en-US',
  
  // Recent files
  recentFiles: [],
  maxRecentFiles: 10,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Performance settings
    setPerformanceMonitoring: (state, action: PayloadAction<boolean>) => {
      state.enablePerformanceMonitoring = action.payload;
    },
    
    setShowFPS: (state, action: PayloadAction<boolean>) => {
      state.showFPS = action.payload;
    },
    
    setAutoOptimization: (state, action: PayloadAction<boolean>) => {
      state.autoOptimization = action.payload;
    },
    
    setMaxNodes: (state, action: PayloadAction<number>) => {
      state.maxNodes = Math.max(100, Math.min(50000, action.payload));
    },
    
    setMaxEdges: (state, action: PayloadAction<number>) => {
      state.maxEdges = Math.max(100, Math.min(100000, action.payload));
    },
    
    setLodEnabled: (state, action: PayloadAction<boolean>) => {
      state.lodEnabled = action.payload;
    },
    
    setCullingEnabled: (state, action: PayloadAction<boolean>) => {
      state.cullingEnabled = action.payload;
    },
    
    // Visual settings
    setTheme: (state, action: PayloadAction<SettingsState['theme']>) => {
      state.theme = action.payload;
    },
    
    setColorScheme: (state, action: PayloadAction<SettingsState['colorScheme']>) => {
      state.colorScheme = action.payload;
    },
    
    setNodeSize: (state, action: PayloadAction<number>) => {
      state.nodeSize = Math.max(0.1, Math.min(3.0, action.payload));
    },
    
    setEdgeOpacity: (state, action: PayloadAction<number>) => {
      state.edgeOpacity = Math.max(0.1, Math.min(1.0, action.payload));
    },
    
    setShowLabels: (state, action: PayloadAction<boolean>) => {
      state.showLabels = action.payload;
    },
    
    setShowGrid: (state, action: PayloadAction<boolean>) => {
      state.showGrid = action.payload;
    },
    
    setAnimationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.animationsEnabled = action.payload;
    },
    
    // Interaction settings
    setDefaultInteractionMode: (state, action: PayloadAction<SettingsState['defaultInteractionMode']>) => {
      state.defaultInteractionMode = action.payload;
    },
    
    setMultiSelectModifier: (state, action: PayloadAction<SettingsState['multiSelectModifier']>) => {
      state.multiSelectModifier = action.payload;
    },
    
    setZoomSpeed: (state, action: PayloadAction<number>) => {
      state.zoomSpeed = Math.max(0.1, Math.min(3.0, action.payload));
    },
    
    setPanSpeed: (state, action: PayloadAction<number>) => {
      state.panSpeed = Math.max(0.1, Math.min(3.0, action.payload));
    },
    
    setDoubleClickZoom: (state, action: PayloadAction<boolean>) => {
      state.doubleClickZoom = action.payload;
    },
    
    // Audio settings
    setMasterVolume: (state, action: PayloadAction<number>) => {
      state.masterVolume = Math.max(0, Math.min(1, action.payload));
    },
    
    setPreviewVolume: (state, action: PayloadAction<number>) => {
      state.previewVolume = Math.max(0, Math.min(1, action.payload));
    },
    
    setEnableAudioPreview: (state, action: PayloadAction<boolean>) => {
      state.enableAudioPreview = action.payload;
    },
    
    setAudioFormat: (state, action: PayloadAction<SettingsState['audioFormat']>) => {
      state.audioFormat = action.payload;
    },
    
    // Accessibility settings
    setReducedMotion: (state, action: PayloadAction<boolean>) => {
      state.reducedMotion = action.payload;
      if (action.payload) {
        state.animationsEnabled = false;
      }
    },
    
    setHighContrast: (state, action: PayloadAction<boolean>) => {
      state.highContrast = action.payload;
    },
    
    setScreenReaderEnabled: (state, action: PayloadAction<boolean>) => {
      state.screenReaderEnabled = action.payload;
    },
    
    setKeyboardNavigation: (state, action: PayloadAction<boolean>) => {
      state.keyboardNavigation = action.payload;
    },
    
    setFontSize: (state, action: PayloadAction<SettingsState['fontSize']>) => {
      state.fontSize = action.payload;
    },
    
    // Layout settings
    setSidebarPosition: (state, action: PayloadAction<SettingsState['sidebarPosition']>) => {
      state.sidebarPosition = action.payload;
    },
    
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = Math.max(200, Math.min(600, action.payload));
    },
    
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.compactMode = action.payload;
    },
    
    setShowMinimap: (state, action: PayloadAction<boolean>) => {
      state.showMinimap = action.payload;
    },
    
    setShowToolbar: (state, action: PayloadAction<boolean>) => {
      state.showToolbar = action.payload;
    },
    
    // Data settings
    setCacheEnabled: (state, action: PayloadAction<boolean>) => {
      state.cacheEnabled = action.payload;
    },
    
    setCacheSize: (state, action: PayloadAction<number>) => {
      state.cacheSize = Math.max(10, Math.min(1000, action.payload));
    },
    
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.autoSave = action.payload;
    },
    
    setSaveInterval: (state, action: PayloadAction<number>) => {
      state.saveInterval = Math.max(10, Math.min(300, action.payload));
    },
    
    setMaxHistory: (state, action: PayloadAction<number>) => {
      state.maxHistory = Math.max(10, Math.min(200, action.payload));
    },
    
    // Privacy settings
    setAnalyticsEnabled: (state, action: PayloadAction<boolean>) => {
      state.analyticsEnabled = action.payload;
    },
    
    setCrashReporting: (state, action: PayloadAction<boolean>) => {
      state.crashReporting = action.payload;
    },
    
    setUsageTracking: (state, action: PayloadAction<boolean>) => {
      state.usageTracking = action.payload;
    },
    
    setShareAnonymousData: (state, action: PayloadAction<boolean>) => {
      state.shareAnonymousData = action.payload;
    },
    
    // Export settings
    setDefaultExportFormat: (state, action: PayloadAction<SettingsState['defaultExportFormat']>) => {
      state.defaultExportFormat = action.payload;
    },
    
    setExportQuality: (state, action: PayloadAction<SettingsState['exportQuality']>) => {
      state.exportQuality = action.payload;
    },
    
    setIncludeMetadata: (state, action: PayloadAction<boolean>) => {
      state.includeMetadata = action.payload;
    },
    
    // Advanced settings
    setDebugMode: (state, action: PayloadAction<boolean>) => {
      state.debugMode = action.payload;
    },
    
    setExperimentalFeatures: (state, action: PayloadAction<boolean>) => {
      state.experimentalFeatures = action.payload;
    },
    
    setBetaFeatures: (state, action: PayloadAction<boolean>) => {
      state.betaFeatures = action.payload;
    },
    
    setDeveloperMode: (state, action: PayloadAction<boolean>) => {
      state.developerMode = action.payload;
    },
    
    // Shortcuts
    setShortcut: (state, action: PayloadAction<{ action: string; shortcut: string }>) => {
      state.shortcuts[action.payload.action] = action.payload.shortcut;
    },
    
    resetShortcuts: (state) => {
      state.shortcuts = { ...defaultShortcuts };
    },
    
    // User preferences
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    
    setTimezone: (state, action: PayloadAction<string>) => {
      state.timezone = action.payload;
    },
    
    setDateFormat: (state, action: PayloadAction<string>) => {
      state.dateFormat = action.payload;
    },
    
    setNumberFormat: (state, action: PayloadAction<string>) => {
      state.numberFormat = action.payload;
    },
    
    // Recent files
    addRecentFile: (state, action: PayloadAction<{ path: string; name: string }>) => {
      const file = {
        ...action.payload,
        lastModified: Date.now(),
      };
      
      // Remove if already exists
      state.recentFiles = state.recentFiles.filter(f => f.path !== file.path);
      
      // Add to beginning
      state.recentFiles.unshift(file);
      
      // Keep only maxRecentFiles
      if (state.recentFiles.length > state.maxRecentFiles) {
        state.recentFiles = state.recentFiles.slice(0, state.maxRecentFiles);
      }
    },
    
    removeRecentFile: (state, action: PayloadAction<string>) => {
      state.recentFiles = state.recentFiles.filter(f => f.path !== action.payload);
    },
    
    clearRecentFiles: (state) => {
      state.recentFiles = [];
    },
    
    setMaxRecentFiles: (state, action: PayloadAction<number>) => {
      state.maxRecentFiles = Math.max(5, Math.min(50, action.payload));
      
      // Trim existing files if necessary
      if (state.recentFiles.length > state.maxRecentFiles) {
        state.recentFiles = state.recentFiles.slice(0, state.maxRecentFiles);
      }
    },
    
    // Bulk operations
    updateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      Object.assign(state, action.payload);
    },
    
    resetSettings: () => {
      return { ...initialState };
    },
    
    resetToDefaults: (state, action: PayloadAction<keyof SettingsState | 'all'>) => {
      if (action.payload === 'all') {
        return { ...initialState };
      } else {
        (state as any)[action.payload] = (initialState as any)[action.payload];
      }
    },
  },
});

export const {
  setPerformanceMonitoring,
  setShowFPS,
  setAutoOptimization,
  setMaxNodes,
  setMaxEdges,
  setLodEnabled,
  setCullingEnabled,
  setTheme,
  setColorScheme,
  setNodeSize,
  setEdgeOpacity,
  setShowLabels,
  setShowGrid,
  setAnimationsEnabled,
  setDefaultInteractionMode,
  setMultiSelectModifier,
  setZoomSpeed,
  setPanSpeed,
  setDoubleClickZoom,
  setMasterVolume,
  setPreviewVolume,
  setEnableAudioPreview,
  setAudioFormat,
  setReducedMotion,
  setHighContrast,
  setScreenReaderEnabled,
  setKeyboardNavigation,
  setFontSize,
  setSidebarPosition,
  setSidebarWidth,
  setCompactMode,
  setShowMinimap,
  setShowToolbar,
  setCacheEnabled,
  setCacheSize,
  setAutoSave,
  setSaveInterval,
  setMaxHistory,
  setAnalyticsEnabled,
  setCrashReporting,
  setUsageTracking,
  setShareAnonymousData,
  setDefaultExportFormat,
  setExportQuality,
  setIncludeMetadata,
  setDebugMode,
  setExperimentalFeatures,
  setBetaFeatures,
  setDeveloperMode,
  setShortcut,
  resetShortcuts,
  setLanguage,
  setTimezone,
  setDateFormat,
  setNumberFormat,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  setMaxRecentFiles,
  updateSettings,
  resetSettings,
  resetToDefaults,
} = settingsSlice.actions;

export default settingsSlice.reducer;