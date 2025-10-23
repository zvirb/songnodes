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
    <div className={styles.planModeLayout}>
      {/* Left: Library Browser */}
      <div className={styles.libraryPanel}>
        <h3 className={styles.libraryHeader}>Library</h3>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="🔍 Search tracks, artists, BPM, key..."
            value={librarySearchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className={styles.searchInput}
            aria-label="Search library"
          />
          {librarySearchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#8E8E93',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '16px'
              }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results Counter */}
        {librarySearchQuery && (
          <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '8px' }}>
            {filteredTracks.length} of {tracks.length} tracks
          </div>
        )}

        {/* Track List */}
        <div className={styles.trackList}>
          {filteredTracks.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8E8E93', padding: '60px 20px' }}>
              {librarySearchQuery ? (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>No tracks found</div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>Try a different search term</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📚</div>
                  <div>No tracks in library</div>
                </>
              )}
            </div>
          ) : (
            filteredTracks.map(track => (
              <button
                key={track.id}
                onClick={() => onTrackSelect(track)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (onTrackRightClick) {
                    onTrackRightClick(track, { x: e.clientX, y: e.clientY });
                  }
                }}
                style={{
                  padding: '8px 10px',
                  backgroundColor: nowPlaying?.id === track.id ? 'rgba(126,211,33,0.2)' : 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#F8F8F8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minHeight: '52px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  width: '100%'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <div className={styles.tabHeader}>
          <button
            onClick={() => onRightPanelTabChange('analysis')}
            className={`${styles.tabButton} ${rightPanelTab === 'analysis' ? styles.tabButtonActive : ''}`}
          >
            Track Analysis
          </button>
          <button
            onClick={() => onRightPanelTabChange('keymood')}
            className={`${styles.tabButton} ${rightPanelTab === 'keymood' ? styles.tabButtonActive : ''}`}
          >
            🎭 Key & Mood
          </button>
          <button
            onClick={() => onRightPanelTabChange('pathfinder')}
            className={`${styles.tabButton} ${rightPanelTab === 'pathfinder' ? styles.tabButtonActive : ''}`}
          >
            🗺️ Pathfinder
          </button>
          <button
            onClick={() => onRightPanelTabChange('tidal')}
            className={`${styles.tabButton} ${rightPanelTab === 'tidal' ? styles.tabButtonActive : ''}`}
          >
            🎵 Tidal
          </button>
          <button
            onClick={() => onRightPanelTabChange('spotify')}
            className={`${styles.tabButton} ${rightPanelTab === 'spotify' ? styles.tabButtonActive : ''}`}
          >
            🎧 Spotify
          </button>
          <button
            onClick={() => onRightPanelTabChange('targets')}
            className={`${styles.tabButton} ${rightPanelTab === 'targets' ? styles.tabButtonActive : ''}`}
          >
            🎯 Targets
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {rightPanelTab === 'analysis' && (
            <>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Track Analysis</h3>
              {nowPlaying ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#F8F8F8' }}>
                      {nowPlaying.name}
                    </h4>
                    <p style={{ margin: 0, fontSize: '14px', color: '#8E8E93' }}>
                      {nowPlaying.artist}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '4px' }}>BPM</div>
                      <div style={{ fontSize: '20px', fontWeight: 700 }}>{nowPlaying.bpm || '---'}</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '4px' }}>KEY</div>
                      <div style={{ fontSize: '20px', fontWeight: 700 }}>{nowPlaying.key || '---'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#8E8E93', fontSize: '14px' }}>
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
