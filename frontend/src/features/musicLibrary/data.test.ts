/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { readSavedSetsAsync, writeSavedSetsAsync, readSavedSets, writeSavedSets, SAVED_SETS_KEY, type SavedSet, loadLibrary, mapApiToLibraryTrack } from './data';

describe('loadLibrary', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps missing fields to null correctly', () => {
        const row = {
            id: '123', a: 'Artist', t: 'Title'
        };
        const mapped = mapApiToLibraryTrack(row);
        expect(mapped.m).toBeNull();
        expect(mapped.rev).toBe(false);
        expect(mapped.tags).toEqual([]);
        expect(mapped.chart).toBeNull();
    });

    it('falls back to JSON fixture on API error', async () => {
        const fetchMock = fetch as Mock;
        fetchMock.mockRejectedValueOnce(new Error('Network Error'));
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ tracks: [], counts: { tracks: 0 } })
        });

        const data = await loadLibrary(true);
        expect(data._source).toBe('library-fixture');
        expect(fetchMock).toHaveBeenCalledTimes(2); // one for API, one for fallback
    });

    it('falls back to static json when API returns empty array', async () => {
        const fetchMock = fetch as Mock;
        // API returns 200 OK with empty array
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });
        // Fallback static JSON
        const staticPayload = {
            generated: '2026-10-28T00:00:00Z',
            ledger_updated: '2026-10-28T00:00:00Z',
            counts: { tracks: 1, pending: 0, rejected: 0, beatport_check: 0 },
            sources: [],
            runs: [],
            tracks: [{ id: 'static-1', a: 'Artist', t: 'Track', m: null, d: 300, bpm: 125, k: '8A', e: 5, p: 'House', rot: 1, tags: [], src: ['pbs'], first: null, last: null, g: 'House', lbl: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false }]
        };
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => staticPayload
        });

        const lib = await loadLibrary(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/library/search?limit=5000');
        expect(fetchMock).toHaveBeenCalledWith('/data/music-library.json', { cache: 'no-cache' });
        expect(lib.tracks).toHaveLength(1);
        expect(lib.tracks[0].id).toBe('static-1');
    });

    it('uses API results when API returns tracks', async () => {
        const fetchMock = fetch as Mock;
        const apiTracks = [{ id: 'api-1', a: 'Api Artist', t: 'Api Track', m: null, d: 250, bpm: 128, k: '9A', e: 7, p: 'Techno', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false }];
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => apiTracks
        });

        const lib = await loadLibrary(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/library/search?limit=5000');
        expect(lib.tracks).toHaveLength(1);
        expect(lib.tracks[0].id).toBe('api-1');
    });
});

describe('SavedSets', () => {
    let store: Record<string, string> = {};

    beforeEach(() => {
        store = {};
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store[k] || null,
            setItem: (k: string, v: string) => { store[k] = v; },
            clear: () => { store = {}; }
        });
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('can save, list after reload, delete, and handle an API error', async () => {
        const fetchMock = fetch as Mock;

        // Mock GET sets returning empty
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        const initialSets = await readSavedSetsAsync();
        expect(initialSets).toEqual([]);

        const newSet: SavedSet = {
            id: 'set-new123',
            name: 'My New Set',
            shape: 'peak',
            minutes: 60,
            mix: {},
            pool: 'crate',
            tidal: false,
            seed: 1,
            tracks: [{ id: 'track-123', tgt: 1 }],
            updated: '2023-01-01T00:00:00Z',
            created: '2023-01-01T00:00:00Z'
        };

        // Mock PUT for new set
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 456 })
        });

        await writeSavedSetsAsync([newSet]);

        expect(fetchMock).toHaveBeenCalledWith('/api/v1/library/sets/0', expect.objectContaining({ method: 'PUT' }));
        expect(newSet.id).toBe('456');

        // Verify localStorage contains it
        expect(readSavedSets()).toHaveLength(1);
        expect(readSavedSets()[0].id).toBe('456');

        // Mock GET sets returning the new set
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => [{ id: 456, name: 'My New Set', tracks: [{ track_id: 'track-123' }] }]
        });

        const loaded = await readSavedSetsAsync();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].id).toBe('456');
        expect(loaded[0].tracks[0].id).toBe('track-123');

        // Mock DELETE
        fetchMock.mockResolvedValueOnce({
            ok: true
        });

        await writeSavedSetsAsync([]);
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/library/sets/456', expect.objectContaining({ method: 'DELETE' }));

        // Test API Error handling
        fetchMock.mockRejectedValueOnce(new Error('Network Error'));
        await writeSavedSetsAsync([{ ...newSet, id: '999' }]);

        // Ensure local storage still works despite API error
        expect(readSavedSets()).toHaveLength(1);
        expect(readSavedSets()[0].id).toBe('999');
    });
});
