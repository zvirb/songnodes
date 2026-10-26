import { create } from 'zustand';
import { UnifiedTrack, UseUnifiedTracks, TargetPriority } from '../types/unifiedTrack';
import { fetchTargetTracks, fetchLibraryFixture } from '../services/unifiedTrackService';
import { getLocalTargets, syncTargetTrack } from '../services/trackSyncAdapter';

interface UnifiedTracksStore {
  tracks: UnifiedTrack[];
  targetTracks: UnifiedTrack[];
  isLoading: boolean;
  error: string | null;
  source: 'backend' | 'library-fixture' | 'mixed';
  setTracks: (tracks: UnifiedTrack[], targets: UnifiedTrack[], source: 'backend' | 'library-fixture' | 'mixed') => void;
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  updateTrackTargetState: (id: string, isTarget: boolean, priority: TargetPriority | null) => void;
}

const useUnifiedTracksStore = create<UnifiedTracksStore>((set) => ({
  tracks: [],
  targetTracks: [],
  isLoading: false,
  error: null,
  source: 'backend', // will be updated
  setTracks: (tracks, targets, source) => set({ tracks, targetTracks: targets, source }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
  updateTrackTargetState: (id, isTarget, priority) => set((state) => {
    // Update track in tracks array
    const updatedTracks = state.tracks.map(t =>
      t.id === id ? { ...t, isTarget, targetPriority: priority } : t
    );

    // Update targetTracks array
    const updatedTargets = [...state.targetTracks];
    const targetIdx = updatedTargets.findIndex(t => t.id === id);

    if (isTarget) {
      if (targetIdx >= 0) {
        updatedTargets[targetIdx] = { ...updatedTargets[targetIdx], isTarget, targetPriority: priority };
      } else {
        const track = updatedTracks.find(t => t.id === id);
        if (track) {
          updatedTargets.push({ ...track, isTarget, targetPriority: priority });
        }
      }
    } else {
      if (targetIdx >= 0) {
        updatedTargets.splice(targetIdx, 1);
      }
    }

    return { tracks: updatedTracks, targetTracks: updatedTargets };
  })
}));

// We only want to load once globally per session unless refreshed
let initializationPromise: Promise<void> | null = null;

export function useUnifiedTracks(): UseUnifiedTracks {
  const { tracks, targetTracks, isLoading, error, source, setTracks, setError, setLoading, updateTrackTargetState } = useUnifiedTracksStore();

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      let targets: UnifiedTrack[] = [];
      let libTracks: UnifiedTrack[] = [];
      let dataMode: 'backend' | 'library-fixture' | 'mixed' = 'mixed';

      try {
        targets = await fetchTargetTracks();
      } catch (err) {
        // Backend empty or unreachable
      }

      try {
        libTracks = await fetchLibraryFixture();
      } catch (err) {
        throw new Error('Failed to load library data: ' + (err instanceof Error ? err.message : String(err)));
      }

      // Hydrate library tracks with local target state or backend target state
      // Match by artist + title since IDs might differ between backend and library
      const targetMap = new Map<string, UnifiedTrack>();
      targets.forEach(t => targetMap.set(`${t.artist.toLowerCase()}|${t.title.toLowerCase()}`, t));

      const localTargets = getLocalTargets();

      const hydratedTracks = libTracks.map(t => {
        const localTarget = localTargets[t.id];
        const matchKey = `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`;
        const backendTarget = targetMap.get(matchKey);

        let isTarget = false;
        let priority: TargetPriority | null = null;

        if (localTarget) {
          isTarget = localTarget.isTarget;
          priority = localTarget.priority;
        } else if (backendTarget) {
          isTarget = backendTarget.isTarget;
          priority = backendTarget.targetPriority;
        }

        return {
          ...t,
          isTarget,
          targetPriority: priority
        };
      });

      // The targetTracks list should include both the ones loaded from backend
      // and any from the library that are locally marked as targets
      const allTargetsMap = new Map<string, UnifiedTrack>();
      targets.forEach(t => allTargetsMap.set(t.id, t));

      hydratedTracks.forEach(t => {
        if (t.isTarget) {
          // If we have a matching ID, use that
          if (!allTargetsMap.has(t.id)) {
            allTargetsMap.set(t.id, t);
          }
        }
      });

      if (targets.length === 0) {
        dataMode = 'library-fixture';
      }

      setTracks(hydratedTracks, Array.from(allTargetsMap.values()), dataMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Auto-initialize on first mount
  if (!initializationPromise && tracks.length === 0 && !isLoading && !error) {
    initializationPromise = refresh();
  }

  const setTrackAsTarget = (id: string, priority: TargetPriority = 'medium') => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;

    // Optimistic UI update
    updateTrackTargetState(id, true, priority);

    // Async sync
    syncTargetTrack(id, { title: track.title, artist: track.artist, mix: track.mix }, true, priority).catch(err => {
      // Sync failed, but we keep the local state (handled by adapter)
      console.warn('Failed to sync target to backend, saved locally', err);
    });
  };

  const removeTargetTrack = (id: string) => {
    const track = tracks.find(t => t.id === id);
    const targetTrack = targetTracks.find(t => t.id === id);
    if (!track && !targetTrack) return;

    const trackData = track || targetTrack;

    // Check if we have a backend ID to delete by checking the target list
    // A target loaded from backend has its UUID as the ID
    let targetId: string | undefined;

    if (targetTrack?.source === 'backend') {
      targetId = targetTrack.id;
    } else if (track) {
      // Find matching backend target by artist/title
      const matchKey = `${track.artist.toLowerCase()}|${track.title.toLowerCase()}`;
      const backendTarget = targetTracks.find(t => t.source === 'backend' && `${t.artist.toLowerCase()}|${t.title.toLowerCase()}` === matchKey);
      if (backendTarget) {
        targetId = backendTarget.id;
      }
    }

    // Optimistic UI update
    updateTrackTargetState(id, false, null);
    if (targetId && targetId !== id) {
       updateTrackTargetState(targetId, false, null);
    }

    // Async sync
    syncTargetTrack(
      id,
      { title: trackData!.title, artist: trackData!.artist, mix: trackData!.mix },
      false,
      null,
      targetId
    ).catch(err => {
      console.warn('Failed to sync target removal to backend, saved locally', err);
    });
  };

  return {
    tracks,
    targetTracks,
    isLoading,
    error,
    source,
    setTrackAsTarget,
    removeTargetTrack,
    refresh
  };
}
