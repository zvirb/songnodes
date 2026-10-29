// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playlistName, sendSetToTidal } from './sendToTidal';
import { SavedSet } from '../musicLibrary/data';
import { useStore } from '../../store/useStore';

vi.mock('../../store/useStore', () => ({
  useStore: {
    getState: vi.fn(),
  },
}));

describe('sendToTidal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  describe('playlistName', () => {
    it('formats name using SN.format.date (Melbourne time)', () => {
      const d = new Date('2026-10-28T12:00:00Z');
      const name = playlistName(d, 'Warmup');
      expect(name).toContain('· Warmup');
    });
  });

  describe('sendSetToTidal', () => {
    const dummySet: SavedSet = {
      id: '1',
      name: 'Warmup',
      shape: 'journey',
      minutes: 60,
      mix: {},
      pool: 'all',
      tidal: false,
      seed: 1,
      tracks: [
        { id: 't1', tgt: 1, a: 'Artist 1', t: 'Track 1', tidal: 'url1' },
        { id: 't2', tgt: 2, a: 'Artist 2', t: 'Track 2' },
      ],
      updated: '',
      created: '',
    };

    it('sends set with token and blank note', async () => {
      // @ts-ignore
      useStore.getState.mockReturnValue({
        musicCredentials: {
          tidal: { accessToken: 'dummy-token' },
        },
      });

      // @ts-ignore
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          playlist_id: 'pl-1',
          url: 'http://tidal.com/pl-1',
          added: 1,
          unmatched: [{ position: 2, artist: 'Artist 2', title: 'Track 2' }],
        }),
      });

      const result = await sendSetToTidal(dummySet);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/tidal/sets/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer dummy-token'
          }),
          body: expect.any(String)
        })
      );

      expect(result.playlist_id).toBe('pl-1');
      expect(result.unmatched.length).toBe(1);
    });
  });
});
