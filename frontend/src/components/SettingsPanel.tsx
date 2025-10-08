import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { APIKeyManager } from './APIKeyManager';

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
        console.log('[SettingsPanel] ⚠️ Spotify token expired, clearing credentials');
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
        console.log('[SettingsPanel] ⚠️ Tidal token expired, clearing credentials');
        credentials.updateCredentials('tidal', {
          ...musicCredentials.tidal,
          isConnected: false,
          accessToken: undefined,
          refreshToken: undefined
        });
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log('[SettingsPanel] ✅ Cleared expired tokens');
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
        console.warn('[SettingsPanel] ❌ Ignoring message from untrusted origin:', event.origin);
        return;
      }

      const { type, tokens, error, service } = event.data;

      if (type === 'oauth-success' && tokens) {
        const serviceName = service || 'tidal'; // Default to tidal for backward compatibility
        console.log(`[SettingsPanel] ✅ OAuth success for ${serviceName}, storing credentials...`);

        // Store tokens in Zustand (which will auto-persist to localStorage)
        credentials.updateCredentials(serviceName, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_at,
          isConnected: true,
          lastValidated: Date.now(),
        });

        console.log(`[SettingsPanel] ✅ Stored ${serviceName} credentials in Zustand store`);

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);

        const displayName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
        alert(`✅ Successfully connected to ${displayName}!`);
      } else if (type === 'oauth-error') {
        const serviceName = service || 'music service';
        console.error(`[SettingsPanel] ❌ OAuth error for ${serviceName}:`, error);
        alert(`❌ Failed to connect to ${serviceName}: ${error}`);
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
    if (confirm('Are you sure you want to clear all saved credentials? This action cannot be undone.')) {
      credentials.clearCredentials();
      setSaveStatus('idle');
    }
  };

  // Test connection function
  const testConnection = async (service: keyof MusicServiceCredentials) => {
    try {
      const isConnected = await credentials.testConnection(service);
      if (isConnected) {
        alert(`✅ ${service.charAt(0).toUpperCase() + service.slice(1)} connection successful!`);
      } else {
        alert(`❌ ${service.charAt(0).toUpperCase() + service.slice(1)} connection failed. Please check your credentials.`);
      }
    } catch (error) {
      alert(`❌ Error testing ${service} connection: ${error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(5px)'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'hidden',
          color: '#FFFFFF'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            ⚙️ Music Service Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8E8E93',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content - Unified Music Services Page */}
        <div style={{ padding: '32px', maxHeight: '60vh', overflowY: 'auto' }}>
          <div>
              <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 600 }}>Connect Music Services</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#8E8E93' }}>
                  Click the buttons below to connect your music streaming accounts.
                  Credentials are securely managed by the backend.
                </p>
              </div>

              {/* Connection Status Banner */}
              <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Tidal Connection Status - Validated with expiration check */}
                {isTidalConnected && (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(29, 185, 84, 0.2)',
                    border: '1px solid rgba(29, 185, 84, 0.4)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '18px' }}>✅</span>
                    <span style={{ color: '#1DB954', fontWeight: 600 }}>Tidal Connected</span>
                  </div>
                )}

                {/* Spotify Connection Status - Validated with expiration check */}
                {isSpotifyConnected && (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(29, 185, 84, 0.2)',
                    border: '1px solid rgba(29, 185, 84, 0.4)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '18px' }}>✅</span>
                    <span style={{ color: '#1DB954', fontWeight: 600 }}>Spotify Connected</span>
                  </div>
                )}
              </div>

              {/* Service Connection Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Tidal Button */}
                <button
                  onClick={async () => {
                    try {
                      general.setLoading(true);
                      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';
                      const REDIRECT_URI = 'http://127.0.0.1:3006/oauth/callback';

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
                      alert(`Failed to connect to Tidal: ${errorMessage}`);
                      general.setLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '20px',
                    backgroundColor: isTidalConnected ? 'rgba(29, 185, 84, 0.8)' : '#000000',
                    border: '2px solid #FFFFFF',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: !isLoading ? 'pointer' : 'not-allowed',
                    opacity: !isLoading ? 1 : 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    transition: 'all 0.3s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.backgroundColor = isTidalConnected ? '#1DB954' : '#1A1A1A';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isTidalConnected ? 'rgba(29, 185, 84, 0.8)' : '#000000';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <span style={{ fontSize: '24px' }}>🎵</span>
                  {isTidalConnected ? 'TIDAL - CONNECTED ✓' : 'CONNECT TIDAL'}
                </button>

                {/* Spotify Button */}
                <button
                  onClick={() => {
                    console.log('[SettingsPanel] Spotify button clicked');
                    console.log('[SettingsPanel] Current Spotify credentials:', {
                      hasAccessToken: !!musicCredentials.spotify?.accessToken,
                      isConnected: musicCredentials.spotify?.isConnected,
                      expiresAt: musicCredentials.spotify?.expiresAt,
                      isExpired: isTokenExpired(musicCredentials.spotify?.expiresAt),
                      isSpotifyConnected
                    });

                    // If already connected with valid token, inform user
                    if (isSpotifyConnected) {
                      const reconnect = confirm(
                        'You are already connected to Spotify. Do you want to reconnect (this will refresh your access token)?'
                      );
                      if (!reconnect) {
                        console.log('[SettingsPanel] User cancelled Spotify reconnection');
                        return;
                      }
                      console.log('[SettingsPanel] User confirmed Spotify reconnection');
                    }

                    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                      .map(b => b.toString(16).padStart(2, '0')).join('');
                    sessionStorage.setItem('spotify_auth_state', state);

                    const redirectUri = 'http://127.0.0.1:3006/callback/spotify';
                    const authorizeUrl = `http://127.0.0.1:8082/api/v1/music-auth/spotify/authorize?` + new URLSearchParams({
                      redirect_uri: redirectUri,
                      state: state
                    });

                    console.log('[SettingsPanel] Redirecting to Spotify OAuth:', authorizeUrl);
                    window.location.href = authorizeUrl;
                  }}
                  style={{
                    width: '100%',
                    padding: '20px',
                    backgroundColor: isSpotifyConnected ? '#1ed760' : '#1DB954',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    transition: 'all 0.3s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1fdf64';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSpotifyConnected ? '#1ed760' : '#1DB954';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  {isSpotifyConnected ? 'SPOTIFY - CONNECTED ✓' : 'CONNECT SPOTIFY'}
                </button>
              </div>

              {/* API Keys Button */}
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  onClick={() => {
                    setShowAPIKeyManager(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: 'rgba(74, 144, 226, 0.2)',
                    border: '1px solid rgba(74, 144, 226, 0.4)',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 144, 226, 0.3)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(74, 144, 226, 0.2)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🔑</span>
                  MANAGE API KEYS
                </button>
              </div>

              {/* Info Note */}
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                border: '1px solid rgba(74, 144, 226, 0.3)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#8E8E93'
              }}>
                <strong style={{ color: '#4A90E2' }}>🔐 Secure OAuth:</strong> Your music service credentials are securely stored in the backend environment.
                Client secrets are never exposed to the browser. Each connection uses industry-standard OAuth 2.1 with PKCE for maximum security.
              </div>
            </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.3)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleClearAll}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px solid #F56565',
                borderRadius: '6px',
                color: '#F56565',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {saveStatus === 'saved' && (
              <span style={{ color: '#7ED321', fontSize: '14px' }}>✓ Saved</span>
            )}
            {saveStatus === 'error' && (
              <span style={{ color: '#F56565', fontSize: '14px' }}>✗ Error</span>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              style={{
                padding: '8px 16px',
                backgroundColor: '#7ED321',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '14px',
                cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                opacity: saveStatus === 'saving' ? 0.7 : 1
              }}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: 'rgba(245,101,101,0.1)',
            borderTop: '1px solid rgba(245,101,101,0.2)',
            fontSize: '12px',
            color: '#F56565'
          }}
        >
          🔒 <strong>Security Notice:</strong> Credentials are stored locally in your browser.
          For maximum security, consider using environment variables or a secure credential management service in production.
        </div>
      </div>

      {/* API Key Manager Modal */}
      <APIKeyManager
        isOpen={showAPIKeyManager}
        onClose={() => setShowAPIKeyManager(false)}
      />
    </div>
  );
};

export default SettingsPanel;