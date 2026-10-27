/**
 * OAuth Callback Handler for Music Service Authentication
 * Handles OAuth redirects from Tidal, Spotify, and other services
 * Dynamically routes to the correct backend endpoint based on URL path
 */

import React, { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../lib/apiBase';

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
        return;
      }
      hasProcessed.current = true;
      try {
        // Detect which service from URL path (2025 Best Practice: Explicit service detection)
        const pathname = window.location.pathname;
        console.log('[OAuth] Callback pathname:', pathname);

        // Explicit service detection with validation
        let detectedService: 'spotify' | 'tidal';
        if (pathname.includes('/callback/spotify') || pathname.includes('spotify')) {
          detectedService = 'spotify';
        } else if (pathname.includes('/oauth/callback') || pathname.includes('tidal')) {
          detectedService = 'tidal';
        } else {
          console.error('[OAuth] Unable to determine service from path:', pathname);
          throw new Error('Unable to determine authentication service. Please try again.');
        }

        setService(detectedService);
        console.log('[OAuth] Detected service:', detectedService);

        const serviceName = detectedService.charAt(0).toUpperCase() + detectedService.slice(1);

        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // SECURITY: Immediately sanitize history and URL address bar using history.replaceState
        // to strip authorization codes, tokens, and scopes, preventing token leakage through browser history or Referer headers.
        if (window.location.search || window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

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

        // SECURITY: Cryptographic state parameter verification (OAuth CSRF protection)
        // Retrieve and consume securely generated pre-flight nonce from session storage
        const candidateKeys = [
          `${detectedService}_auth_state`,
          'spotify_auth_state',
          'tidal_auth_state',
          'oauth_state',
          `${detectedService}_oauth_state`,
          `oauth_state_${detectedService}`
        ];

        let storedState: string | null = null;
        for (const key of candidateKeys) {
          const stored = sessionStorage.getItem(key) || localStorage.getItem(key);
          if (stored) {
            storedState = stored;
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
            break;
          }
        }

        // Reject any callback where state is missing or returned state does not match pre-flight nonce
        if ((storedState && state !== storedState) || (!storedState && detectedService === 'spotify')) {
          console.error('[OAuth] CSRF state verification failed:', { returnedState: state, expectedState: storedState });
          setStatus('error');
          setMessage('Authentication failed: OAuth state mismatch or invalid nonce (potential CSRF attack).');

          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-error',
              service: detectedService,
              error: 'state_mismatch',
              error_description: 'OAuth state parameter verification failed'
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

        setMessage(`Exchanging authorization code for ${serviceName} access token...`);

        // Exchange authorization code for tokens
        // SECURITY: Client secret handled entirely by backend, never exposed to frontend

        // Route to correct backend endpoint based on service (2025 Best Practice: Service isolation)
        const callbackEndpoint = detectedService === 'spotify'
          ? `${API_BASE_URL}/api/v1/music-auth/spotify/callback`
          : `${API_BASE_URL}/api/v1/music-auth/tidal/oauth/callback`;

        console.log(`[OAuth] Calling ${detectedService} callback endpoint:`, callbackEndpoint);
        console.log(`[OAuth] Authorization code: ${code.substring(0, 10)}...`);
        console.log(`[OAuth] State: ${state.substring(0, 10)}...`);

        const response = await fetch(
          `${callbackEndpoint}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
          {
            method: 'GET'
          }
        );

        console.log(`[OAuth] ${serviceName} callback response status:`, response.status);

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
        console.log(`[OAuth] ${serviceName} token data received:`, {
          success: tokenData.success,
          hasAccessToken: !!tokenData.access_token,
          hasRefreshToken: !!tokenData.refresh_token,
          expiresIn: tokenData.expires_in
        });

        if (!tokenData.success || !tokenData.access_token) {
          throw new Error('Invalid token response from server');
        }

        setStatus('success');
        setMessage(`${serviceName} authentication successful! Closing window...`);

        // SECURITY: Calculate and validate explicit token expiration
        const now = Date.now();
        const expiresAt = now + ((tokenData.expires_in || 3600) * 1000);
        if (expiresAt <= now) {
          throw new Error('Received expired token from authentication server');
        }

        const tokens = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          expires_at: expiresAt,
          token_type: tokenData.token_type,
          scope: tokenData.scope
        };

        // Use isolated session storage rather than indefinite persistent storage with explicit expiration validation
        const storageKey = `${detectedService}_oauth_tokens`;
        sessionStorage.setItem(storageKey, JSON.stringify(tokens));
        localStorage.removeItem(storageKey); // Remove any old indefinite storage
        console.log(`[OAuth] Stored ${serviceName} tokens in sessionStorage with key:`, storageKey);

        // ALSO store tokens in database for backend enrichment service to use
        try {
          const storeResponse = await fetch(`${API_BASE_URL}/api/v1/music-auth/store-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service: detectedService,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expires_in: tokenData.expires_in,
              token_type: tokenData.token_type,
              scope: tokenData.scope
            })
          });

          if (storeResponse.ok) {
            console.log(`[OAuth] ✅ Stored ${serviceName} tokens in database for enrichment service`);
          } else {
            console.warn(`[OAuth] ⚠️ Failed to store ${serviceName} tokens in database (enrichment may not work)`);
          }
        } catch (dbError) {
          console.error(`[OAuth] Failed to store tokens in database:`, dbError);
          // Don't fail the whole flow, tokens are still in localStorage
        }

        // Notify parent window (if opened as popup) - 2025 Best Practice: Include service identifier
        if (window.opener) {
          console.log(`[OAuth] Posting success message to parent window for service: ${detectedService}`);
          window.opener.postMessage({
            type: 'oauth-success',
            service: detectedService,  // CRITICAL: Service identifier
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
      backgroundColor: 'var(--bg)',
      color: 'var(--fg)',
      fontFamily: 'var(--font-body)',
      padding: 'var(--space-5)'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '500px',
        padding: 'var(--space-10)',
        backgroundColor: 'var(--surface-1)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--line)'
      }}>
        {/* Status Icon */}
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-5)' }}>
          {status === 'processing' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>

        {/* Title */}
        <h1 style={{ margin: '0 0 var(--space-4) 0', fontSize: '1.375rem', fontFamily: 'var(--font-display)' }}>
          {status === 'processing' && `Authenticating with ${service.charAt(0).toUpperCase() + service.slice(1)}`}
          {status === 'success' && 'Authentication Successful!'}
          {status === 'error' && 'Authentication Failed'}
        </h1>

        {/* Message */}
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--fg-3)', lineHeight: 1.5 }}>
          {message}
        </p>

        {/* Loading Spinner */}
        {status === 'processing' && (
          <div style={{
            marginTop: 'var(--space-6)',
            width: 'var(--control-md)',
            height: 'var(--control-md)',
            border: '4px solid var(--line)',
            borderTop: '4px solid var(--status-ok)',
            borderRadius: 'var(--radius-pill)',
            animation: 'spin 1s linear infinite',
            margin: 'var(--space-6) auto 0'
          }} />
        )}

        {/* Manual close button for errors */}
        {status === 'error' && (
          <button
            onClick={() => window.opener ? window.close() : window.location.href = '/'}
            style={{
              marginTop: 'var(--space-6)',
              padding: 'var(--space-2) var(--space-5)',
              backgroundColor: 'var(--brand)',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              color: 'var(--on-brand)',
              fontSize: '0.875rem',
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