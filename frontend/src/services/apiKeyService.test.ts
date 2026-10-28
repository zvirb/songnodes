import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveAIKey,
  clearAIKey,
  validateAIKey,
  getAIKeyConfig,
  AI_KEY_SERVICE,
} from './apiKeyService';

const RAW = {
  claude: 'sk-ant-api03-REALSECRETKEY-0123456789',
  openai: 'sk-proj-REALSECRETKEY-0123456789',
  gemini: 'AIzaREALSECRETKEY0123456789abc',
} as const;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
    dump: () => Array.from(map.entries()),
  };
}

let storage: ReturnType<typeof memoryStorage>;
const mockFetch = vi.fn<(...args: any[]) => Promise<any>>();

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const allStored = () => storage.dump().map(([k, v]) => `${k}=${v}`).join('\n');

describe('apiKeyService AI keys', () => {
  it.each([
    ['claude', 'anthropic'],
    ['openai', 'openai'],
    ['gemini', 'google'],
  ] as const)('saves %s under service %s / api_key and keeps only the mask', async (provider, service) => {
    expect(AI_KEY_SERVICE[provider]).toBe(service);
    mockFetch.mockResolvedValueOnce(okJson({ masked_value: 'sk-a****6789', is_valid: null }));

    const config = await saveAIKey(provider, RAW[provider]);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/api-keys$/);
    expect(url).not.toContain(RAW[provider]);
    expect(JSON.parse(init.body)).toEqual({ service_name: service, key_name: 'api_key', key_value: RAW[provider] });
    expect(config[`${provider}ApiKey`]).toBe('sk-a****6789');
    expect(allStored()).not.toContain(RAW[provider]);
  });

  it('throws when the server save fails and stores nothing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ detail: 'Service must be one of …' }) });

    await expect(saveAIKey('claude', RAW.claude)).rejects.toThrow('Service must be one of');
    expect(allStored()).not.toContain(RAW.claude);
    expect(getAIKeyConfig().claudeApiKey).toBeUndefined();
  });

  it('removes raw keys left in localStorage by earlier builds on first read', () => {
    storage.setItem('songnodes_ai_key_config', JSON.stringify({ claudeApiKey: RAW.claude, claudeStatus: 'valid' }));
    storage.setItem('songnodes_key_claude', RAW.claude);
    storage.setItem('ai_key_openai', RAW.openai);
    storage.setItem('apiKey_gemini', RAW.gemini);

    const config = getAIKeyConfig();

    expect(config.claudeApiKey).toBeUndefined();
    expect(config.claudeStatus).toBe('unconfigured');
    expect(allStored()).not.toContain(RAW.claude);
    expect(allStored()).not.toContain(RAW.openai);
    expect(allStored()).not.toContain(RAW.gemini);
  });

  it('clears the key on the server under the mapped name', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await clearAIKey('gemini');
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/v1\/api-keys\/google\/api_key$/);
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('tests the key on the server under the mapped name', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ valid: true, message: 'Anthropic API key is valid' }));
    const res = await validateAIKey('claude');
    expect(res.ok).toBe(true);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ service_name: 'anthropic', key_name: 'api_key' });
  });

  it('reports a failed test instead of assuming the key is valid', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));
    const res = await validateAIKey('openai');
    expect(res.ok).toBe(false);
  });
});
