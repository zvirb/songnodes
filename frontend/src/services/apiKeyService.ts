/**
 * @file API Key Service
 * @description This service handles all interactions with the backend for API key management.
 */

import { APIKey, APIKeyRequirement } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

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