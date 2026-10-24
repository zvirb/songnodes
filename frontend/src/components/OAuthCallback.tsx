/**
 * OAuth Callback Handler for Music Service Authentication
 * Handles OAuth redirects from Tidal, Spotify, and other services
 * Dynamically routes to the correct backend endpoint based on URL path
 */

import React, { useEffect, useState, useRef } from 'react';
import { Button } from './ui/Button';

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

        // Exchange authorization code for tokens
        // SECURITY: Client secret handled entirely by backend, never exposed to frontend
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

        // Route to correct backend endpoint based on service (2025 Best Practice: Service isolation)
        const callbackEndpoint = detectedService === 'spotify'
          ? `${API_BASE_URL}/api/v1/music-auth/spotify/callback`
          : `${API_BASE_URL}/api/v1/music-auth/tidal/oauth/callback`;

        console.log(`[OAuth] Calling ${detectedService} callback endpoint:`, callbackEndpoint);

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

          let userMessage = errorData.detail || `HTTP ${response.status}`;
          if (userMessage.includes('Invalid or expired state')) {
            userMessage = 'OAuth session expired. This can happen if you took too long to authorize or if the backend restarted. Please try connecting again.';
          }
          throw new Error(userMessage);
        }

        const tokenData = await response.json();

        if (!tokenData.success || !tokenData.access_token) {
          throw new Error('Invalid token response from server');
        }

        setStatus('success');
        setMessage(`${serviceName} authentication successful! Closing window...`);

        // Store tokens in localStorage
        const tokens = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
          token_type: tokenData.token_type,
          scope: tokenData.scope
        };

        const storageKey = `${detectedService}_oauth_tokens`;
        localStorage.setItem(storageKey, JSON.stringify(tokens));

        // ALSO store tokens in database for backend enrichment service to use
        try {
          await fetch(`${API_BASE_URL}/api/v1/music-auth/store-token`, {
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
        } catch (dbError) {
          console.error(`[OAuth] Failed to store tokens in database:`, dbError);
        }

        // Notify parent window (if opened as popup)
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            service: detectedService,
            tokens: tokens
          }, window.location.origin);

          setTimeout(() => window.close(), 1500);
        } else {
          setTimeout(() => window.location.href = '/', 1500);
        }

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

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
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg-primary,#121212)] p-6 text-[var(--color-text-primary,#ffffff)] font-sans">
      <div className="flex w-full max-w-md flex-col items-center rounded-[var(--radius-modal,16px)] border border-[var(--color-border-subtle,rgba(255,255,255,0.1))] bg-[var(--color-bg-secondary,#1a1a1a)] p-8 text-center shadow-[var(--shadow-modal)]">
        {/* Status Icon */}
        <div className="mb-4 text-5xl">
          {status === 'processing' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>

        {/* Title */}
        <h1 className="mb-2 text-xl font-bold text-[var(--color-text-primary)]">
          {status === 'processing' && `Authenticating with ${service.charAt(0).toUpperCase() + service.slice(1)}`}
          {status === 'success' && 'Authentication Successful!'}
          {status === 'error' && 'Authentication Failed'}
        </h1>

        {/* Message */}
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {message}
        </p>

        {/* Loading Spinner */}
        {status === 'processing' && (
          <div className="mt-6 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border-subtle)] border-t-[var(--color-brand-primary)]" />
        )}

        {/* Manual close button for errors */}
        {status === 'error' && (
          <div className="mt-6">
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.opener ? window.close() : window.location.href = '/'}
            >
              Close Window
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
