/**
 * TypeScript interfaces for IntelligentBrowser component
 * Provides comprehensive type definitions for track recommendations and browser state
 */

export interface Track {
  id: string;
  name: string;
  artist: string;
  bpm?: number;
  key?: string;
  energy?: number;
  duration?: number;
  genre?: string;
  spotify_id?: string;
  isrc?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
}

export type CamelotKey =
  | '1A' | '1B' | '2A' | '2B' | '3A' | '3B'
  | '4A' | '4B' | '5A' | '5B' | '6A' | '6B'
  | '7A' | '7B' | '8A' | '8B' | '9A' | '9B'
  | '10A' | '10B' | '11A' | '11B' | '12A' | '12B';

export type CompatibilityLevel = 'perfect' | 'compatible' | 'clash';
export type EnergyLevel = 'perfect' | 'good' | 'risky';
export type BPMLevel = 'perfect' | 'close' | 'needs_adjustment';

export interface Compatibility {
  harmonic: CompatibilityLevel;
  energy: EnergyLevel;
  bpm: BPMLevel;
}

export interface RecommendationReason {
  type: 'history' | 'harmonic' | 'energy' | 'bpm' | 'genre';
  description: string;
  weight: number;
}

export interface TrackRecommendation {
  track: Track;
  score: number;
  reasons: RecommendationReason[];
  compatibility: Compatibility;
}

export type SortOption = 'score' | 'energy' | 'bpm' | 'key';
export type ViewMode = 'list' | 'grid' | 'compact';

export interface IntelligentBrowserConfig {
  maxRecommendations: number;
  sortBy: SortOption;
  groupBy: 'compatibility' | 'none';
  showReasons: boolean;
  autoUpdate: boolean;
  updateInterval: number;
}

export interface BrowserState {
  selectedTracks: Set<string>;
  focusedTrackId: string | null;
  searchQuery: string;
  sortBy: SortOption;
  viewMode: ViewMode;
  showFilters: boolean;
}

export interface BrowserAction {
  type: 'SELECT_TRACK' | 'FOCUS_TRACK' | 'SEARCH' | 'SORT' | 'CHANGE_VIEW' | 'TOGGLE_FILTERS' | 'CLEAR_SELECTION';
  payload?: any;
}

export interface FilterCriteria {
  minBpm?: number;
  maxBpm?: number;
  keys?: CamelotKey[];
  energyRange?: [number, number];
  genres?: string[];
}
