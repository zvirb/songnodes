// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { mapJobsToTelemetry, mapOutboxToStages, mapJobsToWorkers, usePipelineTelemetry } from './usePipelineTelemetry';
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

  it('mapOutboxToStages handles empty data with em dashes', () => {
    const outbox: OutboxStatusResponse = { consumers: [], dead_letters: 0, projection: {} };
    const stages = mapOutboxToStages(outbox);

    const silver = stages.find(s => s.id === 'silver')!;
    expect(silver.state).toBe('waiting');
    expect(silver.detail).toBe('—');
    expect(silver.total).toBe(0);
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

    const w1 = workers.find(w => w.name === '1001tracklists Worker');
    expect(w1).toBeDefined();
    expect(w1!.successRate).toBeCloseTo(66.67, 1);

    const w2 = workers.find(w => w.name === 'spotify Worker');
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
