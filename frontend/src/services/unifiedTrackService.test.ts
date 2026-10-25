import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTargetTracks, fetchLibraryFixture, fromLibraryRow } from './unifiedTrackService';
import { LibraryTrack } from '../features/musicLibrary/data';

// Mock the SN utility for camelot normalisation
vi.mock('../lib/songnodes', () => ({
  SN: {
    camelot: vi.fn().mockImplementation((k) => k === 'invalid' ? null : k)
  }
}));

describe('unifiedTrackService', () => {
  describe('fetchTargetTracks', () => {
    it('fetches and maps backend target tracks correctly', async () => {
      const mockResponse = [
        {
          track_id: 'uuid-123',
          title: 'Test Title',
          artist: 'Test Artist',
          genres: ['Techno'],
          priority: 'high',
          is_active: true
        }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const targets = await fetchTargetTracks();

      expect(targets.length).toBe(1);
      expect(targets[0].id).toBe('uuid-123');
      expect(targets[0].title).toBe('Test Title');
      expect(targets[0].artist).toBe('Test Artist');
      expect(targets[0].genre).toBe('Techno');
      expect(targets[0].targetPriority).toBe('high');
      expect(targets[0].isTarget).toBe(true);
      expect(targets[0].source).toBe('backend');
    });
  });

  describe('fetchLibraryFixture', () => {
    it('fetches and maps library fixture', async () => {
      const mockLibraryTrack = {
        id: 'lib-1', a: 'Artist', t: 'Title', m: 'Mix', d: 120, bpm: 125.123,
        k: '8A', e: 7, p: null, rot: null, tags: [], src: [],
        first: null, last: null, g: 'House', lbl: 'Label',
        sync: null, tidal: 'https://tidal.com/1', dz: null, bp: null,
        chart: null, rev: false, ovr: false, local: false
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tracks: [mockLibraryTrack] })
      });

      const tracks = await fetchLibraryFixture();

      expect(tracks.length).toBe(1);
      expect(tracks[0].id).toBe('lib-1');
      expect(tracks[0].bpm).toBe(125.1); // One decimal
    });
  });

  describe('fromLibraryRow', () => {
    it('normalises key and bpm including nulls', () => {
      const emptyTrack: LibraryTrack = {
        id: 'lib-2', a: 'A', t: 'T', m: null, d: null, bpm: null,
        k: null, e: null, p: null, rot: null, tags: [], src: [],
        first: null, last: null, g: null, lbl: null,
        sync: null, tidal: null, dz: null, bp: null,
        chart: null, rev: false, ovr: false, local: false
      };

      const unified = fromLibraryRow(emptyTrack);

      expect(unified.bpm).toBeNull();
      expect(unified.key).toBeNull();

      const mappedTrack: LibraryTrack = {
        ...emptyTrack,
        bpm: 128.567,
        k: 'invalid' // handled by mock
      };

      const unified2 = fromLibraryRow(mappedTrack);
      expect(unified2.bpm).toBe(128.6); // Rounded to 1 dec
      expect(unified2.key).toBeNull();
    });
  });
});
