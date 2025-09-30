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
    username: string;
    password: string;
    rememberMe: boolean;
    isConnected?: boolean;
    lastValidated?: number;
  };
  spotify?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  appleMusic?: {
    keyId: string;
    teamId: string;
    privateKey: string;
    token?: string;
    expiresAt?: number;
  };
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { musicCredentials, credentials, isLoading } = useStore();
  const [activeTab, setActiveTab] = useState<'tidal' | 'spotify' | 'apple' | 'apikeys'>('tidal');
  const [showAPIKeyManager, setShowAPIKeyManager] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.3)'
          }}
        >
          {[
            { key: 'tidal', label: '🎵 Tidal', color: '#1DB954' },
            { key: 'spotify', label: '🎶 Spotify', color: '#1DB954' },
            { key: 'apple', label: '🍎 Apple Music', color: '#FA243C' },
            { key: 'apikeys', label: '🔑 API Keys', color: '#4A90E2' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                if (tab.key === 'apikeys') {
                  setShowAPIKeyManager(true);
                  onClose();
                }
              }}
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none',
                color: activeTab === tab.key ? '#FFFFFF' : '#8E8E93',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Tidal Settings */}
          {activeTab === 'tidal' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Tidal Account</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#8E8E93' }}>
                  Enter your Tidal credentials to enable playlist creation and track availability checking.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                    Username or Email
                  </label>
                  <input
                    type="text"
                    value={musicCredentials.tidal?.username || ''}
                    onChange={(e) => updateCredentials('tidal', { username: e.target.value })}
                    placeholder="Enter your Tidal username or email"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={musicCredentials.tidal?.password || ''}
                      onChange={(e) => updateCredentials('tidal', { password: e.target.value })}
                      placeholder="Enter your Tidal password"
                      style={{
                        width: '100%',
                        padding: '12px',
                        paddingRight: '40px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#8E8E93',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {showPasswords ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="tidal-remember"
                    checked={musicCredentials.tidal?.rememberMe || false}
                    onChange={(e) => updateCredentials('tidal', { rememberMe: e.target.checked })}
                    style={{ marginRight: '4px' }}
                  />
                  <label htmlFor="tidal-remember" style={{ fontSize: '14px', color: '#8E8E93' }}>
                    Keep me logged in
                  </label>
                </div>

                <button
                  onClick={() => testConnection('tidal')}
                  disabled={!musicCredentials.tidal?.username || !musicCredentials.tidal?.password || isLoading}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: musicCredentials.tidal?.username && musicCredentials.tidal?.password ? '#4A90E2' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    cursor: musicCredentials.tidal?.username && musicCredentials.tidal?.password && !isLoading ? 'pointer' : 'not-allowed',
                    opacity: musicCredentials.tidal?.username && musicCredentials.tidal?.password && !isLoading ? 1 : 0.5
                  }}
                >
                  🔍 Test Connection
                </button>
              </div>
            </div>
          )}

          {/* Spotify Settings */}
          {activeTab === 'spotify' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Spotify API</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#8E8E93' }}>
                  Configure Spotify API credentials for playlist management and track lookups.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={musicCredentials.spotify?.clientId || ''}
                    onChange={(e) => updateCredentials('spotify', { clientId: e.target.value })}
                    placeholder="Your Spotify Client ID"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                    Client Secret
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={musicCredentials.spotify?.clientSecret || ''}
                    onChange={(e) => updateCredentials('spotify', { clientSecret: e.target.value })}
                    placeholder="Your Spotify Client Secret"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Apple Music Settings */}
          {activeTab === 'apple' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Apple Music API</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#8E8E93' }}>
                  Configure Apple Music API credentials for catalog access and playlist management.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                    Key ID
                  </label>
                  <input
                    type="text"
                    value={musicCredentials.appleMusic?.keyId || ''}
                    onChange={(e) => updateCredentials('appleMusic', { keyId: e.target.value })}
                    placeholder="Your Apple Music Key ID"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                    Team ID
                  </label>
                  <input
                    type="text"
                    value={musicCredentials.appleMusic?.teamId || ''}
                    onChange={(e) => updateCredentials('appleMusic', { teamId: e.target.value })}
                    placeholder="Your Apple Developer Team ID"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                    Private Key
                  </label>
                  <textarea
                    value={musicCredentials.appleMusic?.privateKey || ''}
                    onChange={(e) => updateCredentials('appleMusic', { privateKey: e.target.value })}
                    placeholder="-----BEGIN PRIVATE KEY-----..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
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