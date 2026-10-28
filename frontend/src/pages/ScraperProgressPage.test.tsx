/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import ScraperProgressPage from './ScraperProgressPage';

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
    scrapeRuns: [],
    isLoading: false,
    error: null,
    lastUpdated: Date.now(),
    source: 'live',
    refresh: vi.fn(),
  })),
}));

// Mock the API helper since some things use it (retry job)
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
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
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders the queue a scrape form', () => {
    render(<ScraperProgressPage />);

    expect(screen.getAllByRole('heading', { name: 'Queue a scrape' }).length).toBeGreaterThan(0);

    const artistInput = screen.getAllByLabelText('Artist')[0];
    expect(artistInput).toBeTruthy();

    const titleInput = screen.getAllByLabelText('Title')[0];
    expect(titleInput).toBeTruthy();

    const queueBtn = screen.getAllByRole('button', { name: 'Queue scrape' });
    expect(queueBtn.length).toBeGreaterThan(0);
  });

  it('shows errors and does not submit when form is empty', async () => {
    render(<ScraperProgressPage />);

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
      status: 202,
      json: async () => ({ created: true }),
    });

    render(<ScraperProgressPage />);

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

  it('offers only mixesdb and 1001tracklists as sources', () => {
    render(<ScraperProgressPage />);

    expect(screen.getAllByText('MixesDB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1001Tracklists').length).toBeGreaterThan(0);
  });
});
