import { useEffect, useState } from 'react';
import { loadLibrary, type LibraryTrack } from '../musicLibrary/data';
import { SN } from '../../lib/songnodes';

export type TargetPriority = 'high' | 'medium' | 'low';

export interface UnifiedTrack {
  id: string;
  artist: string;
  title: string;
  mix: string | null;
  durationSec: number | null;
  bpm: number | null /* one decimal */;
  key: string | null /* Camelot '8A' */;
  energy: number | null;
  genre: string | null;
  label: string | null;
  source: 'backend' | 'library-fixture';
  isTarget: boolean;
  targetPriority: TargetPriority | null;
  tidalUrl: string | null;
}

export interface UseUnifiedTracks {
  tracks: UnifiedTrack[];
  targetTracks: UnifiedTrack[];
  isLoading: boolean;
  error: string | null;
  source: 'backend' | 'library-fixture' | 'mixed';
  setTrackAsTarget(id: string, priority?: TargetPriority): void;
  removeTargetTrack(id: string): void;
  refresh(): Promise<void>;
}

/**
 * Temporary local adapter for useUnifiedTracks until FE1 implements it and merges.
 * Reads solely from the library fixture since backend is unseeded.
 */
export function useUnifiedTracks(): UseUnifiedTracks {
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [targetIds, setTargetIds] = useState<Record<string, TargetPriority>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracks = async () => {
    setIsLoading(true);
    try {
      const data = await loadLibrary();
      const unified: UnifiedTrack[] = data.tracks.map((t: LibraryTrack) => {
        return {
          id: t.id,
          artist: t.a,
          title: t.t,
          mix: t.m,
          durationSec: t.d,
          bpm: t.bpm !== null ? Math.round(t.bpm * 10) / 10 : null,
          key: t.k ? SN.camelot(t.k) || null : null,
          energy: t.e,
          genre: t.g,
          label: t.lbl,
          source: 'library-fixture',
          isTarget: !!targetIds[t.id],
          targetPriority: targetIds[t.id] || null,
          tidalUrl: t.tidal,
        };
      });
      setTracks(unified);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading tracks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const setTrackAsTarget = (id: string, priority: TargetPriority = 'medium') => {
    setTargetIds(prev => ({ ...prev, [id]: priority }));
    setTracks(prev => prev.map(t => t.id === id ? { ...t, isTarget: true, targetPriority: priority } : t));
  };

  const removeTargetTrack = (id: string) => {
    setTargetIds(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTracks(prev => prev.map(t => t.id === id ? { ...t, isTarget: false, targetPriority: null } : t));
  };

  return {
    tracks,
    targetTracks: tracks.filter(t => t.isTarget),
    isLoading,
    error,
    source: 'library-fixture',
    setTrackAsTarget,
    removeTargetTrack,
    refresh: fetchTracks,
  };
}
