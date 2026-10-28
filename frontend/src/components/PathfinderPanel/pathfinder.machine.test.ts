import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { pathfinderMachine } from './pathfinder.machine';
import type { Track } from '../../types';

const track = (id: string): Track => ({ id, name: `Track ${id}`, artist: 'Artist' }) as Track;
type FetchStub = (url: string, init: { body: string }) => Promise<unknown>;

const pathResponse = {
  success: true,
  path: [{ track: track('a'), cumulative_duration_ms: 60000 }],
  total_duration_ms: 120000,
};

describe('pathfinder machine', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores tracks and waypoints and refuses to advance without a start track', () => {
    const actor = createActor(pathfinderMachine).start();
    actor.send({ type: 'NEXT_STEP' });
    expect(actor.getSnapshot().context.error).toMatch(/selectStart/);

    actor.send({ type: 'SET_START_TRACK', track: track('a') });
    actor.send({ type: 'ADD_WAYPOINT', track: track('b') });
    actor.send({ type: 'NEXT_STEP' });
    const { context } = actor.getSnapshot();
    expect(context.startTrack?.id).toBe('a');
    expect(context.waypoints.map((w) => w.track.id)).toEqual(['b']);
    expect(context.error).toBeNull();
    expect(context.currentStep).not.toBe('selectStart');
    expect(context.completedSteps.has('selectStart')).toBe(true);
  });

  it('calculates a path through the invoked actor', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => pathResponse });
    vi.stubGlobal('fetch', fetchMock);
    const actor = createActor(pathfinderMachine).start();
    actor.send({ type: 'SET_START_TRACK', track: track('a') });
    actor.send({ type: 'CALCULATE_PATH', tracks: [{ id: 'a' }], edges: [] });
    await vi.waitFor(() => expect(actor.getSnapshot().matches('success')).toBe(true));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).start_track_id).toBe('a');
    expect(actor.getSnapshot().context.result).toEqual(pathResponse);
    expect(actor.getSnapshot().context.currentStep).toBe('reviewPath');
  });

  it('surfaces actor failures as an error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'No route' }) }));
    const actor = createActor(pathfinderMachine).start();
    actor.send({ type: 'SET_START_TRACK', track: track('a') });
    actor.send({ type: 'CALCULATE_PATH', tracks: [], edges: [] });
    await vi.waitFor(() => expect(actor.getSnapshot().matches('error')).toBe(true));
    expect(actor.getSnapshot().context.error).toBe('No route');
  });

  it('surfaces validation errors correctly as text instead of object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 422,
      json: async () => ({ detail: [{ msg: 'Missing field tracks' }, { msg: 'Missing field edges' }] })
    }));
    const actor = createActor(pathfinderMachine).start();
    actor.send({ type: 'SET_START_TRACK', track: track('a') });
    actor.send({ type: 'CALCULATE_PATH', tracks: [], edges: [] });
    await vi.waitFor(() => expect(actor.getSnapshot().matches('error')).toBe(true));
    expect(actor.getSnapshot().context.error).toBe('Missing field tracks; Missing field edges');
  });

  it('moves to the error state on PATH_ERROR from idle', () => {
    const actor = createActor(pathfinderMachine).start();
    actor.send({ type: 'SET_START_TRACK', track: track('a') });
    actor.send({ type: 'PATH_ERROR', error: 'The graph has not loaded yet.' });
    expect(actor.getSnapshot().matches('error')).toBe(true);
    expect(actor.getSnapshot().context.error).toBe('The graph has not loaded yet.');
    expect(actor.getSnapshot().context.result).toBeNull();
  });

  it('sends the latest tracks and edges when recalculating from success', async () => {
    const fetchMock = vi.fn<FetchStub>().mockResolvedValue({ ok: true, json: async () => pathResponse });
    vi.stubGlobal('fetch', fetchMock);
    const actor = createActor(pathfinderMachine).start();
    actor.send({ type: 'SET_START_TRACK', track: track('a') });
    actor.send({ type: 'CALCULATE_PATH', tracks: [{ id: 'a' }], edges: [] });
    await vi.waitFor(() => expect(actor.getSnapshot().matches('success')).toBe(true));

    const edges = [{ from_id: 'a', to_id: 'b', weight: 1, connection_type: 'sequential' }];
    actor.send({ type: 'CALCULATE_PATH', tracks: [{ id: 'a' }, { id: 'b' }], edges });
    expect(actor.getSnapshot().context.tracks).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(actor.getSnapshot().context.edges).toEqual(edges);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.tracks.map((t: { id: string }) => t.id)).toEqual(['a', 'b']);
    expect(body.edges).toEqual(edges);
  });

  it('sends the latest tracks and edges when retrying from error', async () => {
    const fetchMock = vi.fn<FetchStub>()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ detail: 'No route' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => pathResponse });
    vi.stubGlobal('fetch', fetchMock);
    const actor = createActor(pathfinderMachine).start();
    actor.send({ type: 'SET_START_TRACK', track: track('a') });
    actor.send({ type: 'CALCULATE_PATH', tracks: [], edges: [] });
    await vi.waitFor(() => expect(actor.getSnapshot().matches('error')).toBe(true));

    actor.send({ type: 'CALCULATE_PATH', tracks: [{ id: 'a' }], edges: [] });
    expect(actor.getSnapshot().context.error).toBeNull();
    await vi.waitFor(() => expect(actor.getSnapshot().matches('success')).toBe(true));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tracks).toEqual([{ id: 'a' }]);
  });
});
