export type TargetPriority = 'high' | 'medium' | 'low';
export interface UnifiedTrack {
  id: string; artist: string; title: string; mix: string | null;
  durationSec: number | null; bpm: number | null /* one decimal */;
  key: string | null /* Camelot '8A' */; energy: number | null; genre: string | null; label: string | null;
  source: 'backend' | 'library-fixture'; isTarget: boolean; targetPriority: TargetPriority | null;
  tidalUrl: string | null;
}
export interface UseUnifiedTracks {
  tracks: UnifiedTrack[]; targetTracks: UnifiedTrack[]; isLoading: boolean; error: string | null;
  source: 'backend' | 'library-fixture' | 'mixed';
  setTrackAsTarget(id: string, priority?: TargetPriority): void; removeTargetTrack(id: string): void;
  refresh(): Promise<void>;
}
