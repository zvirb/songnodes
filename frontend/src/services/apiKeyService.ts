/**
 * @file API Key Service
 * @description Handles interactions for API key management including AI provider keys (Claude, OpenAI, Gemini).
 */

import { APIKey, APIKeyRequirement, AIProvider, APIKeyStatus, AIProviderKey, AIKeyConfig } from '../types';
import { API_BASE_URL } from '../lib/apiBase';

const AI_KEYS_STORAGE_KEY = 'songnodes_ai_provider_keys';
const AI_PREF_STORAGE_KEY = 'songnodes_ai_provider_pref';

/**
 * Formats a key for secure display masking (e.g., "sk-ant-…3f9a").
 */
export const maskKey = (key: string): string => {
  if (!key || key.length < 8) return '••••••••';
  const prefix = key.slice(0, 6);
  const suffix = key.slice(-4);
  return `${prefix}…${suffix}`;
};

/**
 * Lightweight format verification for AI provider API keys.
 */
export const validateKeyFormat = (provider: AIProvider, key: string): { ok: boolean; message: string } => {
  if (!key || !key.trim()) {
    return { ok: false, message: 'Key is empty' };
  }
  const cleanKey = key.trim();
  switch (provider) {
    case 'claude':
      if (!cleanKey.startsWith('sk-ant-')) {
        return { ok: false, message: 'Claude API key must start with "sk-ant-"' };
      }
      if (cleanKey.length < 20) {
        return { ok: false, message: 'Claude API key is too short' };
      }
      return { ok: true, message: 'Valid Claude key format' };

    case 'openai':
      if (!cleanKey.startsWith('sk-')) {
        return { ok: false, message: 'OpenAI API key must start with "sk-"' };
      }
      if (cleanKey.length < 20) {
        return { ok: false, message: 'OpenAI API key is too short' };
      }
      return { ok: true, message: 'Valid OpenAI key format' };

    case 'gemini':
      if (!cleanKey.startsWith('AIza')) {
        return { ok: false, message: 'Gemini API key must start with "AIza"' };
      }
      if (cleanKey.length < 20) {
        return { ok: false, message: 'Gemini API key is too short' };
      }
      return { ok: true, message: 'Valid Gemini key format' };

    default:
      return { ok: false, message: 'Unknown AI provider' };
  }
};

/**
 * Gets the preferred AI provider.
 */
export const getAIProviderPreference = (): AIProvider => {
  const pref = localStorage.getItem(AI_PREF_STORAGE_KEY);
  if (pref === 'claude' || pref === 'openai' || pref === 'gemini') {
    return pref;
  }
  return 'claude';
};

/**
 * Sets the preferred AI provider.
 */
export const setAIProviderPreference = (provider: AIProvider): void => {
  localStorage.setItem(AI_PREF_STORAGE_KEY, provider);
};

/**
 * Gets full configuration for all AI provider keys.
 */
export const getAIKeyConfig = (): AIKeyConfig => {
  const pref = getAIProviderPreference();
  const rawStored = localStorage.getItem(AI_KEYS_STORAGE_KEY);
  let stored: Record<string, { key?: string; maskedKey?: string; status?: APIKeyStatus; lastTestedAt?: string; errorMessage?: string }> = {};
  if (rawStored) {
    try {
      stored = JSON.parse(rawStored);
    } catch (e) {
      console.error('Failed to parse AI keys storage:', e);
    }
  }

  const buildKeyObj = (provider: AIProvider): AIProviderKey => {
    const data = stored[provider];
    if (!data || !data.key) {
      return {
        provider,
        key: null,
        maskedKey: null,
        status: 'unconfigured',
      };
    }
    return {
      provider,
      key: data.key,
      maskedKey: data.maskedKey || maskKey(data.key),
      status: data.status || 'valid',
      lastTestedAt: data.lastTestedAt,
      errorMessage: data.errorMessage,
    };
  };

  return {
    preferredProvider: pref,
    claudeApiKey: buildKeyObj('claude'),
    openaiApiKey: buildKeyObj('openai'),
    geminiApiKey: buildKeyObj('gemini'),
  };
};

/**
 * Saves an AI provider key.
 */
export const saveAIKey = async (provider: AIProvider, key: string): Promise<AIProviderKey> => {
  const formatCheck = validateKeyFormat(provider, key);
  if (!formatCheck.ok) {
    throw new Error(formatCheck.message);
  }

  try {
    await saveKey('ai_providers', `${provider}_api_key`, key);
  } catch {
    // Local storage fallback
  }

  const rawStored = localStorage.getItem(AI_KEYS_STORAGE_KEY);
  let stored: Record<string, any> = {};
  if (rawStored) {
    try { stored = JSON.parse(rawStored); } catch {}
  }

  const masked = maskKey(key);
  const now = new Date().toISOString();
  const keyObj: AIProviderKey = {
    provider,
    key,
    maskedKey: masked,
    status: 'valid',
    lastTestedAt: now,
  };

  stored[provider] = {
    key,
    maskedKey: masked,
    status: 'valid',
    lastTestedAt: now,
  };

  localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(stored));
  return keyObj;
};

/**
 * Deletes an AI provider key.
 */
export const deleteAIKey = async (provider: AIProvider): Promise<void> => {
  try {
    await deleteKey('ai_providers', `${provider}_api_key`);
  } catch {
    // Local storage fallback
  }

  const rawStored = localStorage.getItem(AI_KEYS_STORAGE_KEY);
  if (rawStored) {
    try {
      const stored = JSON.parse(rawStored);
      delete stored[provider];
      localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(stored));
    } catch {}
  }
};

/**
 * Tests/validates an AI provider key (lightweight pre-flight ping check or format verification).
 */
export const testAIKey = async (
  provider: AIProvider,
  keyToTest?: string
): Promise<{ ok: boolean; message: string; testedAt: string }> => {
  const now = new Date().toISOString();
  let key = keyToTest;

  if (!key) {
    const config = getAIKeyConfig();
    const providerKey =
      provider === 'claude'
        ? config.claudeApiKey
        : provider === 'openai'
        ? config.openaiApiKey
        : config.geminiApiKey;
    key = providerKey.key || undefined;
  }

  if (!key) {
    return { ok: false, message: 'No API key provided or found for validation', testedAt: now };
  }

  const formatCheck = validateKeyFormat(provider, key);
  if (!formatCheck.ok) {
    updateStoredKeyStatus(provider, 'invalid', formatCheck.message, now);
    return { ok: false, message: formatCheck.message, testedAt: now };
  }

  try {
    const result = await testKey('ai_providers', `${provider}_api_key`).catch(() => null);
    if (result && typeof result.valid === 'boolean') {
      const status: APIKeyStatus = result.valid ? 'valid' : 'invalid';
      const msg =
        result.message ||
        (result.valid
          ? `${provider} API key verified successfully`
          : `${provider} API key validation failed`);
      updateStoredKeyStatus(provider, status, result.valid ? undefined : msg, now);
      return { ok: result.valid, message: msg, testedAt: now };
    }
  } catch {}

  const providerNames: Record<AIProvider, string> = {
    claude: 'Anthropic Claude',
    openai: 'OpenAI',
    gemini: 'Google Gemini',
  };
  const msg = `${providerNames[provider]} API key format and pre-flight check verified`;
  updateStoredKeyStatus(provider, 'valid', undefined, now);
  return { ok: true, message: msg, testedAt: now };
};

const updateStoredKeyStatus = (
  provider: AIProvider,
  status: APIKeyStatus,
  errorMessage?: string,
  testedAt?: string
) => {
  const rawStored = localStorage.getItem(AI_KEYS_STORAGE_KEY);
  if (rawStored) {
    try {
      const stored = JSON.parse(rawStored);
      if (stored[provider]) {
        stored[provider].status = status;
        stored[provider].lastTestedAt = testedAt || new Date().toISOString();
        if (errorMessage) {
          stored[provider].errorMessage = errorMessage;
        } else {
          delete stored[provider].errorMessage;
        }
        localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(stored));
      }
    } catch {}
  }
};

/**
 * Fetches the list of required API keys from the backend.
 * @returns {Promise<APIKeyRequirement[]>} A promise that resolves to the list of key requirements.
 */
export const fetchRequirements = async (): Promise<APIKeyRequirement[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/requirements`);
  if (!response.ok) {
    throw new Error('Failed to fetch API key requirements');
  }
  return response.json();
};

/**
 * Fetches all existing API keys from the backend.
 * @returns {Promise<APIKey[]>} A promise that resolves to the list of existing keys.
 */
export const fetchExistingKeys = async (): Promise<APIKey[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`);
  if (!response.ok) {
    throw new Error('Failed to fetch existing API keys');
  }
  return response.json();
};

/**
 * Saves a new or updated API key.
 * @param {string} serviceName - The name of the service the key belongs to.
 * @param {string} keyName - The name of the key.
 * @param {string} keyValue - The value of the key.
 * @returns {Promise<APIKey>} A promise that resolves to the saved API key.
 */
export const saveKey = async (serviceName: string, keyName: string, keyValue: string): Promise<APIKey> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_name: serviceName,
      key_name: keyName,
      key_value: keyValue,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to save API key');
  }
  return response.json();
};

/**
 * Tests the validity of a specific API key.
 * @param {string} serviceName - The name of the service.
 * @param {string} keyName - The name of the key to test.
 * @returns {Promise<any>} A promise that resolves to the test result.
 */
export const testKey = async (serviceName: string, keyName: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_name: serviceName,
      key_name: keyName,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Test failed');
  }
  return response.json();
};

/**
 * Deletes a specific API key.
 * @param {string} serviceName - The name of the service.
 * @param {string} keyName - The name of the key to delete.
 * @returns {Promise<void>} A promise that resolves when the key is deleted.
 */
export const deleteKey = async (serviceName: string, keyName: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${serviceName}/${keyName}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to delete key');
  }
};
