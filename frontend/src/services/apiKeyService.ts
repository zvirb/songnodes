/**
 * @file API Key Service
 * @description This service handles all interactions with the backend and local storage for API key management,
 * including Anthropic (Claude), OpenAI, and Google (Gemini) keys.
 */

import { APIKey, APIKeyRequirement, AIProvider, AIKeyConfig, AIKeyValidationResult } from '../types';
import { API_BASE_URL } from '../lib/apiBase';

const STORAGE_KEY_AI_CONFIG = 'songnodes_ai_key_config';

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
 * Saves a new or updated API key to the backend.
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
 * Tests the validity of a specific API key via backend test endpoint.
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
 * Deletes a specific API key on the backend.
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

/* ------------------------------------------------------------------ */
/* AI Provider API Key Helpers & Local Storage Management             */
/* ------------------------------------------------------------------ */

/**
 * Format verification for AI Provider keys.
 * Lightweight pre-flight check without making external network calls or exposing keys.
 */
export const validateKeyFormat = (provider: AIProvider, key: string): { valid: boolean; message?: string } => {
  const trimmed = key.trim();
  if (!trimmed) {
    return { valid: false, message: 'Key cannot be empty.' };
  }

  switch (provider) {
    case 'claude':
      if (!trimmed.startsWith('sk-ant-')) {
        return { valid: false, message: 'Claude API key should start with "sk-ant-".' };
      }
      if (trimmed.length < 20) {
        return { valid: false, message: 'Claude API key is too short.' };
      }
      return { valid: true };

    case 'openai':
      if (!trimmed.startsWith('sk-')) {
        return { valid: false, message: 'OpenAI API key should start with "sk-".' };
      }
      if (trimmed.length < 20) {
        return { valid: false, message: 'OpenAI API key is too short.' };
      }
      return { valid: true };

    case 'gemini':
      if (!trimmed.startsWith('AIza')) {
        return { valid: false, message: 'Google Gemini API key should start with "AIza".' };
      }
      if (trimmed.length < 20) {
        return { valid: false, message: 'Gemini API key is too short.' };
      }
      return { valid: true };

    default:
      return { valid: false, message: 'Provider missing or not supported.' };
  }
};

/**
 * Helper to produce a masked representation of a key ("sk-…3f9a").
 */
export const getMaskedKey = (key?: string): string | null => {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}…${suffix}`;
};

/**
 * AI provider keys live on the server only, under the service and key names the
 * AI proxy reads (services/rest_api/routers/ai_proxy.py). The browser keeps the
 * server's masked value for display, never the key itself.
 */
export const AI_KEY_SERVICE: Record<AIProvider, string> = {
  claude: 'anthropic',
  openai: 'openai',
  gemini: 'google',
};
export const AI_KEY_NAME = 'api_key';

const AI_PROVIDERS: AIProvider[] = ['claude', 'openai', 'gemini'];
const RAW_KEY_PREFIXES = ['songnodes_key_', 'ai_key_', 'apiKey_'];
const STORAGE_KEY_AI_MIGRATED = 'songnodes_ai_keys_server_v1';

const defaultAIKeyConfig = (): AIKeyConfig => ({
  preferredProvider: 'claude',
  claudeStatus: 'unconfigured',
  openaiStatus: 'unconfigured',
  geminiStatus: 'unconfigured',
});

/**
 * One-off clean-up: earlier builds kept raw AI keys in localStorage. Drop them;
 * the masked value comes back from the server on the next save.
 */
const purgeRawAIKeys = (config: AIKeyConfig): AIKeyConfig => {
  const cleaned: AIKeyConfig = { ...config };
  for (const provider of AI_PROVIDERS) {
    const keyProp = `${provider}ApiKey` as const;
    if (cleaned[keyProp]) {
      delete cleaned[keyProp];
      cleaned[`${provider}Status`] = 'unconfigured';
    }
    for (const prefix of RAW_KEY_PREFIXES) {
      localStorage.removeItem(`${prefix}${provider}`);
    }
  }
  return cleaned;
};

/**
 * Retrieves the AI Key configuration from local storage.
 */
export const getAIKeyConfig = (): AIKeyConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
    let config: AIKeyConfig = raw ? JSON.parse(raw) : defaultAIKeyConfig();
    if (!localStorage.getItem(STORAGE_KEY_AI_MIGRATED)) {
      config = purgeRawAIKeys(config);
      if (raw) localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(config));
      localStorage.setItem(STORAGE_KEY_AI_MIGRATED, '1');
    }
    return config;
  } catch (e) {
    console.error('Failed to read AI key config from localStorage:', e);
  }
  return defaultAIKeyConfig();
};

/**
 * Persists the AI Key configuration to local storage.
 */
export const saveAIKeyConfig = (config: AIKeyConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save AI key config to localStorage:', e);
  }
};

/**
 * Saves an AI key for a provider on the server. Throws when the server save
 * fails; only the server's masked value is kept locally.
 */
export const saveAIKey = async (provider: AIProvider, key: string): Promise<AIKeyConfig> => {
  const formatCheck = validateKeyFormat(provider, key);
  if (!formatCheck.valid) {
    throw new Error(formatCheck.message || 'Invalid key format.');
  }

  const saved = await saveKey(AI_KEY_SERVICE[provider], AI_KEY_NAME, key.trim());

  const updated: AIKeyConfig = {
    ...getAIKeyConfig(),
    [`${provider}ApiKey`]: saved.masked_value || '****',
    [`${provider}Status`]: saved.is_valid === false ? 'invalid' : 'valid',
  };
  saveAIKeyConfig(updated);
  return updated;
};

/**
 * Clears an AI key for a provider on the server and locally.
 */
export const clearAIKey = async (provider: AIProvider): Promise<AIKeyConfig> => {
  await deleteKey(AI_KEY_SERVICE[provider], AI_KEY_NAME);

  const updated: AIKeyConfig = { ...getAIKeyConfig() };
  delete updated[`${provider}ApiKey` as const];
  updated[`${provider}Status` as const] = 'unconfigured';
  saveAIKeyConfig(updated);
  return updated;
};

/**
 * Tests the provider key stored on the server. A key passed in is only
 * format-checked; the server always tests the key it holds.
 */
export const validateAIKey = async (provider: AIProvider, key?: string): Promise<AIKeyValidationResult> => {
  const testedAt = new Date().toISOString();
  const config = getAIKeyConfig();
  const statusProp = `${provider}Status` as const;

  if (key) {
    const formatCheck = validateKeyFormat(provider, key);
    if (!formatCheck.valid) {
      saveAIKeyConfig({ ...config, [statusProp]: 'invalid' });
      return { ok: false, message: formatCheck.message, testedAt };
    }
  }

  try {
    const res = await testKey(AI_KEY_SERVICE[provider], AI_KEY_NAME);
    const isOk = !!res.valid;
    saveAIKeyConfig({
      ...config,
      [statusProp]: isOk ? 'valid' : 'invalid',
      lastTestedAt: { ...config.lastTestedAt, [provider]: testedAt },
    });
    return {
      ok: isOk,
      message: res.message || (isOk ? 'Key works.' : 'Key test failed.'),
      testedAt,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not test the key.',
      testedAt,
    };
  }
};

/**
 * Gets preferred AI provider.
 */
export const getPreferredAIProvider = (): AIProvider => {
  return getAIKeyConfig().preferredProvider || 'claude';
};

/**
 * Sets preferred AI provider.
 */
export const setPreferredAIProvider = (provider: AIProvider): AIKeyConfig => {
  const current = getAIKeyConfig();
  const updated: AIKeyConfig = {
    ...current,
    preferredProvider: provider,
  };
  saveAIKeyConfig(updated);
  return updated;
};
