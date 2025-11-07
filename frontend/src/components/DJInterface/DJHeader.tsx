/**
 * DJHeader Component
 *
 * Header bar with mode toggle, stats, and action buttons.
 * Provides navigation and quick access to key features.
 *
 * @module DJInterface/DJHeader
 */

import React from 'react';
import { HelpCircle, Wand2, FileUp, Filter, Settings as SettingsIcon, Music } from 'lucide-react';
import { DJModeSelector } from './DJModeSelector';
import type { DJHeaderProps } from './types';
import styles from './DJInterface.module.css';

/**
 * DJHeader - Main navigation and control bar
 *
 * Features:
 * - App title with gradient effect
 * - Mode selector (PLAN/PLAY toggle)
 * - Track and connection count badges
 * - Quick action buttons (Artist Attribution, Tracklist Import, etc.)
 * - Settings and onboarding access
 *
 * @param props - DJHeaderProps
 * @returns React component
 */
export function DJHeader({
  mode,
  onModeChange,
  trackCount,
  connectionCount,
  onOpenArtistAttribution,
  onOpenTracklistImporter,
  onOpenGraphFilters,
  onOpenSettings,
  onOpenOnboarding,
  onboardingDismissed,
}: DJHeaderProps): React.ReactElement {
  const onboardingTooltip = onboardingDismissed
    ? 'Open the orientation guide again'
    : 'Show a quick orientation guide';

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.headerTitle}>
          <Music size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} aria-hidden="true" />
          SongNodes DJ
        </h1>

        <DJModeSelector mode={mode} onModeChange={onModeChange} />
      </div>

      <div className={styles.headerRight}>
        <span className={styles.statBadge}>
          {trackCount} Tracks Loaded
        </span>

        <span className={`${styles.statBadge} ${styles.success}`}>
          {connectionCount} Connections
        </span>

        <button
          onClick={onOpenArtistAttribution}
          className={`${styles.headerButton} ${styles.danger}`}
          aria-label="Fix artist attribution for unknown tracks"
        >
          <Wand2 size={16} strokeWidth={2} aria-hidden="true" />
          Fix Artist Attribution
        </button>

        <button
          onClick={onOpenTracklistImporter}
          className={`${styles.headerButton} ${styles.info}`}
          aria-label="Import tracklist from text or file"
        >
          <FileUp size={16} strokeWidth={2} aria-hidden="true" />
          Import Tracklist
        </button>

        <button
          onClick={onOpenGraphFilters}
          className={styles.headerButton}
          aria-label="Configure graph visualization filters"
        >
          <Filter size={16} strokeWidth={2} aria-hidden="true" />
          Graph Filters
        </button>

        <button
          onClick={onOpenSettings}
          className={styles.headerButton}
          aria-label="Open application settings"
        >
          <SettingsIcon size={16} strokeWidth={2} aria-hidden="true" />
          Settings
        </button>

        <button
          onClick={onOpenOnboarding}
          className={styles.headerButton}
          title={onboardingTooltip}
          aria-label={onboardingTooltip}
        >
          <HelpCircle size={18} strokeWidth={1.8} />
          Quick Tour
        </button>
      </div>
    </header>
  );
}
