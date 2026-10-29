import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchRequirements,
  fetchExistingKeys,
  saveKey,
  testKey,
  deleteKey,
  validateKeyFormat,
  getMaskedKey,
  saveAIKeyConfig,
  saveAIKey,
  clearAIKey,
  validateAIKey,
  getAIKeyConfig,
  getPreferredAIProvider,
  setPreferredAIProvider,
  AI_KEY_SERVICE,
} from './apiKeyService';
import { AIProvider } from '../types';

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

describe('apiKeyService REST API endpoints', () => {
  describe('fetchRequirements', () => {
    it('fetches API key requirements successfully', async () => {
      const requirements = [{ service_name: 'anthropic', key_name: 'api_key', is_required: true }];
      mockFetch.mockResolvedValueOnce(okJson(requirements));

      const result = await fetchRequirements();
      expect(result).toEqual(requirements);
      expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/v1\/api-keys\/requirements$/);
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(fetchRequirements()).rejects.toThrow('Failed to fetch API key requirements');
    });
  });

  describe('fetchExistingKeys', () => {
    it('fetches existing API keys successfully', async () => {
      const keys = [{ id: '1', service_name: 'anthropic', key_name: 'api_key', masked_value: 'sk-ant-****' }];
      mockFetch.mockResolvedValueOnce(okJson(keys));

      const result = await fetchExistingKeys();
      expect(result).toEqual(keys);
      expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/v1\/api-keys$/);
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(fetchExistingKeys()).rejects.toThrow('Failed to fetch existing API keys');
    });
  });

  describe('saveKey', () => {
    it('saves an API key successfully with JSON payload', async () => {
      const savedKey = { id: '1', service_name: 'anthropic', key_name: 'api_key', masked_value: 'sk-ant-****' };
      mockFetch.mockResolvedValueOnce(okJson(savedKey));

      const result = await saveKey('anthropic', 'api_key', 'sk-ant-secret');
      expect(result).toEqual(savedKey);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/api\/v1\/api-keys$/);
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body)).toEqual({
        service_name: 'anthropic',
        key_name: 'api_key',
        key_value: 'sk-ant-secret',
      });
    });

    it('throws custom error detail from backend when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Invalid service specified' }),
      });

      await expect(saveKey('invalid_svc', 'api_key', 'val')).rejects.toThrow('Invalid service specified');
    });

    it('falls back to default error message when backend provides no detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(saveKey('anthropic', 'api_key', 'val')).rejects.toThrow('Failed to save API key');
    });
  });

  describe('testKey', () => {
    it('tests an API key successfully', async () => {
      const testResult = { valid: true, message: 'Key is valid' };
      mockFetch.mockResolvedValueOnce(okJson(testResult));

      const result = await testKey('anthropic', 'api_key');
      expect(result).toEqual(testResult);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/api\/v1\/api-keys\/test$/);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ service_name: 'anthropic', key_name: 'api_key' });
    });

    it('throws custom error detail from backend when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Authentication failed for provider' }),
      });

      await expect(testKey('anthropic', 'api_key')).rejects.toThrow('Authentication failed for provider');
    });

    it('falls back to default error message when backend provides no detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(testKey('anthropic', 'api_key')).rejects.toThrow('Test failed');
    });
  });

  describe('deleteKey', () => {
    it('deletes an API key successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await deleteKey('anthropic', 'api_key');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/api\/v1\/api-keys\/anthropic\/api_key$/);
      expect(init.method).toBe('DELETE');
    });

    it('throws custom error detail from backend when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'API key not found' }),
      });

      await expect(deleteKey('anthropic', 'missing_key')).rejects.toThrow('API key not found');
    });

    it('falls back to default error message when backend provides no detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(deleteKey('anthropic', 'api_key')).rejects.toThrow('Failed to delete key');
    });
  });
});

describe('validateKeyFormat', () => {
  it('validates Claude API keys', () => {
    expect(validateKeyFormat('claude', 'sk-ant-api03-REALSECRETKEY-0123456789')).toEqual({ valid: true });
    expect(validateKeyFormat('claude', 'invalid-prefix')).toEqual({
      valid: false,
      message: 'Claude API key should start with "sk-ant-".',
    });
    expect(validateKeyFormat('claude', 'sk-ant-short')).toEqual({
      valid: false,
      message: 'Claude API key is too short.',
    });
  });

  it('validates OpenAI API keys', () => {
    expect(validateKeyFormat('openai', 'sk-proj-REALSECRETKEY-0123456789')).toEqual({ valid: true });
    expect(validateKeyFormat('openai', 'invalid-prefix')).toEqual({
      valid: false,
      message: 'OpenAI API key should start with "sk-".',
    });
    expect(validateKeyFormat('openai', 'sk-short')).toEqual({
      valid: false,
      message: 'OpenAI API key is too short.',
    });
  });

  it('validates Google Gemini API keys', () => {
    expect(validateKeyFormat('gemini', 'AIzaREALSECRETKEY0123456789abc')).toEqual({ valid: true });
    expect(validateKeyFormat('gemini', 'invalid-prefix')).toEqual({
      valid: false,
      message: 'Google Gemini API key should start with "AIza".',
    });
    expect(validateKeyFormat('gemini', 'AIzaShort')).toEqual({
      valid: false,
      message: 'Gemini API key is too short.',
    });
  });

  it('returns invalid for empty or whitespace-only keys', () => {
    expect(validateKeyFormat('claude', '')).toEqual({ valid: false, message: 'Key cannot be empty.' });
    expect(validateKeyFormat('claude', '   ')).toEqual({ valid: false, message: 'Key cannot be empty.' });
  });

  it('returns invalid for missing or unsupported provider', () => {
    expect(validateKeyFormat('unsupported' as AIProvider, 'sk-ant-api03-REALSECRETKEY-0123456789')).toEqual({
      valid: false,
      message: 'Provider missing or not supported.',
    });
  });
});

describe('getMaskedKey', () => {
  it('returns null for undefined, empty, or whitespace-only keys', () => {
    expect(getMaskedKey(undefined)).toBeNull();
    expect(getMaskedKey('')).toBeNull();
  });

  it('returns dots for keys of 8 characters or fewer', () => {
    expect(getMaskedKey('12345678')).toBe('••••••••');
    expect(getMaskedKey('short')).toBe('••••••••');
  });

  it('returns formatted masked string for longer keys', () => {
    expect(getMaskedKey('sk-ant-api03-123456789')).toBe('sk-a…6789');
    expect(getMaskedKey('123456789')).toBe('1234…6789');
  });
});

describe('AI provider preference & config helpers', () => {
  it('saves and retrieves AI key config', () => {
    saveAIKeyConfig({ preferredProvider: 'gemini', claudeStatus: 'valid' });
    expect(getAIKeyConfig().preferredProvider).toBe('gemini');
    expect(getAIKeyConfig().claudeStatus).toBe('valid');
  });

  it('gets default preferred AI provider when unconfigured', () => {
    expect(getPreferredAIProvider()).toBe('claude');
  });

  it('sets and persists preferred AI provider', () => {
    const updated = setPreferredAIProvider('openai');
    expect(updated.preferredProvider).toBe('openai');
    expect(getPreferredAIProvider()).toBe('openai');
  });
});

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
