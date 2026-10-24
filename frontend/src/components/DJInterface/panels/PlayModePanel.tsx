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
    <div className={styles.playModeLayout} data-testid="play-mode-panel">
      {/* Graph Visualization */}
      <div className={styles.graphContainer} data-testid="graph-container">
        {isMobile ? (
          <MobileTrackExplorer />
        ) : (
          <>
            <GraphVisualization
              onTrackSelect={onTrackSelect as any}
              onTrackRightClick={onTrackRightClick as any}
            />

            {/* Graph Legend Overlay */}
            <div style={{
              position: 'absolute',
              bottom: 'var(--space-5)',
              left: 'var(--space-5)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-base)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backdropFilter: 'blur(10px)'
            }}>
              <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Node Colors
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-brand-primary)', borderRadius: '50%' }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Perfect Match</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-warning)', borderRadius: '50%' }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Compatible</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-brand-secondary)', borderRadius: '50%' }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Default</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Intelligent Browser */}
      {!isMobile && (
        <div className={styles.browserContainer} data-testid="browser-container">
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
