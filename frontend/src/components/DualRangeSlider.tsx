import React, { useCallback } from 'react';

interface DualRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  label: string;
  unit?: string;
  formatValue?: (value: number) => string;
}

/**
 * A dual-handle range slider component for selecting a numeric range.
 * @param {DualRangeSliderProps} props The component props.
 * @returns {React.ReactElement} The rendered dual range slider.
 */
export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min, max, value, onChange, label, unit = '', formatValue
}) => {
  const formatDisplayValue = (val: number) => {
    return formatValue ? formatValue(val) : `${val}${unit}`;
  };

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Math.min(parseInt(e.target.value, 10), value[1] - 1);
    onChange([newMin, value[1]]);
  }, [value, onChange]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Math.max(parseInt(e.target.value, 10), value[0] + 1);
    onChange([value[0], newMax]);
  }, [value, onChange]);

  const rangePercentage = ((value[1] - value[0]) / (max - min)) * 100;
  const leftPercentage = ((value[0] - min) / (max - min)) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)' }}>{label}</label>
        <span style={{ fontSize: '0.8125rem', color: 'var(--brand-strong)', fontFamily: 'var(--font-data)' }}>
          {formatDisplayValue(value[0])} – {formatDisplayValue(value[1])}
        </span>
      </div>
      <div style={{ position: 'relative', height: '16px', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '100%', height: '4px', backgroundColor: 'var(--surface-3)', borderRadius: 'var(--radius-pill)' }}>
          <div
            style={{
              position: 'absolute',
              height: '4px',
              backgroundColor: 'var(--brand)',
              borderRadius: 'var(--radius-pill)',
              left: `${leftPercentage}%`,
              width: `${rangePercentage}%`
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={value[0]}
            aria-label={`${label} minimum`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value[0]}
            aria-valuetext={formatDisplayValue(value[0])}
            onChange={handleMinChange}
            style={{
              position: 'absolute',
              width: '100%',
              height: '4px',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 2
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={value[1]}
            aria-label={`${label} maximum`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value[1]}
            aria-valuetext={formatDisplayValue(value[1])}
            onChange={handleMaxChange}
            style={{
              position: 'absolute',
              width: '100%',
              height: '4px',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 3
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
        <span>{formatDisplayValue(min)}</span>
        <span>{formatDisplayValue(max)}</span>
      </div>
    </div>
  );
};

export default DualRangeSlider;