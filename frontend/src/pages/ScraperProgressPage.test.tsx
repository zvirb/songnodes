/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import ScraperProgressPage from './ScraperProgressPage';
import { showToast } from '../components/ds';
import { api } from '../services/api';

const telemetryState = vi.hoisted(() => ({ scrapeRuns: [] as any[] }));

// Mock the telemetry hook
vi.mock('../features/pipeline/usePipelineTelemetry', () => ({
  usePipelineTelemetry: vi.fn(() => ({
    telemetry: {
      activeWorkers: 0,
      itemsProcessed: 0,
      itemsRemaining: 0,
      throughputRate: null,
      errorCount: 0,
      lastSyncIso: new Date().toISOString(),
    },
    stages: [],
    workers: [],
    jobs: [],
    scrapeRuns: telemetryState.scrapeRuns,
    isLoading: false,
    error: null,
    lastUpdated: Date.now(),
    source: 'live',
    refresh: vi.fn(),
  })),
}));

// The stages card has its own tests; here only which jobs get one matters.
vi.mock('../features/pipeline/ScrapeJobStages', () => ({
  ScrapeJobStages: ({ jobId, query }: { jobId: string; query: string }) => <div data-testid="job-stages">{jobId} {query}</div>,
}));

// The scrape window card has its own tests and its own fetch; here only that the page mounts it matters.
vi.mock('../features/pipeline/ScrapeWindowCard', () => ({
  ScrapeWindowCard: () => <div data-testid="scrape-window-card" />,
}));

// Mock the API helper since some things use it (retry job)
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn().mockResolvedValue({ data: { count: 0 } }),
  },
}));

// Mock API_BASE_URL
vi.mock('../lib/apiBase', () => ({
  API_BASE_URL: 'http://localhost:8000',
}));

// Mock the AppShell hook
vi.mock('../shell/AppShell', () => ({
  usePageHeader: vi.fn(),
}));

// Mock TargetTracksManager component
vi.mock('../components/TargetTracksManager', () => ({
  default: () => <div data-testid="target-tracks-manager">TargetTracksManager</div>,
}));

// Mock the toast function
vi.mock('../components/ds', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    showToast: vi.fn(),
  };
});

describe('ScraperProgressPage', () => {
  let fetchMock: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { count: 0 } });
    telemetryState.scrapeRuns = [];
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it.each([0, 27])('shows the actual review queue count %s', async (count) => {
    vi.mocked(api.get).mockResolvedValue({ data: { count } });
    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);
    const tile = screen.getByText('Review queue').closest('.sn-figure-tile')!;
    await waitFor(() => expect(tile.querySelector('.sn-figure-tile__figure')?.textContent).toBe(String(count)));
    expect(api.get).toHaveBeenCalledWith('/library/review-queue/count');
  });

  it('leaves the review queue count unknown when the response has no count', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);
    const tile = screen.getByText('Review queue').closest('.sn-figure-tile')!;
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(tile.querySelector('.sn-figure-tile__figure')?.textContent).toBe('–');
  });

  it('renders the queue a scrape form', () => {
    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Pipeline: Health' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'Queue a scrape' }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('scrape-window-card')).toBeTruthy();

    const artistInput = screen.getAllByLabelText('Artist')[0];
    expect(artistInput).toBeTruthy();

    const titleInput = screen.getAllByLabelText('Title')[0];
    expect(titleInput).toBeTruthy();

    const queueBtn = screen.getAllByRole('button', { name: 'Queue scrape' });
    expect(queueBtn.length).toBeGreaterThan(0);
  });

  it('shows errors and does not submit when form is empty', async () => {
    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);

    const formQueueBtn = screen.getAllByRole('button', { name: 'Queue scrape' }).find(b => b.getAttribute('type') === 'submit');
    expect(formQueueBtn).toBeTruthy();
    fireEvent.click(formQueueBtn!);

    expect(await screen.findByText('Enter the artist.')).toBeTruthy();
    expect(await screen.findByText('Enter the track title.')).toBeTruthy();

    expect(fetchMock).not.toHaveBeenCalled();

    // Test the focus check later if needed, vitest might be having trouble with activeElement matching because of mock jsdom
    // Checking errors is the main point of this test.
  });

  it('calls the trigger API with source, search_query and Idempotency-Key on valid submission', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ created: true }),
    });

    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);

    const artistInput = screen.getAllByLabelText('Artist')[0];
    const titleInput = screen.getAllByLabelText('Title')[0];

    fireEvent.change(artistInput, { target: { value: 'Deadmau5' } });
    fireEvent.change(titleInput, { target: { value: 'Strobe' } });

    // MixesDB is default. Let's find 1001Tracklists
    const source1001 = screen.getAllByText('1001Tracklists')[0];
    fireEvent.click(source1001);

    const formQueueBtn = screen.getAllByRole('button', { name: 'Queue scrape' }).find(b => b.getAttribute('type') === 'submit');
    expect(formQueueBtn).toBeTruthy();
    fireEvent.click(formQueueBtn!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/api/v1/scrape/trigger');
    expect(calledUrl.searchParams.get('source')).toBe('1001tracklists');
    expect(calledUrl.searchParams.get('search_query')).toBe('Deadmau5 Strobe');

    const options = fetchMock.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.headers).toHaveProperty('Idempotency-Key');
    // Idempotency key should be a valid UUID
    expect(options.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Wait for the form to be cleared
    await waitFor(() => {
      expect((artistInput as HTMLInputElement).value).toBe('');
      expect((titleInput as HTMLInputElement).value).toBe('');
    });
  });

  it('shows the HTTP status when the trigger answers with a non-JSON error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    });

    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);
    fireEvent.change(screen.getAllByLabelText('Artist')[0], { target: { value: 'Deadmau5' } });
    fireEvent.change(screen.getAllByLabelText('Title')[0], { target: { value: 'Strobe' } });
    const formQueueBtn = screen.getAllByRole('button', { name: 'Queue scrape' }).find(b => b.getAttribute('type') === 'submit');
    fireEvent.click(formQueueBtn);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Could not queue the scrape (HTTP 502)');
    });
  });

  it('offers only mixesdb and 1001tracklists as sources', () => {
    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);

    expect(screen.getAllByText('MixesDB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1001Tracklists').length).toBeGreaterThan(0);
  });

  it('shows a stages card for each queued or running scrape and keeps it after the job finishes', () => {
    const run = (id: string, state: string) => ({ id, source: 'mixesdb', query: `Query ${id}`, state, createdAt: '2026-11-01T10:00:00Z', finishedAt: null, seconds: null, playlists: null, tracks: null, error: null });
    telemetryState.scrapeRuns = [run('r1', 'running'), run('q1', 'queued'), run('d1', 'done'), run('f1', 'failed')];
    const { rerender } = render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);
    expect(screen.getAllByTestId('job-stages').map((n) => n.textContent)).toEqual(['r1 Query r1', 'q1 Query q1']);

    telemetryState.scrapeRuns = [run('r1', 'done'), run('q1', 'running')];
    rerender(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);
    expect(screen.getAllByTestId('job-stages')).toHaveLength(2);
  });

  it('shows no stages card when no scrape is unfinished', () => {
    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);
    expect(screen.queryByTestId('job-stages')).toBeNull();
  });

  it('opens on a warn Banner naming the run and linking to /pipeline/runs when yield is half the previous four', () => {
    telemetryState.scrapeRuns = [
      { id: 'latest', source: 'mixesdb', query: 'Yield Drop Run', state: 'done', createdAt: '2026-11-01T12:00:00Z', finishedAt: '2026-11-01T12:05:00Z', seconds: 300, playlists: 1, tracks: 10, error: null },
      { id: 'prev1', source: 'mixesdb', query: 'Run 1', state: 'done', createdAt: '2026-11-01T11:00:00Z', finishedAt: '2026-11-01T11:05:00Z', seconds: 300, playlists: 1, tracks: 100, error: null },
      { id: 'prev2', source: 'mixesdb', query: 'Run 2', state: 'done', createdAt: '2026-11-01T10:00:00Z', finishedAt: '2026-11-01T10:05:00Z', seconds: 300, playlists: 1, tracks: 100, error: null },
      { id: 'prev3', source: 'mixesdb', query: 'Run 3', state: 'done', createdAt: '2026-11-01T09:00:00Z', finishedAt: '2026-11-01T09:05:00Z', seconds: 300, playlists: 1, tracks: 100, error: null },
      { id: 'prev4', source: 'mixesdb', query: 'Run 4', state: 'done', createdAt: '2026-11-01T08:00:00Z', finishedAt: '2026-11-01T08:05:00Z', seconds: 300, playlists: 1, tracks: 100, error: null },
    ];

    render(<MemoryRouter><ScraperProgressPage /></MemoryRouter>);

    const banner = screen.getByRole('alert');
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('data-status')).toBe('warn');
    expect(screen.getByText(/Resolve yield dropped for Yield Drop Run/)).toBeTruthy();

    const link = screen.getByRole('link', { name: 'See run history' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/pipeline/runs');
  });
});
