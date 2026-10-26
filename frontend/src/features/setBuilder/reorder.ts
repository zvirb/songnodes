import type { Slot } from '../musicLibrary/setBuilder';

/** Swap two neighbours' tracks and locks; targets stay with the position (artifact up/down). */
export function reorderTracks(slots: Slot[], i: number, dir: -1 | 1): Slot[] {
  const j = i + dir;
  if (j < 0 || j >= slots.length) return slots;
  const S = slots.map((s) => ({ ...s }));
  [S[i].id, S[j].id] = [S[j].id, S[i].id];
  [S[i].lock, S[j].lock] = [S[j].lock, S[i].lock];
  return S;
}
