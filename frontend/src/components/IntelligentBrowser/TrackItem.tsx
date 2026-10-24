/**
 * TrackItem Component
 * Individual track recommendation with accessibility features
 */

import React, { useRef } from 'react';
import type { TrackRecommendation, Track } from './types';
import { getScoreColor } from './utils';
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
  onPreview,
  style
}) => {
  const { track, score, reasons, compatibility } = recommendation;
  const itemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to focused item
  React.useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  const handleClick = () => {
    onSelect(track);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(track);
    }
  };

  const scoreColor = getScoreColor(score);

  return (
    <div
      ref={itemRef}
      className={`${styles.trackItem} ${isSelected ? styles.selected : ''} ${isFocused ? styles.focused : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      aria-label={`${track.name} by ${track.artist}, score ${score}`}
      tabIndex={isFocused ? 0 : -1}
      style={style}
      data-testid={`track-item-${track.id}`}
    >
      {/* Score Badge */}
      <div
        className={styles.scoreBadge}
        style={{
          backgroundColor: `${scoreColor}20`,
          borderColor: scoreColor,
          color: scoreColor
        }}
        aria-label={`Compatibility score ${score} out of 100`}
        data-testid={`score-badge-${track.id}`}
      >
        {score}
      </div>

      {/* Track Info - ONLY artist and title */}
      <div className={styles.trackInfo}>
        <h4 className={styles.trackName}>{track.name}</h4>
        <p className={styles.trackArtist}>{track.artist}</p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Optimize re-renders by comparing only relevant props
  return (
    prevProps.recommendation.track.id === nextProps.recommendation.track.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.showReasons === nextProps.showReasons
  );
});

TrackItem.displayName = 'TrackItem';
