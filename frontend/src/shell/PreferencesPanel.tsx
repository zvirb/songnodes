/** PreferencesPanel (design-system): theme, text size, density, motion, and AI Provider key configuration, applied live through SN.prefs. */
import React, { useState, useEffect } from 'react';
import { SN, SnIcon } from '../lib/songnodes';
import { AIProvider, AIKeyConfig } from '../types';
import { SecretField } from '../components/APIKeyManager';
import {
  getAIKeyConfig,
  saveAIKey,
  clearAIKey,
  validateAIKey,
  getMaskedKey,
  setPreferredAIProvider,
} from '../services/apiKeyService';

type Theme = 'system' | 'dark' | 'light' | 'booth';
const THEMES: [Theme, string, string][] = [
  ['system', 'System', 'monitor'],
  ['dark', 'Dark', 'moon'],
  ['light', 'Light', 'sun'],
  ['booth', 'Booth', 'headphones'],
];

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length][0];
    onChange(next);
    const group = (e.currentTarget as HTMLElement).parentElement;
    requestAnimationFrame(() => group?.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus());
  };
  return (
    <div className="sn-seg sn-segmented-control sn-segmented-control--block" role="radiogroup" aria-label={label}>
      {options.map(([v, text], i) => (
        <button key={v} type="button" role="radio" data-value={v} aria-checked={v === value} tabIndex={v === value ? 0 : -1} onClick={() => onChange(v)} onKeyDown={(e) => onKey(e, i)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export const PreferencesPanel: React.FC<{ embedded?: boolean }> = ({ embedded = true }) => {
  const [p, setP] = useState(() => SN.prefs.get());
  const [announce, setAnnounce] = useState('');
  const [aiConfig, setAiConfig] = useState<AIKeyConfig>(() => getAIKeyConfig());

  useEffect(() => {
    setAiConfig(getAIKeyConfig());
  }, []);

  const refresh = (msg: string) => { setP(SN.prefs.get()); setAnnounce(msg); };

  const handlePreferredProviderChange = (provider: AIProvider) => {
    const updated = setPreferredAIProvider(provider);
    setAiConfig(updated);
    refresh(`Preferred AI provider set to ${provider.toUpperCase()}`);
  };

  const handleSaveAIKey = async (provider: AIProvider, key: string) => {
    const updated = await saveAIKey(provider, key);
    setAiConfig(updated);
    refresh(`${provider.toUpperCase()} API key saved`);
  };

  const handleClearAIKey = async (provider: AIProvider) => {
    const updated = await clearAIKey(provider);
    setAiConfig(updated);
    refresh(`${provider.toUpperCase()} API key cleared`);
  };

  const handleTestAIKey = async (provider: AIProvider) => {
    const res = await validateAIKey(provider);
    setAiConfig(getAIKeyConfig());
    refresh(`${provider.toUpperCase()} key tested: ${res.message}`);
    return res;
  };

  return (
    <section className={`sn-preferences-panel${embedded ? ' sn-preferences-panel--embedded' : ''}`} aria-labelledby="pp-title">
      <div className="sn-preferences-panel__head"><h2 className="sn-title title-m" id="pp-title">Preferences</h2></div>
      <div className="sn-preferences-panel__body">
        <div className="sn-preferences-panel__set">
          <span className="sn-field__label" id="pp-theme">Theme</span>
          <div className="sn-preferences-panel__themes" role="radiogroup" aria-labelledby="pp-theme">
            {THEMES.map(([v, label, icon]) => (
              <button key={v} type="button" className="sn-preferences-panel__theme" role="radio" aria-checked={p.theme === v} data-value={v}
                onClick={() => { SN.prefs.setTheme(v); refresh(`Theme set to ${label}`); }}>
                <SnIcon name={icon} />
                <span>{label}</span>
                <span className="sn-preferences-panel__check" aria-hidden="true">✓</span>
              </button>
            ))}
          </div>
          <p className="sn-preferences-panel__help">Booth is pure black with larger type for dark rooms and reading at a distance.</p>
        </div>
        <div className="sn-preferences-panel__set">
          <span className="sn-field__label">Text size</span>
          <Segmented label="Text size" value={p.textSize as 's' | 'm' | 'l' | 'xl'} options={[['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]}
            onChange={(v) => { SN.prefs.setTextSize(v); refresh(`Text size ${v.toUpperCase()}`); }} />
        </div>
        <div className="sn-preferences-panel__set">
          <span className="sn-field__label">Row density</span>
          <Segmented label="Row density" value={p.density as 'comfortable' | 'compact'} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]}
            onChange={(v) => { SN.prefs.setDensity(v); refresh(`Row density ${v}`); }} />
          <p className="sn-preferences-panel__help">Comfortable rows are 40px; compact rows are 32px.</p>
        </div>
        <fieldset className="sn-preferences-panel__set">
          <legend className="sn-field__label">Reduce motion</legend>
          <div className="sn-preferences-panel__radios">
            <label className="sn-check"><input type="radio" name="pp-motion" checked={p.motion !== 'reduce'} onChange={() => { SN.prefs.setMotion('system'); refresh('Motion follows this device'); }} /> <span>Follow this device’s setting</span></label>
            <label className="sn-check"><input type="radio" name="pp-motion" checked={p.motion === 'reduce'} onChange={() => { SN.prefs.setMotion('reduce'); refresh('Motion reduced'); }} /> <span>Always reduce motion</span></label>
          </div>
        </fieldset>

        <div className="sn-preferences-panel__set">
          <span className="sn-field__label">AI Provider Configuration</span>
          <p className="sn-preferences-panel__help">Select your preferred AI provider and manage API keys using the SecretField pattern.</p>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Segmented
              label="Preferred AI Provider"
              value={aiConfig.preferredProvider || 'claude'}
              options={[
                ['claude', 'Claude (Anthropic)'],
                ['openai', 'OpenAI'],
                ['gemini', 'Google (Gemini)'],
              ]}
              onChange={(v) => handlePreferredProviderChange(v as AIProvider)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <SecretField
              label="Anthropic (Claude) Key"
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
              getKeyLabel="Get key"
              placeholder="sk-ant-..."
            />

            <SecretField
              label="OpenAI Key"
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
              getKeyLabel="Get key"
              placeholder="sk-..."
            />

            <SecretField
              label="Google (Gemini) Key"
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
              getKeyLabel="Get key"
              placeholder="AIza..."
            />
          </div>
        </div>
      </div>
      <div className="sn-preferences-panel__foot">
        <span>Saved on this device only</span>
        <button className="sn-btn sn-btn--quiet sn-btn--sm" type="button" onClick={() => {
          SN.prefs.setTheme('system'); SN.prefs.setTextSize('m'); SN.prefs.setDensity('comfortable'); SN.prefs.setMotion('system');
          refresh('Preferences reset to defaults');
        }}>Reset to defaults</button>
      </div>
      <p className="sn-sr" role="status">{announce}</p>
    </section>
  );
};
