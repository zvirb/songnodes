import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runProxyQuery, proxyErrorMessage } from '../api/proxyRun';
import { importSetlists } from '../api/importRun';
import { AIProxyError } from '../../../services/aiProxyClient';
import type { AISetlist } from '../api/schema';

const mockFetch = vi.fn<(...args: any[]) => Promise<any>>();

const setlist = (dj: string): AISetlist => ({
  dj,
  event: 'Warehouse',
  date: '2024-05-01',
  venue: null,
  genre: null,
  source_url: 'https://example.com',
  tracks: [{ position: 1, artist: 'A', title: 'B', mix: null, label: null }],
});

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const PROVIDER_HOSTS = ['api.anthropic.com', 'api.openai.com', 'googleapis.com'];

describe('runProxyQuery', () => {
  it.each(['claude', 'openai', 'gemini'] as const)('calls only /api/v1/ai/complete for %s', async (provider) => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: '{"setlists":[]}', provider, model: 'm' }) });

    const text = await runProxyQuery(provider, 'Find sets', { webSearch: true });

    expect(text).toBe('{"setlists":[]}');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/ai\/complete$/);
    for (const host of PROVIDER_HOSTS) expect(url).not.toContain(host);
    const headers = JSON.stringify(init.headers);
    expect(headers).not.toMatch(/x-api-key|authorization|x-goog-api-key|dangerous/i);
    const body = JSON.parse(init.body);
    expect(body.provider).toBe(provider);
    expect(body.prompt).toBe('Find sets');
    expect(body.web_search).toBe(provider === 'gemini');
  });

  it('sends web_search false for Gemini when the toggle is off', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: '', provider: 'gemini', model: 'm' }) });
    await runProxyQuery('gemini', 'p', { webSearch: false });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).web_search).toBe(false);
  });
});

describe('proxyErrorMessage', () => {
  it('points to Settings when no key is configured', () => {
    const msg = proxyErrorMessage(new AIProxyError('Upstream authentication failed', 401, 'AUTH_FAILED'), 'claude');
    expect(msg).toContain('Settings');
    expect(msg).toContain('Claude');
  });

  it.each(['RATE_LIMIT', 'TIMEOUT', 'PAYLOAD_TOO_LARGE', 'NETWORK_ERROR', 'PROVIDER_ERROR'])('gives a plain message for %s', (code) => {
    const msg = proxyErrorMessage(new AIProxyError('x', 500, code), 'gemini');
    expect(msg).toMatch(/\.$/);
    expect(msg).not.toMatch(/undefined|Error:/);
  });
});

describe('importSetlists', () => {
  it('counts only 2xx answers as created or replayed', async () => {
    const fetchImpl = vi
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ replayed: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ replayed: true }) })
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ detail: 'bad' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockRejectedValueOnce(new Error('offline'));

    const sets = ['One', 'Two', 'Three', 'Four', 'Five'].map(setlist);
    const out = await importSetlists(sets, () => {}, fetchImpl);

    expect(out.created).toBe(1);
    expect(out.replayed).toBe(1);
    expect(out.failed.map((s) => s.dj)).toEqual(['Three', 'Four', 'Five']);
    expect(out.ledger).toEqual(['One @ Warehouse (2024-05-01)', 'Two @ Warehouse (2024-05-01)']);
  });
});
