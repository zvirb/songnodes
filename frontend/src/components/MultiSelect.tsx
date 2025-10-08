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
        <label className="text-sm font-semibold text-gray-300">{label}</label>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-blue-400 font-mono">({selectedValues.length})</span>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-blue-400">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="space-y-2 p-2 bg-gray-800 rounded-md">
          {searchable && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          )}
          <div className={`overflow-y-auto space-y-1 ${maxHeight}`}>
            {filteredOptions.map(option => (
              <label key={option} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white cursor-pointer p-1.5 hover:bg-gray-700 rounded">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500"
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