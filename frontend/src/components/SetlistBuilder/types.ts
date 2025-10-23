/**
 * SetlistBuilder Type Definitions
 * Optimized for performance and type safety
 */

export interface Track {
  id: string;
  name: string;
  artist: string;
  duration?: number;
  bpm?: number;
  key?: string;
  energy?: number;
  spotify_id?: string;
  isrc?: string;
}

export interface SetlistTrack {
  id: string;
  track: Track;
  position: number;
  transition_notes?: string;
  key_shift?: number;
  tempo_change?: number;
  mix_cue_in?: number;
  mix_cue_out?: number;
}

export interface Setlist {
  id?: string;
  name: string;
  tracks: SetlistTrack[];
  created_at?: Date;
  updated_at?: Date;
}

export interface SetlistState {
  setlist: Setlist | null;
  undoStack: Setlist[];
  redoStack: Setlist[];
}

export interface SetlistActions {
  setSetlist: (setlist: Setlist) => void;
  addTrack: (track: Track, position?: number) => void;
  removeTrack: (trackId: string) => void;
  moveTrack: (from: number, to: number) => void;
  updateTrack: (trackId: string, updates: Partial<SetlistTrack>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearSetlist: () => void;
}

export interface TransitionQuality {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  key: 'perfect' | 'good' | 'poor' | 'unknown';
  bpm: 'perfect' | 'good' | 'poor' | 'unknown';
  energy?: 'good' | 'poor' | 'unknown';
}

export interface SetlistAnalytics {
  totalDuration: number;
  trackCount: number;
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  bpmProgression: number[];
  energyFlow: number[];
  keyChanges: number;
  harmonicCompatibility: number;
}

export interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  error: string | null;
}

export type ExportFormat = 'json' | 'spotify' | 'tidal' | 'csv' | 'm3u' | 'clipboard';
