import React, { useState, useEffect } from 'react';

/**
 * APIKeyManager - Secure API Key Management Interface
 * Manages API keys for scraper and enrichment services
 *
 * Features:
 * - Encrypted storage via backend
 * - Show/hide sensitive values
 * - Test connection functionality
 * - Service-specific validation
 * - Visual status indicators
 */

import type { APIKey, APIKeyRequirement } from '../types';

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

  // Fetch requirements and existing keys on mount
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

        // Set first service as active
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

        // Clear the input field
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

      // Refresh keys to show updated test status
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--color-modal-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal)',
        backdropFilter: 'blur(10px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-elevated-1)',
          borderRadius: 'var(--radius-modal)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-modal)',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '85vh',
          overflow: 'hidden',
          color: 'var(--color-text-primary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-elevated-2)'
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
              API Key Management
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              Configure API keys for scraper and enrichment services
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-tertiary)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Service Tabs */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-elevated-2)',
          }}
        >
          {uniqueServices.map((service) => {
            const serviceReqs = getServiceRequirements(service);
            const allConfigured = serviceReqs.every((req) => getExistingKey(service, req.key_name));
            const someValid = serviceReqs.some((req) => {
              const existing = getExistingKey(service, req.key_name);
              return existing?.is_valid === true;
            });

            return (
              <button
                key={service}
                onClick={() => setActiveService(service)}
                style={{
                  flex: '0 0 auto',
                  padding: '16px 20px',
                  backgroundColor: activeService === service ? 'var(--color-bg-elevated-1)' : 'transparent',
                  border: 'none',
                  color: activeService === service ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  cursor: 'pointer',
                  borderBottom: activeService === service ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                  transition: 'var(--transition-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {service.toUpperCase()}
                {allConfigured && someValid && <span style={{ color: 'var(--color-success)' }}>✓</span>}
                {allConfigured && !someValid && <span style={{ color: 'var(--color-warning)' }}>⚠</span>}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>
              Loading API keys...
            </div>
          ) : (
            <div>
              {getServiceRequirements(activeService).map((req) => {
                const existing = getExistingKey(activeService, req.key_name);
                const inputKey = `${activeService}:${req.key_name}`;
                const isShowingKey = showKeys[inputKey];
                const isTesting = testing[inputKey];

                return (
                  <div
                    key={inputKey}
                    style={{
                      marginBottom: '24px',
                      padding: '20px',
                      backgroundColor: 'var(--color-bg-elevated-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                            {req.display_name}
                          </h3>
                          {req.required && (
                            <span
                              style={{
                                fontSize: 'var(--font-size-xs)',
                                padding: '2px 8px',
                                backgroundColor: 'var(--color-error-bg)',
                                color: 'var(--color-error)',
                                border: '1px solid var(--color-error-border)',
                                borderRadius: 'var(--radius-badge)',
                                fontWeight: 'var(--font-weight-semibold)',
                              }}
                            >
                              REQUIRED
                            </span>
                          )}
                          {existing?.is_valid === true && (
                            <span style={{ color: 'var(--color-success)', fontSize: '16px' }}>✓</span>
                          )}
                          {existing?.is_valid === false && (
                            <span style={{ color: 'var(--color-error)', fontSize: '16px' }}>✗</span>
                          )}
                        </div>
                        <p style={{ margin: '0 0 8px 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                          {req.description}
                        </p>
                        <a
                          href={req.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-primary)', textDecoration: 'none' }}
                        >
                          Get API Key →
                        </a>
                      </div>
                    </div>

                    {existing ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <div
                            className="font-mono"
                            style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}
                          >
                            {existing.masked_value}
                          </div>
                          <button
                            onClick={() => handleTestKey(activeService, req.key_name)}
                            disabled={isTesting}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: 'var(--color-brand-secondary)',
                              border: 'none',
                              borderRadius: 'var(--radius-button)',
                              color: 'var(--color-text-inverse)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-semibold)',
                              cursor: isTesting ? 'wait' : 'pointer',
                              opacity: isTesting ? 0.6 : 1,
                            }}
                          >
                            {isTesting ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(activeService, req.key_name)}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--color-error)',
                              borderRadius: 'var(--radius-button)',
                              color: 'var(--color-error)',
                              fontSize: 'var(--font-size-sm)',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        {existing.last_tested_at && (
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                            Last tested: {new Date(existing.last_tested_at).toLocaleString()}
                            {existing.test_error && (
                              <span style={{ color: 'var(--color-error)', marginLeft: '8px' }}>
                                ({existing.test_error})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input
                              type={isShowingKey ? 'text' : 'password'}
                              value={keyValues[activeService]?.[req.key_name] || ''}
                              onChange={(e) => updateKeyValue(activeService, req.key_name, e.target.value)}
                              placeholder={`Enter ${req.display_name}`}
                              className="font-mono"
                              style={{
                                width: '100%',
                                padding: '10px 40px 10px 12px',
                                backgroundColor: 'var(--color-input-bg)',
                                border: '1px solid var(--color-input-border)',
                                borderRadius: 'var(--radius-input)',
                                color: 'var(--color-text-primary)',
                                fontSize: 'var(--font-size-sm)',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowKey(inputKey)}
                              style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-tertiary)',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-sm)',
                              }}
                            >
                              {isShowingKey ? '👁️' : '🙈'}
                            </button>
                          </div>
                          <button
                            onClick={() => handleSaveKey(activeService, req.key_name)}
                            disabled={saveStatus === 'saving'}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: 'var(--color-brand-primary)',
                              border: 'none',
                              borderRadius: 'var(--radius-button)',
                              color: 'var(--color-text-inverse)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-semibold)',
                              cursor: saveStatus === 'saving' ? 'wait' : 'pointer',
                              opacity: saveStatus === 'saving' ? 0.6 : 1,
                            }}
                          >
                            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-elevated-2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
            {saveStatus === 'saved' && <span style={{ color: 'var(--color-success)' }}>✓ Saved successfully</span>}
            {saveStatus === 'error' && <span style={{ color: 'var(--color-error)' }}>✗ {errorMessage || 'Save failed'}</span>}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-button)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        {/* Security Notice */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: 'var(--color-info-bg)',
            borderTop: '1px solid var(--color-info-border)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-info)',
          }}
        >
          🔒 <strong>Security:</strong> All API keys are encrypted at rest using PostgreSQL pgcrypto.
          Keys are never exposed in API responses.
        </div>
      </div>
    </div>
  );
};

export default APIKeyManager;