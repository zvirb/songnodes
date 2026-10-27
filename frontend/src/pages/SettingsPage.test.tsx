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
    expect(screen.getByText('Anthropic (Claude) API key')).toBeDefined();
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
});
