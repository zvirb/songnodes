/**
 * DJInterface Type Definitions
 *
 * TypeScript interfaces and types specific to the DJInterface component
 * and its sub-components. Extends core types from src/types/*.
 *
 * @module DJInterface/types
 */

import type { Track, DJMode } from '../../types';

/**
 * Props for the main DJInterface component
 */
export interface DJInterfaceProps {
  /**
   * Initial mode to display (PLAN or PLAY)
   * @default 'play'
   */
  initialMode?: DJMode;
}

/**
 * Props for mode-specific panel components
 */
export interface ModePanelProps {
  /** Array of all available tracks */
  tracks: Track[];

  /** Currently selected track (for inspection) */
  selectedTrack: Track | null;

  /** Currently playing track */
  nowPlaying: Track | null;

  /** Callback when a track is selected for inspection */
  onTrackSelect: (track: Track) => void;

  /** Callback when a track should start playing */
  onTrackPlay?: (track: Track) => void;
}

/**
 * Props for PlanModePanel component
 */
export interface PlanModePanelProps extends ModePanelProps {
  /** Graph edges for visualization */
  graphEdges: any[];

  /** Search query for library filtering */
  librarySearchQuery: string;

  /** Callback when search query changes */
  onSearchQueryChange: (query: string) => void;

  /** Active right panel tab */
  rightPanelTab: RightPanelTab;

  /** Callback when right panel tab changes */
  onRightPanelTabChange: (tab: RightPanelTab) => void;

  /** Callback for track right-click (context menu) */
  onTrackRightClick?: (track: Track, position: { x: number; y: number }) => void;
}

/**
 * Props for PlayModePanel component
 */
export interface PlayModePanelProps extends ModePanelProps {
  /** Graph edges for IntelligentBrowser recommendations */
  graphEdges: any[];

  /** Configuration for IntelligentBrowser */
  browserConfig?: IntelligentBrowserConfig;

  /** Callback for track right-click (context menu) */
  onTrackRightClick?: (track: Track, position: { x: number; y: number }) => void;
}

/**
 * Available right panel tabs in PLAN mode
 */
export type RightPanelTab =
  | 'analysis'
  | 'keymood'
  | 'pathfinder'
  | 'tidal'
  | 'spotify'
  | 'targets';

/**
 * Configuration for IntelligentBrowser component
 */
export interface IntelligentBrowserConfig {
  /** Maximum number of recommendations to show */
  maxRecommendations: number;

  /** Whether to show recommendation reasons */
  showReasons: boolean;

  /** Grouping strategy for recommendations */
  groupBy: 'compatibility' | 'energy' | 'bpm' | 'none';
}

/**
 * Props for DJModeSelector component
 */
export interface DJModeSelectorProps {
  /** Current active mode */
  mode: DJMode;

  /** Callback when mode is toggled */
  onModeChange: (mode: DJMode) => void;
}

/**
 * Props for DJHeader component
 */
export interface DJHeaderProps {
  /** Current DJ mode */
  mode: DJMode;

  /** Callback to toggle mode */
  onModeChange: (mode: DJMode) => void;

  /** Number of tracks loaded */
  trackCount: number;

  /** Number of graph connections */
  connectionCount: number;

  /** Callback to open artist attribution manager */
  onOpenArtistAttribution: () => void;

  /** Callback to open tracklist importer */
  onOpenTracklistImporter: () => void;

  /** Callback to open graph filters */
  onOpenGraphFilters: () => void;

  /** Callback to open settings */
  onOpenSettings: () => void;

  /** Callback to open onboarding overlay */
  onOpenOnboarding: () => void;

  /** Whether onboarding has been dismissed permanently */
  onboardingDismissed: boolean;
}

/**
 * State returned by useDJMode hook
 */
export interface DJModeState {
  /** Current mode */
  mode: DJMode;

  /** Toggle between PLAN and PLAY modes */
  toggleMode: () => void;

  /** Set mode to PLAN */
  setToPlan: () => void;

  /** Set mode to PLAY */
  setToPlay: () => void;

  /** Check if currently in PLAN mode */
  isPlanMode: boolean;

  /** Check if currently in PLAY mode */
  isPlayMode: boolean;
}

/**
 * State returned by useTrackManagement hook
 */
export interface TrackManagementState {
  /** Array of all validated and transformed tracks */
  tracks: Track[];

  /** Currently selected track (for inspection) */
  selectedTrack: Track | null;

  /** Currently playing track */
  nowPlaying: Track | null;

  /** History of played tracks (last 50) */
  playHistory: Track[];

  /** Select a track for inspection */
  selectTrack: (track: Track) => void;

  /** Start playing a track */
  playTrack: (track: Track) => void;

  /** Clear current selection */
  clearSelection: () => void;

  /** Clear now playing */
  clearNowPlaying: () => void;
}

/**
 * State returned by useOnboarding hook
 */
export interface OnboardingState {
  /** Whether onboarding overlay is currently shown */
  isShown: boolean;

  /** Whether onboarding has been permanently dismissed */
  isDismissed: boolean;

  /** Show the onboarding overlay */
  show: () => void;

  /** Hide the onboarding overlay (temporary) */
  hide: () => void;

  /** Permanently dismiss onboarding (saves to localStorage) */
  dismiss: () => void;
}

/**
 * Context menu state
 */
export interface ContextMenuState {
  /** Track that was right-clicked */
  track: Track | null;

  /** Position of the context menu */
  position: { x: number; y: number } | null;

  /** Whether context menu is open */
  isOpen: boolean;
}

/**
 * Manual trigger state for scraper operations
 */
export interface ManualTriggerState {
  /** Whether operation is currently loading */
  loading: boolean;

  /** ISO timestamp of last trigger */
  lastTriggered: string | null;
}

/**
 * All manual trigger states
 */
export interface TriggerStates {
  targetSearch: ManualTriggerState;
  scraperTasks: ManualTriggerState;
  clearQueue: ManualTriggerState;
}
