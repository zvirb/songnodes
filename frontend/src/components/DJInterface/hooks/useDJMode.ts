/**
 * useDJMode Hook
 *
 * Manages the dual-mode state (PLAN vs PLAY) for the DJ interface.
 * Provides simple state management with helper methods for mode switching.
 *
 * @module DJInterface/hooks/useDJMode
 */

import { useState, useCallback } from 'react';
import type { DJMode } from '../../../types/dj';
import type { DJModeState } from '../types';

/**
 * Custom hook for managing DJ interface mode (PLAN/PLAY)
 *
 * PLAN Mode: Full-featured preparation interface
 * - Library browser with search
 * - Track analysis panels
 * - Playlist managers (Tidal, Spotify)
 * - Pathfinder for track discovery
 * - Key/Mood visualization
 *
 * PLAY Mode: Simplified performance interface
 * - Now playing deck
 * - Intelligent browser with recommendations
 * - Cognitive offloading for live sets
 * - Minimal distractions
 *
 * @param initialMode - Initial mode to start in
 * @returns DJModeState object with current mode and mode control functions
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { mode, toggleMode, isPlanMode } = useDJMode('play');
 *
 *   return (
 *     <div>
 *       <button onClick={toggleMode}>
 *         Switch to {isPlanMode ? 'PLAY' : 'PLAN'}
 *       </button>
 *       {isPlanMode ? <PlanModePanel /> : <PlayModePanel />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDJMode(initialMode: DJMode = 'play'): DJModeState {
  const [mode, setMode] = useState<DJMode>(initialMode);

  /**
   * Toggle between PLAN and PLAY modes
   */
  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'PLAN' ? 'play' : 'PLAN');
  }, []);

  /**
   * Explicitly set mode to PLAN
   */
  const setToPlan = useCallback(() => {
    setMode('PLAN');
  }, []);

  /**
   * Explicitly set mode to PLAY
   */
  const setToPlay = useCallback(() => {
    setMode('play');
  }, []);

  return {
    mode,
    toggleMode,
    setToPlan,
    setToPlay,
    isPlanMode: mode === 'PLAN',
    isPlayMode: mode === 'play',
  };
}
