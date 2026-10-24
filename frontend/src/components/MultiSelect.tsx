import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MultiSelectProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  label: string;
  searchable?: boolean;
  maxHeight?: string;
}

/**
 * A multi-select dropdown component with search and select-all functionality.
 * @param {MultiSelectProps} props The component props.
 * @returns {React.ReactElement} The rendered multi-select component.
 */
export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  label,
  searchable = false,
  maxHeight = 'max-h-40',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    return options.filter(option =>
      option.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, searchable]);

  const toggleOption = useCallback((option: string) => {
    const newSelection = selectedValues.includes(option)
      ? selectedValues.filter(v => v !== option)
      : [...selectedValues, option];
    onChange(newSelection);
  }, [selectedValues, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-bold" style={{ color: 'var(--color-brand-primary)' }}>
            ({selectedValues.length})
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ color: 'var(--color-text-tertiary)', transition: 'var(--transition-color)' }}
            className="hover:opacity-80"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div
          className="space-y-2 p-2 rounded-md"
          style={{
            backgroundColor: 'var(--color-bg-elevated-2)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {searchable && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full px-3 py-2 rounded focus:outline-none"
              style={{
                backgroundColor: 'var(--color-bg-elevated-1)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
                borderRadius: 'var(--radius-input)',
                fontSize: 'var(--font-size-sm)'
              }}
            />
          )}
          <div className={`overflow-y-auto space-y-1 ${maxHeight}`}>
            {filteredOptions.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded transition-colors"
                style={{
                  color: selectedValues.includes(option) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{
                    accentColor: 'var(--color-brand-primary)'
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;