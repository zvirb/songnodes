import React from 'react';
import { CamelotKey } from '../types/dj';
import { SN, KeyBadge } from '../lib/songnodes';
import { KeyCompat } from './ds';

/**
 * HarmonicCompatibility: key verdict between two tracks as a design-system
 * CompatibilityBadge (glyph + words), from SN.compat on standard Camelot codes.
 * Ensures JetBrains Mono rendering for Camelot key notations.
 */

interface HarmonicCompatibilityProps {
  currentKey: CamelotKey | string;
  targetKey: CamelotKey | string;
  showLabel?: boolean;
  /** Kept for API compatibility; the badge has one size. */
  size?: 'small' | 'medium' | 'large';
}

export const HarmonicCompatibility: React.FC<HarmonicCompatibilityProps> = ({
  currentKey,
  targetKey,
  showLabel = false,
}) => (
  <span className="harmonic-indicator data" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
    <KeyCompat from={currentKey} to={targetKey} outline />
    {showLabel ? <KeyBadge value={targetKey} /> : null}
  </span>
);

// Batch component for showing multiple compatibilities
interface HarmonicSetProps {
  currentKey: CamelotKey | string;
  tracks: Array<{ id: string; key: CamelotKey | string; name: string }>;
  onTrackSelect?: (trackId: string) => void;
}

const ORDER = { perfect: 0, compatible: 1, possible: 2, clash: 3, unknown: 4 } as const;
const levelOf = (a: string, b: string) => {
  const x = SN.camelot(a), y = SN.camelot(b);
  return x && y ? SN.compat(x, y).level : 'unknown';
};

export const HarmonicSet: React.FC<HarmonicSetProps> = ({ currentKey, tracks, onTrackSelect }) => {
  const sortedTracks = tracks.slice(0, 20).sort((a, b) => ORDER[levelOf(currentKey, a.key)] - ORDER[levelOf(currentKey, b.key)]);
  return (
    <div className="harmonic-set" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <h3 className="sn-title title-s" style={{ margin: 0 }}>
        Keys that mix from <KeyBadge value={currentKey} />
      </h3>
      {sortedTracks.map((track) => (
        <button
          type="button"
          key={track.id}
          className="sn-btn sn-btn--quiet body"
          onClick={() => onTrackSelect?.(track.id)}
          style={{ justifyContent: 'flex-start', gap: 'var(--space-3)', width: '100%' }}
        >
          <KeyCompat from={currentKey} to={track.key} outline />
          <span style={{ flex: 1, textAlign: 'left', color: 'var(--fg)' }}>{track.name}</span>
          <KeyBadge value={track.key} />
        </button>
      ))}
    </div>
  );
};

export default HarmonicCompatibility;
