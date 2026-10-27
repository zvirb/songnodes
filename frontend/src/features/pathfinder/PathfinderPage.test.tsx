// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
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

// Mock the hooks
vi.mock('../../hooks/useUnifiedTracks', () => ({
  useUnifiedTracks: () => ({
    tracks: [
      { id: '1', title: 'Track 1', artist: 'Artist 1', key: '8A' },
      { id: '2', title: 'Track 2', artist: 'Artist 2', key: null }
    ],
    isLoading: false,
    error: null,
    source: 'library-fixture'
  })
}));

const mockSend = vi.fn<(...args: unknown[]) => void>();

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
    availableTracks: [{ id: '1', name: 'Start', artist: 'Artist' }],
    isCalculating: false,
    hasResult: true,
    hasError: false,
    send: mockSend
  })
}));

describe('PathfinderPage', () => {
  it('renders title and found path', () => {
    render(<MemoryRouter><PathfinderPage /></MemoryRouter>);
    expect(screen.getByText('Pathfinder')).toBeTruthy();
    expect(screen.getByText('Found path')).toBeTruthy();
  });
});
