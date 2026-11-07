/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrackDetailPage from './TrackDetailPage';

vi.mock('../../shell/AppShell', () => ({
  usePageHeader: vi.fn(),
}));

vi.mock('../../store/useStore', () => ({
  useGraphNodes: () => [
    {
      id: 'track-123',
      artist: 'Bicep',
      title: 'Glue',
      bpm: 130,
      key: '8A',
      energy: 7,
      duration: 269,
      genre: 'Breakbeat',
      track: {
        id: 'track-123',
        artist: 'Bicep',
        name: 'Glue',
        bpm: 130,
        key: '8A',
        energy: 7,
        duration: 269,
        genre: 'Breakbeat',
      },
    },
    {
      id: 'track-456',
      artist: 'Overmono',
      title: 'So U Kno',
      bpm: 132,
      key: '9A',
      energy: 8,
      duration: 310,
      track: {
        id: 'track-456',
        artist: 'Overmono',
        name: 'So U Kno',
        bpm: 132,
        key: '9A',
        energy: 8,
      },
    },
  ],
  useGraphEdges: () => [
    {
      id: 'edge-1',
      source: 'track-123',
      target: 'track-456',
      type: 'Proven transition',
      weight: 3.5,
    },
  ],
}));

vi.mock('../../services/unifiedTrackService', () => ({
  fetchLibraryTracks: vi.fn().mockResolvedValue({
    tracks: [
      {
        id: 'track-123',
        artist: 'Bicep',
        title: 'Glue',
        bpm: 130,
        key: '8A',
        energy: 7,
        durationSec: 269,
        genre: 'Breakbeat',
        source: 'PBS',
        tidalUrl: 'https://listen.tidal.com/track/12345678',
      },
    ],
    source: 'library-fixture',
  }),
}));

describe('TrackDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders track details with key, BPM, energy and connected transitions', async () => {
    render(
      <MemoryRouter initialEntries={['/tracks/track-123']}>
        <Routes>
          <Route path="/tracks/:id" element={<TrackDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Header with artist and title
    expect(await screen.findByRole('heading', { level: 1, name: /Track:\s*Bicep – Glue/ })).toBeTruthy();

    // Key, BPM and energy
    expect(screen.getByText('8A')).toBeTruthy();
    expect(screen.getByText('A minor')).toBeTruthy();
    expect(screen.getByText('130')).toBeTruthy();
    expect(screen.getByText('7 / 10')).toBeTruthy();

    // Connected tracks section
    expect(screen.getByText(/Overmono –/)).toBeTruthy();
    expect(screen.getByText(/So U Kno/)).toBeTruthy();
    expect(screen.getByText('3.5')).toBeTruthy();
  });

  it('renders not found state when track id does not exist', async () => {
    render(
      <MemoryRouter initialEntries={['/tracks/nonexistent-track']}>
        <Routes>
          <Route path="/tracks/:id" element={<TrackDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Track not found in library')).toBeTruthy();
  });
});
