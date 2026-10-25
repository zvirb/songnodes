import React, { useState, useEffect } from 'react';

/**
 * APIKeyManager - Secure API Key Management Interface
 * Manages API keys for AI providers (Claude, OpenAI, Gemini) and scraper/enrichment services.
 *
 * Features:
 * - SecretField design system pattern for API keys
 * - Encrypted storage via backend & local state
 * - Masked inputs with reveal toggles
 * - Lightweight pre-flight ping & format verification
 * - Visual status indicators
 */

import type { APIKey, APIKeyRequirement, AIKeyConfig, AIProvider } from '../types';
import { Eye, EyeOff, ExternalLink, KeyRound } from 'lucide-react';
import { SN, StatusPill } from '../lib/songnodes';
import { Dialog, ConfirmDialog, Tabs, TabPanel, EmptyPanel, LoadingPanel, showToast } from './ds';
import './APIKeyManager.css';
import { API_BASE_URL } from '../lib/apiBase';
import {
  getAIKeyConfig,
  saveAIKey,
  deleteAIKey,
  testAIKey,
  setAIProviderPreference,
} from '../services/apiKeyService';

export interface SecretFieldProps {
  label: string;
  savedMask: string | null;
  onSave: (key: string) => Promise<void>;
  onTest?: (key?: string) => Promise<{ ok: boolean; message?: string; testedAt: string }>;
  onClear?: () => Promise<void>;
  lastTest?: { ok: boolean; message?: string; testedAt?: string } | null;
  getKeyUrl?: string;
  getKeyLabel?: string;
  description?: string;
  required?: boolean;
}

export const SecretField: React.FC<SecretFieldProps> = ({
  label,
  savedMask,
  onSave,
  onTest,
  onClear,
  lastTest,
  getKeyUrl,
  getKeyLabel = 'Get an API key',
  description,
  required,
}) => {
  const [value, setValue] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; testedAt?: string } | null>(
    lastTest || null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lastTest) {
      setTestResult(lastTest);
    }
  }, [lastTest]);

  const handleSave = async () => {
    if (!value.trim()) {
      setError('Enter a key first.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave(value.trim());
      setValue('');
      setIsRevealed(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    setIsTesting(true);
    setError(null);
    try {
      const res = await onTest(value.trim() || undefined);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = async () => {
    if (!onClear) return;
    setIsClearing(true);
    setError(null);
    try {
      await onClear();
      setValue('');
      setTestResult(null);
    } catch (err: any) {
      setError(err.message || 'Failed to clear key');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="akm__key sn-secret-field">
      <div className="akm__head">
        <h3 className="akm__name">{label}</h3>
        {required && <span className="sn-tag">Required</span>}
        {testResult?.ok === true && <StatusPill raw="ok" label="Works" />}
        {testResult?.ok === false && <StatusPill raw="failed" label="Rejected" />}
        {savedMask && testResult?.ok === undefined && <StatusPill raw="untested" label="Saved" />}
      </div>

      {description && <p className="akm__desc">{description}</p>}

      {getKeyUrl && (
        <a
          className="sn-link sn-link--ext"
          href={getKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {getKeyLabel} <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      )}

      {savedMask ? (
        <div className="akm__row">
          <code className="akm__masked">{savedMask}</code>
          {onTest && (
            <button
              type="button"
              className="sn-btn sn-btn--sm"
              onClick={handleTest}
              disabled={isTesting}
            >
              {isTesting ? 'Testing…' : 'Test key'}
            </button>
          )}
          {onClear && (
            <button
              type="button"
              className="sn-btn sn-btn--sm sn-btn--danger-quiet"
              onClick={handleClear}
              disabled={isClearing}
            >
              {isClearing ? 'Clearing…' : 'Clear key'}
            </button>
          )}
        </div>
      ) : (
        <div className="akm__row">
          <div className="akm__secret">
            <input
              className="sn-input"
              type={isRevealed ? 'text' : 'password'}
              aria-label={label}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={`Paste the ${label}`}
              autoComplete="off"
            />
            <button
              type="button"
              className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm akm__eye"
              onClick={() => setIsRevealed(!isRevealed)}
              aria-label={isRevealed ? `Hide ${label}` : `Show ${label}`}
              title={isRevealed ? 'Hide' : 'Show'}
            >
              {isRevealed ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
            </button>
          </div>
          <button
            type="button"
            className="sn-btn sn-btn--sm"
            onClick={handleSave}
            disabled={isSaving || !value.trim()}
          >
            {isSaving ? 'Saving…' : 'Save key'}
          </button>
          {value.trim() && onTest && (
            <button
              type="button"
              className="sn-btn sn-btn--sm sn-btn--quiet"
              onClick={handleTest}
              disabled={isTesting}
            >
              {isTesting ? 'Testing…' : 'Test key'}
            </button>
          )}
        </div>
      )}

      {error && <p className="sn-field__error">{error}</p>}
      {testResult?.message && (
        <p className="akm__meta" style={{ marginTop: 'var(--space-1)' }}>
          {testResult.message}
          {testResult.testedAt && ` (${SN.format.dateTime(testResult.testedAt)})`}
        </p>
      )}
    </div>
  );
};

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
  const [aiConfig, setAiConfig] = useState<AIKeyConfig>(() => getAIKeyConfig());
  const [keyValues, setKeyValues] = useState<ServiceKeys>({});
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeService, setActiveService] = useState<string>('ai_models');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ service: string; key: string; label: string } | null>(null);

  // Fetch requirements, existing keys, and AI config on mount / open
  useEffect(() => {
    if (isOpen) {
      setAiConfig(getAIKeyConfig());
      fetchRequirements();
      fetchExistingKeys();
    }
  }, [isOpen]);

  const refreshAIConfig = () => {
    setAiConfig(getAIKeyConfig());
  };

  const fetchRequirements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/requirements`);
      if (response.ok) {
        const data = await response.json();
        setRequirements(data);
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
        ...(prev[serviceName] || {}),
        [keyName]: value,
      },
    }));
  };

  const getServiceRequirements = (serviceName: string): APIKeyRequirement[] => {
    return requirements.filter((req) => req.service_name === serviceName);
  };

  const uniqueServices = [...new Set(requirements.map((req) => req.service_name))];
  const allServices = ['ai_models', ...uniqueServices.filter((s) => s !== 'ai_models')];

  const tabs = allServices.map((service) => ({
    id: service,
    label: service === 'ai_models' ? 'AI Providers' : service.charAt(0).toUpperCase() + service.slice(1),
  }));

  return (
    <>
      <Dialog
        open={isOpen}
        title="API keys"
        sub="Manage keys for AI models (Claude, OpenAI, Gemini) and scraper/enrichment services. Stored encrypted."
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

        <Tabs label="Services" idBase="akm" tabs={tabs} value={activeService} onChange={setActiveService} />

        <TabPanel idBase="akm" id="ai_models">
          <div className="akm">
            <div className="akm__provider-selector" style={{ marginBottom: 'var(--space-2)' }}>
              <span className="sn-field__label">Primary AI Provider</span>
              <div className="sn-seg sn-segmented-control sn-segmented-control--block" role="radiogroup" aria-label="Primary AI Provider">
                {(['claude', 'openai', 'gemini'] as AIProvider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={aiConfig.preferredProvider === p}
                    onClick={() => {
                      setAIProviderPreference(p);
                      refreshAIConfig();
                      showToast(`Preferred AI Provider set to ${p === 'claude' ? 'Claude' : p === 'openai' ? 'OpenAI' : 'Gemini'}`);
                    }}
                  >
                    {p === 'claude' ? 'Anthropic (Claude)' : p === 'openai' ? 'OpenAI' : 'Google (Gemini)'}
                  </button>
                ))}
              </div>
            </div>

            <SecretField
              label="Anthropic (Claude)"
              description="Used for setlist generation, harmonic transition analysis, and intelligent track recommendations."
              savedMask={aiConfig.claudeApiKey.maskedKey}
              getKeyUrl="https://console.anthropic.com/settings/keys"
              getKeyLabel="Get a Claude API key"
              lastTest={
                aiConfig.claudeApiKey.status !== 'unconfigured'
                  ? {
                      ok: aiConfig.claudeApiKey.status === 'valid',
                      message: aiConfig.claudeApiKey.errorMessage || (aiConfig.claudeApiKey.status === 'valid' ? 'Claude API key format & pre-flight check verified' : 'Invalid Claude key'),
                      testedAt: aiConfig.claudeApiKey.lastTestedAt || undefined,
                    }
                  : null
              }
              onSave={async (key) => {
                await saveAIKey('claude', key);
                refreshAIConfig();
                showToast('Claude API key saved');
              }}
              onTest={async (key) => {
                const res = await testAIKey('claude', key);
                refreshAIConfig();
                return res;
              }}
              onClear={async () => {
                await deleteAIKey('claude');
                refreshAIConfig();
                showToast('Claude API key removed');
              }}
            />

            <SecretField
              label="OpenAI"
              description="Used for track auto-tagging, genre taxonomy mapping, and mood descriptor extraction."
              savedMask={aiConfig.openaiApiKey.maskedKey}
              getKeyUrl="https://platform.openai.com/api-keys"
              getKeyLabel="Get an OpenAI API key"
              lastTest={
                aiConfig.openaiApiKey.status !== 'unconfigured'
                  ? {
                      ok: aiConfig.openaiApiKey.status === 'valid',
                      message: aiConfig.openaiApiKey.errorMessage || (aiConfig.openaiApiKey.status === 'valid' ? 'OpenAI API key format & pre-flight check verified' : 'Invalid OpenAI key'),
                      testedAt: aiConfig.openaiApiKey.lastTestedAt || undefined,
                    }
                  : null
              }
              onSave={async (key) => {
                await saveAIKey('openai', key);
                refreshAIConfig();
                showToast('OpenAI API key saved');
              }}
              onTest={async (key) => {
                const res = await testAIKey('openai', key);
                refreshAIConfig();
                return res;
              }}
              onClear={async () => {
                await deleteAIKey('openai');
                refreshAIConfig();
                showToast('OpenAI API key removed');
              }}
            />

            <SecretField
              label="Google (Gemini)"
              description="Used for multimodal audio analysis, batch feature extraction, and graph insights."
              savedMask={aiConfig.geminiApiKey.maskedKey}
              getKeyUrl="https://aistudio.google.com/app/apikey"
              getKeyLabel="Get a Gemini API key"
              lastTest={
                aiConfig.geminiApiKey.status !== 'unconfigured'
                  ? {
                      ok: aiConfig.geminiApiKey.status === 'valid',
                      message: aiConfig.geminiApiKey.errorMessage || (aiConfig.geminiApiKey.status === 'valid' ? 'Gemini API key format & pre-flight check verified' : 'Invalid Gemini key'),
                      testedAt: aiConfig.geminiApiKey.lastTestedAt || undefined,
                    }
                  : null
              }
              onSave={async (key) => {
                await saveAIKey('gemini', key);
                refreshAIConfig();
                showToast('Gemini API key saved');
              }}
              onTest={async (key) => {
                const res = await testAIKey('gemini', key);
                refreshAIConfig();
                return res;
              }}
              onClear={async () => {
                await deleteAIKey('gemini');
                refreshAIConfig();
                showToast('Gemini API key removed');
              }}
            />
          </div>
        </TabPanel>

        {allServices.filter((s) => s !== 'ai_models').map((service) => (
          <TabPanel key={service} idBase="akm" id={service}>
            {loading ? (
              <LoadingPanel message="Loading API keys…" rows={3} />
            ) : (
              <div className="akm">
                {getServiceRequirements(service).map((req) => {
                  const existing = getExistingKey(service, req.key_name);
                  const inputKey = `${service}:${req.key_name}`;
                  const isShowingKey = showKeys[inputKey];
                  const isTesting = testing[inputKey];
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
                            <button type="button" className="sn-btn sn-btn--sm" onClick={() => handleTestKey(service, req.key_name)} disabled={isTesting} aria-busy={isTesting || undefined}>
                              {isTesting ? 'Testing…' : 'Test key'}
                            </button>
                            <button type="button" className="sn-btn sn-btn--sm sn-btn--danger-quiet" onClick={() => setPendingDelete({ service, key: req.key_name, label: req.display_name })}>
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
                              value={keyValues[service]?.[req.key_name] || ''}
                              onChange={(e) => updateKeyValue(service, req.key_name, e.target.value)}
                              placeholder={`Paste the ${req.display_name}`}
                              autoComplete="off"
                            />
                            <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm akm__eye" onClick={() => toggleShowKey(inputKey)} aria-label={isShowingKey ? `Hide ${req.display_name}` : `Show ${req.display_name}`} title={isShowingKey ? 'Hide' : 'Show'}>
                              {isShowingKey ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
                            </button>
                          </div>
                          <button type="button" className="sn-btn sn-btn--sm" onClick={() => handleSaveKey(service, req.key_name)} disabled={saveStatus === 'saving'} aria-busy={saveStatus === 'saving' || undefined}>
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
        ))}
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
