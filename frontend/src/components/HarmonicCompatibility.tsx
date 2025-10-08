import React from 'react';
import { CamelotKey } from '../types/dj';
import { getCompatibility, COMPATIBILITY_PROPS, SIZES } from '../utils/harmonicUtils';

interface HarmonicCompatibilityProps {
  /** The key of the currently playing track. */
  currentKey: CamelotKey;
  /** The key of the track to compare against. */
  targetKey: CamelotKey;
  /** Whether to display the text label for the target key. */
  showLabel?: boolean;
  /** The size of the visual indicator. */
  size?: 'small' | 'medium' | 'large';
}

/**
 * A visual indicator that shows the harmonic compatibility between two tracks
 * based on their Camelot keys.
 */
export const HarmonicCompatibility: React.FC<HarmonicCompatibilityProps> = ({
  currentKey,
  targetKey,
  showLabel = false,
  size = 'medium',
}) => {
  const compatibilityType = getCompatibility(currentKey, targetKey);
  const { bgClass, textClass, label, icon, colorValue } = COMPATIBILITY_PROPS[compatibilityType];
  const { container, fontSize } = SIZES[size];

  return (
    <div className="inline-flex items-center gap-2" title={`${currentKey} → ${targetKey}: ${label}`}>
      <div
        className={`flex items-center justify-center font-bold rounded-full border-2 border-white/30 shadow-md ${container} ${bgClass} ${textClass}`}
      >
        {icon}
      </div>
      {showLabel && (
        <span className={`font-semibold ${fontSize}`} style={{ color: colorValue }}>
          {targetKey}
        </span>
      )}
    </div>
  );
};

interface HarmonicSetProps {
  /** The key of the currently playing track. */
  currentKey: CamelotKey;
  /** A list of tracks to compare against the current key. */
  tracks: Array<{ id: string; key: CamelotKey; name: string }>;
  /** An optional callback function to handle track selection. */
  onTrackSelect?: (trackId: string) => void;
}

/**
 * A component that displays a list of tracks sorted by their harmonic
 * compatibility with a given key.
 */
export const HarmonicSet: React.FC<HarmonicSetProps> = ({
  currentKey,
  tracks,
  onTrackSelect,
}) => {
  const sortedTracks = React.useMemo(() => {
    const order = { perfect: 0, compatible: 1, possible: 2, clash: 3 };
    return [...tracks]
      .slice(0, 20) // Apply Hick's Law: limit choices
      .sort((a, b) => {
        const compA = getCompatibility(currentKey, a.key);
        const compB = getCompatibility(currentKey, b.key);
        return order[compA] - order[compB];
      });
  }, [currentKey, tracks]);

  return (
    <div className="flex flex-col gap-2 p-3 bg-black/80 rounded-lg">
      <h3 className="text-white text-sm font-semibold tracking-wider uppercase">
        Compatible Tracks ({currentKey})
      </h3>
      {sortedTracks.map(track => (
        <div
          key={track.id}
          onClick={() => onTrackSelect?.(track.id)}
          className="flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-white/10"
        >
          <HarmonicCompatibility currentKey={currentKey} targetKey={track.key} size="small" />
          <span className="flex-1 text-white text-sm">{track.name}</span>
          <span className="text-gray-400 text-xs">{track.key}</span>
        </div>
      ))}
    </div>
  );
};

export default HarmonicCompatibility;