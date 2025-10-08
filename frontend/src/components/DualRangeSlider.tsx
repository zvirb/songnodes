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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-300">{label}</label>
        <span className="text-sm text-blue-400 font-mono">
          {formatDisplayValue(value[0])} - {formatDisplayValue(value[1])}
        </span>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="relative w-full h-1 bg-gray-700 rounded-full">
          <div
            className="absolute h-1 bg-blue-500 rounded-full"
            style={{ left: `${leftPercentage}%`, width: `${rangePercentage}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={value[0]}
            onChange={handleMinChange}
            className="absolute w-full h-1 opacity-0 cursor-pointer"
          />
          <input
            type="range"
            min={min}
            max={max}
            value={value[1]}
            onChange={handleMaxChange}
            className="absolute w-full h-1 opacity-0 cursor-pointer"
          />
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatDisplayValue(min)}</span>
        <span>{formatDisplayValue(max)}</span>
      </div>
    </div>
  );
};

export default DualRangeSlider;