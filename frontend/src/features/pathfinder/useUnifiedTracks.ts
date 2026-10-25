import { UnifiedTrack, UseUnifiedTracks, TargetPriority } from '../../types/unifiedTrack';
import { useStore } from '../../store/useStore';
import { useMemo } from 'react';

// TEMP: replace with useUnifiedTracks from unified tracks package (FE1)
export function useUnifiedTracks(): UseUnifiedTracks {
  const store = useStore();
  const source = 'library-fixture';
  const targetTracks: UnifiedTrack[] = [];
  const isLoading = false;
  const error: string | null = null;

  const tracks = useMemo(() => {
    return store.graphData.nodes.map(node => ({
      id: node.id,
      artist: node.artist,
      title: node.name || (node as any).title || '',
      mix: null,
      durationSec: node.duration || (node as any).duration_seconds || null,
      bpm: node.bpm || null,
      key: node.camelotKey || node.key || null,
      energy: node.energy || null,
      genre: node.genres?.[0] || null,
      label: node.record_label || null,
      source: 'library-fixture' as const,
      isTarget: false,
      targetPriority: null,
      tidalUrl: null
    }));
  }, [store.graphData.nodes]);

  return {
    tracks,
    targetTracks,
    isLoading,
    error,
    source,
    setTrackAsTarget: () => {},
    removeTargetTrack: () => {},
    refresh: async () => {},
  };
}
