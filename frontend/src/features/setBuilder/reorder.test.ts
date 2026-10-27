import { describe, expect, it } from 'vitest';
import { reorderTracks } from './reorder';
import type { Slot } from '../musicLibrary/setBuilder';

describe('reorderTracks', () => {
  it('swaps tracks and locks but keeps targets in place', () => {
    const slots: Slot[] = [
      { id: 't1', lock: false, tgt: 1 },
      { id: 't2', lock: true, tgt: 2 },
    ];
    const moved = reorderTracks(slots, 0, 1);
    expect(moved[0]).toEqual({ id: 't2', lock: true, tgt: 1 });
    expect(moved[1]).toEqual({ id: 't1', lock: false, tgt: 2 });
  });

  it('does nothing if moving out of bounds', () => {
    const slots: Slot[] = [
      { id: 't1', lock: false, tgt: 1 },
    ];
    const moved = reorderTracks(slots, 0, 1);
    expect(moved).toEqual(slots);
  });
});
