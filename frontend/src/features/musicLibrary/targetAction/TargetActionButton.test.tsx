// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TargetActionButton } from './TargetActionButton';
import { LibraryTrack } from '../data';

// Mock dependencies
vi.mock('../../../hooks/useUnifiedTracks', () => ({
  useUnifiedTracks: vi.fn(),
}));

vi.mock('../../../services/trackSyncAdapter', () => ({
  syncTargetTrack: vi.fn(),
}));

// Mock SN icon
vi.mock('../../../lib/songnodes', () => ({
  SnIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

import { useUnifiedTracks } from '../../../hooks/useUnifiedTracks';
import { syncTargetTrack } from '../../../services/trackSyncAdapter';

const mockTrack: LibraryTrack = {
  id: 't1',
  a: 'Artist',
  t: 'Title',
  m: 'Mix',
  bpm: null, // Renders with missing BPM/key
  k: null,
  d: 120,
  e: 5,
  p: 'House',
  rot: 1,
  tags: [],
  src: [],
  first: null,
  last: null,
  g: 'House',
  lbl: null,
  sync: null,
  tidal: null,
  dz: null,
  bp: null,
  chart: null,
  rev: false,
  ovr: false,
  local: false,
};

describe('TargetActionButton', () => {
  const mockSetTrackAsTarget = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup(); // prevent multiple elements issue
    (useUnifiedTracks as any).mockReturnValue({
      targetTracks: [],
      setTrackAsTarget: mockSetTrackAsTarget,
    });
    (syncTargetTrack as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly with idle state', () => {
    render(<TargetActionButton track={mockTrack} />);
    const btn = screen.getByRole('button', { name: 'Add Artist - Title to target tracks' });
    expect(btn).not.toBeNull();
    expect(screen.getByTestId('icon-star')).not.toBeNull();
  });

  it('one click calls setTrackAsTarget once and transitions to added state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock;

    render(<TargetActionButton track={mockTrack} />);
    const btn = screen.getByRole('button', { name: 'Add Artist - Title to target tracks' });

    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockSetTrackAsTarget).toHaveBeenCalledWith('t1', 'medium');
      expect(mockSetTrackAsTarget).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('icon-check')).not.toBeNull();
      expect(screen.queryByRole('button')).toBeNull(); // It becomes a span
    });
  });

  it('double click does not duplicate', async () => {
    // We delay the fetch to keep it in "adding" state
    let resolveSync: (value: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((res) => { resolveSync = res; }));
    globalThis.fetch = fetchMock;

    render(<TargetActionButton track={mockTrack} />);
    const btn = screen.getByRole('button', { name: 'Add Artist - Title to target tracks' });

    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockSetTrackAsTarget).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    resolveSync!({ ok: true });
  });

  it('existing target shows added', () => {
    (useUnifiedTracks as any).mockReturnValue({
      targetTracks: [{ id: 't1', artist: 'Artist', title: 'Title' }],
      setTrackAsTarget: mockSetTrackAsTarget,
    });

    render(<TargetActionButton track={mockTrack} />);
    expect(screen.getByTestId('icon-check')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows backend-down message on failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Backend down'));
    globalThis.fetch = fetchMock;

    render(<TargetActionButton track={mockTrack} />);
    const btn = screen.getByRole('button', { name: 'Add Artist - Title to target tracks' });

    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('saved locally, will sync')).not.toBeNull();
      expect(screen.getByTestId('icon-check')).not.toBeNull();
    });
  });
});
