import React, { useState, useEffect } from 'react';

/**
 * APIKeyManager - Secure API Key Management Interface
 * Manages API keys for scraper and enrichment services
 *
 * Features:
 * - Encrypted storage via backend
 * - Show/hide sensitive values (SecretField specs)
 * - Copy to clipboard with status feedback
 * - Test connection functionality
 * - Service-specific validation
 * - Visual status indicators
 */

import type { APIKey, APIKeyRequirement } from '../types';
import { Eye, EyeOff, ExternalLink, KeyRound, Copy, Check } from 'lucide-react';
import { SN, StatusPill } from '../lib/songnodes';
import { Dialog, ConfirmDialog, Tabs, TabPanel, EmptyPanel, LoadingPanel, showToast } from './ds';
import './APIKeyManager.css';
import { API_BASE_URL } from '../lib/apiBase';

interface APIKeyManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServiceKeys {
  [serviceName: string]: {
    [keyName: string]: string;
  };
}

const CopyButton: React.FC<{ text: string; label?: string; size?: 'sm' | 'md' }> = ({ text, label = 'Copy', size = 'sm' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className={`sn-btn ${size === 'sm' ? 'sn-btn--sm' : ''} sn-btn--quiet`}
      onClick={handleCopy}
      aria-label={copied ? 'Copied to clipboard' : `Copy ${label}`}
      title={copied ? 'Copied' : `Copy ${label}`}
    >
      {copied ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={2} aria-hidden="true" />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
};

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
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ service: string; key: string; label: string } | null>(null);


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
      setErrorMessage('Enter the key first.');
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
        setTestResult({ ok: !!result.valid, text: `${serviceName} ${keyName}: ${result.message}` });
        if (result.valid) showToast(`${serviceName} key works`);
      } else {
        setTestResult({ ok: false, text: `The test didn’t run: ${result.detail || 'the API gave no reason'}` });
      }

      // Refresh keys to show updated test status
      await fetchExistingKeys();
    } catch (error) {
      setTestResult({ ok: false, text: `The test didn’t run: ${error}` });
    } finally {
      setTesting((prev) => ({ ...prev, [testKey]: false }));
    }
  };

  const handleDeleteKey = async (serviceName: string, keyName: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/api-keys/${serviceName}/${keyName}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        await fetchExistingKeys();
        showToast(`${serviceName} key deleted`);
      } else {
        const errorData = await response.json();
        setTestResult({ ok: false, text: `Couldn’t delete the key: ${errorData.detail}` });
      }
    } catch (error) {
      setTestResult({ ok: false, text: `Couldn’t delete the key: ${error}` });
    } finally {
      setPendingDelete(null);
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

  const tabs = uniqueServices.map((service) => ({ id: service, label: service.charAt(0).toUpperCase() + service.slice(1) }));
  return (
    <>
      <Dialog
        open={isOpen}
        title="API keys"
        sub="Keys for the scraper and enrichment services. Stored encrypted on the server (pgcrypto); never sent back in full."
        size="l"
        onClose={onClose}
        footer={
          <>
            <span className="sn-dialog__foot-start" role="status">
              {saveStatus === 'saved' && <StatusPill raw="saved" label="Key saved" />}
              {saveStatus === 'error' && <span className="sn-field__error">{errorMessage || 'The key wasn’t saved.'}</span>}
            </span>
            <button type="button" className="sn-btn" onClick={onClose}>Close</button>
          </>
        }
      >
        {testResult && (
          <p className="sn-inline-message sn-inline-message--boxed" data-status={testResult.ok ? 'ok' : 'bad'} role={testResult.ok ? 'status' : 'alert'}>
            {testResult.text}
          </p>
        )}

        {tabs.length === 0 ? (
          loading ? <LoadingPanel message="Loading API keys…" rows={3} /> : (
            <EmptyPanel compact icon={KeyRound} title="No key requirements">
              The API didn’t list any services that need keys. It may be offline.
            </EmptyPanel>
          )
        ) : (
          <>
            <Tabs label="Services" idBase="akm" tabs={tabs} value={activeService} onChange={setActiveService} />
            <TabPanel idBase="akm" id={activeService}>
              {loading ? (
                <LoadingPanel message="Loading API keys…" rows={3} />
              ) : (
                <div className="akm">
                  {getServiceRequirements(activeService).map((req) => {
                    const existing = getExistingKey(activeService, req.key_name);
                    const inputKey = `${activeService}:${req.key_name}`;
                    const isShowingKey = !!showKeys[inputKey];
                    const isTesting = !!testing[inputKey];
                    return (
                      <section key={inputKey} className="akm__key" aria-labelledby={`akm-${inputKey}`}>
                        <div className="akm__head">
                          <h3 className="akm__name" id={`akm-${inputKey}`}>{req.display_name}</h3>
                          {req.required && <span className="sn-tag">Required</span>}
                          {existing?.is_valid === true && <StatusPill raw="ok" label="Works" />}
                          {existing?.is_valid === false && <StatusPill raw="failed" label="Rejected" />}
                          {existing && existing.is_valid == null && <StatusPill raw="untested" label="Not tested" />}
                        </div>
                        <p className="akm__desc">{req.description}</p>
                        <a className="sn-link sn-link--ext" href={req.documentation_url} target="_blank" rel="noopener noreferrer">
                          Get a key <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
                        </a>

                        {existing ? (
                          <>
                            <div className="akm__row">
                              <code className="akm__masked">{existing.masked_value}</code>
                              <CopyButton text={existing.masked_value} label="Copy" size="sm" />
                              <button type="button" className="sn-btn sn-btn--sm" onClick={() => handleTestKey(activeService, req.key_name)} disabled={isTesting} aria-busy={isTesting || undefined}>
                                {isTesting ? <span className="sn-spinner" aria-hidden="true" /> : null}
                                {isTesting ? 'Testing…' : 'Test key'}
                              </button>
                              <button type="button" className="sn-btn sn-btn--sm sn-btn--danger-quiet" onClick={() => setPendingDelete({ service: activeService, key: req.key_name, label: req.display_name })}>
                                Delete key…
                              </button>
                            </div>
                            {existing.last_tested_at && (
                              <p className="akm__meta">
                                Tested {SN.format.dateTime(existing.last_tested_at)}
                                {existing.test_error ? <span className="sn-field__error">{existing.test_error}</span> : null}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="akm__row">
                            <div className="akm__secret">
                              <input
                                className="sn-input"
                                type={isShowingKey ? 'text' : 'password'}
                                aria-label={req.display_name}
                                value={keyValues[activeService]?.[req.key_name] || ''}
                                onChange={(e) => updateKeyValue(activeService, req.key_name, e.target.value)}
                                placeholder={`Paste the ${req.display_name}`}
                                autoComplete="off"
                              />
                              <button
                                type="button"
                                className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm akm__eye"
                                onClick={() => toggleShowKey(inputKey)}
                                aria-pressed={isShowingKey}
                                aria-label={isShowingKey ? `Hide ${req.display_name}` : `Show ${req.display_name}`}
                                title={isShowingKey ? 'Hide' : 'Show'}
                              >
                                {isShowingKey ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
                              </button>
                            </div>
                            <button type="button" className="sn-btn sn-btn--sm" onClick={() => handleSaveKey(activeService, req.key_name)} disabled={saveStatus === 'saving'} aria-busy={saveStatus === 'saving' || undefined}>
                              {saveStatus === 'saving' ? 'Saving…' : 'Save key'}
                            </button>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </TabPanel>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete the “${pendingDelete?.label ?? ''}” key?`}
        confirmLabel="Delete key"
        onConfirm={() => pendingDelete && handleDeleteKey(pendingDelete.service, pendingDelete.key)}
        onCancel={() => setPendingDelete(null)}
      >
        The {pendingDelete?.service} scraper stops working until you add a new key. This can’t be undone.
      </ConfirmDialog>
    </>
  );
};

export default APIKeyManager;