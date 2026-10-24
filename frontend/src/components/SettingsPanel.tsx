import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { APIKeyManager } from './APIKeyManager';
import { KeyRound } from 'lucide-react';
import { StatusPill } from '../lib/songnodes';
import { Dialog, ConfirmDialog, showToast } from './ds';
import './SettingsPanel.css';
import { API_BASE_URL, oauthRedirectUri } from '../lib/apiBase';

/**
 * SettingsPanel - User Credential Management
 * Handles secure storage of music service credentials for Tidal integration
 * Now includes API Key Management for scraper services
 */

interface MusicServiceCredentials {
  tidal?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    isConnected?: boolean;
    lastValidated?: number;
  };
  spotify?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    isConnected?: boolean;  // 2025 Best Practice: Standardized connection status
    lastValidated?: number; // 2025 Best Practice: Track last validation timestamp
  };
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { musicCredentials, credentials, isLoading, general } = useStore();
  const [showAPIKeyManager, setShowAPIKeyManager] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Helper function to check if credentials are expired (2025 Best Practice: Token validation)
  const isTokenExpired = (expiresAt?: number): boolean => {
    if (!expiresAt) return true;
    // Add 5-minute buffer to refresh before actual expiration
    return Date.now() >= (expiresAt - 5 * 60 * 1000);
  };

  // Check if service is truly connected (has valid, non-expired token)
  const isSpotifyConnected = musicCredentials.spotify?.accessToken
    && musicCredentials.spotify?.isConnected
    && !isTokenExpired(musicCredentials.spotify?.expiresAt);

  const isTidalConnected = musicCredentials.tidal?.accessToken
    && musicCredentials.tidal?.isConnected
    && !isTokenExpired(musicCredentials.tidal?.expiresAt);

  // Clear expired tokens on component mount (2025 Best Practice: Token lifecycle management)
  useEffect(() => {
    const clearExpiredTokens = () => {
      let needsUpdate = false;

      // Check Spotify token expiration
      if (musicCredentials.spotify?.accessToken && isTokenExpired(musicCredentials.spotify?.expiresAt)) {
        console.log('[SettingsPanel] Spotify token expired, clearing credentials');
        credentials.updateCredentials('spotify', {
          ...musicCredentials.spotify,
          isConnected: false,
          accessToken: undefined,
          refreshToken: undefined
        });
        needsUpdate = true;
      }

      // Check Tidal token expiration
      if (musicCredentials.tidal?.accessToken && isTokenExpired(musicCredentials.tidal?.expiresAt)) {
        console.log('[SettingsPanel] Tidal token expired, clearing credentials');
        credentials.updateCredentials('tidal', {
          ...musicCredentials.tidal,
          isConnected: false,
          accessToken: undefined,
          refreshToken: undefined
        });
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log('[SettingsPanel] Cleared expired tokens');
      }
    };

    clearExpiredTokens();
  }, [isOpen]); // Run when panel opens

  // Listen for OAuth callback messages (2025 Best Practice: Service-aware message handling)
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      console.log('[SettingsPanel] Received postMessage:', { origin: event.origin, type: event.data?.type, service: event.data?.service });

      // Security: Verify the message origin matches our app
      if (event.origin !== window.location.origin) {
        console.warn('[SettingsPanel] Ignoring message from untrusted origin:', event.origin);
        return;
      }

      const { type, tokens, error, service } = event.data;

      if (type === 'oauth-success' && tokens) {
        const serviceName = service || 'tidal'; // Default to tidal for backward compatibility
        console.log(`[SettingsPanel] OAuth success for ${serviceName}, storing credentials...`);

        // Store tokens in Zustand (which will auto-persist to localStorage)
        credentials.updateCredentials(serviceName, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_at,
          isConnected: true,
          lastValidated: Date.now(),
        });

        console.log(`[SettingsPanel] Stored ${serviceName} credentials in Zustand store`);

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);

        const displayName = serviceName === 'tidal' ? 'TIDAL' : serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
        setConnectError(null);
        showToast(`${displayName} connected`);
      } else if (type === 'oauth-error') {
        const serviceName = service || 'music service';
        console.error(`[SettingsPanel] OAuth error for ${serviceName}:`, error);
        setConnectError(`Couldn’t connect ${serviceName === 'tidal' ? 'TIDAL' : serviceName}: ${error}`);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [credentials]);

  // Migrate legacy OAuth tokens from separate localStorage key to Zustand
  useEffect(() => {
    const migrateLegacyTokens = () => {
      try {
        // Migrate Tidal tokens
        const tidalTokensStr = localStorage.getItem('tidal_oauth_tokens');
        if (tidalTokensStr) {
          const legacyTokens = JSON.parse(tidalTokensStr);

          // Only migrate if we don't already have tokens in Zustand
          if (!musicCredentials.tidal?.accessToken && legacyTokens.access_token) {
            credentials.updateCredentials('tidal', {
              accessToken: legacyTokens.access_token,
              refreshToken: legacyTokens.refresh_token,
              expiresAt: legacyTokens.expires_at,
              isConnected: true,
              lastValidated: Date.now(),
            });

            // Clean up legacy storage after successful migration
            localStorage.removeItem('tidal_oauth_tokens');
          } else {
            localStorage.removeItem('tidal_oauth_tokens');
          }
        }

        // Migrate Spotify tokens
        const spotifyTokensStr = localStorage.getItem('spotify_oauth_tokens');
        if (spotifyTokensStr) {
          const legacyTokens = JSON.parse(spotifyTokensStr);

          // Only migrate if we don't already have tokens in Zustand
          if (!musicCredentials.spotify?.accessToken && legacyTokens.access_token) {
            credentials.updateCredentials('spotify', {
              accessToken: legacyTokens.access_token,
              refreshToken: legacyTokens.refresh_token,
              expiresAt: legacyTokens.expires_at,
              isConnected: true,
              lastValidated: Date.now(),
            });

            // Clean up legacy storage after successful migration
            localStorage.removeItem('spotify_oauth_tokens');
          } else {
            localStorage.removeItem('spotify_oauth_tokens');
          }
        }
      } catch (error) {
        console.error('Failed to migrate legacy tokens:', error);
      }
    };

    migrateLegacyTokens();
  }, [musicCredentials.tidal?.accessToken, musicCredentials.spotify?.accessToken, credentials]);

  // Handle credential updates
  const updateCredentials = (service: keyof MusicServiceCredentials, updates: any) => {
    credentials.updateCredentials(service, updates);
  };

  // Save credentials to localStorage
  const handleSave = () => {
    setSaveStatus('saving');
    try {
      credentials.saveCredentialsToStorage();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // Clear all credentials
  const handleClearAll = () => {
    credentials.clearCredentials();
    setSaveStatus('idle');
    setConfirmClear(false);
    showToast('Saved credentials cleared');
  };

  // Test connection function
  const testConnection = async (service: keyof MusicServiceCredentials) => {
    try {
      const isConnected = await credentials.testConnection(service);
      const name = service === 'tidal' ? 'TIDAL' : 'Spotify';
      if (isConnected) {
        setConnectError(null);
        showToast(`${name} connection works`);
      } else {
        setConnectError(`${name} didn’t accept the saved credentials. Connect again.`);
      }
    } catch (error) {
      setConnectError(`Couldn’t test the ${service} connection: ${error}`);
    }
  };

  const connectTidal = async () => {
                    try {
                      general.setLoading(true);
                      const REDIRECT_URI = oauthRedirectUri('/oauth/callback');

                      const initResponse = await fetch(
                        `${API_BASE_URL}/api/v1/music-auth/tidal/oauth/init`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ redirect_uri: REDIRECT_URI })
                        }
                      );

                      if (!initResponse.ok) {
                        const error = await initResponse.json().catch(() => ({ detail: 'Failed to initialize' }));
                        throw new Error(error.detail || 'Failed to initialize OAuth');
                      }

                      const authData = await initResponse.json();
                      window.location.href = authData.authorization_url;

                    } catch (err) {
                      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                      setConnectError(`Couldn’t start the TIDAL connection: ${errorMessage}`);
                      general.setLoading(false);
                    }
                  };

  const connectSpotify = () => {
                    console.log('[SettingsPanel] Spotify button clicked');
                    console.log('[SettingsPanel] Current Spotify credentials:', {
                      hasAccessToken: !!musicCredentials.spotify?.accessToken,
                      isConnected: musicCredentials.spotify?.isConnected,
                      expiresAt: musicCredentials.spotify?.expiresAt,
                      isExpired: isTokenExpired(musicCredentials.spotify?.expiresAt),
                      isSpotifyConnected
                    });

                    // Already connected: the button reads "Reconnect Spotify", so pressing it is the choice

                    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                      .map(b => b.toString(16).padStart(2, '0')).join('');
                    sessionStorage.setItem('spotify_auth_state', state);

                    const redirectUri = oauthRedirectUri('/callback/spotify');
                    const authorizeUrl = `${API_BASE_URL}/api/v1/music-auth/spotify/authorize?` + new URLSearchParams({
                      redirect_uri: redirectUri,
                      state: state
                    });

                    console.log('[SettingsPanel] Redirecting to Spotify OAuth:', authorizeUrl);
                    window.location.href = authorizeUrl;
                  };

  return (
    <>
      <Dialog
        open={isOpen}
        title="Music services"
        sub="Connect TIDAL and Spotify to send sets as playlists."
        onClose={onClose}
        footer={
          <>
            <button type="button" className="sn-btn sn-btn--quiet sn-dialog__foot-start" onClick={() => setConfirmClear(true)}>
              Clear saved credentials…
            </button>
            {saveStatus === 'saved' && <StatusPill raw="saved" label="Saved" />}
            {saveStatus === 'error' && <StatusPill raw="error" label="Not saved" />}
            <button type="button" className="sn-btn" onClick={onClose}>Close</button>
            <button type="button" className="sn-btn sn-btn--primary" onClick={handleSave} disabled={saveStatus === 'saving'} aria-busy={saveStatus === 'saving' || undefined}>
              {saveStatus === 'saving' ? 'Saving…' : 'Save settings'}
            </button>
          </>
        }
      >
        {connectError && (
          <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">{connectError}</p>
        )}

        <ul className="stp__services">
          <li className="stp__service">
            <div className="stp__service-main">
              <span className="stp__service-name">TIDAL</span>
              {isTidalConnected ? <StatusPill raw="ok" label="Connected" /> : <StatusPill raw="not_configured" label="Not connected" />}
            </div>
            <button type="button" className={`sn-btn sn-btn--sm${isTidalConnected ? '' : ' sn-service-status__btn--tidal'}`} onClick={connectTidal} disabled={isLoading}>
              {isTidalConnected ? 'Reconnect TIDAL' : 'Connect TIDAL'}
            </button>
          </li>
          <li className="stp__service">
            <div className="stp__service-main">
              <span className="stp__service-name">Spotify</span>
              {isSpotifyConnected ? <StatusPill raw="ok" label="Connected" /> : <StatusPill raw="not_configured" label="Not connected" />}
            </div>
            <button type="button" className={`sn-btn sn-btn--sm${isSpotifyConnected ? '' : ' sn-service-status__btn--spotify'}`} onClick={connectSpotify}>
              {isSpotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify'}
            </button>
          </li>
        </ul>

        <div className="stp__row">
          <div>
            <span className="stp__service-name">Scraper API keys</span>
            <p className="stp__help">Keys for the services the scrapers use.</p>
          </div>
          <button type="button" className="sn-btn sn-btn--sm" onClick={() => setShowAPIKeyManager(true)}>
            <KeyRound size={16} strokeWidth={2} aria-hidden="true" />
            Manage API keys
          </button>
        </div>

        <p className="sn-inline-message" data-status="info">
          Client secrets stay on the server; connections use OAuth 2.1 with PKCE. Access tokens are kept in this browser.
        </p>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        title="Clear saved credentials?"
        confirmLabel="Clear credentials"
        typedValue="clear"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClear(false)}
        facts={['TIDAL and Spotify disconnect in this browser.', 'Server-side client secrets are not touched.']}
      >
        This removes every saved token in this browser. You will need to connect each service again.
      </ConfirmDialog>

      {/* API Key Manager Modal */}
      <APIKeyManager
        isOpen={showAPIKeyManager}
        onClose={() => setShowAPIKeyManager(false)}
      />
    </>
  );
};

export default SettingsPanel;