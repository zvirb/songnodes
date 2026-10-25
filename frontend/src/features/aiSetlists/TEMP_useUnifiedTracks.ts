import { useState, useEffect } from 'react';

export type TargetPriority = 'high' | 'medium' | 'low';

export interface UnifiedTrack {
  id: string;
  artist: string;
  title: string;
  mix: string | null;
  durationSec: number | null;
  bpm: number | null; /* one decimal */
  key: string | null; /* Camelot '8A' */
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

// TEMP: replace with useUnifiedTracks from FE1 once it exists on main
export function useUnifiedTracks(): UseUnifiedTracks {
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTracks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/tracks');
      if (res.ok) {
        const data = await res.json();
        setTracks(data.map((t: any) => ({
          id: t.id,
          artist: t.artist_name || t.artist,
          title: t.track_name || t.title,
          mix: null,
          durationSec: null,
          bpm: null,
          key: null,
          energy: null,
          genre: null,
          label: null,
          source: 'backend',
          isTarget: false,
          targetPriority: null,
          tidalUrl: null,
        })));
      } else {
        // Fallback to library
        const libRes = await fetch('/data/music-library.json');
        if (libRes.ok) {
           const libData = await libRes.json();
           if (libData.tracks) {
               setTracks(libData.tracks.map((t: any) => ({
                  id: t.id,
                  artist: t.a,
                  title: t.t,
                  mix: t.m,
                  durationSec: t.d,
                  bpm: t.bpm,
                  key: t.k,
                  energy: t.e,
                  genre: t.p,
                  label: t.lbl,
                  source: 'library-fixture',
                  isTarget: false,
                  targetPriority: null,
                  tidalUrl: null,
               })));
           }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  return {
    tracks,
    targetTracks: [],
    isLoading,
    error: null,
    source: 'backend',
    setTrackAsTarget: () => {},
    removeTargetTrack: () => {},
    refresh: fetchTracks,
  };
}
