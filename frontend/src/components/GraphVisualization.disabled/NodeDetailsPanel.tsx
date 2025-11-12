/**
 * NodeDetailsPanel Component
 * Displays metadata for selected nodes
 *
 * Features:
 * - Single and multi-select support
 * - Scrollable for large selections
 * - Track metadata display (artist, title, BPM, key, energy)
 * - Click to zoom to node
 * - Keyboard shortcuts (Escape to close)
 * - Accessible (ARIA labels, keyboard navigation)
 *
 * Layout:
 * - Fixed position left side
 * - Scrollable content area
 * - Close button
 * - Compact design
 */

import React, { useEffect } from 'react';
import { X, Music, Activity, Hash, Circle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { GraphNode } from './types';
import styles from './NodeDetailsPanel.module.css';

/* ============================================
   TYPES
   ============================================ */

interface NodeDetailsPanelProps {
  /** Selected nodes to display */
  nodes: GraphNode[];

  /** Close handler */
  onClose: () => void;

  /** Node click handler (zoom to node) */
  onNodeClick?: (nodeId: string) => void;

  /** Custom CSS class */
  className?: string;
}

/* ============================================
   HELPER COMPONENTS
   ============================================ */

/**
 * Track Info Row Component
 */
interface TrackInfoRowProps {
  node: GraphNode;
  onClick?: () => void;
}

function TrackInfoRow({ node, onClick }: TrackInfoRowProps) {
  const { track } = node;

  return (
    <div
      className={styles.trackRow}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={`${track.artist_name} - ${track.title}`}
    >
      {/* Artist & Title */}
      <div className={styles.trackInfo}>
        <div className={styles.artist}>
          <Music size={14} className={styles.icon} />
          {track.artist_name}
        </div>
        <div className={styles.title}>{track.title}</div>
      </div>

      {/* Metadata Badges */}
      <div className={styles.metadata}>
        {track.bpm && (
          <Badge variant="outline" title="Beats per minute">
            <Activity size={12} />
            {Math.round(track.bpm)} BPM
          </Badge>
        )}
        {track.key && (
          <Badge variant="outline" title="Musical key">
            <Hash size={12} />
            {track.key}
          </Badge>
        )}
        {track.energy !== undefined && (
          <Badge
            variant={
              track.energy > 0.7 ? 'success' : track.energy > 0.4 ? 'warning' : 'secondary'
            }
            title="Energy level"
          >
            <Circle size={12} />
            {(track.energy * 100).toFixed(0)}%
          </Badge>
        )}
      </div>

      {/* Additional Metadata (if available) */}
      {(track.genre || track.album || track.release_date) && (
        <div className={styles.additionalInfo}>
          {track.genre && (
            <span className={styles.infoItem} title="Genre">
              Genre: {track.genre}
            </span>
          )}
          {track.album && (
            <span className={styles.infoItem} title="Album">
              Album: {track.album}
            </span>
          )}
          {track.release_date && (
            <span className={styles.infoItem} title="Release date">
              Released: {new Date(track.release_date).getFullYear()}
            </span>
          )}
        </div>
      )}

      {/* Graph Metrics */}
      {(node.degree || node.betweenness || node.clustering) && (
        <div className={styles.graphMetrics}>
          {node.degree && (
            <span className={styles.metric} title="Number of connections">
              Degree: {node.degree}
            </span>
          )}
          {node.betweenness !== undefined && (
            <span className={styles.metric} title="Betweenness centrality">
              Betweenness: {node.betweenness.toFixed(3)}
            </span>
          )}
          {node.clustering !== undefined && (
            <span className={styles.metric} title="Clustering coefficient">
              Clustering: {node.clustering.toFixed(3)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

/**
 * NodeDetailsPanel Component
 * Displays selected node metadata
 */
export function NodeDetailsPanel({
  nodes,
  onClose,
  onNodeClick,
  className,
}: NodeDetailsPanelProps) {
  /* ============================================
     KEYBOARD SHORTCUTS
     ============================================ */

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  /* ============================================
     RENDER
     ============================================ */

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div
      className={`${styles.panel} ${className || ''}`}
      role="complementary"
      aria-label="Selected nodes details"
    >
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          {nodes.length === 1
            ? 'Track Details'
            : `${nodes.length} Track${nodes.length !== 1 ? 's' : ''} Selected`}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel (Escape)"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {nodes.map((node) => (
          <TrackInfoRow
            key={node.id}
            node={node}
            onClick={onNodeClick ? () => onNodeClick(node.id) : undefined}
          />
        ))}
      </div>

      {/* Footer (if many selected) */}
      {nodes.length > 10 && (
        <div className={styles.footer}>
          <p className={styles.hint}>
            Showing {nodes.length} track{nodes.length !== 1 ? 's' : ''}. Click a track to zoom to
            it.
          </p>
        </div>
      )}
    </div>
  );
}
