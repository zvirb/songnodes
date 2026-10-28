import { describe, it, expect } from 'vitest';
import { findCompatibleTracks } from './transitions';
import { LibraryTrack } from '../musicLibrary/data';

describe('findCompatibleTracks', () => {
  const baseTrack = {
    id: 't1', a: 'A', t: 'T', m: null, d: 300, bpm: 120, k: '8A', e: 5, p: 'House',
  } as LibraryTrack;

  const pool = [
    { ...baseTrack, id: 't2', bpm: 122, k: '8A', e: 6 },
    { ...baseTrack, id: 't3', bpm: 125, k: '9A', e: 5 },
    { ...baseTrack, id: 't4', bpm: 130, k: '8A', e: 5 },
    { ...baseTrack, id: 't5', bpm: 120, k: '2A', e: 5 },
    { ...baseTrack, id: 't6', bpm: 120, k: '8A', e: 8 },
  ] as LibraryTrack[];

  it('scores and sorts correctly', () => {
    const matches = findCompatibleTracks(baseTrack, { pool });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].track.id).toBe('t2'); // same key, close BPM, smooth energy
  });

  it('handles edge cases in key (12A -> 1A)', () => {
    const t12A = { ...baseTrack, k: '12A' } as LibraryTrack;
    const t1A = { ...baseTrack, id: 't1A', k: '1A' } as LibraryTrack;
    const matches = findCompatibleTracks(t12A, { pool: [t1A] });
    expect(matches.length).toBe(1);
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it('respects BPM tolerance', () => {
    const matches = findCompatibleTracks(baseTrack, { pool: [
        { ...baseTrack, id: 't7', bpm: 124, k: '8A' },
        { ...baseTrack, id: 't8', bpm: 125, k: '8A' },
    ] as LibraryTrack[] });
    expect(matches.map(m => m.track.id)).toEqual(['t7']);
  });
});
