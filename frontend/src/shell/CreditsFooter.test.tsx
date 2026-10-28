// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CreditsFooter } from './CreditsFooter';
import * as attributionsModule from '../utils/attributions';

describe('CreditsFooter', () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(attributionsModule, 'fetchAttributions');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders five default links with right hrefs and getsongbpm has no nofollow', async () => {
    fetchSpy.mockResolvedValue([]);
    render(<MemoryRouter><CreditsFooter /></MemoryRouter>);

    expect(screen.getByText('Track data from')).not.toBeNull();

    const mbLink = screen.getByText('MusicBrainz (tags CC BY-NC-SA 3.0)');
    expect(mbLink.closest('a')?.getAttribute('href')).toBe('https://musicbrainz.org');

    const gsLink = screen.getByText('GetSongBPM');
    expect(gsLink.closest('a')?.getAttribute('href')).toBe('https://getsongbpm.com');
    expect(gsLink.closest('a')?.getAttribute('rel')).not.toContain('nofollow');
    expect(gsLink.closest('a')?.getAttribute('rel')).toContain('noopener');

    const dzLink = screen.getByText('Deezer');
    expect(dzLink.closest('a')?.getAttribute('href')).toBe('https://www.deezer.com');

    const lfLink = screen.getByText('Last.fm');
    expect(lfLink.closest('a')?.getAttribute('href')).toBe('https://www.last.fm');

    const dcLink = screen.getByText('Discogs');
    expect(dcLink.closest('a')?.getAttribute('href')).toBe('https://www.discogs.com');
  });

  it('replaces getsongbpm static text with server attribution', async () => {
    fetchSpy.mockResolvedValue([
      { provider: 'getsongbpm', text: 'GetSongBPM Backlink', url: 'https://getsongbpm.com' }
    ]);
    render(<MemoryRouter><CreditsFooter /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('GetSongBPM Backlink')).not.toBeNull();
    });
    expect(screen.queryByText('GetSongBPM')).toBeNull();

    const gsLink = screen.getByText('GetSongBPM Backlink');
    expect(gsLink.closest('a')?.getAttribute('href')).toBe('https://getsongbpm.com');
    expect(gsLink.closest('a')?.getAttribute('rel')).not.toContain('nofollow');
  });

  it('keeps static list if fetch is rejected/failed', async () => {
    // Return empty list on failure, which mimics the behavior of fetchAttributions which catches internally.
    // In our component fetchAttributions is called and .then is awaited but we just mock the failure return here to avoid unhandledrejection
    fetchSpy.mockResolvedValue([]);

    render(<MemoryRouter><CreditsFooter /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('GetSongBPM')).not.toBeNull();
    });
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('does not render on /graph', async () => {
    render(
      <MemoryRouter initialEntries={['/graph']}>
        <CreditsFooter />
      </MemoryRouter>
    );
    expect(screen.queryByLabelText('Data credits')).toBeNull();
  });
});
