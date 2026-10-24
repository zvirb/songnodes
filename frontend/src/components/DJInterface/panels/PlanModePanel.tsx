/**
 * PlanModePanel Component
 *
 * Full-featured preparation interface for track selection and setlist building.
 * Three-column layout with library, graph, and analysis panels.
 *
 * @module DJInterface/panels/PlanModePanel
 */

import React, { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import GraphVisualization from '../../GraphVisualization';
import MobileTrackExplorer from '../../MobileTrackExplorer';
import { PathfinderPanel } from '../../PathfinderPanel';
import { KeyMoodPanel } from '../../KeyMoodPanel';
import TargetTracksManager from '../../TargetTracksManager';
import { TidalPlaylistManager } from '../../TidalPlaylistManager';
import { SpotifyPlaylistManager } from '../../SpotifyPlaylistManager';
import { Input, Button, Card } from '@/components/ui';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { searchTracks } from '../utils/trackTransformers';
import type { PlanModePanelProps } from '../types';
import styles from '../DJInterface.module.css';

/**
 * PlanModePanel - Preparation mode layout
 *
 * Layout:
 * - Left: Library browser with search (280px)
 * - Center: Graph visualization (flexible)
 * - Right: Tabbed panel for analysis tools (380px)
 *
 * Right Panel Tabs:
 * - Track Analysis: Now playing track details
 * - Key & Mood: Camelot wheel visualization
 * - Pathfinder: Find paths between tracks
 * - Tidal: Playlist management
 * - Spotify: Playlist management
 * - Targets: Target tracks for scraping
 *
 * @param props - PlanModePanelProps
 * @returns React component
 */
export function PlanModePanel({
  tracks,
  nowPlaying,
  onTrackSelect,
  onTrackRightClick,
  librarySearchQuery,
  onSearchQueryChange,
  rightPanelTab,
  onRightPanelTabChange,
}: PlanModePanelProps): React.ReactElement {
  const isMobile = useIsMobile();

  // Filtered tracks based on search query
  const filteredTracks = useMemo(() => {
    return searchTracks(tracks, librarySearchQuery);
  }, [tracks, librarySearchQuery]);

  return (
    <div className={styles.planModeLayout}>
      {/* Left: Library Browser */}
      <div className={styles.libraryPanel}>
        <h3 className={styles.libraryHeader}>Library</h3>

        {/* Search Input using Design System Input */}
        <div className={styles.searchContainer}>
          <Input
            value={librarySearchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search tracks, artists, BPM, key..."
            leftIcon={<Search size={16} aria-hidden="true" />}
            rightIcon={
              librarySearchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1"
                  aria-label="Clear search"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : undefined
            }
            aria-label="Search library"
            inputSize="sm"
          />
        </div>

        {/* Results Counter */}
        {librarySearchQuery && (
          <div className="text-xs text-[var(--color-text-tertiary)] mb-2 px-1">
            {filteredTracks.length} of {tracks.length} tracks
          </div>
        )}

        {/* Track List */}
        <div className={styles.trackList}>
          {filteredTracks.length === 0 ? (
            <div className="text-center text-[var(--color-text-tertiary)] py-12 px-4">
              {librarySearchQuery ? (
                <>
                  <div className="text-4xl mb-3 opacity-50">🔍</div>
                  <div className="font-semibold mb-1 text-[var(--color-text-secondary)]">No tracks found</div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">Try a different search term</div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3 opacity-50">📚</div>
                  <div className="text-[var(--color-text-secondary)]">No tracks in library</div>
                </>
              )}
            </div>
          ) : (
            filteredTracks.map(track => {
              const isActive = nowPlaying?.id === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onTrackSelect(track)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (onTrackRightClick) {
                      onTrackRightClick(track, { x: e.clientX, y: e.clientY });
                    }
                  }}
                  className={`${styles.trackItem} ${isActive ? styles.trackItemActive : ''}`}
                >
                  <div className={styles.trackItemTitle}>
                    {track.name}
                  </div>
                  <div className={styles.trackItemMeta}>
                    {track.artist}
                    {track.bpm && <> • {track.bpm} BPM</>}
                    {track.key && <> • {track.key}</>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Center: Graph Visualization */}
      <div className={styles.graphContainer}>
        {isMobile ? (
          <MobileTrackExplorer />
        ) : (
          <GraphVisualization
            onTrackSelect={onTrackSelect as any}
            onTrackRightClick={onTrackRightClick as any}
          />
        )}
      </div>

      {/* Right: Tabbed Analysis Panel */}
      <div className={styles.rightPanel}>
        {/* Tab Header */}
        <div className={styles.tabHeader} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'analysis'}
            onClick={() => onRightPanelTabChange('analysis')}
            className={`${styles.tabButton} ${rightPanelTab === 'analysis' ? styles.tabButtonActive : ''}`}
          >
            Track Analysis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'keymood'}
            onClick={() => onRightPanelTabChange('keymood')}
            className={`${styles.tabButton} ${rightPanelTab === 'keymood' ? styles.tabButtonActive : ''}`}
          >
            🎭 Key & Mood
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'pathfinder'}
            onClick={() => onRightPanelTabChange('pathfinder')}
            className={`${styles.tabButton} ${rightPanelTab === 'pathfinder' ? styles.tabButtonActive : ''}`}
          >
            🗺️ Pathfinder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'tidal'}
            onClick={() => onRightPanelTabChange('tidal')}
            className={`${styles.tabButton} ${rightPanelTab === 'tidal' ? styles.tabButtonActive : ''}`}
          >
            🎵 Tidal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'spotify'}
            onClick={() => onRightPanelTabChange('spotify')}
            className={`${styles.tabButton} ${rightPanelTab === 'spotify' ? styles.tabButtonActive : ''}`}
          >
            🎧 Spotify
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'targets'}
            onClick={() => onRightPanelTabChange('targets')}
            className={`${styles.tabButton} ${rightPanelTab === 'targets' ? styles.tabButtonActive : ''}`}
          >
            🎯 Targets
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {rightPanelTab === 'analysis' && (
            <div>
              <h3 className="text-base font-semibold mb-4 text-[var(--color-text-primary)]">Track Analysis</h3>
              {nowPlaying ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                      {nowPlaying.name}
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {nowPlaying.artist}
                    </p>
                  </div>

                  <div className={styles.analysisGrid}>
                    <Card variant="default" className={styles.analysisMetricCard}>
                      <div className={styles.metricLabel}>BPM</div>
                      <div className={styles.metricValue}>{nowPlaying.bpm || '---'}</div>
                    </Card>
                    <Card variant="default" className={styles.analysisMetricCard}>
                      <div className={styles.metricLabel}>KEY</div>
                      <div className={styles.metricValue}>{nowPlaying.key || '---'}</div>
                    </Card>
                  </div>

                  {nowPlaying.energy !== undefined && (
                    <div>
                      <div className={styles.metricLabel}>ENERGY</div>
                      <div className="flex gap-1 h-5 mt-1">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm ${
                              i < nowPlaying.energy!
                                ? 'bg-[var(--color-brand-primary)]'
                                : 'bg-[var(--color-bg-elevated-3)]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <Button variant="primary" fullWidth className="mt-2">
                    Analyze Full Track
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Select a track to view analysis
                </p>
              )}
            </div>
          )}

          {rightPanelTab === 'keymood' && (
            <KeyMoodPanel showInSidePanel={true} className="h-full" />
          )}

          {rightPanelTab === 'pathfinder' && <PathfinderPanel />}
          {rightPanelTab === 'tidal' && <TidalPlaylistManager />}
          {rightPanelTab === 'spotify' && <SpotifyPlaylistManager />}
          {rightPanelTab === 'targets' && <TargetTracksManager />}
        </div>
      </div>
    </div>
  );
}
