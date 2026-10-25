import { TargetPriority } from '../types/unifiedTrack';

export const TARGET_TRACKS_KEY = 'sn-target-tracks-v1';

export interface LocalTargetState {
  isTarget: boolean;
  priority: TargetPriority | null;
  pendingSync: boolean;
}

export function getLocalTargets(): Record<string, LocalTargetState> {
  try {
    const data = localStorage.getItem(TARGET_TRACKS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    // Storage unavailable or corrupted
  }
  return {};
}

export function saveLocalTargets(targets: Record<string, LocalTargetState>): void {
  try {
    localStorage.setItem(TARGET_TRACKS_KEY, JSON.stringify(targets));
  } catch (e) {
    // Storage unavailable
  }
}

export async function syncTargetTrack(
  id: string,
  track: { title: string; artist: string; mix: string | null },
  isTarget: boolean,
  priority: TargetPriority | null,
  targetId?: string // backend track_id for deletions if known
): Promise<void> {
  const localTargets = getLocalTargets();
  const searchTerms = track.mix ? [track.mix] : [];

  if (isTarget) {
    try {
      const res = await fetch('/api/v1/target-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          priority: priority || 'medium',
          is_active: true,
          search_terms: searchTerms
        })
      });

      if (!res.ok) {
        throw new Error('Sync failed');
      }

      localTargets[id] = { isTarget, priority, pendingSync: false };
      saveLocalTargets(localTargets);
    } catch (e) {
      localTargets[id] = { isTarget, priority, pendingSync: true };
      saveLocalTargets(localTargets);
      throw e;
    }
  } else {
    // If removing target, ideally we delete by target_id.
    // If we only have the library ID, this requires a search or track mapping.
    // Assuming backend target ID is available as `id` if it was from backend source,
    // or passed via `targetId`

    const idToDelete = targetId || id;

    try {
      // Try to delete via target-tracks API if it's a UUID format
      // Simple regex to check if it might be a UUID (backend track_id)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idToDelete);

      if (isUUID) {
        const res = await fetch(`/api/v1/target-tracks/${idToDelete}`, {
          method: 'DELETE'
        });

        if (!res.ok && res.status !== 404) {
          throw new Error('Sync deletion failed');
        }
      }

      localTargets[id] = { isTarget: false, priority: null, pendingSync: false };
      saveLocalTargets(localTargets);
    } catch (e) {
      localTargets[id] = { isTarget: false, priority: null, pendingSync: true };
      saveLocalTargets(localTargets);
      throw e;
    }
  }
}
