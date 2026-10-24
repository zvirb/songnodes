/**
 * TrackItem Component
 * One suggestion: design-system TrackCell, key verdict (CompatibilityBadge via
 * SN.compat) and the score band.
 */

import React, { useRef } from 'react';
import type { TrackRecommendation, Track } from './types';
import { scoreBand, formatDuration } from './utils';
import { CompatibilityBadge, KeyCompat } from '../ds';
import styles from './IntelligentBrowser.module.css';

interface TrackItemProps {
  recommendation: TrackRecommendation;
  currentTrack: Track;
  isSelected: boolean;
  isFocused: boolean;
  showReasons: boolean;
  onSelect: (track: Track) => void;
  onPreview?: (track: Track) => void;
  style?: React.CSSProperties;
}

export const TrackItem = React.memo<TrackItemProps>(({
  recommendation,
  currentTrack,
  isSelected,
  isFocused,
  showReasons,
  onSelect,
  style
}) => {
  const { track, score, reasons } = recommendation;
  const itemRef = useRef<HTMLDivElement>(null);
  const band = scoreBand(score);

  // Auto-scroll to focused item
  React.useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(track);
    }
  };

  const topReason = showReasons && reasons.length ? reasons[0].description : null;
  const length = formatDuration(track.duration);

  return (
    <div
      ref={itemRef}
      className={`${styles.row} ${isFocused ? styles.focused : ''}`}
      onClick={() => onSelect(track)}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      aria-label={`${track.artist} – ${track.name}, score ${score} of 100`}
      tabIndex={isFocused ? 0 : -1}
      style={style}
    >
      <div className={`sn-track-cell ${styles.rowMain}`}>
        <span className="sn-track-cell__title">
          <span className="sn-track-cell__name" title={`${track.artist} – ${track.name}`}>
            <span className="sn-track-cell__artist">{track.artist} –</span> {track.name}
          </span>
        </span>
        <span className="sn-track-cell__meta">
          {topReason ? <span className="sn-track-cell__mix">{topReason}</span> : null}
          {topReason && length !== '–' ? <span className="sn-track-cell__sep" aria-hidden="true">·</span> : null}
          {length !== '–' ? <span className="sn-track-cell__dur">{length}</span> : null}
        </span>
      </div>
      <div className={styles.rowBadges}>
        <CompatibilityBadge level={band.level} label={band.label} />
        <KeyCompat from={currentTrack?.key} to={track.key} outline />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Optimize re-renders by comparing only relevant props
  return (
    prevProps.recommendation.track.id === nextProps.recommendation.track.id &&
    prevProps.recommendation.score === nextProps.recommendation.score &&
    prevProps.currentTrack?.id === nextProps.currentTrack?.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.showReasons === nextProps.showReasons &&
    prevProps.style?.transform === nextProps.style?.transform
  );
});

TrackItem.displayName = 'TrackItem';
