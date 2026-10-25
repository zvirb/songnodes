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
      return { valid: false, message: 'Unknown provider.' };
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
 * Retrieves the AI Key configuration from local storage.
 */
export const getAIKeyConfig = (): AIKeyConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read AI key config from localStorage:', e);
  }
  return {
    preferredProvider: 'claude',
    claudeStatus: 'unconfigured',
    openaiStatus: 'unconfigured',
    geminiStatus: 'unconfigured',
  };
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
 * Saves an AI key for a specific provider.
 * Performs format validation and syncs both local storage and backend if available.
 */
export const saveAIKey = async (provider: AIProvider, key: string): Promise<AIKeyConfig> => {
  const formatCheck = validateKeyFormat(provider, key);
  if (!formatCheck.valid) {
    throw new Error(formatCheck.message || 'Invalid key format.');
  }

  const current = getAIKeyConfig();
  const keyProp = `${provider}ApiKey` as keyof AIKeyConfig;
  const statusProp = `${provider}Status` as keyof AIKeyConfig;

  const updated: AIKeyConfig = {
    ...current,
    [keyProp]: key.trim(),
    [statusProp]: 'valid',
  };

  saveAIKeyConfig(updated);

  // Attempt backend persistence (best-effort)
  try {
    await saveKey('ai-providers', `${provider}_api_key`, key.trim());
  } catch (e) {
    console.warn(`Backend save for ${provider} key failed, kept in local storage:`, e);
  }

  return updated;
};

/**
 * Clears an AI key for a specific provider.
 */
export const clearAIKey = async (provider: AIProvider): Promise<AIKeyConfig> => {
  const current = getAIKeyConfig();
  const updated: AIKeyConfig = { ...current };

  if (provider === 'claude') {
    delete updated.claudeApiKey;
    updated.claudeStatus = 'unconfigured';
  } else if (provider === 'openai') {
    delete updated.openaiApiKey;
    updated.openaiStatus = 'unconfigured';
  } else if (provider === 'gemini') {
    delete updated.geminiApiKey;
    updated.geminiStatus = 'unconfigured';
  }

  saveAIKeyConfig(updated);

  // Attempt backend delete (best-effort)
  try {
    await deleteKey('ai-providers', `${provider}_api_key`);
  } catch (e) {
    console.warn(`Backend delete for ${provider} key failed:`, e);
  }

  return updated;
};

/**
 * Validates / tests an AI key (lightweight pre-flight ping check or format validation).
 */
export const validateAIKey = async (provider: AIProvider, key?: string): Promise<AIKeyValidationResult> => {
  const testedAt = new Date().toISOString();
  const config = getAIKeyConfig();
  const targetKey = key || config[`${provider}ApiKey` as keyof AIKeyConfig] as string | undefined;

  if (!targetKey) {
    return {
      ok: false,
      message: 'No key provided to test.',
      testedAt,
    };
  }

  const formatCheck = validateKeyFormat(provider, targetKey);
  if (!formatCheck.valid) {
    // Update local status to invalid
    const statusProp = `${provider}Status` as keyof AIKeyConfig;
    saveAIKeyConfig({ ...config, [statusProp]: 'invalid' });
    return {
      ok: false,
      message: formatCheck.message,
      testedAt,
    };
  }

  // Try backend test if applicable
  try {
    const res = await testKey('ai-providers', `${provider}_api_key`);
    const isOk = !!res.valid;
    const statusProp = `${provider}Status` as keyof AIKeyConfig;
    const updatedConfig = {
      ...config,
      [statusProp]: (isOk ? 'valid' : 'invalid') as 'valid' | 'invalid',
      lastTestedAt: {
        ...config.lastTestedAt,
        [provider]: testedAt,
      },
    };
    saveAIKeyConfig(updatedConfig);

    return {
      ok: isOk,
      message: res.message || (isOk ? 'Key format and pre-flight check passed.' : 'Key test failed.'),
      testedAt,
    };
  } catch (e) {
    // Fallback: format check passed, set valid
    const statusProp = `${provider}Status` as keyof AIKeyConfig;
    const updatedConfig = {
      ...config,
      [statusProp]: 'valid' as const,
      lastTestedAt: {
        ...config.lastTestedAt,
        [provider]: testedAt,
      },
    };
    saveAIKeyConfig(updatedConfig);

    return {
      ok: true,
      message: `${provider.toUpperCase()} API key format verified successfully (${formatCheck.message || 'format valid'}).`,
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
