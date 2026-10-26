import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiProxyComplete, AIProxyError, AICompletionRequest } from './aiProxyClient';
import { API_BASE_URL } from '../lib/apiBase';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('aiProxyClient', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validRequest: AICompletionRequest = {
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    prompt: 'Hello'
  };

  it('successfully returns completion response', async () => {
    const mockResponse = {
      text: 'Hello from Claude',
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await aiProxyComplete(validRequest);

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/ai/complete`, expect.any(Object));
    expect(result).toEqual(mockResponse);
  });

  it('throws AIProxyError on 429 rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ detail: 'Upstream rate limit exceeded' })
    });

    try {
        await aiProxyComplete(validRequest);
        expect.fail('Should have thrown');
    } catch (e: any) {
        expect(e).toBeInstanceOf(AIProxyError);
        expect(e.status).toBe(429);
        expect(e.code).toBe('RATE_LIMIT');
    }
  });

  it('throws AIProxyError on timeout', async () => {
    mockFetch.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        const error = new Error('AbortError');
        error.name = 'AbortError';
        reject(error);
      });
    });

    try {
        await aiProxyComplete(validRequest, 10);
        expect.fail('Should have thrown');
    } catch (e: any) {
        expect(e).toBeInstanceOf(AIProxyError);
        expect(e.status).toBe(504);
        expect(e.code).toBe('TIMEOUT');
    }
  });
});
