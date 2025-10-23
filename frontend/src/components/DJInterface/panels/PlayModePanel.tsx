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
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              padding: '12px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#8E8E93' }}>
                Node Colors
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#7ED321', borderRadius: '50%' }} />
                  <span style={{ fontSize: '11px', color: '#F8F8F8' }}>Perfect Match</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#F5A623', borderRadius: '50%' }} />
                  <span style={{ fontSize: '11px', color: '#F8F8F8' }}>Compatible</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#4A90E2', borderRadius: '50%' }} />
                  <span style={{ fontSize: '11px', color: '#F8F8F8' }}>Default</span>
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
