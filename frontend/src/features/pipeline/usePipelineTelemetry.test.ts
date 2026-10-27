// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { mapJobsToTelemetry, mapOutboxToStages, mapJobsToWorkers, mapScrapeRuns, mapPipelineStages, usePipelineTelemetry } from './usePipelineTelemetry';
import { JobResponse, OutboxStatusResponse } from '../../utils/dataLoaderUtils';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('usePipelineTelemetry mappers', () => {
  it('mapJobsToTelemetry computes correct totals', () => {
    const jobs: JobResponse[] = [
      { status: 'succeeded', kind: 'scrape', finished_at: new Date().toISOString() } as any,
      { status: 'succeeded', kind: 'scrape', finished_at: new Date().toISOString() } as any,
      { status: 'queued', kind: 'scrape' } as any,
      { status: 'running', kind: 'scrape' } as any,
      { status: 'running', kind: 'enrich' } as any,
      { status: 'dead', kind: 'scrape' } as any,
    ];

    const t = mapJobsToTelemetry(jobs);
    expect(t.itemsProcessed).toBe(2);
    expect(t.itemsRemaining).toBe(3);
    expect(t.errorCount).toBe(1);
    expect(t.activeWorkers).toBe(2);
    expect(t.throughputRate).toBe(2/15);
  });

  it('mapOutboxToStages handles empty data without inventing progress', () => {
    const outbox: OutboxStatusResponse = { consumers: [], dead_letters: 0, projection: {} };
    const stages = mapOutboxToStages(outbox);

    const silver = stages.find(s => s.id === 'silver')!;
    expect(silver.state).toBe('waiting');
    expect(silver.total).toBe(0);
    expect(stages.find(s => s.id === 'bronze')!.state).toBe('waiting');
  });

  it('mapScrapeRuns flags a finished scrape that saved nothing', () => {
    const base = { kind: 'scrape', attempts: 1, max_attempts: 3, idempotency_key: 'k', run_after: '', last_error: null, updated_at: '' };
    const runs = mapScrapeRuns([
      { ...base, job_id: 'd', kind: 'projection_consume', status: 'succeeded', payload: {}, created_at: '2026-10-27T09:31:00Z', started_at: null, finished_at: null, result: {} },
      { ...base, job_id: 'c', status: 'running', payload: { source: 'mixesdb', search_query: 'x' }, created_at: '2026-10-27T09:30:00Z', started_at: '2026-10-27T09:30:00Z', finished_at: null, result: null },
      { ...base, job_id: 'b', status: 'succeeded', payload: { source: 'mixesdb', search_query: 'Eric Prydz Opus' }, created_at: '2026-10-27T09:20:00Z', started_at: '2026-10-27T09:20:00Z', finished_at: '2026-10-27T09:22:00Z',
        result: { bronze_playlists: 2, bronze_tracks: 31 } },
      { ...base, job_id: 'a', status: 'succeeded', payload: { source: 'mixesdb', search_query: 'Deadmau5 Strobe' }, created_at: '2026-10-27T09:12:13Z', started_at: '2026-10-27T09:12:13Z', finished_at: '2026-10-27T09:17:28Z',
        result: { found_nothing: true, bronze_playlists: 0, bronze_tracks: 0, scraper: { duration_seconds: 315.07 } } },
    ] as JobResponse[]);
    expect(runs.map(r => [r.id, r.state])).toEqual([['c', 'running'], ['b', 'done'], ['a', 'found_nothing']]);
    expect(runs[2].seconds).toBeCloseTo(315.07);
    expect(runs[1].tracks).toBe(31);
  });

  it('mapPipelineStages reports a stalled consumer and a scrape that found nothing', () => {
    const now = new Date('2026-10-27T09:36:00Z').getTime();
    const outbox: OutboxStatusResponse = {
      consumers: [
        { consumer: 'graph_projection', backlog: 15, updated_at: '2026-10-27T03:44:02Z' },
        { consumer: 'projection_tracks', backlog: 0, updated_at: '2026-10-27T09:29:58Z' },
      ],
      dead_letters: 0,
      projection: { missing: 32, extra: 0, stale: 3, source_total: 35, projection_total: 3 },
    };
    const runs = mapScrapeRuns([{ job_id: 'a', kind: 'scrape', status: 'succeeded', payload: { search_query: 'Deadmau5 Strobe' }, created_at: '2026-10-27T09:12:13Z', finished_at: '2026-10-27T09:17:28Z', result: { found_nothing: true } } as unknown as JobResponse]);
    const byId = Object.fromEntries(mapPipelineStages(outbox, runs, now).map(s => [s.id, s]));
    expect(byId.bronze.state).toBe('warning');
    expect(byId.bronze.detail).toContain('found nothing');
    expect(byId.silver.state).toBe('done');
    expect(byId.gold.state).toBe('failed');
    expect(byId.gold.detail).toContain('Stalled');
    expect(byId.serving.state).toBe('warning');
    expect([byId.serving.done, byId.serving.total]).toEqual([3, 35]);
  });

  it('mapJobsToWorkers correctly creates worker health lists', () => {
    const now = new Date();
    const jobs: JobResponse[] = [
      { status: 'succeeded', kind: 'scrape', payload: { source: '1001tracklists' }, finished_at: now.toISOString() } as any,
      { status: 'succeeded', kind: 'scrape', payload: { source: '1001tracklists' }, finished_at: now.toISOString() } as any,
      { status: 'dead', kind: 'scrape', payload: { source: '1001tracklists' } } as any,
      { status: 'running', kind: 'enrich', payload: { source: 'spotify' }, search_query: 'test' } as any,
      { status: 'running', kind: 'projection_consume', payload: {} } as any,
    ];

    const workers = mapJobsToWorkers(jobs);
    expect(workers.length).toBe(3);

    const w1 = workers.find(w => w.name === "1001tracklists worker");
    expect(w1).toBeDefined();
    expect(w1!.successRate).toBeCloseTo(66.67, 1);

    const w2 = workers.find(w => w.name === "spotify worker");
    expect(w2).toBeDefined();
    expect(w2!.status).toBe('running');

    const noSourceWorker = workers.find(w => w.kind === 'projection_consume');
    expect(noSourceWorker?.name).toBe('');
    expect(noSourceWorker?.activeTarget).toBeUndefined();
  });
});

describe('usePipelineTelemetry hook', () => {
  beforeEach(() => {
    // Only mock the ones we need so it doesn't infinite loop on startPolling
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches data successfully initially', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/jobs')) return Promise.resolve({ data: [] });
      if (url.includes('/outbox')) return Promise.resolve({ data: { consumers: [], dead_letters: 0, projection: {} } });
      return Promise.reject(new Error('Unknown url'));
    });

    const { result } = renderHook(() => usePipelineTelemetry());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.source).toBe('unavailable');

    // Wait for the async effect to settle
    await vi.waitFor(() => {
      if (result.current.isLoading) throw new Error("still loading");
    }, { timeout: 1000 });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.source).toBe('live');
    expect(result.current.error).toBeNull();
  });

  it('handles api errors gracefully initially', async () => {
    (api.get as any).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => usePipelineTelemetry());

    await vi.waitFor(() => {
      if (result.current.isLoading) throw new Error("still loading");
    }, { timeout: 1000 });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.source).toBe('unavailable');
    expect(result.current.error).toBe('API Error');
  });
});
