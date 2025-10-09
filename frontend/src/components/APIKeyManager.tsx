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

interface APIKeyRequirement {
  service_name: string;
  key_name: string;
  display_name: string;
  description: string;
  required: boolean;
  documentation_url: string;
  display_order: number;
}

interface APIKey {
  id: string;
  service_name: string;
  key_name: string;
  masked_value: string;
  description: string | null;
  is_valid: boolean | null;
  last_tested_at: string | null;
  test_error: string | null;
  created_at: string;
  updated_at: string;
}

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
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(5px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '85vh',
          overflow: 'hidden',
          color: '#FFFFFF',
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
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
              API Key Management
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#8E8E93' }}>
              Configure API keys for scraper and enrichment services
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8E8E93',
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
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.3)',
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
                  backgroundColor: activeService === service ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  color: activeService === service ? '#FFFFFF' : '#8E8E93',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderBottom: activeService === service ? '2px solid #4A90E2' : '2px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {service.toUpperCase()}
                {allConfigured && someValid && <span style={{ color: '#7ED321' }}>✓</span>}
                {allConfigured && !someValid && <span style={{ color: '#FFA500' }}>⚠</span>}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8E8E93' }}>
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
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                            {req.display_name}
                          </h3>
                          {req.required && (
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                backgroundColor: '#F56565',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              REQUIRED
                            </span>
                          )}
                          {existing?.is_valid === true && (
                            <span style={{ color: '#7ED321', fontSize: '16px' }}>✓</span>
                          )}
                          {existing?.is_valid === false && (
                            <span style={{ color: '#F56565', fontSize: '16px' }}>✗</span>
                          )}
                        </div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#8E8E93' }}>
                          {req.description}
                        </p>
                        <a
                          href={req.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: '#4A90E2', textDecoration: 'none' }}
                        >
                          Get API Key →
                        </a>
                      </div>
                    </div>

                    {existing ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <div style={{ flex: 1, fontSize: '14px', color: '#8E8E93', fontFamily: 'monospace' }}>
                            {existing.masked_value}
                          </div>
                          <button
                            onClick={() => handleTestKey(activeService, req.key_name)}
                            disabled={isTesting}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#4A90E2',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#FFFFFF',
                              fontSize: '13px',
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
                              border: '1px solid #F56565',
                              borderRadius: '6px',
                              color: '#F56565',
                              fontSize: '13px',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        {existing.last_tested_at && (
                          <div style={{ fontSize: '12px', color: '#8E8E93' }}>
                            Last tested: {new Date(existing.last_tested_at).toLocaleString()}
                            {existing.test_error && (
                              <span style={{ color: '#F56565', marginLeft: '8px' }}>
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
                              style={{
                                width: '100%',
                                padding: '10px 40px 10px 12px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '6px',
                                color: '#FFFFFF',
                                fontSize: '14px',
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
                                color: '#8E8E93',
                                cursor: 'pointer',
                                fontSize: '14px',
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
                              backgroundColor: '#7ED321',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#FFFFFF',
                              fontSize: '14px',
                              fontWeight: 600,
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
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: '#8E8E93' }}>
            {saveStatus === 'saved' && <span style={{ color: '#7ED321' }}>✓ Saved successfully</span>}
            {saveStatus === 'error' && <span style={{ color: '#F56565' }}>✗ {errorMessage || 'Save failed'}</span>}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontSize: '14px',
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
            backgroundColor: 'rgba(74,144,226,0.1)',
            borderTop: '1px solid rgba(74,144,226,0.2)',
            fontSize: '11px',
            color: '#4A90E2',
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