/**
 * DJModeSelector Component
 *
 * Toggle button for switching between PLAN and PLAY modes.
 * Follows the segmented control pattern for mutually exclusive options.
 *
 * @module DJInterface/DJModeSelector
 */

import React from 'react';
import type { DJModeSelectorProps } from './types';
import styles from './DJInterface.module.css';

/**
 * DJModeSelector - Mode toggle segmented control
 *
 * Displays both PLAN and PLAY options simultaneously with
 * clear visual indication of the active mode.
 *
 * Accessibility:
 * - aria-pressed indicates active mode
 * - aria-label describes each button's purpose
 * - Keyboard navigation supported (Tab, Space, Enter)
 *
 * @param props - DJModeSelectorProps
 * @returns React component
 *
 * @example
 * ```tsx
 * <DJModeSelector
 *   mode="play"
 *   onModeChange={(mode) => console.log('Mode:', mode)}
 * />
 * ```
 */
export function DJModeSelector({ mode, onModeChange }: DJModeSelectorProps): React.ReactElement {
  const handlePlayClick = () => {
    if (mode !== 'play') {
      onModeChange('play');
    }
  };

  const handlePlanClick = () => {
    if (mode !== 'PLAN') {
      onModeChange('PLAN');
    }
  };

  return (
    <div className={styles.modeSelector}>
      <button
        onClick={handlePlayClick}
        aria-label="Switch to PLAY mode"
        aria-pressed={mode === 'play'}
        className={`${styles.modeButton} ${mode === 'play' ? styles.modeButtonActive : ''}`}
        data-mode="play"
      >
        ▶️ PLAY
      </button>

      <button
        onClick={handlePlanClick}
        aria-label="Switch to PLAN mode"
        aria-pressed={mode === 'PLAN'}
        className={`${styles.modeButton} ${mode === 'PLAN' ? styles.modeButtonActive : ''}`}
        data-mode="plan"
      >
        📋 PLAN
      </button>
    </div>
  );
}
