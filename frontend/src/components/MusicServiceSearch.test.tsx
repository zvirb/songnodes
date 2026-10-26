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

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    const button = screen.getByRole('button', { name: /search/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('TIDAL is not configured')).not.toBeNull();
    });
  });
});
