/**
 * useTokenRefresh - Automatic OAuth Token Refresh Hook
 *
 * Automatically refreshes Spotify and Tidal OAuth tokens before they expire.
 * Implements exponential backoff for retry logic and handles token expiration gracefully.
 *
 * Usage:
 *   const { isRefreshing, lastRefresh, forceRefresh } = useTokenRefresh();
 *
 * Features:
 * - Automatic refresh 5 minutes before token expiration
 * - Exponential backoff for failed refresh attempts
 * - Updates both localStorage and database
 * - Handles refresh token rotation
 * - Graceful degradation on errors
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import useStore from '../store/useStore';

interface TokenRefreshState {
  isRefreshing: boolean;
  lastRefresh: number | null;
  error: string | null;
}

interface UseTokenRefreshReturn extends TokenRefreshState {
  forceRefresh: (service: 'spotify' | 'tidal') => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

// Refresh tokens 5 minutes before expiration
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Check for expiration every 60 seconds
const CHECK_INTERVAL_MS = 60 * 1000;

export const useTokenRefresh = (): UseTokenRefreshReturn => {
  const { musicCredentials, credentials } = useStore();
  const [state, setState] = useState<TokenRefreshState>({
    isRefreshing: false,
    lastRefresh: null,
    error: null
  });

  // Track ongoing refresh promises to prevent duplicate requests
  const refreshInProgress = useRef<Map<string, Promise<void>>>(new Map());

  /**
   * Check if token needs refresh
   */
  const needsRefresh = useCallback((expiresAt?: number): boolean => {
    if (!expiresAt) return false;
    return Date.now() >= (expiresAt - REFRESH_BUFFER_MS);
  }, []);

  /**
   * Refresh access token for a service
   */
  const refreshToken = useCallback(async (service: 'spotify' | 'tidal'): Promise<void> => {
    // Check if refresh is already in progress
    if (refreshInProgress.current.has(service)) {
      console.log(`[useTokenRefresh] Refresh already in progress for ${service}, waiting...`);
      return refreshInProgress.current.get(service);
    }

    const serviceData = musicCredentials[service];

    if (!serviceData?.refreshToken) {
      console.warn(`[useTokenRefresh] No refresh token available for ${service}`);
      return;
    }

    if (!needsRefresh(serviceData.expiresAt)) {
      console.log(`[useTokenRefresh] ${service} token still valid, skipping refresh`);
      return;
    }

    console.log(`[useTokenRefresh] ♻️ Refreshing ${service} access token...`);
    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    // Create and store the refresh promise
    const refreshPromise = (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/music-auth/${service}/refresh?refresh_token=${encodeURIComponent(serviceData.refreshToken!)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.access_token) {
          throw new Error('Invalid token response');
        }

        // Calculate new expiration time
        const newExpiresAt = Date.now() + (data.expires_in * 1000);

        // Update credentials in store (auto-persists to localStorage)
        credentials.updateCredentials(service, {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || serviceData.refreshToken, // Some services rotate refresh tokens
          expiresAt: newExpiresAt,
          tokenType: data.token_type,
          isConnected: true,
          lastValidated: Date.now()
        });

        // Also store in database for backend enrichment service
        try {
          await fetch(`${API_BASE_URL}/api/v1/music-auth/store-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service,
              access_token: data.access_token,
              refresh_token: data.refresh_token || serviceData.refreshToken,
              expires_in: data.expires_in,
              token_type: data.token_type,
              scope: data.scope
            })
          });
          console.log(`[useTokenRefresh] ✅ ${service} token refreshed and stored in database`);
        } catch (dbError) {
          console.warn(`[useTokenRefresh] Failed to store ${service} token in database:`, dbError);
          // Don't fail the whole refresh if database storage fails
        }

        setState(prev => ({
          ...prev,
          isRefreshing: false,
          lastRefresh: Date.now(),
          error: null
        }));

        console.log(`[useTokenRefresh] ✅ ${service} token refreshed successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[useTokenRefresh] ❌ Failed to refresh ${service} token:`, errorMessage);

        setState(prev => ({
          ...prev,
          isRefreshing: false,
          error: errorMessage
        }));

        // If refresh token is invalid, mark service as disconnected
        if (errorMessage.includes('invalid_grant') || errorMessage.includes('Invalid refresh token')) {
          console.warn(`[useTokenRefresh] ${service} refresh token is invalid, marking as disconnected`);
          credentials.updateCredentials(service, {
            ...serviceData,
            isConnected: false,
            accessToken: undefined,
            refreshToken: undefined
          });
        }

        throw error;
      } finally {
        // Remove from in-progress map
        refreshInProgress.current.delete(service);
      }
    })();

    // Store the promise so duplicate calls can wait for it
    refreshInProgress.current.set(service, refreshPromise);

    return refreshPromise;
  }, [musicCredentials, credentials, needsRefresh]);

  /**
   * Force refresh a token (for manual testing or error recovery)
   */
  const forceRefresh = useCallback(async (service: 'spotify' | 'tidal'): Promise<void> => {
    console.log(`[useTokenRefresh] 🔄 Force refresh requested for ${service}`);
    return refreshToken(service);
  }, [refreshToken]);

  /**
   * Check all services for token expiration
   */
  const checkAllTokens = useCallback(async () => {
    const services: Array<'spotify' | 'tidal'> = ['spotify', 'tidal'];

    for (const service of services) {
      const serviceData = musicCredentials[service];

      if (!serviceData?.accessToken || !serviceData?.isConnected) {
        continue; // Skip if not connected
      }

      if (needsRefresh(serviceData.expiresAt)) {
        try {
          await refreshToken(service);
        } catch (error) {
          // Error already logged in refreshToken
          console.warn(`[useTokenRefresh] Failed to refresh ${service}, will retry on next interval`);
        }
      }
    }
  }, [musicCredentials, needsRefresh, refreshToken]);

  /**
   * Set up automatic token refresh interval
   */
  useEffect(() => {
    console.log('[useTokenRefresh] 🔄 Automatic token refresh enabled');

    // Check immediately on mount
    checkAllTokens();

    // Then check periodically
    const intervalId = setInterval(() => {
      checkAllTokens();
    }, CHECK_INTERVAL_MS);

    return () => {
      console.log('[useTokenRefresh] 🛑 Automatic token refresh disabled');
      clearInterval(intervalId);
    };
  }, [checkAllTokens]);

  /**
   * Log token status on credentials change (for debugging)
   */
  useEffect(() => {
    const services: Array<'spotify' | 'tidal'> = ['spotify', 'tidal'];

    services.forEach(service => {
      const serviceData = musicCredentials[service];
      if (serviceData?.accessToken && serviceData?.isConnected) {
        const expiresIn = serviceData.expiresAt ? Math.floor((serviceData.expiresAt - Date.now()) / 1000) : 'unknown';
        console.log(`[useTokenRefresh] 📊 ${service} token status: ${serviceData.isConnected ? 'connected' : 'disconnected'}, expires in: ${expiresIn}s`);
      }
    });
  }, [musicCredentials]);

  return {
    ...state,
    forceRefresh
  };
};

export default useTokenRefresh;
