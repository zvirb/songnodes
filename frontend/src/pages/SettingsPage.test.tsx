/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SettingsPage from './SettingsPage';

// Mock fetch globally
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/v1/api-keys/requirements')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
                {
          service_name: 'beatport',
          key_name: 'api_key',
          display_name: 'Beatport API Key',
          description: 'Key for Beatport metadata scraper.',
          documentation_url: 'https://beatport.com',
          required: false,
          display_order: 1,
        },
        {
          service_name: 'spotify',
          key_name: 'client_id',
          display_name: 'Spotify Client ID',
          description: 'Spotify API Client ID.',
          documentation_url: 'https://developer.spotify.com',
          required: true,
          display_order: 2,
        },
        {
          service_name: 'discogs',
          key_name: 'token',
          display_name: 'Discogs Token',
          description: 'Discogs API Token.',
          documentation_url: 'https://discogs.com',
          required: true,
          display_order: 3,
        },
        {
          service_name: 'getsongbpm',
          key_name: 'api_key',
          display_name: 'GetSongBPM API Key',
          description: 'GetSongBPM key.',
          documentation_url: 'https://getsongbpm.com/api',
          required: false,
          display_order: 5,
        },
        {
          service_name: '1001tracklists',
          key_name: 'password',
          display_name: '1001Tracklists Password',
          description: '1001Tracklists Password.',
          documentation_url: 'https://1001tracklists.com',
          required: true,
          display_order: 4,
        },
        {
          service_name: 'lastfm',
          key_name: 'api_key',
          display_name: 'Last.fm API Key',
          description: 'Last.fm API Key.',
          documentation_url: 'https://last.fm/api',
          required: false,
          display_order: 6,
        },
        {
          service_name: 'musicbrainz',
          key_name: 'user_agent',
          display_name: 'MusicBrainz User-Agent',
          description: 'MusicBrainz User-Agent.',
          documentation_url: 'https://musicbrainz.org/doc/MusicBrainz_API',
          required: true,
          display_order: 7,
        },
        {
          service_name: 'youtube',
          key_name: 'api_key',
          display_name: 'YouTube Data API Key',
          description: 'YouTube Data API Key.',
          documentation_url: 'https://console.cloud.google.com/apis/credentials',
          required: true,
          display_order: 8,
        },
        {
          service_name: 'setlistfm',
          key_name: 'api_key',
          display_name: 'Setlist.fm API Key',
          description: 'Setlist.fm API Key.',
          documentation_url: 'https://setlist.fm',
          required: false,
          display_order: 9,
        },
        {
          service_name: 'reddit',
          key_name: 'client_id',
          display_name: 'Reddit Client ID',
          description: 'Reddit Client ID.',
          documentation_url: 'https://reddit.com/prefs/apps',
          required: false,
          display_order: 10,
        },
      ]),
    });
  }
  if (url.includes('/api/v1/api-keys')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

describe('SettingsPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders main settings overview page with search field and setting cards', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:settingId" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Title & Lead
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toContain('Services: Settings');

    // SearchField
    const searchInput = screen.getByPlaceholderText(/Search settings, API keys, appearance/i);
    expect(searchInput).toBeDefined();

    // Cards
    expect(screen.getByText('Theme')).toBeDefined();
    expect(screen.getByText('Text size')).toBeDefined();
    expect(screen.getByText('TIDAL connection')).toBeDefined();
    expect(screen.getByText('Spotify connection')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Anthropic (Claude) API key' })).toBeDefined();
  });

    it('renders one card per service and none for Beatport', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the mock fetch to settle
    const spotifyCards = await screen.findAllByText('Spotify API keys');
    expect(spotifyCards.length).toBeGreaterThan(0);

    expect(screen.getByText('Discogs API keys')).toBeDefined();
    expect(screen.getByText('1001Tracklists API keys')).toBeDefined();
    expect(screen.queryByText(/Beatport/i)).toBeNull();
    expect(screen.queryByText(/API status/i)).toBeNull();

    // Check modules via classes
    // 1001Tracklists carries sn-m-library
    const ttCardTitle = screen.getByText('1001Tracklists API keys');
    const ttCard = ttCardTitle.closest('.sn-card');
    expect(ttCard?.className).toContain('sn-m-library');

    // Theme carries sn-m-harmony
    const themeCardTitle = screen.getByText('Theme');
    const themeCard = themeCardTitle.closest('.sn-card');
    expect(themeCard?.className).toContain('sn-m-harmony');

    // AI key carries sn-m-paths
    const aiCardTitle = screen.getAllByText('Anthropic (Claude) API key')[0];
    const aiCard = aiCardTitle.closest('.sn-card');
    expect(aiCard?.className).toContain('sn-m-paths');

    // About is neutral (no module)
    const aboutCardTitle = screen.getByText('About SongNodes');
    const aboutCard = aboutCardTitle.closest('.sn-card');
    expect(aboutCard?.className).not.toContain('sn-m-');
    // expect(aboutCard?.className).toContain('sn-card--neutral');
  });

  it('filters setting cards live when typing in the search box', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:settingId" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search settings, API keys, appearance/i);

    // Filter by "spotify"
    fireEvent.change(searchInput, { target: { value: 'spotify' } });

    expect(screen.getByText('Spotify connection')).toBeDefined();
    expect(screen.queryByText('Theme')).toBeNull();
    expect(screen.queryByText('Text size')).toBeNull();

    // Filter by nonexistent query
    fireEvent.change(searchInput, { target: { value: 'xyz123nonexistent' } });
    expect(screen.getByText('No settings found')).toBeDefined();
  });

  it('renders dedicated setting page at /settings/:settingId', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings/theme']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:settingId" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Title should be Theme
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toContain('Services: Theme');
    expect(screen.getByText(/Back to all settings/i)).toBeDefined();
  });

  it('renders error state when visiting invalid setting ID', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings/unknown-id']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:settingId" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toContain('Services: Setting not found');
    expect(screen.getByText('The requested setting page does not exist.')).toBeDefined();
  });

  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:settingId" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('a service card holds that service\'s key fields', async () => {
    renderAt('/settings');
    expect(await screen.findByText('Discogs Token')).toBeTruthy();
    expect(screen.getByText('Spotify Client ID')).toBeTruthy();
    expect(screen.queryByText('Beatport API Key')).toBeNull();
  });

  it('a service page shows only that service\'s key fields', async () => {
    renderAt('/settings/service-discogs');
    expect(await screen.findByText('Discogs Token')).toBeTruthy();
    expect(screen.queryByText('Spotify Client ID')).toBeNull();
  });

  it('the combined service keys page still loads', async () => {
    renderAt('/settings/scraper-keys');
    expect(await screen.findByText('Discogs Token')).toBeTruthy();
    expect(screen.queryByText('Setting not found')).toBeNull();
    expect(screen.queryByText('Beatport API Key')).toBeNull();
  });

  it('the GetSongBPM card says what its sign-up form needs, including the backlink', async () => {
    renderAt('/settings/service-getsongbpm');
    expect(await screen.findByText('Backlink URL')).toBeTruthy();
    expect(screen.getByText('https://github.com/zvirb/songnodes#9-data-sources-and-attribution')).toBeTruthy();
    expect(screen.queryByText('Discogs Token')).toBeNull();
  });

  it('the Spotify card displays app registration requirements and callback URL', async () => {
    renderAt('/settings/service-spotify');
    expect(await screen.findByText('Redirect URI')).toBeTruthy();
    expect(screen.getByText('http://127.0.0.1:3006/callback/spotify')).toBeTruthy();
    expect(screen.getByText('Web API')).toBeTruthy();
  });

  it('the Reddit card displays app requirements and callback URL', async () => {
    renderAt('/settings/service-reddit');
    expect(await screen.findByText('Redirect URI')).toBeTruthy();
    expect(screen.getByText('http://127.0.0.1:3006/callback/reddit')).toBeTruthy();
  });

  it('the MusicBrainz card displays User-Agent format guidelines', async () => {
    renderAt('/settings/service-musicbrainz');
    expect(await screen.findByText('Required format')).toBeTruthy();
    expect(screen.getByText('AppName/Version ( contact-url-or-email )')).toBeTruthy();
  });

  it('the Last.fm card displays API account requirements and callback URL', async () => {
    renderAt('/settings/service-lastfm');
    expect(await screen.findByText('Callback URL')).toBeTruthy();
    expect(screen.getByText('http://127.0.0.1:3006/callback/lastfm')).toBeTruthy();
  });

  it('the Discogs card displays Personal Access Token instructions', async () => {
    renderAt('/settings/service-discogs');
    expect(await screen.findByText('Token description')).toBeTruthy();
    expect(screen.getByText('SongNodes')).toBeTruthy();
  });

  it('the YouTube card displays Google Cloud Console instructions', async () => {
    renderAt('/settings/service-youtube');
    expect(await screen.findByText('API library')).toBeTruthy();
    expect(screen.getByText('Enable "YouTube Data API v3"')).toBeTruthy();
  });

  it('the Setlist.fm card displays application requirements', async () => {
    renderAt('/settings/service-setlistfm');
    expect(await screen.findByText('Application website')).toBeTruthy();
    expect(screen.getByText('https://github.com/zvirb/songnodes')).toBeTruthy();
  });

  it('the 1001Tracklists card displays account credentials note', async () => {
    renderAt('/settings/service-1001tracklists');
    expect(await screen.findByText('Username')).toBeTruthy();
    expect(screen.getByText('Your 1001tracklists.com account username')).toBeTruthy();
  });
});
