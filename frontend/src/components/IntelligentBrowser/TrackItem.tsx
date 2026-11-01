/**
 * TrackItem Component
 * One recommendation row: artwork thumb, a design-system TrackCell
 * (`sn-track-cell`: "Artist – Title" on line one; BPM, key, duration, genre
 * and the top reason on line two, ellipsised) and the compatibility badges.
 */

import React, { useRef } from 'react';
import { Disc } from 'lucide-react';
import type { TrackRecommendation, Track } from './types';
import { scoreBand, formatDuration } from './utils';
import { Bpm, KeyBadge } from '../../lib/songnodes';
import { CompatibilityBadge, KeyCompat } from '../ds';
import styles from './IntelligentBrowser.module.css';

/**
 * Virtual row height in px: the TrackCell's two-line height (--row-two-line,
 * 56) plus --space-2 (8) above and below. The list positions rows absolutely
 * at this height, so the row content must fit inside it (IB1).
 */
export const TRACK_ROW_HEIGHT = 56 + 2 * 8;

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

      <div className={`sn-track-cell ${styles.rowMain}`}>
        <span className="sn-track-cell__title">
          <span className="sn-track-cell__name" title={`${track.artist} – ${track.name}`}>
            <span className="sn-track-cell__artist">{track.artist} –</span> {track.name}
          </span>
        </span>

        <span className="sn-track-cell__meta">
          {track.bpm ? <Bpm value={track.bpm} /> : null}
          {track.key ? <KeyBadge value={track.key} /> : null}
          {length !== '–' ? <span className="sn-track-cell__dur">{length}</span> : null}
          {track.genre ? <span className="sn-tag">{track.genre}</span> : null}
          {topReason ? (
            <>
              <span className="sn-track-cell__sep" aria-hidden="true">·</span>
              <span className="sn-track-cell__mix" title={topReason}>{topReason}</span>
            </>
          ) : null}
        </span>
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
