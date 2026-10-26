import { API_BASE_URL } from '../lib/apiBase';
import type { AIProvider } from '../types';

export interface AICompletionRequest {
  provider: AIProvider;
  model: string;
  system?: string;
  prompt: string;
  max_tokens?: number;
  web_search?: boolean;
}

export interface AICompletionResponse {
  text: string;
  provider: string;
  model: string;
  usage?: Record<string, any>;
}

export class AIProxyError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'AIProxyError';
  }
}

export const aiProxyComplete = async (request: AICompletionRequest, timeoutMs: number = 60000): Promise<AICompletionResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AIProxyError('Upstream authentication failed', response.status, 'AUTH_FAILED');
      } else if (response.status === 429) {
        throw new AIProxyError('Upstream rate limit exceeded', response.status, 'RATE_LIMIT');
      } else if (response.status === 504) {
        throw new AIProxyError('Upstream timeout', response.status, 'TIMEOUT');
      } else if (response.status === 413) {
        throw new AIProxyError('Request body too large', response.status, 'PAYLOAD_TOO_LARGE');
      } else {
        let errDetail = 'Upstream provider error';
        try {
           const errBody = await response.json();
           if (errBody.detail) {
               errDetail = errBody.detail;
           }
        } catch (e) {}
        throw new AIProxyError(errDetail, response.status, 'PROVIDER_ERROR');
      }
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new AIProxyError(`Request timed out after ${timeoutMs}ms`, 504, 'TIMEOUT');
    }
    if (error instanceof AIProxyError) {
        throw error;
    }
    throw new AIProxyError(error.message || 'Unknown network error', undefined, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
};
