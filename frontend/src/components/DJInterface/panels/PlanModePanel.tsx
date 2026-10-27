/**
 * PlanModePanel Component
 *
 * Full-featured preparation interface for track selection and setlist building.
 * Three-column layout with library, graph, and analysis panels.
 *
 * @module DJInterface/panels/PlanModePanel
 */

import React, { useMemo } from 'react';
import {
  Search, X, Library, SearchX, BarChart2, Disc, Route, Radio, Headphones, Target,
} from 'lucide-react';
import GraphVisualization from '../../GraphVisualization';
import MobileTrackExplorer from '../../MobileTrackExplorer';
import { PathfinderPanel } from '../../PathfinderPanel';
import { KeyMoodPanel } from '../../KeyMoodPanel';
import TargetTracksManager from '../../TargetTracksManager';
import { TidalPlaylistManager } from '../../TidalPlaylistManager';
import { SpotifyPlaylistManager } from '../../SpotifyPlaylistManager';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { searchTracks } from '../utils/trackTransformers';
import { Bpm, KeyBadge } from '../../../lib/songnodes';
import { TrackEnergy } from '../../ds';
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
        <h2 className={styles.libraryHeader}>Library</h2>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
          <input
            type="search"
            placeholder="Search tracks, artists, BPM, key..."
            value={librarySearchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className={styles.searchInput}
            aria-label="Search library"
          />
          <Search
            size={16}
            strokeWidth={2}
            style={{
              position: 'absolute',
              left: 'var(--space-2)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--fg-3)',
              pointerEvents: 'none'
            }}
            aria-hidden="true"
          />
          {librarySearchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              style={{
                position: 'absolute',
                right: 'var(--space-2)',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--fg-3)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Clear search"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Results Counter */}
        {librarySearchQuery && (
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            color: 'var(--fg-3)',
            marginBottom: 'var(--space-2)'
          }}>
            <span className="data">
              {filteredTracks.length}
            </span> of <span className="data">
              {tracks.length}
            </span> tracks
          </div>
        )}

        {/* Track List */}
        <div className={styles.trackList}>
          {filteredTracks.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: 'var(--fg-3)',
              padding: 'var(--space-8) var(--space-4)',
              fontFamily: 'var(--font-body)'
            }}>
              {librarySearchQuery ? (
                <>
                  <SearchX size={36} strokeWidth={1.5} style={{ margin: '0 auto var(--space-3)', color: 'var(--fg-3)' }} aria-hidden="true" />
                  <div className="body-strong" style={{ color: 'var(--fg)', marginBottom: 'var(--space-1)' }}>No tracks found</div>
                  <div className="caption" style={{ color: 'var(--fg-3)' }}>Try a different search term</div>
                </>
              ) : (
                <>
                  <Library size={36} strokeWidth={1.5} style={{ margin: '0 auto var(--space-3)', color: 'var(--fg-3)' }} aria-hidden="true" />
                  <div className="body-strong" style={{ color: 'var(--fg)' }}>No tracks in library</div>
                </>
              )}
            </div>
          ) : (
            filteredTracks.map(track => {
              const isNowPlaying = nowPlaying?.id === track.id;
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
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: isNowPlaying ? 'var(--surface-2)' : 'transparent',
                    border: '1px solid var(--line)',
                    boxShadow: isNowPlaying ? 'inset 3px 0 0 var(--now)' : 'none',
                    borderRadius: 'var(--radius-control)',
                    color: 'var(--fg)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background var(--duration-fast) var(--ease-standard)',
                    minHeight: '52px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    width: '100%'
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    lineHeight: 1.3,
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {track.name}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    color: 'var(--fg-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      {track.artist}
                    </span>
                    {track.bpm ? <Bpm value={track.bpm} /> : null}
                    {track.key || track.camelotKey ? <KeyBadge value={track.camelotKey || track.key} /> : null}
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
        <div className={styles.tabHeader} role="tablist" aria-label="Plan tools">
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'analysis'}
            onClick={() => onRightPanelTabChange('analysis')}
            className={`${styles.tabButton} ${rightPanelTab === 'analysis' ? styles.tabButtonActive : ''}`}
          >
            <BarChart2 size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} aria-hidden="true" />
            Track Analysis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'keymood'}
            onClick={() => onRightPanelTabChange('keymood')}
            className={`${styles.tabButton} ${rightPanelTab === 'keymood' ? styles.tabButtonActive : ''}`}
          >
            <Disc size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} aria-hidden="true" />
            Key & Mood
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'pathfinder'}
            onClick={() => onRightPanelTabChange('pathfinder')}
            className={`${styles.tabButton} ${rightPanelTab === 'pathfinder' ? styles.tabButtonActive : ''}`}
          >
            <Route size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} aria-hidden="true" />
            Pathfinder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'tidal'}
            onClick={() => onRightPanelTabChange('tidal')}
            className={`${styles.tabButton} ${rightPanelTab === 'tidal' ? styles.tabButtonActive : ''}`}
          >
            <Radio size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} aria-hidden="true" />
            Tidal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'spotify'}
            onClick={() => onRightPanelTabChange('spotify')}
            className={`${styles.tabButton} ${rightPanelTab === 'spotify' ? styles.tabButtonActive : ''}`}
          >
            <Headphones size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} aria-hidden="true" />
            Spotify
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === 'targets'}
            onClick={() => onRightPanelTabChange('targets')}
            className={`${styles.tabButton} ${rightPanelTab === 'targets' ? styles.tabButtonActive : ''}`}
          >
            <Target size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} aria-hidden="true" />
            Targets
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {rightPanelTab === 'analysis' && (
            <>
              <h3 style={{
                margin: '0 0 var(--space-4) 0',
                fontFamily: 'var(--font-display)',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--fg)'
              }}>
                Track Analysis
              </h3>
              {nowPlaying ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <h4 style={{
                      margin: '0 0 var(--space-1) 0',
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--fg)'
                    }}>
                      {nowPlaying.name}
                    </h4>
                    <p style={{
                      margin: 0,
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      color: 'var(--fg-2)'
                    }}>
                      {nowPlaying.artist}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--surface-2)',
                      borderRadius: 'var(--radius-control)',
                      border: '1px solid var(--line)'
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--fg-3)',
                        marginBottom: 'var(--space-1)'
                      }}>
                        BPM
                      </div>
                      <Bpm value={nowPlaying.bpm} />
                    </div>

                    <div style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--surface-2)',
                      borderRadius: 'var(--radius-control)',
                      border: '1px solid var(--line)'
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--fg-3)',
                        marginBottom: 'var(--space-1)'
                      }}>
                        KEY
                      </div>
                      <KeyBadge value={nowPlaying.camelotKey || nowPlaying.key} withName />
                    </div>
                  </div>

                  <div style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: 'var(--radius-control)',
                    border: '1px solid var(--line)'
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--fg-3)',
                      marginBottom: 'var(--space-1)'
                    }}>
                      ENERGY
                    </div>
                    <TrackEnergy energy={nowPlaying.energy} scale={(nowPlaying as { energy_scale?: string }).energy_scale} />
                  </div>
                </div>
              ) : (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--fg-3)',
                  fontSize: '0.875rem'
                }}>
                  Select a track to view analysis
                </p>
              )}
            </>
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
