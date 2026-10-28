import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { pathfinderMachine } from './pathfinder.machine';
import type { Track } from '../../types';

const track = (id: string): Track => ({ id, name: `Track ${id}`, artist: 'Artist' }) as Track;

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
});
