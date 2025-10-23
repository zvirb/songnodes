/**
 * useOnboarding Hook
 *
 * Manages onboarding overlay visibility and persistence state.
 * Uses localStorage to remember if user has permanently dismissed the overlay.
 *
 * @module DJInterface/hooks/useOnboarding
 */

import { useState, useEffect, useCallback } from 'react';
import type { OnboardingState } from '../types';

/**
 * localStorage key for persisting onboarding dismissal
 */
const ONBOARDING_STORAGE_KEY = 'songnodes-onboarding-dismissed';

/**
 * Custom hook for managing onboarding overlay state
 *
 * Features:
 * - Auto-shows onboarding on first visit
 * - Persists dismissal preference in localStorage
 * - Provides temporary hide (closes overlay without persisting)
 * - Provides permanent dismiss (closes overlay and saves preference)
 * - Safe fallbacks for SSR and localStorage errors
 *
 * Behavior:
 * - First visit: Onboarding shown automatically
 * - User clicks "Don't show again": Permanently dismissed
 * - User clicks "Close" or "Dismiss": Temporarily hidden (shows on next visit)
 * - User clicks "Quick Tour" button: Re-opens onboarding
 *
 * @returns OnboardingState object with visibility state and control functions
 *
 * @example
 * ```typescript
 * function DJInterface() {
 *   const onboarding = useOnboarding();
 *
 *   return (
 *     <>
 *       <button onClick={onboarding.show}>Quick Tour</button>
 *
 *       {onboarding.isShown && (
 *         <OnboardingOverlay
 *           onClose={onboarding.hide}
 *           onDisable={onboarding.dismiss}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useOnboarding(): OnboardingState {
  const [isShown, setIsShown] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  /**
   * Initialize onboarding state from localStorage on mount
   */
  useEffect(() => {
    // Skip on server-side rendering
    if (typeof window === 'undefined') return;

    try {
      const dismissed = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
      setIsDismissed(dismissed);

      // Show onboarding if not permanently dismissed
      if (!dismissed) {
        setIsShown(true);
      }
    } catch (error) {
      console.warn('[useOnboarding] Unable to read onboarding preference:', error);
      // Fail gracefully: Show onboarding if localStorage unavailable
      setIsShown(true);
    }
  }, []);

  /**
   * Show the onboarding overlay
   *
   * Can be called even if permanently dismissed (e.g., "Quick Tour" button)
   */
  const show = useCallback(() => {
    setIsShown(true);
  }, []);

  /**
   * Hide the onboarding overlay temporarily
   *
   * Does not persist preference. Onboarding will show again on next visit.
   */
  const hide = useCallback(() => {
    setIsShown(false);
  }, []);

  /**
   * Permanently dismiss the onboarding overlay
   *
   * Saves preference to localStorage and prevents auto-showing on future visits.
   */
  const dismiss = useCallback(() => {
    setIsShown(false);
    setIsDismissed(true);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      } catch (error) {
        console.warn('[useOnboarding] Unable to persist onboarding preference:', error);
      }
    }
  }, []);

  return {
    isShown,
    isDismissed,
    show,
    hide,
    dismiss,
  };
}
