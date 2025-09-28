import React from 'react';
import { CamelotKey, HarmonicCompatibility as HarmonicType } from '../types/dj';

/**
 * HarmonicCompatibility Component - Visual indicator for key compatibility
 * Implements cognitive offloading through color-coding (DJ's Co-Pilot Section 3)
 */

interface HarmonicCompatibilityProps {
  currentKey: CamelotKey;
  targetKey: CamelotKey;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Camelot Wheel compatibility rules
const getCompatibility = (current: CamelotKey, target: CamelotKey): HarmonicType => {
  const currentNum = parseInt(current.slice(0, -1));
  const currentLetter = current.slice(-1);
  const targetNum = parseInt(target.slice(0, -1));
  const targetLetter = target.slice(-1);

  // Same key = perfect match
  if (current === target) return 'perfect';

  // Same number, different letter (major/minor switch)
  if (currentNum === targetNum && currentLetter !== targetLetter) return 'perfect';

  // Adjacent numbers, same letter (±1 on wheel)
  const numDiff = Math.abs(currentNum - targetNum);
  const wrappedDiff = Math.min(numDiff, 12 - numDiff);

  if (wrappedDiff === 1 && currentLetter === targetLetter) return 'compatible';
  if (wrappedDiff === 2 && currentLetter === targetLetter) return 'possible';

  return 'clash';
};

// Color scheme following cognitive load principles
const COMPATIBILITY_COLORS = {
  perfect: {
    bg: '#7ED321',      // Bright green - instant recognition
    text: '#FFFFFF',
    label: 'Perfect',
    icon: '✓✓'
  },
  compatible: {
    bg: '#F5A623',      // Yellow - good to go
    text: '#000000',
    label: 'Compatible',
    icon: '✓'
  },
  possible: {
    bg: '#FFA500',      // Orange - use with caution
    text: '#000000',
    label: 'Possible',
    icon: '~'
  },
  clash: {
    bg: '#D0021B',      // Red - avoid
    text: '#FFFFFF',
    label: 'Clash',
    icon: '✗'
  }
};

const SIZES = {
  small: { width: '24px', height: '24px', fontSize: '12px' },
  medium: { width: '40px', height: '40px', fontSize: '14px' },
  large: { width: '60px', height: '60px', fontSize: '16px' }
};

export const HarmonicCompatibility: React.FC<HarmonicCompatibilityProps> = ({
  currentKey,
  targetKey,
  showLabel = false,
  size = 'medium'
}) => {
  const compatibility = getCompatibility(currentKey, targetKey);
  const colors = COMPATIBILITY_COLORS[compatibility];
  const dimensions = SIZES[size];

  return (
    <div
      className="harmonic-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px'
      }}
      title={`${currentKey} → ${targetKey}: ${colors.label}`}
    >
      <div
        style={{
          ...dimensions,
          backgroundColor: colors.bg,
          color: colors.text,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          // High contrast for dark environments
          border: '2px solid rgba(255,255,255,0.3)'
        }}
      >
        {colors.icon}
      </div>
      {showLabel && (
        <span style={{
          color: colors.bg,
          fontSize: dimensions.fontSize,
          fontWeight: 600
        }}>
          {targetKey}
        </span>
      )}
    </div>
  );
};

// Batch component for showing multiple compatibilities
interface HarmonicSetProps {
  currentKey: CamelotKey;
  tracks: Array<{ id: string; key: CamelotKey; name: string }>;
  onTrackSelect?: (trackId: string) => void;
}

export const HarmonicSet: React.FC<HarmonicSetProps> = ({
  currentKey,
  tracks,
  onTrackSelect
}) => {
  // Apply Hick's Law - limit to 20 tracks max
  const limitedTracks = tracks.slice(0, 20);

  // Sort by compatibility for cognitive offloading
  const sortedTracks = limitedTracks.sort((a, b) => {
    const compA = getCompatibility(currentKey, a.key);
    const compB = getCompatibility(currentKey, b.key);
    const order = { perfect: 0, compatible: 1, possible: 2, clash: 3 };
    return order[compA] - order[compB];
  });

  return (
    <div className="harmonic-set" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderRadius: '8px'
    }}>
      <h3 style={{
        color: '#F8F8F8',
        margin: 0,
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        Compatible Tracks ({currentKey})
      </h3>
      {sortedTracks.map(track => (
        <div
          key={track.id}
          onClick={() => onTrackSelect?.(track.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          <HarmonicCompatibility
            currentKey={currentKey}
            targetKey={track.key}
            size="small"
          />
          <span style={{
            color: '#F8F8F8',
            fontSize: '14px',
            flex: 1
          }}>
            {track.name}
          </span>
          <span style={{
            color: '#8E8E93',
            fontSize: '12px'
          }}>
            {track.key}
          </span>
        </div>
      ))}
    </div>
  );
};

export default HarmonicCompatibility;