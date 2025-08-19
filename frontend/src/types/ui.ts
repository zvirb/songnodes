// UI interaction modes
export enum InteractionMode {
  SELECT = 'select',
  PAN = 'pan',
  ZOOM = 'zoom',
  DRAW_PATH = 'draw_path',
  MEASURE = 'measure',
}

// Viewport and camera
export interface Viewport {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

// Panel states
export interface PanelState {
  isOpen: boolean;
  width: number;
  height: number;
  position: 'left' | 'right' | 'top' | 'bottom' | 'floating';
  isDocked: boolean;
  isMinimized: boolean;
}

// Layout configurations
export interface LayoutConfig {
  showSidebar: boolean;
  showControlPanel: boolean;
  showSearchPanel: boolean;
  showNodeDetails: boolean;
  showPerformancePanel: boolean;
  compactMode: boolean;
  sidebarWidth: number;
  panelPositions: {
    sidebar: 'left' | 'right';
    controlPanel: 'top' | 'bottom' | 'floating';
    searchPanel: 'top' | 'floating';
    nodeDetails: 'right' | 'floating';
    performancePanel: 'top-right' | 'bottom-right' | 'floating';
  };
}

// Theme and appearance
export interface Theme {
  name: string;
  isDark: boolean;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
    warning: string;
    error: string;
    success: string;
  };
  graph: {
    background: string;
    grid: string;
    nodeDefault: string;
    nodeSelected: string;
    nodeHovered: string;
    nodeHighlighted: string;
    edgeDefault: string;
    edgeSelected: string;
    edgeHighlighted: string;
  };
}

// Keyboard shortcuts
export interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  action: string;
  description: string;
  category: 'navigation' | 'selection' | 'layout' | 'view' | 'general';
}

// Modal and dialog types
export interface ModalState {
  type: string | null;
  isOpen: boolean;
  data?: any;
  options?: {
    closeable?: boolean;
    persistent?: boolean;
    backdrop?: boolean;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
  };
}

// Loading states
export interface LoadingState {
  global: boolean;
  graph: boolean;
  search: boolean;
  pathfinding: boolean;
  export: boolean;
  import: boolean;
  [key: string]: boolean;
}

// Error states
export interface ErrorState {
  message: string | null;
  type: 'network' | 'validation' | 'permission' | 'unknown';
  context?: string;
  timestamp?: number;
  dismissed?: boolean;
}

// Toast notifications
export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  createdAt: number;
}

// Context menu
export interface ContextMenu {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  target?: {
    type: 'node' | 'edge' | 'background';
    id?: string;
    data?: any;
  };
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
}

// Toolbar and controls
export interface ToolbarState {
  visible: boolean;
  position: 'top' | 'bottom' | 'left' | 'right' | 'floating';
  tools: ToolbarItem[];
  activeTools: Set<string>;
}

export interface ToolbarItem {
  id: string;
  type: 'button' | 'toggle' | 'dropdown' | 'separator' | 'group';
  label: string;
  icon?: string;
  tooltip?: string;
  shortcut?: string;
  action?: () => void;
  active?: boolean;
  disabled?: boolean;
  items?: ToolbarItem[]; // For dropdowns and groups
}

// Selection states
export interface SelectionState {
  mode: 'single' | 'multiple' | 'box' | 'lasso';
  nodes: Set<string>;
  edges: Set<string>;
  isMultiSelecting: boolean;
  selectionBox?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    active: boolean;
  };
  lassoPath?: { x: number; y: number }[];
}

// Drag and drop
export interface DragState {
  isDragging: boolean;
  dragType: 'node' | 'viewport' | 'selection' | 'none';
  dragTarget?: string;
  startPosition?: { x: number; y: number };
  currentPosition?: { x: number; y: number };
  offset?: { x: number; y: number };
}

// Animation states
export interface AnimationState {
  layoutTransition: {
    active: boolean;
    progress: number;
    duration: number;
    easing: string;
  };
  viewportTransition: {
    active: boolean;
    fromViewport: Viewport;
    toViewport: Viewport;
    progress: number;
    duration: number;
  };
  nodeAnimations: Map<string, {
    type: 'position' | 'size' | 'color' | 'opacity';
    fromValue: any;
    toValue: any;
    progress: number;
    duration: number;
  }>;
  globalAnimationsEnabled: boolean;
  reducedMotion: boolean;
}

// Accessibility
export interface AccessibilityState {
  screenReaderEnabled: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  keyboardNavigation: boolean;
  focusedElement?: {
    type: 'node' | 'edge' | 'control';
    id: string;
  };
  announcements: string[];
}

// Device and responsive
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
}

// Performance UI preferences
export interface PerformanceUIState {
  showFPS: boolean;
  showMemoryUsage: boolean;
  showNodeCount: boolean;
  enableDebugMode: boolean;
  showRenderStats: boolean;
  autoOptimize: boolean;
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
}

// Search UI state
export interface SearchUIState {
  query: string;
  isSearching: boolean;
  suggestions: string[];
  recentSearches: string[];
  filters: {
    types: string[];
    dateRange?: [Date, Date];
    genres: string[];
    artists: string[];
    advanced: boolean;
  };
  results: {
    nodes: any[];
    total: number;
    hasMore: boolean;
  };
  selectedResultIndex: number;
}

// Export state
export interface ExportUIState {
  format: 'png' | 'svg' | 'pdf' | 'json' | 'csv';
  quality: number;
  includeBackground: boolean;
  includeLabels: boolean;
  includeEdges: boolean;
  scale: number;
  bounds: 'visible' | 'selection' | 'all';
  progress: number;
  isExporting: boolean;
}

// Help and tutorial
export interface HelpState {
  showTutorial: boolean;
  currentTutorialStep: number;
  completedTutorials: Set<string>;
  showTooltips: boolean;
  showKeyboardShortcuts: boolean;
  helpPanelOpen: boolean;
  quickStartVisible: boolean;
}