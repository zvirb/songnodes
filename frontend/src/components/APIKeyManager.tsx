import React, { useState, useEffect } from 'react';
import type { APIKey, APIKeyRequirement, AIProvider, AIKeyConfig } from '../types';
import { SN, StatusPill, SnIcon } from '../lib/songnodes';
import { Dialog, ConfirmDialog, Tabs, TabPanel, EmptyPanel, LoadingPanel, showToast, SegmentedControl } from './ds';
import './APIKeyManager.css';
import { API_BASE_URL } from '../lib/apiBase';
import {
  getAIKeyConfig,
  saveAIKey,
  clearAIKey,
  validateAIKey,
  getMaskedKey,
  setPreferredAIProvider,
} from '../services/apiKeyService';

interface APIKeyManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServiceKeys {
  [serviceName: string]: {
    [keyName: string]: string;
  };
}

export interface SecretFieldProps {
  label: string;
  savedMask: string | null;
  onSave: (key: string) => Promise<void>;
  onTest?: (key?: string) => Promise<{ ok: boolean; message?: string; testedAt: string }>;
  onClear?: () => Promise<void>;
  lastTest?: { ok: boolean; message?: string; testedAt: string };
  status?: 'unconfigured' | 'valid' | 'invalid';
  getKeyUrl?: string;
  getKeyLabel?: string;
  placeholder?: string;
  description?: string;
}

export const SecretField: React.FC<SecretFieldProps> = ({
  label,
  savedMask,
  onSave,
  onTest,
  onClear,
  lastTest,
  status,
  getKeyUrl,
  getKeyLabel = 'Get an API key',
  placeholder = 'Paste key here…',
  description,
}) => {
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localTestResult, setLocalTestResult] = useState<{ ok: boolean; message?: string; testedAt: string } | null>(
    lastTest || null
  );

  useEffect(() => {
    if (lastTest) {
      setLocalTestResult(lastTest);
    }
  }, [lastTest]);

  const showSavedRow = !!savedMask && !isEditing;

  const handleSave = async () => {
    if (!value.trim()) {
      setErrorMsg('Please enter a key.');
      return;
    }
    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onSave(value);
      setValue('');
      setIsEditing(false);
      setRevealed(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save key.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    setErrorMsg(null);
    setIsTesting(true);
    try {
      const res = await onTest();
      setLocalTestResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Test failed.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = async () => {
    if (!onClear) return;
    setErrorMsg(null);
    setIsClearing(true);
    try {
      await onClear();
      setValue('');
      setIsEditing(false);
      setLocalTestResult(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clear key.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="sn-secret-field">
      <div className="sn-secret-field__head">
        <label className="sn-secret-field__label">{label}</label>
        {getKeyUrl && (
          <a
            className="sn-link sn-link--ext"
            href={getKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
              {getKeyLabel} <SnIcon name="external-link" />
          </a>
        )}
      </div>

      {description && <p className="akm__desc">{description}</p>}

      {showSavedRow ? (
        <div className="sn-secret-field__row">
          <div className="sn-secret-field__saved">
            <SnIcon name="key-round" className="sn-icon" aria-hidden="true" />
            <code>{savedMask}</code>
          </div>
          {onTest && (
            <button
              type="button"
              className="sn-btn sn-btn--sm"
              onClick={handleTest}
              disabled={isTesting}
              aria-busy={isTesting || undefined}
            >
              {isTesting ? 'Testing…' : 'Test key'}
            </button>
          )}
          <button
            type="button"
            className="sn-btn sn-btn--sm sn-btn--quiet"
            onClick={() => setIsEditing(true)}
          >
            Change
          </button>
          {onClear && (
            <button
              type="button"
              className="sn-btn sn-btn--sm sn-btn--danger-quiet"
              onClick={handleClear}
              disabled={isClearing}
            >
              {isClearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
        </div>
      ) : (
        <div className="sn-secret-field__row">
          <div className="sn-secret-field__box">
            <input
              className="sn-input"
              type={revealed ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              aria-label={label}
            />
            <button
              type="button"
              className="sn-secret-field__reveal"
              onClick={() => setRevealed(!revealed)}
              aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
              title={revealed ? 'Hide' : 'Show'}
            >
              {revealed ? <SnIcon name="eye-off" /> : <SnIcon name="eye" />}
            </button>
          </div>
          <button
            type="button"
            className="sn-btn sn-btn--sm"
            onClick={handleSave}
            disabled={isSaving}
            aria-busy={isSaving || undefined}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          {savedMask && (
            <button
              type="button"
              className="sn-btn sn-btn--sm sn-btn--quiet"
              onClick={() => {
                setIsEditing(false);
                setValue('');
                setErrorMsg(null);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {errorMsg && <p className="sn-field__error">{errorMsg}</p>}

      <div className="sn-secret-field__status">
        {status === 'valid' && <StatusPill raw="ok" label="Valid" />}
        {status === 'invalid' && <StatusPill raw="failed" label="Invalid" />}
        {(status === 'unconfigured' || (!status && !savedMask)) && <StatusPill raw="untested" label="Not configured" />}

        {localTestResult && (
          <span className="sn-secret-field__stamp">
            {localTestResult.message}{' '}
            {localTestResult.testedAt && `(${SN.format.dateTime(localTestResult.testedAt)})`}
          </span>
        )}
      </div>
    </div>
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
  const [activeService, setActiveService] = useState<string>('ai-providers');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ service: string; key: string; label: string } | null>(null);
  const [aiConfig, setAiConfig] = useState<AIKeyConfig>(() => getAIKeyConfig());

  // Fetch requirements and existing keys on mount
  useEffect(() => {
    if (isOpen) {
      fetchRequirements();
      fetchExistingKeys();
      setAiConfig(getAIKeyConfig());
    }
  }, [isOpen]);

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
        ...(prev[serviceName] || {}),
        [keyName]: value,
      },
    }));
  };

  const getServiceRequirements = (serviceName: string): APIKeyRequirement[] => {
    return requirements.filter((req) => req.service_name === serviceName);
  };

  const uniqueServices = [...new Set(requirements.map((req) => req.service_name))];

  const tabs = [
    { id: 'ai-providers', label: 'AI Providers' },
    ...uniqueServices.map((service) => ({
      id: service,
      label: service.charAt(0).toUpperCase() + service.slice(1),
    })),
  ];

  const handleSaveAIKey = async (provider: AIProvider, key: string) => {
    const updated = await saveAIKey(provider, key);
    setAiConfig(updated);
    showToast(`${provider.toUpperCase()} API key saved`);
  };

  const handleClearAIKey = async (provider: AIProvider) => {
    const updated = await clearAIKey(provider);
    setAiConfig(updated);
    showToast(`${provider.toUpperCase()} API key removed`);
  };

  const handleTestAIKey = async (provider: AIProvider) => {
    const res = await validateAIKey(provider);
    setAiConfig(getAIKeyConfig());
    if (res.ok) showToast(`${provider.toUpperCase()} API key is valid`);
    return res;
  };

  const handlePreferredProviderChange = (provider: AIProvider) => {
    const updated = setPreferredAIProvider(provider);
    setAiConfig(updated);
    showToast(`Preferred AI Provider set to ${provider.toUpperCase()}`);
  };

  return (
    <>
      <Dialog
        open={isOpen}
        title="API keys"
        sub="Manage keys for AI assistant providers and scraper/enrichment services. AI keys are stored locally and validated securely."
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

        <TabPanel idBase="akm" id="ai-providers">
          <div className="akm">
            <div className="akm__key">
              <div className="akm__head">
                <h3 className="akm__name">Preferred AI Provider</h3>
              </div>
              <p className="akm__desc">Select which AI model provider to use for track analysis and recommendations.</p>
              <SegmentedControl
                label="Preferred AI Provider"
                options={[
                  { value: 'claude', label: 'Claude' },
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'gemini', label: 'Gemini' },
                ]}
                value={aiConfig.preferredProvider || 'claude'}
                onChange={(val) => handlePreferredProviderChange(val as AIProvider)}
              />
            </div>

            <section className="akm__key">
              <SecretField
                label="Anthropic (Claude) API Key"
                savedMask={getMaskedKey(aiConfig.claudeApiKey)}
                status={aiConfig.claudeStatus || 'unconfigured'}
                onSave={(key) => handleSaveAIKey('claude', key)}
                onTest={() => handleTestAIKey('claude')}
                onClear={() => handleClearAIKey('claude')}
                lastTest={
                  aiConfig.lastTestedAt?.claude
                    ? { ok: aiConfig.claudeStatus === 'valid', testedAt: aiConfig.lastTestedAt.claude }
                    : undefined
                }
                getKeyUrl="https://console.anthropic.com/settings/keys"
                getKeyLabel="Get Anthropic key"
                placeholder="sk-ant-..."
                description="Powers Claude AI models for music structure analysis and setlist planning."
              />
            </section>

            <section className="akm__key">
              <SecretField
                label="OpenAI API Key"
                savedMask={getMaskedKey(aiConfig.openaiApiKey)}
                status={aiConfig.openaiStatus || 'unconfigured'}
                onSave={(key) => handleSaveAIKey('openai', key)}
                onTest={() => handleTestAIKey('openai')}
                onClear={() => handleClearAIKey('openai')}
                lastTest={
                  aiConfig.lastTestedAt?.openai
                    ? { ok: aiConfig.openaiStatus === 'valid', testedAt: aiConfig.lastTestedAt.openai }
                    : undefined
                }
                getKeyUrl="https://platform.openai.com/api-keys"
                getKeyLabel="Get OpenAI key"
                placeholder="sk-..."
                description="Powers GPT models for metadata generation and audio feature extraction."
              />
            </section>

            <section className="akm__key">
              <SecretField
                label="Google (Gemini) API Key"
                savedMask={getMaskedKey(aiConfig.geminiApiKey)}
                status={aiConfig.geminiStatus || 'unconfigured'}
                onSave={(key) => handleSaveAIKey('gemini', key)}
                onTest={() => handleTestAIKey('gemini')}
                onClear={() => handleClearAIKey('gemini')}
                lastTest={
                  aiConfig.lastTestedAt?.gemini
                    ? { ok: aiConfig.geminiStatus === 'valid', testedAt: aiConfig.lastTestedAt.gemini }
                    : undefined
                }
                getKeyUrl="https://aistudio.google.com/app/apikey"
                getKeyLabel="Get Gemini key"
                placeholder="AIza..."
                description="Powers Gemini models for multimodal music reasoning and playlist flow optimization."
              />
            </section>
          </div>
        </TabPanel>

        {uniqueServices.map((service) => (
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
                        Get a key <SnIcon name="external-link" />
                      </a>

                      {existing ? (
                        <>
                          <div className="akm__row">
                            <code className="akm__masked">{existing.masked_value}</code>
                            <button type="button" className="sn-btn sn-btn--sm" onClick={() => handleTestKey(service, req.key_name)} disabled={isTesting} aria-busy={isTesting || undefined}>
                              {isTesting ? <span className="sn-spinner" aria-hidden="true" /> : null}
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
                              {isShowingKey ? <SnIcon name="eye-off" /> : <SnIcon name="eye" />}
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
