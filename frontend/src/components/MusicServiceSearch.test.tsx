import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MusicServiceSearch from './MusicServiceSearch';
import { api } from '../services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/** @vitest-environment jsdom */

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
  }
}));

describe('MusicServiceSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows detail.message error when one service fails', async () => {
    // Spotify succeeds, Tidal fails with a 424 message
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/music-search/spotify') {
        return { data: { tracks: [] } };
      }
      if (url === '/music-search/tidal') {
        const err = new Error('TIDAL is not configured');
        (err as any).code = 424;
        throw err;
      }
      return { data: { tracks: [] } };
    });

    render(<MusicServiceSearch onAddToTargets={() => {}} />);

    const input = screen.getAllByPlaceholderText('Artist and title')[0];
    fireEvent.change(input, { target: { value: 'test' } });

    const button = screen.getAllByRole('button', { name: /search/i })[0];
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('TIDAL is not configured')).not.toBeNull();
    });
  });

  it('saves executed search to recent list and clicking a chip re-executes', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      return { data: { tracks: [] } };
    });

    render(<MusicServiceSearch onAddToTargets={() => {}} />);

    const input = screen.getAllByPlaceholderText('Artist and title')[0];
    fireEvent.change(input, { target: { value: 'Mall Grab' } });

    const button = screen.getAllByRole('button', { name: /search/i })[0];
    fireEvent.click(button);

    // After search, we need to clear to see recent chips
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/music-search/spotify', expect.objectContaining({ q: 'Mall Grab' }));
    });

    // clear input
    fireEvent.change(input, { target: { value: '' } });

    // Check if the chip is rendered
    await waitFor(() => {
      expect(screen.getByText('Mall Grab')).not.toBeNull();
    });

    // click the chip
    const chip = screen.getByRole('button', { name: 'Mall Grab' });
    fireEvent.click(chip);

    await waitFor(() => {
      // should execute search again
      expect(api.get).toHaveBeenCalledTimes(4); // 2 from first (both), 2 from second (both)
    });
  });

  it('clears recent searches when Clear history is clicked', async () => {
    // Add something to recent by searching
    vi.mocked(api.get).mockImplementation(async (url) => {
      return { data: { tracks: [] } };
    });

    render(<MusicServiceSearch onAddToTargets={() => {}} />);

    const input = screen.getAllByPlaceholderText('Artist and title')[0];
    fireEvent.change(input, { target: { value: 'Dusky' } });
    const button = screen.getAllByRole('button', { name: /search/i })[0];
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText('Dusky')).not.toBeNull();
    });

    // Click clear history
    const clearBtn = screen.getByRole('button', { name: /Clear history/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText('Dusky')).toBeNull();
    });
  });
});
