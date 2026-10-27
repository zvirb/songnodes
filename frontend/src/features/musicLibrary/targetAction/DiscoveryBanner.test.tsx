// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscoveryBanner } from './DiscoveryBanner';
import { LibraryTrack } from '../data';
import { useUnifiedTracks } from '../../../hooks/useUnifiedTracks';

// Mock dependencies
vi.mock('../../../hooks/useUnifiedTracks', () => ({
  useUnifiedTracks: vi.fn(),
}));

// Mock SN icon for Banner
vi.mock('../../../lib/songnodes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/songnodes')>();
  return {
    ...actual,
    SnIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
  };
});

const mockTrack1: LibraryTrack = {
  id: 't1', a: 'Artist 1', t: 'Title 1', m: null, bpm: null, k: null, d: 120, e: 5, p: 'House', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false,
};
const mockTrack2: LibraryTrack = {
  id: 't2', a: 'Artist 2', t: 'Title 2', m: null, bpm: null, k: null, d: 120, e: 5, p: 'House', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false,
};
const mockTrack3: LibraryTrack = {
  id: 't3', a: 'Artist 3', t: 'Title 3', m: null, bpm: 120, k: '8A', d: 120, e: 5, p: 'House', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false,
};

describe('DiscoveryBanner', () => {
  const mockSetTrackAsTarget = vi.fn();
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    (useUnifiedTracks as any).mockReturnValue({
      targetTracks: [],
      setTrackAsTarget: mockSetTrackAsTarget,
    });
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders when un-targeted tracks are present', () => {
    render(<DiscoveryBanner tracks={[mockTrack1, mockTrack2, mockTrack3]} />);

    expect(screen.getByText('Enrichment opportunity')).not.toBeNull();
    expect(screen.getByText(/2 tracks in this view lack BPM, key, or graph adjacencies/)).not.toBeNull();
  });

  it('does not render if all tracks are enriched', () => {
    const { container } = render(<DiscoveryBanner tracks={[mockTrack3]} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render if un-enriched tracks are already targeted', () => {
    (useUnifiedTracks as any).mockReturnValue({
      targetTracks: [{ id: 't1', artist: 'Artist 1', title: 'Title 1' }],
      setTrackAsTarget: mockSetTrackAsTarget,
    });
    const { container } = render(<DiscoveryBanner tracks={[mockTrack1]} />);
    expect(container.firstChild).toBeNull();
  });

  it('action triggers batch targeting', async () => {
    render(<DiscoveryBanner tracks={[mockTrack1, mockTrack2]} />);

    const btn = screen.getByRole('button', { name: 'Target top un-enriched' });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockSetTrackAsTarget).toHaveBeenCalledWith('t1', 'medium');
      expect(mockSetTrackAsTarget).toHaveBeenCalledWith('t2', 'medium');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('dismiss hides banner', () => {
    render(<DiscoveryBanner tracks={[mockTrack1]} />);

    expect(screen.getByText('Enrichment opportunity')).not.toBeNull();

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss: Dismiss enrichment banner' });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Enrichment opportunity')).toBeNull();
  });
});
