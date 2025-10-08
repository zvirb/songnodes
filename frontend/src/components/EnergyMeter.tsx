import React from 'react';
import { ENERGY_DESCRIPTORS, getEnergyColor, SIZES } from '../utils/energyUtils';

interface EnergyMeterProps {
  /** The energy level to display, on a scale of 1-10. */
  level: number;
  /** Whether to show the descriptive label (e.g., "Energetic"). */
  showLabel?: boolean;
  /** The orientation of the meter. */
  orientation?: 'horizontal' | 'vertical';
  /** The size of the meter. */
  size?: 'small' | 'medium' | 'large';
  /** Whether to animate transitions. */
  animated?: boolean;
}

/**
 * A visual component to represent track energy on a 1-10 scale.
 * It uses a series of bars to provide a quick, at-a-glance understanding of energy level.
 */
export const EnergyMeter: React.FC<EnergyMeterProps> = ({
  level,
  showLabel = false,
  orientation = 'horizontal',
  size = 'medium',
  animated = true,
}) => {
  const dimensions = SIZES[size];
  const barCount = dimensions.bars;
  const validLevel = Math.max(1, Math.min(10, Math.round(level || 5)));
  const activeBars = Math.round((validLevel / 10) * barCount);
  const color = getEnergyColor(validLevel);
  const descriptor = ENERGY_DESCRIPTORS[validLevel];

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`flex flex-col-reverse gap-px p-1 bg-black/50 rounded border border-white/20 ${dimensions.height} ${dimensions.width}`}>
          {Array.from({ length: barCount }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${animated ? 'transition-all duration-300' : ''}`}
              style={{
                backgroundColor: i < activeBars ? getEnergyColor(Math.ceil((i + 1) * 10 / barCount)) : 'rgba(255,255,255,0.1)',
                boxShadow: i < activeBars ? `0 0 8px ${getEnergyColor(Math.ceil((i + 1) * 10 / barCount))}40` : 'none',
              }}
            />
          ))}
        </div>
        {showLabel && <span className="text-white text-xs font-semibold text-center">{descriptor.label}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" title={`Energy: ${descriptor.label} - ${descriptor.desc}`}>
      <div className={`flex gap-px p-1 bg-black/50 rounded border border-white/20 ${dimensions.width} ${dimensions.height}`}>
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${animated ? 'transition-all duration-300' : ''}`}
            style={{
              backgroundColor: i < activeBars ? getEnergyColor(Math.ceil((i + 1) * 10 / barCount)) : 'rgba(255,255,255,0.1)',
              boxShadow: i < activeBars ? `0 0 8px ${color}40` : 'none',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-sm font-semibold min-w-[80px]" style={{ color }}>
          {descriptor.label}
        </span>
      )}
    </div>
  );
};

interface EnergyFlowProps {
  /** The energy level of the current track. */
  currentEnergy: number;
  /** The energy level of the target/next track. */
  targetEnergy: number;
  /** Whether to show the text recommendation for the transition. */
  showRecommendation?: boolean;
}

/**
 * A component to visualize the energy transition between two tracks.
 * It provides a quick recommendation on the quality of the energy flow.
 */
export const EnergyFlow: React.FC<EnergyFlowProps> = ({
  currentEnergy,
  targetEnergy,
  showRecommendation = true,
}) => {
  const diff = targetEnergy - currentEnergy;
  const isGoodTransition = Math.abs(diff) <= 2;

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
  const borderColor = isGoodTransition ? 'border-green-500' : 'border-amber-500';
  const textColor = isGoodTransition ? 'text-green-400' : 'text-amber-400';

  return (
    <div className={`flex flex-col gap-3 p-3 bg-black/80 rounded-lg border-2 ${borderColor}`}>
      <div className="flex items-center gap-4">
        <div>
          <div className="text-gray-400 text-[10px] mb-1">NOW</div>
          <EnergyMeter level={currentEnergy} size="small" />
        </div>
        <div className="text-white text-xl">{recommendation.icon}</div>
        <div>
          <div className="text-gray-400 text-[10px] mb-1">NEXT</div>
          <EnergyMeter level={targetEnergy} size="small" />
        </div>
      </div>
      {showRecommendation && (
        <div className={`text-xs text-center ${textColor}`}>
          {recommendation.text}
        </div>
      )}
    </div>
  );
};

export default EnergyMeter;