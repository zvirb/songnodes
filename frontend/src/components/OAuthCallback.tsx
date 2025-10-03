/**
 * OAuth Callback Handler for Music Service Authentication
 * Handles OAuth redirects from Tidal, Spotify, and other services
 * Dynamically routes to the correct backend endpoint based on URL path
 */

import React, { useEffect, useState, useRef } from 'react';

const OAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const [service, setService] = useState<'tidal' | 'spotify'>('tidal');

  // Prevent duplicate requests in React Strict Mode (development)
  const hasProcessed = useRef(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Guard against React Strict Mode double-rendering
      if (hasProcessed.current) {
        console.log('[OAuth] Skipping duplicate callback (React Strict Mode)');
        return;
      }
      hasProcessed.current = true;
      try {
        // Detect which service from URL path
        const pathname = window.location.pathname;
        const detectedService = pathname.includes('spotify') ? 'spotify' : 'tidal';
        setService(detectedService);

        const serviceName = detectedService.charAt(0).toUpperCase() + detectedService.slice(1);
        console.log(`[OAuth] Detected service: ${serviceName}`);

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
              service: detectedService,
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

        setMessage(`Exchanging authorization code for ${serviceName} access token...`);
        console.log(`[OAuth] Exchanging code for ${serviceName} tokens...`, { state: state.substring(0, 8) + '...' });

        // Exchange authorization code for tokens
        // SECURITY: Client secret handled entirely by backend, never exposed to frontend
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

        // Route to correct backend endpoint based on service
        const callbackEndpoint = detectedService === 'spotify'
          ? `${API_BASE_URL}/api/v1/music-auth/spotify/callback`
          : `${API_BASE_URL}/api/v1/music-auth/tidal/oauth/callback`;

        console.log(`[OAuth] Calling ${serviceName} callback endpoint:`, callbackEndpoint);

        const response = await fetch(
          `${callbackEndpoint}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
          {
            method: 'GET'
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          console.error('[OAuth] Token exchange failed:', errorData);

          // Provide user-friendly error messages
          let userMessage = errorData.detail || `HTTP ${response.status}`;
          if (userMessage.includes('Invalid or expired state')) {
            userMessage = 'OAuth session expired. This can happen if you took too long to authorize or if the backend restarted. Please try connecting again.';
          }
          throw new Error(userMessage);
        }

        const tokenData = await response.json();
        console.log('[OAuth] Token exchange successful:', {
          hasAccessToken: !!tokenData.access_token,
          hasRefreshToken: !!tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          scope: tokenData.scope
        });

        if (!tokenData.success || !tokenData.access_token) {
          throw new Error('Invalid token response from server');
        }

        setStatus('success');
        setMessage(`${serviceName} authentication successful! Closing window...`);

        // Store tokens in localStorage (temporary - should be in secure state)
        const tokens = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
          token_type: tokenData.token_type,
          scope: tokenData.scope
        };

        // Use service-specific storage key
        const storageKey = `${detectedService}_oauth_tokens`;
        localStorage.setItem(storageKey, JSON.stringify(tokens));
        console.log(`[OAuth] ${serviceName} tokens stored in localStorage as '${storageKey}'`);

        // Notify parent window (if opened as popup)
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            service: detectedService,
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
          {status === 'processing' && `Authenticating with ${service.charAt(0).toUpperCase() + service.slice(1)}`}
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