import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
  vi.resetModules();
  return import('./apiBase');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('API_BASE_URL', () => {
  it('is same-origin (empty) by default, never a localhost address', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect((await load()).API_BASE_URL).toBe('');
  });

  it('uses VITE_API_BASE_URL without a trailing slash', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/');
    expect((await load()).API_BASE_URL).toBe('https://api.example.test');
  });
});

describe('oauthRedirectUri', () => {
  it("defaults to the page's own origin", async () => {
    vi.stubEnv('VITE_OAUTH_REDIRECT_ORIGIN', '');
    vi.stubGlobal('window', { location: { origin: 'http://songnodes.test:3006' } });
    expect((await load()).oauthRedirectUri('/callback/spotify')).toBe('http://songnodes.test:3006/callback/spotify');
  });

  it('uses VITE_OAUTH_REDIRECT_ORIGIN when set (the URI registered with the provider)', async () => {
    vi.stubEnv('VITE_OAUTH_REDIRECT_ORIGIN', 'http://127.0.0.1:3006/');
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3006' } });
    expect((await load()).oauthRedirectUri('/oauth/callback')).toBe('http://127.0.0.1:3006/oauth/callback');
  });
});
