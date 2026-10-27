/**
 * TrackItem Component
 * Standardized track item row according to TrackCell specs:
 * Album artwork thumb / fallback, artist - title, key pill, BPM tag,
 * duration, genre chips, and compatibility badges.
 */

import React, { useRef } from 'react';
import { Disc } from 'lucide-react';
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
  onSelect: (track: Track, multi?: boolean) => void;
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
      onSelect(track, e.ctrlKey || e.metaKey);
    }
  };

  const topReason = showReasons && reasons.length ? reasons[0].description : null;
  const length = formatDuration(track.duration);

  return (
    <div
      ref={itemRef}
      className={`${styles.row} ${isFocused ? styles.focused : ''}`}
      onClick={(e) => onSelect(track, e.ctrlKey || e.metaKey)}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      aria-label={`${track.artist} – ${track.name}, score ${score} of 100`}
      tabIndex={isFocused ? 0 : -1}
      style={style}
    >
      <div className={styles.rowMain}>
        <div className={styles.rowTitleRow}>
          <div className={styles.artworkThumb} aria-hidden="true">
            {(track as { artwork_url?: string }).artwork_url ? (
              <img
                src={(track as { artwork_url?: string }).artwork_url}
                alt=""
                className={styles.artworkImg}
              />
            ) : (
              <Disc size={18} strokeWidth={1.5} />
            )}
          </div>
          <span className={styles.trackTitleText} title={`${track.artist} – ${track.name}`}>
            <span className={styles.trackArtistText}>{track.artist} –</span> {track.name}
          </span>
        </div>

        <div className={styles.rowMetaRow}>
          {track.bpm ? <span className={styles.bpmTag}>{track.bpm} BPM</span> : null}
          {track.key ? <span className={styles.keyPill}>{track.key}</span> : null}
          {length !== '–' ? <span className={styles.durationTag}>{length}</span> : null}
          {track.genre ? <span className={styles.genreChip}>{track.genre}</span> : null}
          {topReason ? <span className="sn-track-cell__mix">{topReason}</span> : null}
        </div>
      </div>

      <div className={styles.rowBadges}>
        <CompatibilityBadge level={band.level} label={band.label} />
        <KeyCompat from={currentTrack?.key} to={track.key} outline />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
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
