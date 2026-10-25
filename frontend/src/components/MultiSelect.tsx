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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)' }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--brand-strong)', fontFamily: 'var(--font-data)' }}>({selectedValues.length})</span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${label} options` : `Expand ${label} options`}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg-3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px'
            }}
          >
            {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-2)', backgroundColor: 'var(--surface-2)', borderRadius: 'var(--radius-control)', border: '1px solid var(--line)' }}>
          {searchable && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="sn-input"
              aria-label={`Search ${label}`}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-chip)',
                color: 'var(--fg)',
                fontSize: '0.8125rem'
              }}
            />
          )}
          <div className={maxHeight} style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {filteredOptions.map(option => (
              <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--fg-2)', cursor: 'pointer', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-chip)' }}>
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="sn-checkbox"
                  style={{ accentColor: 'var(--brand)' }}
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