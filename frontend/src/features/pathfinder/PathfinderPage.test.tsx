// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Setup basic window.SongNodes for vitest before any imports
beforeAll(() => {
  if (typeof window !== 'undefined') {
    Object.assign(window, { SongNodes: {
      format: { duration: () => '1:00', count: () => '1', bpm: () => '120' },
      camelot: (k: string) => k,
      html: { key: () => '', energy: () => '' }
    } });
  }
});

import PathfinderPage from './PathfinderPage';

const view = vi.hoisted(() => ({
  emptyLibrary: false,
  hasResult: true,
  availableTracks: [{ id: '1', name: 'Start', artist: 'Artist' }] as Array<Record<string, unknown>>,
}));

// Mock the hooks
vi.mock('../../hooks/useUnifiedTracks', () => ({
  useUnifiedTracks: () => ({
    tracks: view.emptyLibrary ? [] : [
      { id: '1', title: 'Track 1', artist: 'Artist 1', key: '8A' },
      { id: '2', title: 'Track 2', artist: 'Artist 2', key: null }
    ],
    isLoading: false,
    error: null,
    source: 'library-fixture'
  })
}));

const mockSend = vi.fn<(...args: unknown[]) => void>();

const mockCalculate = vi.fn();

vi.mock('../../components/PathfinderPanel/hooks', () => ({
  usePathfinder: () => ({
    state: {
      startTrack: { id: '1', name: 'Start', artist: 'Artist' },
      endTrack: null,
      result: {
        total_duration_ms: 60000,
        path: [
          { track: { id: '1', name: 'Start', artist: 'Artist', bpm: 120, energy: 0.5, camelot_key: '8A' }, key_compatible: true, is_synthetic_edge: false },
          { track: { id: '3', name: 'Next', artist: 'Artist', bpm: 122, energy: 0.6, camelot_key: '8A' }, key_compatible: true, is_synthetic_edge: false }
        ]
      },
      error: null
    },
    availableTracks: view.availableTracks,
    isCalculating: false,
    hasResult: view.hasResult,
    hasError: false,
    send: mockSend,
    calculate: mockCalculate,
    skippedCount: 12,
  })
}));

vi.mock('../../hooks/useDataLoader', () => ({
  useDataLoader: vi.fn()
}));

describe('PathfinderPage', () => {
  afterEach(() => {
    cleanup();
    view.emptyLibrary = false;
    view.hasResult = true;
    view.availableTracks = [{ id: '1', name: 'Start', artist: 'Artist' }];
  });

  it('shows only Open library when no tracks are available', () => {
    view.emptyLibrary = true;
    const { container } = render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    expect(container.querySelectorAll('.sn-btn--primary')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open library' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Find path' })).toBeNull();
  });

  it('uses the empty-state action until a path has been found', () => {
    view.hasResult = false;
    const { container } = render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    expect(container.querySelectorAll('.sn-btn--primary')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Find path' }));
    expect(mockCalculate).toHaveBeenCalled();
  });

  it('renders title and found path', () => {
    render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    expect(screen.getByText('Pathfinder')).toBeTruthy();
    expect(screen.getByText('Found path')).toBeTruthy();
  });

  it('suggests matching routeable tracks and sets the waypoint on selection', () => {
    mockSend.mockClear();
    render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    const input = screen.getByRole('combobox', { name: 'End track (optional)' });
    fireEvent.change(input, { target: { value: 'Track' } });
    const options = screen.getAllByRole('option');
    // Track 2 has no key, so it cannot be routed and is not suggested.
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Artist 1 – Track 1');
    expect(options[0].textContent).toContain('8A');
    fireEvent.mouseDown(options[0]);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_END_TRACK', track: expect.objectContaining({ id: '1' }) }));
  });

  it('shows skipped tracks count and uses calculate function', () => {
    mockCalculate.mockClear();
    render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    expect(screen.getByText(/12 tracks left out: no duration\./, { exact: false })).toBeTruthy();

    const findRouteBtn = screen.getByRole('button', { name: 'Find path' });
    fireEvent.click(findRouteBtn);
    expect(mockCalculate).toHaveBeenCalled();
  });

  it('matches song_ prefixed availableTracks IDs when selecting a library track with raw UUID (PF-01)', () => {
    view.availableTracks = [{ id: 'song_1', track_id: '1', title: 'Track 1', artist: 'Artist 1' }];
    mockSend.mockClear();
    render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    const input = screen.getByRole('combobox', { name: 'End track (optional)' });
    fireEvent.change(input, { target: { value: 'Track' } });
    const options = screen.getAllByRole('option');
    fireEvent.mouseDown(options[0]);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SET_END_TRACK',
      track: expect.objectContaining({ id: 'song_1', name: 'Track 1' }),
    }));
  });

  it('constructs a fallback Track when selected library track is missing from availableTracks (PF-01)', () => {
    view.availableTracks = [{ id: 'song_999', name: 'Other', artist: 'Other' }];
    mockSend.mockClear();
    render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    const input = screen.getByRole('combobox', { name: 'End track (optional)' });
    fireEvent.change(input, { target: { value: 'Track' } });
    const options = screen.getAllByRole('option');
    fireEvent.mouseDown(options[0]);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SET_END_TRACK',
      track: expect.objectContaining({ id: 'song_1', track_id: '1', name: 'Track 1', artist: 'Artist 1' }),
    }));
  });
});
