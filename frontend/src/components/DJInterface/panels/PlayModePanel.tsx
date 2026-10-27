/**
 * PlayModePanel Component
 *
 * Simplified performance interface for live DJ sets.
 * Focuses on cognitive offloading and essential controls.
 *
 * @module DJInterface/panels/PlayModePanel
 */

import React from 'react';
import GraphVisualization from '../../GraphVisualization';
import { IntelligentBrowser } from '../../IntelligentBrowser';
import MobileTrackExplorer from '../../MobileTrackExplorer';
import { useIsMobile } from '../../../hooks/useIsMobile';
import type { PlayModePanelProps } from '../types';
import styles from '../DJInterface.module.css';

/**
 * PlayModePanel - Performance mode layout
 *
 * Layout:
 * - Graph visualization (left, full height)
 * - Intelligent browser with recommendations (right sidebar)
 * - Mobile: MobileTrackExplorer instead of graph
 *
 * Features:
 * - Minimal distractions
 * - AI-powered track recommendations
 * - Graph-based adjacency suggestions
 * - Touch-optimized for live performance
 *
 * @param props - PlayModePanelProps
 * @returns React component
 */
export function PlayModePanel({
  tracks,
  nowPlaying,
  onTrackSelect,
  onTrackRightClick,
  graphEdges,
  browserConfig = {
    maxRecommendations: 12,
    showReasons: true,
    groupBy: 'compatibility'
  }
}: PlayModePanelProps): React.ReactElement {
  const isMobile = useIsMobile();

  return (
    <div className={styles.playModeLayout}>
      {/* Graph Visualization */}
      <div className={styles.graphContainer}>
        {isMobile ? (
          <MobileTrackExplorer />
        ) : (
          <>
            <GraphVisualization
              onTrackSelect={onTrackSelect as any}
              onTrackRightClick={onTrackRightClick as any}
            />

            {/* Graph Legend Overlay */}
            <div className="sn-card" style={{
              position: 'absolute',
              bottom: 'var(--space-4)',
              left: 'var(--space-4)',
              zIndex: 'var(--z-sticky)',
              maxWidth: '260px'
            }}>
              <h4 className="label" style={{
                margin: '0 0 var(--space-2) 0',
                color: 'var(--fg-3)'
              }}>
                Node Legend
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1.5, 6px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'var(--status-ok)',
                    borderRadius: 'var(--radius-pill)',
                    flexShrink: 0
                  }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--fg)' }}>
                    Perfect Match
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'var(--status-fair)',
                    borderRadius: 'var(--radius-pill)',
                    flexShrink: 0
                  }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--fg)' }}>
                    Compatible
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'var(--brand)',
                    borderRadius: 'var(--radius-pill)',
                    flexShrink: 0
                  }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--fg)' }}>
                    Selected
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'var(--now)',
                    borderRadius: 'var(--radius-pill)',
                    flexShrink: 0
                  }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--fg)' }}>
                    Now Playing
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Intelligent Browser */}
      {!isMobile && (
        <div className={styles.browserContainer}>
          <IntelligentBrowser
            currentTrack={nowPlaying as any}
            allTracks={tracks as any}
            onTrackSelect={onTrackSelect as any}
            graphEdges={graphEdges}
            config={browserConfig}
          />
        </div>
      )}
    </div>
  );
}
