import React, { useState, useEffect } from 'react';
import type { APIKey, APIKeyRequirement } from '../types';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Input } from './ui';

interface APIKeyManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServiceKeys {
  [serviceName: string]: {
    [keyName: string]: string;
  };
}

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ isOpen, onClose }) => {
  const [requirements, setRequirements] = useState<APIKeyRequirement[]>([]);
  const [existingKeys, setExistingKeys] = useState<APIKey[]>([]);
  const [keyValues, setKeyValues] = useState<ServiceKeys>({});
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeService, setActiveService] = useState<string>('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

  useEffect(() => {
    if (isOpen) {
      fetchRequirements();
      fetchExistingKeys();
    }
  }, [isOpen]);

  const fetchRequirements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/requirements`);
      if (response.ok) {
        const data = await response.json();
        setRequirements(data);

        if (data.length > 0 && !activeService) {
          setActiveService(data[0].service_name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch API key requirements:', error);
    }
  };

  const fetchExistingKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`);
      if (response.ok) {
        const data = await response.json();
        setExistingKeys(data);
      }
    } catch (error) {
      console.error('Failed to fetch existing API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (serviceName: string, keyName: string) => {
    const keyValue = keyValues[serviceName]?.[keyName];

    if (!keyValue || keyValue.trim() === '') {
      setErrorMessage('Please enter a value');
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 3000);
      return;
    }

    setSaveStatus('saving');
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: serviceName,
          key_name: keyName,
          key_value: keyValue,
          description: null,
        }),
      });

      if (response.ok) {
        setSaveStatus('saved');
        await fetchExistingKeys();

        setKeyValues((prev) => ({
          ...prev,
          [serviceName]: {
            ...prev[serviceName],
            [keyName]: '',
          },
        }));

        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.detail || 'Failed to save API key');
        setSaveStatus('error');
        setTimeout(() => {
          setSaveStatus('idle');
          setErrorMessage('');
        }, 3000);
      }
    } catch (error) {
      setErrorMessage(`Save failed: ${error}`);
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 3000);
    }
  };

  const handleTestKey = async (serviceName: string, keyName: string) => {
    const testKey = `${serviceName}:${keyName}`;
    setTesting((prev) => ({ ...prev, [testKey]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: serviceName,
          key_name: keyName,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.valid) {
          alert(`✅ ${serviceName.toUpperCase()} - ${keyName}: ${result.message}`);
        } else {
          alert(`❌ ${serviceName.toUpperCase()} - ${keyName}: ${result.message}`);
        }
      } else {
        alert(`❌ Test failed: ${result.detail || 'Unknown error'}`);
      }

      await fetchExistingKeys();
    } catch (error) {
      alert(`❌ Test error: ${error}`);
    } finally {
      setTesting((prev) => ({ ...prev, [testKey]: false }));
    }
  };

  const handleDeleteKey = async (serviceName: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete ${serviceName}/${keyName}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/api-keys/${serviceName}/${keyName}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        await fetchExistingKeys();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete: ${errorData.detail}`);
      }
    } catch (error) {
      alert(`Delete error: ${error}`);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getExistingKey = (serviceName: string, keyName: string): APIKey | undefined => {
    return existingKeys.find(
      (k) => k.service_name === serviceName && k.key_name === keyName
    );
  };

  const updateKeyValue = (serviceName: string, keyName: string, value: string) => {
    setKeyValues((prev) => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName] || {},
        [keyName]: value,
      },
    }));
  };

  const getServiceRequirements = (serviceName: string): APIKeyRequirement[] => {
    return requirements.filter((req) => req.service_name === serviceName);
  };

  const uniqueServices = [...new Set(requirements.map((req) => req.service_name))];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[var(--color-modal-overlay)] flex items-center justify-center z-[var(--z-modal)] backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card
        variant="elevated"
        className="w-full max-w-4xl max-h-[85vh] flex flex-col border-[var(--color-border-default)] bg-[var(--color-bg-elevated-1)] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
          <div>
            <CardTitle className="text-xl font-semibold text-[var(--color-text-primary)]">
              API Key Management
            </CardTitle>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Configure API keys for scraper and enrichment services
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-lg px-2 py-1">
            ✕
          </Button>
        </CardHeader>

        {/* Service Tabs */}
        <div className="flex overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4">
          {uniqueServices.map((service) => {
            const serviceReqs = getServiceRequirements(service);
            const allConfigured = serviceReqs.every((req) => getExistingKey(service, req.key_name));
            const someValid = serviceReqs.some((req) => {
              const existing = getExistingKey(service, req.key_name);
              return existing?.is_valid === true;
            });

            return (
              <Button
                key={service}
                variant={activeService === service ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveService(service)}
                className={`rounded-none border-b-2 px-5 py-3 transition-colors flex items-center gap-2 font-medium text-xs uppercase tracking-wider ${
                  activeService === service
                    ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]'
                    : 'border-transparent text-[var(--color-text-tertiary)]'
                }`}
              >
                {service}
                {allConfigured && someValid && (
                  <Badge variant="success" size="sm">Active</Badge>
                )}
                {allConfigured && !someValid && (
                  <Badge variant="warning" size="sm">Warning</Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Content */}
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center py-10 text-[var(--color-text-tertiary)]">
              Loading API keys...
            </div>
          ) : (
            <div className="space-y-6">
              {getServiceRequirements(activeService).map((req) => {
                const existing = getExistingKey(activeService, req.key_name);
                const inputKey = `${activeService}:${req.key_name}`;
                const isShowingKey = showKeys[inputKey];
                const isTesting = testing[inputKey];

                return (
                  <Card key={inputKey} variant="default" className="p-5 border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-2)]">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base text-[var(--color-text-primary)]">
                            {req.display_name}
                          </h3>
                          {req.required && (
                            <Badge variant="error" size="sm">REQUIRED</Badge>
                          )}
                          {existing?.is_valid === true && (
                            <Badge variant="success" size="sm">Valid</Badge>
                          )}
                          {existing?.is_valid === false && (
                            <Badge variant="error" size="sm">Expired / Invalid</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)] mb-2">
                          {req.description}
                        </p>
                        {req.documentation_url && (
                          <a
                            href={req.documentation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--color-brand-primary)] hover:underline inline-flex items-center gap-1"
                          >
                            Get API Key →
                          </a>
                        )}
                      </div>
                    </div>

                    {existing ? (
                      <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)] mt-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated-1)] px-3 py-2 rounded border border-[var(--color-border-subtle)]">
                            {existing.masked_value}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleTestKey(activeService, req.key_name)}
                            disabled={isTesting}
                          >
                            {isTesting ? 'Testing...' : 'Test'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                            onClick={() => handleDeleteKey(activeService, req.key_name)}
                          >
                            Delete
                          </Button>
                        </div>

                        {existing.last_tested_at && (
                          <div className="text-[11px] text-[var(--color-text-tertiary)]">
                            Last tested: {new Date(existing.last_tested_at).toLocaleString()}
                            {existing.test_error && (
                              <span className="text-[var(--color-error)] ml-2">
                                ({existing.test_error})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2">
                        <div className="flex gap-3 items-center">
                          <div className="flex-1 relative">
                            <Input
                              type={isShowingKey ? 'text' : 'password'}
                              value={keyValues[activeService]?.[req.key_name] || ''}
                              onChange={(e) => updateKeyValue(activeService, req.key_name, e.target.value)}
                              placeholder={`Enter ${req.display_name}`}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowKey(inputKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-sm"
                            >
                              {isShowingKey ? '👁️' : '🙈'}
                            </button>
                          </div>
                          <Button
                            variant="primary"
                            onClick={() => handleSaveKey(activeService, req.key_name)}
                            disabled={saveStatus === 'saving'}
                          >
                            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-6 py-4 flex items-center justify-between">
          <div className="text-xs">
            {saveStatus === 'saved' && <Badge variant="success">✓ Saved successfully</Badge>}
            {saveStatus === 'error' && <Badge variant="error">✗ {errorMessage || 'Save failed'}</Badge>}
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Security Notice */}
        <div className="bg-[var(--color-brand-primary-muted)] border-t border-[var(--color-brand-primary)] px-6 py-2 text-[11px] text-[var(--color-brand-primary)]">
          🔒 <strong>Security:</strong> All API keys are encrypted at rest using PostgreSQL pgcrypto. Keys are never exposed in API responses.
        </div>
      </Card>
    </div>
  );
};

export default APIKeyManager;
