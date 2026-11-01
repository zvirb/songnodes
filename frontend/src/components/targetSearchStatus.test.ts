/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { SN } from '../lib/songnodes';
import { targetSearchStatus, isPendingSearch, type TargetSearchJobs } from './targetSearchStatus';

const STARTED = '2026-11-02T03:05:00Z';
const FINISHED = '2026-11-02T03:09:00Z';
const jobs = (over: Partial<TargetSearchJobs>): TargetSearchJobs => ({
  queued: 0, running: 0, succeeded: 0, dead: 0, finished_at: null, last_error: null, ...over,
});

describe('targetSearchStatus', () => {
  it('a target never searched says so and has no detail', () => {
    expect(targetSearchStatus({ last_searched: null, search_jobs: null }))
      .toEqual({ kind: 'never', status: 'idle', label: 'Never searched', detail: null, retry: false });
  });

  it('a search with no job record says it started, not that it finished', () => {
    const s = targetSearchStatus({ last_searched: STARTED, search_jobs: jobs({}) });
    expect([s.kind, s.status, s.label]).toEqual(['unrecorded', 'info', 'Search started']);
    expect(s.detail).toBe(`${SN.format.dateTime(STARTED)} · no scrape job on record`);
    expect(targetSearchStatus({ last_searched: STARTED }).kind).toBe('unrecorded');
  });

  it('queued jobs show Queued with the sources done so far', () => {
    const s = targetSearchStatus({ last_searched: STARTED, search_jobs: jobs({ queued: 2 }) });
    expect([s.kind, s.status, s.label, s.detail]).toEqual(['queued', 'idle', 'Queued', '0 of 2 sources done']);
  });

  it('a running job shows Searching… even while another source waits', () => {
    const s = targetSearchStatus({ last_searched: STARTED, search_jobs: jobs({ running: 1, succeeded: 1 }) });
    expect([s.kind, s.status, s.label, s.detail]).toEqual(['running', 'running', 'Searching…', '1 of 2 sources done']);
    const single = targetSearchStatus({ last_searched: STARTED, search_jobs: jobs({ running: 1 }) });
    expect(single.detail).toBe(`Started ${SN.format.dateTime(STARTED)}`);
  });

  it('a finished search shows when it finished and the playlists found', () => {
    const s = targetSearchStatus({ last_searched: STARTED, playlists_found: 3, search_jobs: jobs({ succeeded: 2, finished_at: FINISHED }) });
    expect([s.kind, s.status, s.label, s.retry]).toEqual(['done', 'ok', 'Searched', false]);
    expect(s.detail).toBe(`${SN.format.dateTime(FINISHED)} · 3 playlists found`);
    const one = targetSearchStatus({ last_searched: STARTED, playlists_found: 1, search_jobs: jobs({ succeeded: 1, finished_at: FINISHED }) });
    expect(one.detail).toBe(`${SN.format.dateTime(FINISHED)} · 1 playlist found`);
  });

  it('one failed source is Partly done with a retry', () => {
    const s = targetSearchStatus({ last_searched: STARTED, playlists_found: 2, search_jobs: jobs({ succeeded: 1, dead: 1 }) });
    expect([s.kind, s.status, s.label, s.detail, s.retry]).toEqual(['partial', 'warn', 'Partly done', '1 of 2 sources failed · 2 playlists found', true]);
  });

  it('every source failed is Search failed with the cause and a retry', () => {
    const s = targetSearchStatus({ last_searched: STARTED, search_jobs: jobs({ dead: 2, last_error: 'unified scraper returned HTTP 503', finished_at: FINISHED }) });
    expect([s.kind, s.status, s.label, s.detail, s.retry]).toEqual(['failed', 'bad', 'Search failed', 'unified scraper returned HTTP 503', true]);
  });

  it('never reports a percentage', () => {
    const all = [jobs({ queued: 1 }), jobs({ running: 1 }), jobs({ succeeded: 1 }), jobs({ dead: 1 })]
      .map((j) => targetSearchStatus({ last_searched: STARTED, search_jobs: j }));
    for (const s of all) expect(`${s.label} ${s.detail}`).not.toMatch(/%/);
  });

  it('pending is everything except a finished search', () => {
    expect(isPendingSearch({ last_searched: null })).toBe(true);
    expect(isPendingSearch({ last_searched: STARTED, search_jobs: jobs({ running: 1 }) })).toBe(true);
    expect(isPendingSearch({ last_searched: STARTED, search_jobs: jobs({ succeeded: 1, dead: 1 }) })).toBe(true);
    expect(isPendingSearch({ last_searched: STARTED, search_jobs: jobs({ succeeded: 2 }) })).toBe(false);
  });
});
