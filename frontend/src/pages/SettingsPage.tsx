/**
 * Services: Settings (/settings and /settings/:settingId).
 * Rebuilt to follow the design system requirements:
 * - Each setting gets its own card and its own page at /settings/:settingId
 * - Main overview at /settings features a text box search that filters all cards live by searching all terms in each card
 * - Uses en-AU copy, sentence case, Australia/Melbourne 24-hour time, and Lucide icons (no emojis).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { usePageHeader } from '../shell/AppShell';
import { PageHeader } from '../shell/PageParts';
import { SN, SnIcon, StatusPill } from '../lib/songnodes';
import {
  Button,
  Card,
  SearchField,
  SegmentedControl,
  Radio,
  ConfirmDialog,
  EmptyPanel,
  LoadingPanel,
  showToast,
} from '../components/ds';
import { SecretField } from '../components/APIKeyManager';
import useStore from '../store/useStore';
import { API_BASE_URL, oauthRedirectUri } from '../lib/apiBase';
import {
  getAIKeyConfig,
  saveAIKey,
  clearAIKey,
  validateAIKey,
  getMaskedKey,
  setPreferredAIProvider,
} from '../services/apiKeyService';
import type { AIProvider, AIKeyConfig, APIKeyRequirement, APIKey } from '../types';

export interface SettingMeta {
  id: string;
  lead: string;
  title: string;
  description: string;
  keywords: string[];
}

export const SETTINGS_LIST: SettingMeta[] = [
  {
    id: 'theme',
    lead: 'Appearance',
    title: 'Theme',
    description: 'Choose the interface theme. Booth mode is pure black with high contrast and larger type for dark environments.',
    keywords: ['theme', 'dark', 'light', 'booth', 'system', 'monitor', 'appearance', 'display', 'mode', 'color', 'colour'],
  },
  {
    id: 'text-size',
    lead: 'Appearance',
    title: 'Text size',
    description: 'Adjust global font scaling across the entire application (Small, Medium, Large, Extra large).',
    keywords: ['text', 'size', 'font', 'scaling', 'typography', 'reading', 'display', 'small', 'medium', 'large', 'extra large'],
  },
  {
    id: 'row-density',
    lead: 'Appearance',
    title: 'Row density',
    description: 'Choose between comfortable 40px table rows or compact 32px rows for maximum data density.',
    keywords: ['row', 'density', 'height', 'comfortable', 'compact', 'table', 'list', 'spacing', 'padding'],
  },
  {
    id: 'reduce-motion',
    lead: 'Accessibility',
    title: 'Reduce motion',
    description: 'Control user interface animation and motion transition effects.',
    keywords: ['motion', 'reduce motion', 'accessibility', 'animation', 'transition', 'system', 'smooth'],
  },
  {
    id: 'tidal-connection',
    lead: 'Music Services',
    title: 'TIDAL connection',
    description: 'Connect your TIDAL account via OAuth 2.1 to export setlists, match audio tracks, and sync playlists.',
    keywords: ['tidal', 'oauth', 'connect', 'playlist', 'music', 'service', 'streaming', 'token', 'account', 'sync'],
  },
  {
    id: 'spotify-connection',
    lead: 'Music Services',
    title: 'Spotify connection',
    description: 'Connect your Spotify account via OAuth 2.1 PKCE to match library tracks and export playlists.',
    keywords: ['spotify', 'oauth', 'connect', 'playlist', 'music', 'service', 'streaming', 'token', 'account', 'sync'],
  },
  {
    id: 'preferred-ai-provider',
    lead: 'AI Assistants',
    title: 'Preferred AI provider',
    description: 'Select the default AI assistant provider used for set structure analysis and track recommendations.',
    keywords: ['ai', 'provider', 'preferred', 'assistant', 'claude', 'openai', 'gemini', 'model', 'llm'],
  },
  {
    id: 'anthropic-api-key',
    lead: 'AI Assistants',
    title: 'Anthropic (Claude) API key',
    description: 'API key for Anthropic Claude models, used for deep harmonic structure analysis and setlist planning.',
    keywords: ['anthropic', 'claude', 'api key', 'secret', 'sk-ant', 'assistant', 'model', 'ai'],
  },
  {
    id: 'openai-api-key',
    lead: 'AI Assistants',
    title: 'OpenAI API key',
    description: 'API key for OpenAI GPT models, used for metadata generation and audio feature extraction.',
    keywords: ['openai', 'gpt', 'api key', 'secret', 'sk-', 'assistant', 'model', 'ai'],
  },
  {
    id: 'gemini-api-key',
    lead: 'AI Assistants',
    title: 'Google (Gemini) API key',
    description: 'API key for Google Gemini models, used for multimodal music reasoning and set flow optimization.',
    keywords: ['google', 'gemini', 'api key', 'secret', 'aiza', 'assistant', 'model', 'ai'],
  },
  {
    id: 'scraper-keys',
    lead: 'Pipeline Services',
    title: 'Scraper service API keys',
    description: 'Manage API keys required by background enrichment scrapers (Beatport, Discogs, 1001Tracklists, Spotify Scraper).',
    keywords: ['scraper', 'api keys', 'beatport', 'discogs', '1001tracklists', 'enrichment', 'data', 'pipeline'],
  },
  {
    id: 'data-storage',
    lead: 'Storage and Reset',
    title: 'Saved data and credentials',
    description: 'Clear local browser credentials, clear saved tokens, or reset preferences to defaults.',
    keywords: ['storage', 'credentials', 'tokens', 'clear', 'reset', 'defaults', 'localstorage', 'browser', 'data'],
  },
  {
    id: 'about-system',
    lead: 'System Information',
    title: 'About SongNodes',
    description: 'System information including design system version, locale, time zone, and API status.',
    keywords: ['about', 'system', 'version', 'locale', 'timezone', 'songnodes', 'design system', 'melbourne', 'australia'],
  },
];

const isTokenExpired = (expiresAt?: number): boolean => {
  if (!expiresAt) return true;
  return Date.now() >= (expiresAt - 5 * 60 * 1000);
};

export const SettingsPage: React.FC = () => {
  const { settingId } = useParams<{ settingId?: string }>();
  const navigate = useNavigate();

  // App-level preferences state
  const [prefs, setPrefs] = useState(() => SN.prefs.get());

  // Store credentials & state
  const { musicCredentials, credentials, general } = useStore();

  // AI keys config
  const [aiConfig, setAiConfig] = useState<AIKeyConfig>(() => getAIKeyConfig());

  // Search query state for main list
  const [searchQuery, setSearchQuery] = useState('');

  // Service connection errors / state
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmClearCredentials, setConfirmClearCredentials] = useState(false);
  const [confirmResetPrefs, setConfirmResetPrefs] = useState(false);

  // Scraper API keys state
  const [scraperReqs, setScraperReqs] = useState<APIKeyRequirement[]>([]);
  const [scraperKeys, setScraperKeys] = useState<APIKey[]>([]);
  const [loadingScrapers, setLoadingScrapers] = useState(false);

  // Set page header dynamically based on route
  const currentSetting = useMemo(() => {
    if (!settingId) return null;
    return SETTINGS_LIST.find((s) => s.id === settingId) || null;
  }, [settingId]);

  usePageHeader({
    lead: 'Services',
    title: currentSetting ? currentSetting.title : 'Settings',
    current: 'services',
  });

  // Refresh preferences from SN.prefs
  const refreshPrefs = (msg?: string) => {
    setPrefs(SN.prefs.get());
    if (msg) showToast(msg);
  };

  // Fetch scraper key requirements and existing keys
  useEffect(() => {
    let isMounted = true;
    const fetchScrapers = async () => {
      setLoadingScrapers(true);
      try {
        const [reqRes, keysRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/api-keys/requirements`),
          fetch(`${API_BASE_URL}/api/v1/api-keys`),
        ]);
        if (reqRes.ok && isMounted) {
          const reqData = await reqRes.json();
          setScraperReqs(reqData);
        }
        if (keysRes.ok && isMounted) {
          const keysData = await keysRes.json();
          setScraperKeys(keysData);
        }
      } catch (err) {
        console.error('Failed to fetch scraper keys info:', err);
      } finally {
        if (isMounted) setLoadingScrapers(false);
      }
    };
    fetchScrapers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for OAuth postMessage callbacks
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type, tokens, error, service } = event.data || {};
      if (type === 'oauth-success' && tokens) {
        const serviceName = service || 'tidal';
        credentials.updateCredentials(serviceName, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_at,
          isConnected: true,
          lastValidated: Date.now(),
        });
        const name = serviceName === 'tidal' ? 'TIDAL' : serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
        setConnectError(null);
        showToast(`${name} connected successfully`);
      } else if (type === 'oauth-error') {
        const serviceName = service || 'music service';
        setConnectError(`Couldn’t connect ${serviceName === 'tidal' ? 'TIDAL' : serviceName}: ${error}`);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [credentials]);

  // TIDAL Connect action
  const connectTidal = async () => {
    try {
      general.setLoading(true);
      setConnectError(null);
      const redirectUri = oauthRedirectUri('/oauth/callback');
      const response = await fetch(`${API_BASE_URL}/api/v1/music-auth/tidal/oauth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_uri: redirectUri }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Failed to initialize' }));
        throw new Error(err.detail || 'Failed to initialize OAuth');
      }
      const data = await response.json();
      window.location.href = data.authorization_url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setConnectError(`Couldn’t start the TIDAL connection: ${msg}`);
      general.setLoading(false);
    }
  };

  // Spotify Connect action
  const connectSpotify = () => {
    setConnectError(null);
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    sessionStorage.setItem('spotify_auth_state', state);

    const redirectUri = oauthRedirectUri('/callback/spotify');
    const authorizeUrl = `${API_BASE_URL}/api/v1/music-auth/spotify/authorize?` + new URLSearchParams({
      redirect_uri: redirectUri,
      state: state,
    });
    window.location.href = authorizeUrl;
  };

  // Scraper API key actions
  const handleSaveScraperKey = async (serviceName: string, keyName: string, keyValue: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_name: serviceName,
        key_name: keyName,
        key_value: keyValue,
        description: null,
      }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Failed to save key' }));
      throw new Error(errData.detail || 'Failed to save key');
    }
    showToast(`${serviceName} API key saved`);
    const updated = await fetch(`${API_BASE_URL}/api/v1/api-keys`);
    if (updated.ok) setScraperKeys(await updated.json());
  };

  const handleTestScraperKey = async (serviceName: string, keyName: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_name: serviceName, key_name: keyName }),
    });
    const result = await response.json();
    const updated = await fetch(`${API_BASE_URL}/api/v1/api-keys`);
    if (updated.ok) setScraperKeys(await updated.json());
    if (response.ok && result.valid) {
      showToast(`${serviceName} key is valid`);
      return { ok: true, message: result.message || 'Key verified', testedAt: new Date().toISOString() };
    }
    return { ok: false, message: result.detail || result.message || 'Key test failed', testedAt: new Date().toISOString() };
  };

  const handleClearScraperKey = async (serviceName: string, keyName: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${serviceName}/${keyName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to delete key' }));
      throw new Error(err.detail || 'Failed to delete key');
    }
    showToast(`${serviceName} API key removed`);
    const updated = await fetch(`${API_BASE_URL}/api/v1/api-keys`);
    if (updated.ok) setScraperKeys(await updated.json());
  };

  // Connection status checks
  const isSpotifyConnected = !!(
    musicCredentials.spotify?.accessToken &&
    musicCredentials.spotify?.isConnected &&
    !isTokenExpired(musicCredentials.spotify?.expiresAt)
  );

  const isTidalConnected = !!(
    musicCredentials.tidal?.accessToken &&
    musicCredentials.tidal?.isConnected &&
    !isTokenExpired(musicCredentials.tidal?.expiresAt)
  );

  // Helper to render control content for a specific setting ID
  const renderSettingControl = (id: string, isSinglePage = false) => {
    switch (id) {
      case 'theme': {
        return (
          <div>
            <SegmentedControl
              label="Theme"
              value={prefs.theme as 'system' | 'dark' | 'light' | 'booth'}
              options={[
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'booth', label: 'Booth' },
              ]}
              onChange={(v) => {
                SN.prefs.setTheme(v);
                refreshPrefs(`Theme set to ${v.charAt(0).toUpperCase() + v.slice(1)}`);
              }}
              block={isSinglePage}
            />
          </div>
        );
      }

      case 'text-size': {
        return (
          <div>
            <SegmentedControl
              label="Text size"
              value={prefs.textSize as 's' | 'm' | 'l' | 'xl'}
              options={[
                { value: 's', label: 'S', ariaLabel: 'Small' },
                { value: 'm', label: 'M', ariaLabel: 'Medium' },
                { value: 'l', label: 'L', ariaLabel: 'Large' },
                { value: 'xl', label: 'XL', ariaLabel: 'Extra large' },
              ]}
              onChange={(v) => {
                SN.prefs.setTextSize(v);
                refreshPrefs(`Text size set to ${v.toUpperCase()}`);
              }}
              block={isSinglePage}
            />
          </div>
        );
      }

      case 'row-density': {
        return (
          <div>
            <SegmentedControl
              label="Row density"
              value={prefs.density as 'comfortable' | 'compact'}
              options={[
                { value: 'comfortable', label: 'Comfortable (40px)' },
                { value: 'compact', label: 'Compact (32px)' },
              ]}
              onChange={(v) => {
                SN.prefs.setDensity(v);
                refreshPrefs(`Row density set to ${v}`);
              }}
              block={isSinglePage}
            />
          </div>
        );
      }

      case 'reduce-motion': {
        return (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Radio
                name="motion"
                label="Follow this device’s setting"
                checked={prefs.motion !== 'reduce'}
                onChange={() => {
                  SN.prefs.setMotion('system');
                  refreshPrefs('Motion follows device setting');
                }}
              />
              <Radio
                name="motion"
                label="Always reduce motion"
                checked={prefs.motion === 'reduce'}
                onChange={() => {
                  SN.prefs.setMotion('reduce');
                  refreshPrefs('Motion reduced');
                }}
              />
            </div>
          </div>
        );
      }

      case 'tidal-connection': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {isTidalConnected ? (
                <StatusPill raw="ok" label="Connected" />
              ) : musicCredentials.tidal?.accessToken && isTokenExpired(musicCredentials.tidal?.expiresAt) ? (
                <StatusPill raw="warn" label="Expired" />
              ) : (
                <StatusPill raw="not_configured" label="Not connected" />
              )}
              {musicCredentials.tidal?.lastValidated ? (
                <span className="sn-muted body-s">
                  Last validated {SN.format.dateTime(new Date(musicCredentials.tidal.lastValidated))}
                </span>
              ) : null}
            </div>
            {connectError && id === 'tidal-connection' && (
              <p className="sn-field__error" role="alert">{connectError}</p>
            )}
            <div>
              <Button
                kind="secondary"
                onClick={connectTidal}
              >
                <SnIcon name="plug" />
                {isTidalConnected ? 'Reconnect TIDAL' : 'Connect TIDAL'}
              </Button>
            </div>
          </div>
        );
      }

      case 'spotify-connection': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {isSpotifyConnected ? (
                <StatusPill raw="ok" label="Connected" />
              ) : musicCredentials.spotify?.accessToken && isTokenExpired(musicCredentials.spotify?.expiresAt) ? (
                <StatusPill raw="warn" label="Expired" />
              ) : (
                <StatusPill raw="not_configured" label="Not connected" />
              )}
              {musicCredentials.spotify?.lastValidated ? (
                <span className="sn-muted body-s">
                  Last validated {SN.format.dateTime(new Date(musicCredentials.spotify.lastValidated))}
                </span>
              ) : null}
            </div>
            {connectError && id === 'spotify-connection' && (
              <p className="sn-field__error" role="alert">{connectError}</p>
            )}
            <div>
              <Button
                kind="secondary"
                onClick={connectSpotify}
              >
                <SnIcon name="plug" />
                {isSpotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify'}
              </Button>
            </div>
          </div>
        );
      }

      case 'preferred-ai-provider': {
        return (
          <div>
            <SegmentedControl
              label="Preferred AI Provider"
              options={[
                { value: 'claude', label: 'Claude' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'gemini', label: 'Gemini' },
              ]}
              value={aiConfig.preferredProvider || 'claude'}
              onChange={(val) => {
                const updated = setPreferredAIProvider(val as AIProvider);
                setAiConfig(updated);
                showToast(`Preferred AI provider set to ${val.toUpperCase()}`);
              }}
              block={isSinglePage}
            />
          </div>
        );
      }

      case 'anthropic-api-key': {
        return (
          <div>
            <SecretField
              label="Anthropic (Claude) API key"
              savedMask={getMaskedKey(aiConfig.claudeApiKey)}
              status={aiConfig.claudeStatus || 'unconfigured'}
              onSave={async (key) => {
                const updated = await saveAIKey('claude', key);
                setAiConfig(updated);
                showToast('Anthropic API key saved');
              }}
              onTest={async () => {
                const res = await validateAIKey('claude');
                setAiConfig(getAIKeyConfig());
                if (res.ok) showToast('Anthropic API key is valid');
                return res;
              }}
              onClear={async () => {
                const updated = await clearAIKey('claude');
                setAiConfig(updated);
                showToast('Anthropic API key removed');
              }}
              lastTest={
                aiConfig.lastTestedAt?.claude
                  ? { ok: aiConfig.claudeStatus === 'valid', testedAt: aiConfig.lastTestedAt.claude }
                  : undefined
              }
              getKeyUrl="https://console.anthropic.com/settings/keys"
              getKeyLabel="Get Anthropic key"
              placeholder="sk-ant-..."
            />
          </div>
        );
      }

      case 'openai-api-key': {
        return (
          <div>
            <SecretField
              label="OpenAI API key"
              savedMask={getMaskedKey(aiConfig.openaiApiKey)}
              status={aiConfig.openaiStatus || 'unconfigured'}
              onSave={async (key) => {
                const updated = await saveAIKey('openai', key);
                setAiConfig(updated);
                showToast('OpenAI API key saved');
              }}
              onTest={async () => {
                const res = await validateAIKey('openai');
                setAiConfig(getAIKeyConfig());
                if (res.ok) showToast('OpenAI API key is valid');
                return res;
              }}
              onClear={async () => {
                const updated = await clearAIKey('openai');
                setAiConfig(updated);
                showToast('OpenAI API key removed');
              }}
              lastTest={
                aiConfig.lastTestedAt?.openai
                  ? { ok: aiConfig.openaiStatus === 'valid', testedAt: aiConfig.lastTestedAt.openai }
                  : undefined
              }
              getKeyUrl="https://platform.openai.com/api-keys"
              getKeyLabel="Get OpenAI key"
              placeholder="sk-..."
            />
          </div>
        );
      }

      case 'gemini-api-key': {
        return (
          <div>
            <SecretField
              label="Google (Gemini) API key"
              savedMask={getMaskedKey(aiConfig.geminiApiKey)}
              status={aiConfig.geminiStatus || 'unconfigured'}
              onSave={async (key) => {
                const updated = await saveAIKey('gemini', key);
                setAiConfig(updated);
                showToast('Gemini API key saved');
              }}
              onTest={async () => {
                const res = await validateAIKey('gemini');
                setAiConfig(getAIKeyConfig());
                if (res.ok) showToast('Gemini API key is valid');
                return res;
              }}
              onClear={async () => {
                const updated = await clearAIKey('gemini');
                setAiConfig(updated);
                showToast('Gemini API key removed');
              }}
              lastTest={
                aiConfig.lastTestedAt?.gemini
                  ? { ok: aiConfig.geminiStatus === 'valid', testedAt: aiConfig.lastTestedAt.gemini }
                  : undefined
              }
              getKeyUrl="https://aistudio.google.com/app/apikey"
              getKeyLabel="Get Gemini key"
              placeholder="AIza..."
            />
          </div>
        );
      }

      case 'scraper-keys': {
        if (loadingScrapers) {
          return <LoadingPanel message="Loading scraper service keys…" rows={2} />;
        }
        if (!scraperReqs.length) {
          return <p className="sn-muted">No scraper API key requirements configured.</p>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {scraperReqs.map((req) => {
              const existing = scraperKeys.find(
                (k) => k.service_name === req.service_name && k.key_name === req.key_name
              );
              const status: 'valid' | 'invalid' | 'unconfigured' =
                existing?.is_valid === true
                  ? 'valid'
                  : existing?.is_valid === false
                  ? 'invalid'
                  : 'unconfigured';

              return (
                <SecretField
                  key={`${req.service_name}:${req.key_name}`}
                  label={req.display_name}
                  savedMask={existing ? existing.masked_value : null}
                  status={status}
                  description={req.description}
                  getKeyUrl={req.documentation_url}
                  getKeyLabel="Get key"
                  placeholder={`Paste ${req.display_name}`}
                  onSave={async (keyVal) => {
                    await handleSaveScraperKey(req.service_name, req.key_name, keyVal);
                  }}
                  onTest={async () => {
                    return await handleTestScraperKey(req.service_name, req.key_name);
                  }}
                  onClear={async () => {
                    await handleClearScraperKey(req.service_name, req.key_name);
                  }}
                  lastTest={
                    existing?.last_tested_at
                      ? {
                          ok: existing.is_valid === true,
                          message: existing.test_error || (existing.is_valid ? 'Valid key' : 'Invalid key'),
                          testedAt: existing.last_tested_at,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        );
      }

      case 'data-storage': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <Button
                kind="danger-quiet"
                onClick={() => setConfirmClearCredentials(true)}
              >
                Clear saved credentials…
              </Button>
              <Button
                kind="quiet"
                onClick={() => setConfirmResetPrefs(true)}
              >
                Reset preferences to defaults
              </Button>
            </div>
            <p className="sn-muted body-s">
              Clearing credentials removes stored TIDAL and Spotify OAuth tokens in this browser.
            </p>
          </div>
        );
      }

      case 'about-system': {
        return (
          <div>
            <dl className="sn-key-value-grid">
              <dt>Design system</dt>
              <dd className="sn-mono">{SN.version || '2.0'}</dd>
              <dt>Locale</dt>
              <dd className="sn-mono">{SN.locale || 'en-AU'} · {SN.timeZone || 'Australia/Melbourne'}</dd>
              <dt>API endpoint</dt>
              <dd className="sn-mono">{API_BASE_URL || '/api'}</dd>
            </dl>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Filter cards for the overview page
  const filteredSettings = useMemo(() => {
    if (!searchQuery.trim()) return SETTINGS_LIST;
    const q = searchQuery.toLowerCase().trim();
    return SETTINGS_LIST.filter((item) => {
      const matchText = [
        item.lead,
        item.title,
        item.description,
        ...item.keywords,
      ].join(' ').toLowerCase();
      return matchText.includes(q);
    });
  }, [searchQuery]);

  // SINGLE SETTING PAGE VIEW (/settings/:settingId)
  if (settingId) {
    if (!currentSetting) {
      return (
        <main className="sn-page__main sn-page-settings" id="main" tabIndex={-1}>
          <PageHeader
            mod="services"
            lead="Services"
            title="Setting not found"
            desc="The requested setting page does not exist."
          />
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button onClick={() => navigate('/settings')}>
              <SnIcon name="arrow-left" /> Back to all settings
            </Button>
          </div>
        </main>
      );
    }

    return (
      <main className="sn-page__main sn-page-settings" id="main" tabIndex={-1}>
        <PageHeader
          mod="services"
          here={currentSetting.title}
          lead="Services"
          title={currentSetting.title}
          desc={currentSetting.description}
          actions={
            <Button kind="quiet" onClick={() => navigate('/settings')}>
              <SnIcon name="undo-2" /> All settings
            </Button>
          }
        />

        <div style={{ marginTop: 'var(--space-6)', maxWidth: '720px' }}>
          <Card
            variant="neutral"
            eyebrow={currentSetting.lead}
            title={currentSetting.title}
          >
            <div className="sn-card__body" style={{ padding: 'var(--space-4) 0' }}>
              <p className="body-s sn-muted" style={{ marginBottom: 'var(--space-4)' }}>
                {currentSetting.description}
              </p>
              {renderSettingControl(currentSetting.id, true)}
            </div>
            <div className="sn-card__foot" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--line)' }}>
              <Link className="sn-link sn-m-services" to="/settings">
                ← Back to all settings
              </Link>
            </div>
          </Card>
        </div>

        {/* Dialogs */}
        <ConfirmDialog
          open={confirmClearCredentials}
          title="Clear saved credentials?"
          confirmLabel="Clear credentials"
          typedValue="clear"
          onConfirm={() => {
            credentials.clearCredentials();
            setConfirmClearCredentials(false);
            showToast('Saved credentials cleared');
          }}
          onCancel={() => setConfirmClearCredentials(false)}
          facts={['TIDAL and Spotify disconnect in this browser.', 'Server-side secrets are unaffected.']}
        >
          This removes saved music service tokens in this browser. You will need to connect services again.
        </ConfirmDialog>

        <ConfirmDialog
          open={confirmResetPrefs}
          title="Reset preferences to defaults?"
          confirmLabel="Reset preferences"
          onConfirm={() => {
            SN.prefs.setTheme('system');
            SN.prefs.setTextSize('m');
            SN.prefs.setDensity('comfortable');
            SN.prefs.setMotion('system');
            refreshPrefs('Preferences reset to defaults');
            setConfirmResetPrefs(false);
          }}
          onCancel={() => setConfirmResetPrefs(false)}
        >
          This will restore theme, text size, density, and motion settings to default values.
        </ConfirmDialog>
      </main>
    );
  }

  // ALL SETTINGS OVERVIEW PAGE VIEW (/settings)
  return (
    <main className="sn-page__main sn-page-settings" id="main" tabIndex={-1}>
      <PageHeader
        mod="services"
        lead="Services"
        title="Settings"
        desc="Manage streaming connections, API keys, appearance, display preferences, and local data."
      />

      <div style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-6)', maxWidth: '560px' }}>
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          label="Search settings and preferences"
          placeholder="Search settings, API keys, appearance…"
          shortcut
        />
      </div>

      {filteredSettings.length === 0 ? (
        <EmptyPanel
          icon={SnIcon as any}
          title="No settings found"
          actions={
            <Button onClick={() => setSearchQuery('')}>
              Clear search filter
            </Button>
          }
        >
          No setting cards match “{searchQuery}”. Try searching for “theme”, “key”, “spotify”, or “density”.
        </EmptyPanel>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
            alignItems: 'start',
          }}
        >
          {filteredSettings.map((item) => (
            <Card key={item.id} variant="neutral" eyebrow={item.lead} title={item.title}>
              <div className="sn-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
                <p className="body-s sn-muted" style={{ margin: 0 }}>
                  {item.description}
                </p>
                {renderSettingControl(item.id, false)}
              </div>
              <div
                className="sn-card__foot"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: 'var(--space-4)',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Link className="sn-link sn-m-services" to={`/settings/${item.id}`}>
                  Open setting page →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmClearCredentials}
        title="Clear saved credentials?"
        confirmLabel="Clear credentials"
        typedValue="clear"
        onConfirm={() => {
          credentials.clearCredentials();
          setConfirmClearCredentials(false);
          showToast('Saved credentials cleared');
        }}
        onCancel={() => setConfirmClearCredentials(false)}
        facts={['TIDAL and Spotify disconnect in this browser.', 'Server-side secrets are unaffected.']}
      >
        This removes saved music service tokens in this browser. You will need to connect services again.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmResetPrefs}
        title="Reset preferences to defaults?"
        confirmLabel="Reset preferences"
        onConfirm={() => {
          SN.prefs.setTheme('system');
          SN.prefs.setTextSize('m');
          SN.prefs.setDensity('comfortable');
          SN.prefs.setMotion('system');
          refreshPrefs('Preferences reset to defaults');
          setConfirmResetPrefs(false);
        }}
        onCancel={() => setConfirmResetPrefs(false)}
      >
        This will restore theme, text size, density, and motion settings to default values.
      </ConfirmDialog>
    </main>
  );
};

export default SettingsPage;
