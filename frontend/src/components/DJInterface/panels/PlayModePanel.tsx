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
import { Card } from '@/components/ui';
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

            {/* Graph Legend Overlay using Card */}
            <Card className={styles.graphLegend}>
              <h4 className={styles.legendTitle}>
                Node Colors
              </h4>
              <div className={styles.legendList}>
                <div className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ backgroundColor: 'var(--color-success)' }} />
                  <span>Perfect Match</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ backgroundColor: 'var(--color-warning)' }} />
                  <span>Compatible</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ backgroundColor: 'var(--color-brand-secondary)' }} />
                  <span>Default</span>
                </div>
              </div>
            </Card>
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
