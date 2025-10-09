import React from 'react';

/**
 * EnergyMeter Component - Visual representation of track energy (1-10 scale)
 * Implements cognitive offloading through visual bars (DJ's Co-Pilot Section 5)
 * No numbers shown - pure visual pattern recognition
 */

interface EnergyMeterProps {
  level: number; // 1-10 scale from Mixed In Key
  showLabel?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

// Energy level descriptions based on Mixed In Key standards
const ENERGY_DESCRIPTORS = {
  1: { label: 'Ambient', desc: 'Very low energy, chill' },
  2: { label: 'Minimal', desc: 'Low energy, background' },
  3: { label: 'Relaxed', desc: 'Easy listening' },
  4: { label: 'Moderate', desc: 'Building energy' },
  5: { label: 'Groovy', desc: 'Danceable, steady' },
  6: { label: 'Energetic', desc: 'High groove, driving' },
  7: { label: 'Peak', desc: 'Party atmosphere' },
  8: { label: 'Intense', desc: 'Very high energy' },
  9: { label: 'Extreme', desc: 'Festival energy' },
  10: { label: 'Maximum', desc: 'Peak time anthem' }
};

// Color gradient for energy levels (cool to hot)
const getEnergyColor = (level: number): string => {
  const colors = {
    1: '#2E3A87',   // Deep blue
    2: '#3A4A9C',
    3: '#4A5FB1',
    4: '#5A7AC6',
    5: '#4A90E2',   // Medium blue
    6: '#62B0FF',
    7: '#FFA500',   // Orange transition
    8: '#FF7F00',
    9: '#FF5500',
    10: '#FF0000'   // Red peak
  };
  return colors[level as keyof typeof colors] || colors[5];
};

const SIZES = {
  small: { width: 60, height: 20, bars: 5 },
  medium: { width: 100, height: 30, bars: 10 },
  large: { width: 150, height: 40, bars: 10 }
};

export const EnergyMeter: React.FC<EnergyMeterProps> = ({
  level,
  showLabel = false,
  orientation = 'horizontal',
  size = 'medium',
  animated = true
}) => {
  const dimensions = SIZES[size];
  const barCount = dimensions.bars;

  // Clamp level to valid range (1-10) to prevent undefined descriptor
  const validLevel = Math.max(1, Math.min(10, Math.round(level || 5)));

  const activeBars = Math.round((validLevel / 10) * barCount);
  const color = getEnergyColor(validLevel);
  const descriptor = ENERGY_DESCRIPTORS[validLevel as keyof typeof ENERGY_DESCRIPTORS];

  if (orientation === 'vertical') {
    return (
      <div className="energy-meter-vertical" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '2px',
          width: dimensions.height,
          height: dimensions.width,
          padding: '4px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {Array.from({ length: barCount }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                backgroundColor: i < activeBars ? getEnergyColor(Math.ceil((i + 1) * 10 / barCount)) : 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                transition: animated ? 'all 0.3s ease' : 'none',
                boxShadow: i < activeBars ? `0 0 8px ${color}40` : 'none'
              }}
            />
          ))}
        </div>
        {showLabel && (
          <span style={{
            color: '#F8F8F8',
            fontSize: '12px',
            fontWeight: 600,
            textAlign: 'center'
          }}>
            {descriptor.label}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="energy-meter-horizontal"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
      title={`Energy: ${descriptor.label} - ${descriptor.desc}`}
    >
      <div style={{
        display: 'flex',
        gap: '2px',
        width: dimensions.width,
        height: dimensions.height,
        padding: '4px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              backgroundColor: i < activeBars ? getEnergyColor(Math.ceil((i + 1) * 10 / barCount)) : 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              transition: animated ? 'all 0.3s ease' : 'none',
              boxShadow: i < activeBars ? `0 0 8px ${color}40` : 'none'
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span style={{
          color: color,
          fontSize: '14px',
          fontWeight: 600,
          minWidth: '80px'
        }}>
          {descriptor.label}
        </span>
      )}
    </div>
  );
};

// Comparison component for energy flow management
interface EnergyFlowProps {
  currentEnergy: number;
  targetEnergy: number;
  showRecommendation?: boolean;
}

export const EnergyFlow: React.FC<EnergyFlowProps> = ({
  currentEnergy,
  targetEnergy,
  showRecommendation = true
}) => {
  const diff = targetEnergy - currentEnergy;
  const isGoodTransition = Math.abs(diff) <= 2; // Adjacent energy levels work best

  const getRecommendation = () => {
    if (diff === 0) return { text: 'Same energy - smooth continuation', icon: '→' };
    if (diff === 1) return { text: 'Building energy - perfect progression', icon: '↗' };
    if (diff === -1) return { text: 'Cooling down - smooth descent', icon: '↘' };
    if (diff === 2) return { text: 'Energy boost - exciting but manageable', icon: '⬆' };
    if (diff === -2) return { text: 'Energy drop - noticeable but smooth', icon: '⬇' };
    if (diff > 2) return { text: 'Big jump - may feel abrupt!', icon: '⚡' };
    return { text: 'Big drop - may lose the crowd!', icon: '⚠' };
  };

  const recommendation = getRecommendation();

  return (
    <div className="energy-flow" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '12px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderRadius: '8px',
      border: `2px solid ${isGoodTransition ? '#7ED321' : '#F5A623'}`
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div>
          <div style={{ color: '#8E8E93', fontSize: '10px', marginBottom: '4px' }}>
            NOW
          </div>
          <EnergyMeter level={currentEnergy} size="small" />
        </div>

        <div style={{
          color: '#F8F8F8',
          fontSize: '20px'
        }}>
          {recommendation.icon}
        </div>

        <div>
          <div style={{ color: '#8E8E93', fontSize: '10px', marginBottom: '4px' }}>
            NEXT
          </div>
          <EnergyMeter level={targetEnergy} size="small" />
        </div>
      </div>

      {showRecommendation && (
        <div style={{
          color: isGoodTransition ? '#7ED321' : '#F5A623',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          {recommendation.text}
        </div>
      )}
    </div>
  );
};

export default EnergyMeter;