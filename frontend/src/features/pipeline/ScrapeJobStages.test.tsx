/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrapeJobStages, STAGES_POLL_MS } from './ScrapeJobStages';
import type { JobStagesResponse } from './jobStages';

const NOW = Date.parse('2026-11-01T10:05:00Z');
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

const running = (sinceProgress: number): JobStagesResponse => ({
  job_id: 'job-1', kind: 'scrape', last_progress_at: ago(sinceProgress),
  stages: [
    { key: 'queued', label: 'Queued', state: 'done', started_at: ago(200), finished_at: ago(190), detail: null },
    { key: 'scrape', label: 'Scraping and saving raw data', state: 'running', started_at: ago(190), finished_at: null, detail: null,
      progress: { pages: 12, playlists: 2, tracks: 87, updated_at: ago(sinceProgress) } },
    { key: 'ingest', label: 'Ingest to silver', state: 'waiting', started_at: null, finished_at: null, detail: null },
    { key: 'projection', label: 'Graph projection', state: 'waiting', started_at: null, finished_at: null, detail: null },
  ],
});

const finished: JobStagesResponse = {
  job_id: 'job-1', kind: 'scrape', last_progress_at: ago(5),
  stages: ['queued', 'scrape', 'ingest', 'projection'].map((key, i) => ({
    key, label: key, state: 'done', started_at: ago(100 - i * 20), finished_at: ago(90 - i * 20), detail: null,
  })),
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const stepOf = (name: string) => screen.getByText(name).closest('li');

let fetchMock: ReturnType<typeof vi.fn<(url: string) => Promise<unknown>>>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  fetchMock = vi.fn<(url: string) => Promise<unknown>>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe('ScrapeJobStages', () => {
  it('renders every stage with live counts and no cancel or try again', async () => {
    fetchMock.mockResolvedValue(ok(running(10)));
    render(<ScrapeJobStages jobId="job-1" query="Deadmau5 Strobe" source="mixesdb" />);
    await flush();
    expect(screen.getByRole('heading').textContent).toBe('Scrape on MixesDB: Deadmau5 Strobe');
    expect(stepOf('Queued')?.getAttribute('data-state')).toBe('done');
    const scrape = stepOf('Scraping and saving raw data');
    expect(scrape?.getAttribute('data-state')).toBe('running');
    expect(scrape?.textContent).toContain('12 pages, 2 playlists and 87 tracks read so far');
    expect(stepOf('Graph projection')?.textContent).toContain('Waiting');
    expect(screen.queryByRole('button', { name: /Try again|Cancel/ })).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/jobs/job-1/stages');
  });

  it('shows the stall once the running step has sent nothing for 60 s', async () => {
    fetchMock.mockResolvedValue(ok(running(75)));
    render(<ScrapeJobStages jobId="job-1" query="Deadmau5 Strobe" source="mixesdb" />);
    await flush();
    const scrape = stepOf('Scraping and saving raw data');
    expect(scrape?.getAttribute('data-state')).toBe('stalled');
    expect(scrape?.textContent).toContain('No progress for 75 s');
  });

  it('polls while the job runs and stops once every stage is done', async () => {
    fetchMock.mockResolvedValueOnce(ok(running(10))).mockResolvedValueOnce(ok(finished));
    render(<ScrapeJobStages jobId="job-1" query="Deadmau5 Strobe" source="mixesdb" />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(STAGES_POLL_MS); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(stepOf('projection')?.getAttribute('data-state')).toBe('done');
    await act(async () => { await vi.advanceTimersByTimeAsync(STAGES_POLL_MS * 3); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows the cause of a failed request instead of stages', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ detail: 'Database unavailable' }) });
    render(<ScrapeJobStages jobId="job-1" query="" source="" />);
    await flush();
    expect(screen.getByText('Could not read the stages of this scrape')).toBeTruthy();
    expect(screen.getByText('Database unavailable (HTTP 503)')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
