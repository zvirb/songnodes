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
import { Button, Badge } from '@/components/ui';
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
          <Music size={24} aria-hidden="true" />
          SongNodes DJ
        </h1>

        <DJModeSelector mode={mode} onModeChange={onModeChange} />
      </div>

      <div className={styles.headerRight}>
        <Badge variant="default" size="md">
          {trackCount} Tracks
        </Badge>

        <Badge variant="success" size="md">
          {connectionCount} Connections
        </Badge>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<Wand2 size={16} aria-hidden="true" />}
          onClick={onOpenArtistAttribution}
          className="border-[var(--color-brand-tertiary-muted)] text-[var(--color-brand-tertiary)] hover:bg-[var(--color-brand-tertiary-muted)]"
          aria-label="Fix artist attribution for unknown tracks"
        >
          Fix Attribution
        </Button>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<FileUp size={16} aria-hidden="true" />}
          onClick={onOpenTracklistImporter}
          aria-label="Import tracklist from text or file"
        >
          Import
        </Button>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<Filter size={16} aria-hidden="true" />}
          onClick={onOpenGraphFilters}
          aria-label="Configure graph visualization filters"
        >
          Filters
        </Button>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<SettingsIcon size={16} aria-hidden="true" />}
          onClick={onOpenSettings}
          aria-label="Open application settings"
        >
          Settings
        </Button>

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<HelpCircle size={18} aria-hidden="true" />}
          onClick={onOpenOnboarding}
          title={onboardingTooltip}
          aria-label={onboardingTooltip}
        >
          Guide
        </Button>
      </div>
    </header>
  );
}
