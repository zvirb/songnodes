/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJobStages, mapJobStages, type JobStage, type JobStagesResponse } from './jobStages';

const T0 = Date.parse('2026-11-01T10:00:00Z');
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

const stage = (over: Partial<JobStage>): JobStage => ({
  key: 'scrape', label: 'Scraping and saving raw data', state: 'waiting',
  started_at: null, finished_at: null, detail: null, ...over,
});

const response = (stages: JobStage[], last: string | null): JobStagesResponse =>
  ({ job_id: 'j1', kind: 'scrape', stages, last_progress_at: last });

describe('mapJobStages', () => {
  it('maps each API state and the time a finished step took', () => {
    const res = response([
      stage({ key: 'queued', label: 'Queued', state: 'done', started_at: at(0), finished_at: at(4) }),
      stage({ state: 'running', started_at: at(4) }),
      stage({ key: 'ingest', label: 'Ingest to silver', state: 'waiting' }),
      stage({ key: 'projection', label: 'Graph projection', state: 'failed', started_at: at(10), finished_at: at(13), detail: 'The graph projection failed; earlier data is kept' }),
    ], at(4));
    const { steps } = mapJobStages(res, T0 + 20_000);
    expect(steps.map((s) => [s.name, s.state])).toEqual([
      ['Queued', 'done'], ['Scraping and saving raw data', 'running'], ['Ingest to silver', 'waiting'], ['Graph projection', 'failed'],
    ]);
    expect(steps[0].seconds).toBe(4);
    expect(steps[3].seconds).toBe(3);
    expect(steps[3].detail).toBe('The graph projection failed; earlier data is kept');
    expect(steps[2].secondsSinceProgress).toBeUndefined();
  });

  it('shows live counts through SN.format and keeps the fixed detail when progress is null', () => {
    const live = mapJobStages(response([stage({
      state: 'running', started_at: at(0),
      progress: { pages: 1, playlists: 3, tracks: 1240, updated_at: at(30) },
    })], at(30)), T0 + 40_000);
    expect(live.steps[0].detail).toBe('1 page, 3 playlists and 1,240 tracks read so far');

    const none = mapJobStages(response([stage({
      state: 'running', started_at: at(0), progress: null,
      detail: 'Live progress is unavailable: the scraper did not answer',
    })], at(0)), T0 + 10_000);
    expect(none.steps[0].detail).toBe('Live progress is unavailable: the scraper did not answer');
  });

  it('keeps the final counts and the real duration on a finished scrape', () => {
    const done = mapJobStages(response([stage({
      state: 'done', started_at: at(0), finished_at: at(212),
      progress: { pages: 41, playlists: 2, tracks: 10, updated_at: at(212) },
    })], at(212)), T0 + 300_000);
    expect(done.steps[0].detail).toBe('41 pages, 2 playlists and 10 tracks read');
    expect(done.steps[0].seconds).toBe(212);

    const noPages = mapJobStages(response([stage({
      state: 'done', started_at: at(0), finished_at: at(212),
      progress: { pages: null, playlists: 1, tracks: 1, updated_at: at(212) },
    })], at(212)), T0 + 300_000);
    expect(noPages.steps[0].detail).toBe('1 playlist and 1 track read');
  });

  it('shows an unknown state as not known, never as a guessed state', () => {
    const { steps } = mapJobStages(response([stage({ state: 'paused' })], null), T0);
    expect(steps[0].state).toBe('waiting');
    expect(steps[0].detail).toBe('State not known: the stages API sent "paused"');
    expect(steps[0].seconds).toBeUndefined();
  });

  it('works out the gap since progress from last_progress_at on the running step only', () => {
    const res = response([
      stage({ key: 'queued', label: 'Queued', state: 'done', started_at: at(0), finished_at: at(5) }),
      stage({ state: 'running', started_at: at(5), progress: { pages: 2, playlists: 0, tracks: 0, updated_at: at(20) } }),
    ], at(20));
    const fresh = mapJobStages(res, T0 + 50_000);
    expect(fresh.steps[1].secondsSinceProgress).toBe(30);
    const stalled = mapJobStages(res, T0 + 95_000);
    expect(stalled.steps[1].secondsSinceProgress).toBe(75);
    expect(stalled.steps[0].secondsSinceProgress).toBeUndefined();
    expect(stalled.elapsedSeconds).toBe(95);
    expect(stalled.finished).toBe(false);
  });

  it('is finished when every stage is done or one failed, and then stops the clock', () => {
    const done = mapJobStages(response([
      stage({ state: 'done', started_at: at(0), finished_at: at(60) }),
      stage({ key: 'ingest', state: 'done', started_at: at(61), finished_at: at(70) }),
    ], at(70)), T0 + 500_000);
    expect(done.finished).toBe(true);
    expect(done.elapsedSeconds).toBe(70);
    const failed = mapJobStages(response([stage({ state: 'failed', started_at: at(0), finished_at: at(9) }), stage({ key: 'ingest' })], at(9)), T0 + 100_000);
    expect(failed.finished).toBe(true);
    expect(mapJobStages(response([], null), T0).finished).toBe(false);
  });
});

describe('fetchJobStages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the cause the API gives for a failed request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: 'Job not found' }) }));
    await expect(fetchJobStages('j1')).rejects.toThrow('Job not found (HTTP 404)');
  });

  it('says the API did not answer when the request cannot be made', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchJobStages('j1')).rejects.toThrow('The REST API did not answer the stages request');
  });

  it('asks the stages endpoint of the job', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<unknown>>().mockResolvedValue({ ok: true, status: 200, json: async () => response([], null) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchJobStages('a b');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/jobs/a%20b/stages');
  });
});
