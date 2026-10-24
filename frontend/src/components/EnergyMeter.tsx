import React from 'react';
import { ArrowRight } from 'lucide-react';
import { EnergyBar, SN } from '../lib/songnodes';
import { CompatibilityBadge } from './ds';

/**
 * EnergyMeter: the design-system EnergyBar (10 segments, gaps after 4 and 7,
 * number beside it). Energy is 1–10; a missing value is an en dash, never a
 * default of 5. Kept as a wrapper so older imports keep working.
 */

interface EnergyMeterProps {
  level: number | null | undefined; // 1–10
  /** Shows the tier word (Low, Building, High) after the bar. */
  showLabel?: boolean;
  /** Kept for API compatibility; the bar is always horizontal. */
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

const TIER_WORD = { low: 'Low', building: 'Building', high: 'High' } as const;

export const EnergyMeter: React.FC<EnergyMeterProps> = ({ level, showLabel = false }) => {
  const valid = level != null && Number.isFinite(level) && level >= 1 && level <= 10 ? Math.round(level) : null;
  const tier = valid != null ? SN.tier(valid) : null;
  return (
    <span className="energy-meter" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <EnergyBar value={valid} />
      {showLabel && tier ? <span style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>{TIER_WORD[tier]}</span> : null}
    </span>
  );
};

// Comparison component for energy flow management
interface EnergyFlowProps {
  currentEnergy: number;
  targetEnergy: number;
  showRecommendation?: boolean;
}

/** Energy move between two tracks: both bars plus the SN.energyStep verdict as a CompatibilityBadge. */
export const EnergyFlow: React.FC<EnergyFlowProps> = ({ currentEnergy, targetEnergy, showRecommendation = true }) => {
  const step = SN.energyStep(currentEnergy, targetEnergy);
  return (
    <div className="energy-flow" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div>
          <div className="label" style={{ color: 'var(--fg-3)' }}>Now</div>
          <EnergyMeter level={currentEnergy} />
        </div>
        <ArrowRight size={16} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--fg-3)' }} />
        <div>
          <div className="label" style={{ color: 'var(--fg-3)' }}>Next</div>
          <EnergyMeter level={targetEnergy} />
        </div>
      </div>
      {showRecommendation ? <CompatibilityBadge level={step.level} label={step.label} /> : null}
    </div>
  );
};

export default EnergyMeter;
