/**
 * DJ-specific type definitions
 * Based on The DJ's Co-Pilot principles and Camelot Wheel system
 */

// Camelot Wheel key notation (1A-12A for minor, 1B-12B for major)
export type CamelotKey =
  | '1A' | '2A' | '3A' | '4A' | '5A' | '6A'
  | '7A' | '8A' | '9A' | '10A' | '11A' | '12A'
  | '1B' | '2B' | '3B' | '4B' | '5B' | '6B'
  | '7B' | '8B' | '9B' | '10B' | '11B' | '12B';

// Harmonic compatibility levels
export type HarmonicCompatibility = 'perfect' | 'compatible' | 'possible' | 'clash';

// Energy levels (Mixed In Key scale)
export type EnergyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Track play status
export type TrackStatus = 'unplayed' | 'playing' | 'played' | 'queued';

// DJ modes (PLAN vs PLAY)
// PLAN mode: Full-featured preparation interface for track selection and setlist building
// PLAY mode: Simplified performance interface with cognitive offloading for live sets
export type DJMode = 'plan' | 'play';

// Track interface with DJ-specific metadata
export interface Track {
  id: string;
  name: string;
  title?: string;   // Alias for name (for compatibility)
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  release_year?: number; // Alias for year (for compatibility)

  // DJ-critical metadata (optional for compatibility with graph data)
  bpm?: number;
  key?: string; // CamelotKey or other key notation
  camelotKey?: string; // Alias for Camelot-specific key
  energy?: number; // 0-1 float or 1-10 integer scale

  // Timing
  duration?: number; // in seconds
  duration_seconds?: number; // Alias for duration (for compatibility)
  intro?: number;   // intro length in beats
  outro?: number;   // outro length in beats

  // Visual data
  waveform?: number[];
  beatgrid?: number[];

  // Status
  status?: 'unplayed' | 'playing' | 'played' | 'queued';
  lastPlayed?: Date | number; // Date or timestamp
  playCount?: number;

  // Platform IDs
  isrc?: string;
  spotify_id?: string;
  apple_music_id?: string;
  beatport_id?: string;

  // Tags for filtering
  tags?: string[];
  mood?: string;

  // User notes
  notes?: string;
  cuePoints?: CuePoint[];
}

// Cue point for marking important positions
export interface CuePoint {
  id: string;
  position: number; // in seconds
  label: string;
  color: string;
  type: 'intro' | 'buildup' | 'drop' | 'breakdown' | 'outro' | 'custom';
}

// Mix transition information
export interface MixTransition {
  fromTrack: Track;
  toTrack: Track;
  compatibility: HarmonicCompatibility;
  energyFlow: 'up' | 'down' | 'maintain';
  bpmDifference: number;
  recommendedMixPoint?: number; // in seconds
  transitionType: 'blend' | 'cut' | 'effect' | 'echo';
}

// Recommendation engine output
export interface TrackRecommendation {
  track: Track;
  score: number; // 0-100
  reasons: RecommendationReason[];
  compatibility: {
    harmonic: HarmonicCompatibility;
    energy: 'perfect' | 'good' | 'risky';
    bpm: 'perfect' | 'close' | 'needs_adjustment';
  };
}

// Why a track was recommended
export interface RecommendationReason {
  type: 'harmonic' | 'energy' | 'bpm' | 'genre' | 'history' | 'tag';
  description: string;
  weight: number; // How much this factored into the score
}

// Filter criteria for intelligent browsing
export interface DJFilterCriteria {
  bpmRange?: {
    min: number;
    max: number;
    tolerance?: number; // ± tolerance for pitch adjustment
  };
  keyCompatibility?: {
    currentKey: CamelotKey;
    allowPerfect: boolean;
    allowCompatible: boolean;
    allowSemitone: boolean;
  };
  energyRange?: {
    min: EnergyLevel;
    max: EnergyLevel;
    preferredDirection?: 'up' | 'down' | 'maintain';
  };
  tags?: string[];
  excludePlayed?: boolean;
  genre?: string[];
}

// Performance session tracking
export interface DJSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  tracks: PlayedTrack[];
  venue?: string;
  crowdSize?: number;
  notes?: string;
}

// Track played in a session
export interface PlayedTrack {
  track: Track;
  playedAt: Date;
  mixInTime?: number; // When started mixing in
  mixOutTime?: number; // When started mixing out
  crowdResponse?: 'negative' | 'neutral' | 'positive' | 'peak';
  transitionQuality?: 'poor' | 'good' | 'excellent';
}

// UI State for DJ Interface
export interface DJInterfaceState {
  mode: DJMode;
  nowPlaying: Track | null;
  upNext: Track | null;
  recommendations: TrackRecommendation[];
  filters: DJFilterCriteria;
  session: DJSession | null;
  visualizationMode: 'waveform' | 'spectrum' | 'phase';
  copilotEnabled: boolean;
}

// Intelligent Browser configuration
export interface IntelligentBrowserConfig {
  maxRecommendations: number; // Hick's Law: typically 10-20
  sortBy: 'score' | 'bpm' | 'energy' | 'key';
  groupBy?: 'none' | 'compatibility' | 'energy';
  showReasons: boolean;
  autoUpdate: boolean;
  updateInterval: number; // milliseconds
}

// Visual theme for dark environments
export interface DJVisualTheme {
  primaryColor: string;
  successColor: string; // Green for compatible
  warningColor: string; // Yellow for caution
  dangerColor: string; // Red for clash
  backgroundColor: string;
  textColor: string;
  minFontSize: number; // Minimum 18px for clubs
  contrastRatio: number; // Minimum 7:1
}