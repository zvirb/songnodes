/**
 * OAuth Callback Handler for Tidal Authentication
 * Handles the OAuth redirect from Tidal and exchanges authorization code for tokens
 */

import React, { useEffect, useState } from 'react';

const OAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Check for OAuth errors
        if (error) {
          setStatus('error');
          setMessage(`Authentication failed: ${errorDescription || error}`);

          // Notify parent window (if opened as popup)
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-error',
              error: error,
              error_description: errorDescription
            }, window.location.origin);
          }

          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              window.location.href = '/';
            }
          }, 3000);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setStatus('error');
          setMessage('Missing required OAuth parameters');
          setTimeout(() => window.location.href = '/', 3000);
          return;
        }

        // Get client secret from localStorage (stored during OAuth init)
        const clientSecret = localStorage.getItem('tidal_client_secret');
        if (!clientSecret) {
          setStatus('error');
          setMessage('Client secret not found. Please reconnect from Settings.');
          setTimeout(() => window.location.href = '/', 3000);
          return;
        }

        setMessage('Exchanging authorization code for access token...');

        // Exchange authorization code for tokens
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';
        const response = await fetch(
          `${API_BASE_URL}/api/v1/music-auth/tidal/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&client_secret=${encodeURIComponent(clientSecret)}`,
          {
            method: 'GET'
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const tokenData = await response.json();

        if (!tokenData.success || !tokenData.access_token) {
          throw new Error('Invalid token response from server');
        }

        setStatus('success');
        setMessage('Authentication successful! Closing window...');

        // Store tokens in localStorage (temporary - should be in secure state)
        const tokens = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
          token_type: tokenData.token_type,
          scope: tokenData.scope
        };

        localStorage.setItem('tidal_oauth_tokens', JSON.stringify(tokens));

        // Clean up client secret
        localStorage.removeItem('tidal_client_secret');

        // Notify parent window (if opened as popup)
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            tokens: tokens
          }, window.location.origin);

          // Close popup after short delay
          setTimeout(() => window.close(), 1500);
        } else {
          // Redirect to main app if not a popup
          setTimeout(() => window.location.href = '/', 1500);
        }

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Notify parent window of error
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            error: error instanceof Error ? error.message : 'Unknown error'
          }, window.location.origin);
        }

        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            window.location.href = '/';
          }
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '500px',
        padding: '40px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Status Icon */}
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>
          {status === 'processing' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>

        {/* Title */}
        <h1 style={{ margin: '0 0 16px 0', fontSize: '24px' }}>
          {status === 'processing' && 'Authenticating with Tidal'}
          {status === 'success' && 'Authentication Successful!'}
          {status === 'error' && 'Authentication Failed'}
        </h1>

        {/* Message */}
        <p style={{ margin: 0, fontSize: '16px', color: '#8E8E93', lineHeight: 1.5 }}>
          {message}
        </p>

        {/* Loading Spinner */}
        {status === 'processing' && (
          <div style={{
            marginTop: '24px',
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTop: '4px solid #1DB954',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '24px auto 0'
          }} />
        )}

        {/* Manual close button for errors */}
        {status === 'error' && (
          <button
            onClick={() => window.opener ? window.close() : window.location.href = '/'}
            style={{
              marginTop: '24px',
              padding: '10px 20px',
              backgroundColor: '#4A90E2',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Close Window
          </button>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default OAuthCallback;