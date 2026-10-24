/**
 * PlanModePanel Component
 *
 * Full-featured preparation interface for track selection and setlist building.
 * Three-column layout with library, graph, and analysis panels.
 *
 * @module DJInterface/panels/PlanModePanel
 */

import React, { useMemo } from 'react';
import GraphVisualization from '../../GraphVisualization';
import MobileTrackExplorer from '../../MobileTrackExplorer';
import { PathfinderPanel } from '../../PathfinderPanel';
import { KeyMoodPanel } from '../../KeyMoodPanel';
import TargetTracksManager from '../../TargetTracksManager';
import { TidalPlaylistManager } from '../../TidalPlaylistManager';
import { SpotifyPlaylistManager } from '../../SpotifyPlaylistManager';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { searchTracks } from '../utils/trackTransformers';
import type { PlanModePanelProps } from '../types';
import styles from '../DJInterface.module.css';

/**
 * PlanModePanel - Preparation mode layout
 *
 * Layout:
 * - Left: Library browser with search (250px)
 * - Center: Graph visualization (flexible)
 * - Right: Tabbed panel for analysis tools (350px)
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
  selectedTrack,
  nowPlaying,
  onTrackSelect,
  onTrackRightClick,
  graphEdges,
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
    <div className={styles.planModeLayout} data-testid="plan-mode-panel">
      {/* Left: Library Browser */}
      <div className={styles.libraryPanel}>
        <h3 className={styles.libraryHeader}>Library</h3>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
          <input
            type="text"
            data-testid="track-search-input"
            placeholder="🔍 Search tracks, artists, BPM, key..."
            value={librarySearchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className={styles.searchInput}
            aria-label="Search library"
          />
          {librarySearchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              data-testid="clear-search-button"
              style={{
                position: 'absolute',
                right: 'var(--space-2)',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                fontSize: 'var(--font-size-base)',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results Counter */}
        {librarySearchQuery && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
            {filteredTracks.length} of {tracks.length} tracks
          </div>
        )}

        {/* Track List */}
        <div className={styles.trackList}>
          {filteredTracks.length === 0 ? (
            <div
              data-testid="no-search-results"
              style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-10) var(--space-5)' }}
            >
              {librarySearchQuery ? (
                <>
                  <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-4)', opacity: 0.5 }}>🔍</div>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>No tracks found</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>Try a different search term</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-4)', opacity: 0.5 }}>📚</div>
                  <div>No tracks in library</div>
                </>
              )}
            </div>
          ) : (
            filteredTracks.map(track => (
              <button
                key={track.id}
                data-testid="track-item"
                onClick={() => onTrackSelect(track)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (onTrackRightClick) {
                    onTrackRightClick(track, { x: e.clientX, y: e.clientY });
                  }
                }}
                aria-label={`${track.name} by ${track.artist}`}
                aria-current={nowPlaying?.id === track.id ? 'true' : undefined}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: nowPlaying?.id === track.id ? 'var(--color-brand-primary-muted)' : 'transparent',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-base)',
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'var(--transition-button)',
                  minHeight: 'var(--touch-target-min)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  width: '100%'
                }}
              >
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.name}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.artist}
                  {track.bpm && <> • {track.bpm} BPM</>}
                  {track.key && <> • {track.key}</>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Center: Graph Visualization */}
      <div className={styles.graphContainer} data-testid="graph-container">
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
      <div className={styles.rightPanel} data-testid="right-panel">
        {/* Tab Header */}
        <div className={styles.tabHeader} role="tablist" aria-label="Analysis Panels">
          <button
            onClick={() => onRightPanelTabChange('analysis')}
            data-testid="right-panel-tab-analysis"
            role="tab"
            aria-selected={rightPanelTab === 'analysis'}
            className={`${styles.tabButton} ${rightPanelTab === 'analysis' ? styles.tabButtonActive : ''}`}
          >
            Track Analysis
          </button>
          <button
            onClick={() => onRightPanelTabChange('keymood')}
            data-testid="right-panel-tab-keymood"
            role="tab"
            aria-selected={rightPanelTab === 'keymood'}
            className={`${styles.tabButton} ${rightPanelTab === 'keymood' ? styles.tabButtonActive : ''}`}
          >
            🎭 Key & Mood
          </button>
          <button
            onClick={() => onRightPanelTabChange('pathfinder')}
            data-testid="right-panel-tab-pathfinder"
            role="tab"
            aria-selected={rightPanelTab === 'pathfinder'}
            className={`${styles.tabButton} ${rightPanelTab === 'pathfinder' ? styles.tabButtonActive : ''}`}
          >
            🗺️ Pathfinder
          </button>
          <button
            onClick={() => onRightPanelTabChange('tidal')}
            data-testid="right-panel-tab-tidal"
            role="tab"
            aria-selected={rightPanelTab === 'tidal'}
            className={`${styles.tabButton} ${rightPanelTab === 'tidal' ? styles.tabButtonActive : ''}`}
          >
            🎵 Tidal
          </button>
          <button
            onClick={() => onRightPanelTabChange('spotify')}
            data-testid="right-panel-tab-spotify"
            role="tab"
            aria-selected={rightPanelTab === 'spotify'}
            className={`${styles.tabButton} ${rightPanelTab === 'spotify' ? styles.tabButtonActive : ''}`}
          >
            🎧 Spotify
          </button>
          <button
            onClick={() => onRightPanelTabChange('targets')}
            data-testid="right-panel-tab-targets"
            role="tab"
            aria-selected={rightPanelTab === 'targets'}
            className={`${styles.tabButton} ${rightPanelTab === 'targets' ? styles.tabButtonActive : ''}`}
          >
            🎯 Targets
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {rightPanelTab === 'analysis' && (
            <div data-testid="analysis-panel">
              <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--font-size-base)' }}>Track Analysis</h3>
              {nowPlaying ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
                      {nowPlaying.name}
                    </h4>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
                      {nowPlaying.artist}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-elevated-1)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>BPM</div>
                      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>{nowPlaying.bpm || '---'}</div>
                    </div>
                    <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-elevated-1)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>KEY</div>
                      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>{nowPlaying.key || '---'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                  Select a track to view analysis
                </p>
              )}
            </div>
          )}

          {rightPanelTab === 'keymood' && (
            <div data-testid="key-mood-panel">
              <KeyMoodPanel showInSidePanel={true} className="h-full" />
            </div>
          )}

          {rightPanelTab === 'pathfinder' && (
            <div data-testid="pathfinder-panel">
              <PathfinderPanel />
            </div>
          )}
          {rightPanelTab === 'tidal' && (
            <div data-testid="tidal-panel">
              <TidalPlaylistManager />
            </div>
          )}
          {rightPanelTab === 'spotify' && (
            <div data-testid="spotify-panel">
              <SpotifyPlaylistManager />
            </div>
          )}
          {rightPanelTab === 'targets' && (
            <div data-testid="targets-panel">
              <TargetTracksManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
