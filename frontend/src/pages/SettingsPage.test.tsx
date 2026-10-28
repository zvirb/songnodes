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
          service_name: '1001tracklists',
          key_name: 'password',
          display_name: '1001Tracklists Password',
          description: '1001Tracklists Password.',
          documentation_url: 'https://1001tracklists.com',
          required: true,
          display_order: 4,
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
});
