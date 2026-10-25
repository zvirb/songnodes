/**
 * DJModeSelector Component
 *
 * Toggle button for switching between PLAN and PLAY modes.
 * Follows the segmented control pattern for mutually exclusive options.
 *
 * @module DJInterface/DJModeSelector
 */

import React from 'react';
import { Play, ListChecks } from 'lucide-react';
import type { DJModeSelectorProps } from './types';
import styles from './DJInterface.module.css';

/**
 * DJModeSelector - Mode toggle segmented control
 *
 * Displays both PLAN and PLAY options simultaneously with
 * clear visual indication of the active mode.
 *
 * Accessibility:
 * - role="radiogroup" and role="radio"
 * - aria-checked indicates active mode
 * - Keyboard navigation supported (Tab, Space, Enter)
 *
 * @param props - DJModeSelectorProps
 * @returns React component
 */
export function DJModeSelector({ mode, onModeChange }: DJModeSelectorProps): React.ReactElement {
  return (
    <div className={styles.modeSelector} role="radiogroup" aria-label="Interface Mode">
      <button
        type="button"
        role="radio"
        onClick={() => mode !== 'play' && onModeChange('play')}
        aria-label="Switch to PLAY mode"
        aria-checked={mode === 'play'}
        className={`${styles.modeButton} ${mode === 'play' ? styles.modeButtonActive : ''}`}
        data-mode="play"
      >
        <Play size={16} strokeWidth={2} aria-hidden="true" />
        <span>PLAY</span>
      </button>

      <button
        type="button"
        role="radio"
        onClick={() => mode !== 'plan' && onModeChange('plan')}
        aria-label="Switch to PLAN mode"
        aria-checked={mode === 'plan'}
        className={`${styles.modeButton} ${mode === 'plan' ? styles.modeButtonActive : ''}`}
        data-mode="plan"
      >
        <ListChecks size={16} strokeWidth={2} aria-hidden="true" />
        <span>PLAN</span>
      </button>
    </div>
  );
}
