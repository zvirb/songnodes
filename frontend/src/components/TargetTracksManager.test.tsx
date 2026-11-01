/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import TargetTracksManager from './TargetTracksManager';
import { useTargetSuggestions } from '../hooks/useTargetSuggestions';
import { api } from '../services/api';

vi.mock('../hooks/useTargetSuggestions');
vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const noSuggestions = () => vi.mocked(useTargetSuggestions).mockReturnValue({
  suggestions: [], loading: false, error: null, dismissedIds: [],
  refresh: vi.fn(), promoteSuggestion: vi.fn(), dismissSuggestion: vi.fn(),
});

const row = (id: string, title: string, over: Record<string, unknown>) => ({
  track_id: id, title, artist: 'Deadmau5', priority: 'high', is_active: true, archived: false,
  playlists_found: 0, adjacencies_found: 0, last_searched: null, search_jobs: null, completion_percentage: 40, ...over,
});
const jobs = (over: Record<string, unknown>) => ({ queued: 0, running: 0, succeeded: 0, dead: 0, finished_at: null, last_error: null, ...over });

describe('TargetTracksManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never);
  });

  it('shows each target\'s real search status and no progress slider', async () => {
    noSuggestions();
    vi.mocked(api.get).mockResolvedValue({ data: [
      row('a', 'Never', {}),
      row('b', 'Running', { last_searched: '2026-11-02T03:05:00Z', search_jobs: jobs({ running: 1, succeeded: 1 }) }),
      row('c', 'Done', { last_searched: '2026-11-02T03:05:00Z', playlists_found: 3, search_jobs: jobs({ succeeded: 2, finished_at: '2026-11-02T03:09:00Z' }) }),
      row('d', 'Failed', { last_searched: '2026-11-02T03:05:00Z', search_jobs: jobs({ dead: 2, last_error: 'unified scraper unreachable' }) }),
    ] } as never);

    const { container } = render(<TargetTracksManager />);
    await screen.findByText('Never searched');
    expect(screen.getByText('Searching…')).toBeDefined();
    expect(screen.getByText('1 of 2 sources done')).toBeDefined();
    expect(screen.getByText('Searched')).toBeDefined();
    expect(screen.getByText(/· 3 playlists found$/)).toBeDefined();
    expect(screen.getByText('Search failed')).toBeDefined();
    expect(screen.getByText('unified scraper unreachable')).toBeDefined();
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(screen.queryByText(/Progress/)).toBeNull();
    expect(screen.queryByText(/40%/)).toBeNull();

    const pills = Array.from(container.querySelectorAll('.ttm__search .sn-status-pill')).map((p) => p.getAttribute('data-status'));
    expect(pills).toEqual(['idle', 'running', 'ok', 'bad']);
    expect((screen.getByRole('button', { name: /Retry search/ }) as HTMLButtonElement).disabled).toBe(false);
    const searchButtons = screen.getAllByRole('button', { name: /Search now/ }) as HTMLButtonElement[];
    expect(searchButtons.map((b) => b.disabled)).toEqual([false, true, false]);
    expect(api.put).not.toHaveBeenCalled();
  });

  it('the embedded pending queue hides only targets whose last search finished', async () => {
    noSuggestions();
    vi.mocked(api.get).mockResolvedValue({ data: [
      row('a', 'Never', {}),
      row('c', 'Done', { last_searched: '2026-11-02T03:05:00Z', search_jobs: jobs({ succeeded: 1 }) }),
    ] } as never);

    render(<TargetTracksManager embedded filterStatus="pending" />);
    await screen.findByText('Never searched');
    expect(screen.queryByText('Searched')).toBeNull();
  });

  it('renders suggested tracks rail if suggestions exist', () => {
    const mockSuggestions = [
      { id: '1', title: 'Suggestion 1', artist: 'Artist 1', reason: 'Because' }
    ];
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: mockSuggestions,
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion: vi.fn(),
      dismissSuggestion: vi.fn()
    });

    render(<TargetTracksManager />);
    expect(screen.getByText('Suggested for discovery')).toBeDefined();
    expect(screen.getByText('Suggestion 1')).toBeDefined();
    expect(screen.getByText('Artist 1')).toBeDefined();
  });

  it('calls promoteSuggestion when Add to targets is clicked', async () => {
    const promoteSuggestion = vi.fn();
    const mockSuggestions = [
      { id: '1', title: 'Suggestion 1', artist: 'Artist 1', reason: 'Because' }
    ];
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: mockSuggestions,
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion,
      dismissSuggestion: vi.fn()
    });

    render(<TargetTracksManager />);
    const addButtons = screen.getAllByRole('button', { name: /Add to targets/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(promoteSuggestion).toHaveBeenCalledWith(mockSuggestions[0]);
    });
  });

  it('calls dismissSuggestion when Dismiss is clicked', async () => {
    const dismissSuggestion = vi.fn();
    const mockSuggestions = [
      { id: '1', title: 'Suggestion 1', artist: 'Artist 1', reason: 'Because' }
    ];
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: mockSuggestions,
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion: vi.fn(),
      dismissSuggestion
    });

    render(<TargetTracksManager />);
    const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(dismissSuggestion).toHaveBeenCalledWith('1');
    });
  });

  it('does not render suggestions rail if no suggestions exist', () => {
    vi.mocked(useTargetSuggestions).mockReturnValue({
      suggestions: [],
      loading: false,
      error: null,
      dismissedIds: [],
      refresh: vi.fn(),
      promoteSuggestion: vi.fn(),
      dismissSuggestion: vi.fn()
    });

    render(<TargetTracksManager />);
    expect(screen.queryByText('Suggested for discovery')).toBeNull();
  });
});
