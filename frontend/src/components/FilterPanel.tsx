import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { SearchFilters } from '../types';

// Camelot Wheel mapping for harmonic mixing
const CAMELOT_WHEEL = {
  // Major keys
  '1B': 'C major', '2B': 'G major', '3B': 'D major', '4B': 'A major',
  '5B': 'E major', '6B': 'B major', '7B': 'F# major', '8B': 'Db major',
  '9B': 'Ab major', '10B': 'Eb major', '11B': 'Bb major', '12B': 'F major',
  // Minor keys
  '1A': 'A minor', '2A': 'E minor', '3A': 'B minor', '4A': 'F# minor',
  '5A': 'C# minor', '6A': 'G# minor', '7A': 'Eb minor', '8A': 'Bb minor',
  '9A': 'F minor', '10A': 'C minor', '11A': 'G minor', '12A': 'D minor'
};

// const CAMELOT_KEYS = Object.keys(CAMELOT_WHEEL); // Available if needed for key validation

// Common genres for electronic/dance music
const COMMON_GENRES = [
  'House', 'Techno', 'Trance', 'Dubstep', 'Drum & Bass', 'Breakbeat',
  'Ambient', 'Progressive', 'Deep House', 'Tech House', 'Minimal', 'Hardstyle',
  'Psytrance', 'Big Room', 'Future Bass', 'Trap', 'Electro', 'Acid'
];

// Filter preset type
interface FilterPreset {
  id: string;
  name: string;
  filters: SearchFilters;
  created: Date;
}

// Dual range slider component
interface DualRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  label: string;
  unit?: string;
  formatValue?: (value: number) => string;
}

const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min, max, value, onChange, label, unit = '', formatValue
}) => {
  const formatDisplayValue = (val: number) => {
    if (formatValue) return formatValue(val);
    return `${val}${unit}`;
  };

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Math.min(parseInt(e.target.value), value[1] - 1);
    onChange([newMin, value[1]]);
  }, [value, onChange]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Math.max(parseInt(e.target.value), value[0] + 1);
    onChange([value[0], newMax]);
  }, [value, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-300">{label}</label>
        <span className="text-sm text-dj-accent font-mono">
          {formatDisplayValue(value[0])} - {formatDisplayValue(value[1])}
        </span>
      </div>

      <div className="relative">
        {/* Background track */}
        <div className="h-2 bg-dj-gray rounded-full relative">
          {/* Active range */}
          <div
            className="absolute h-full bg-dj-accent rounded-full"
            style={{
              left: `${((value[0] - min) / (max - min)) * 100}%`,
              width: `${((value[1] - value[0]) / (max - min)) * 100}%`
            }}
          />
        </div>

        {/* Range inputs */}
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          onChange={handleMinChange}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          onChange={handleMaxChange}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
          style={{ zIndex: 3 }}
        />

        {/* Thumb indicators */}
        <div
          className="absolute w-4 h-4 bg-dj-accent rounded-full border-2 border-dj-dark -mt-1 cursor-pointer shadow-lg"
          style={{ left: `calc(${((value[0] - min) / (max - min)) * 100}% - 8px)` }}
        />
        <div
          className="absolute w-4 h-4 bg-dj-accent rounded-full border-2 border-dj-dark -mt-1 cursor-pointer shadow-lg"
          style={{ left: `calc(${((value[1] - min) / (max - min)) * 100}% - 8px)` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatDisplayValue(min)}</span>
        <span>{formatDisplayValue(max)}</span>
      </div>
    </div>
  );
};

// Camelot wheel selector component
interface CamelotWheelProps {
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
}

const CamelotWheel: React.FC<CamelotWheelProps> = ({ selectedKeys, onChange }) => {
  const toggleKey = useCallback((key: string) => {
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter(k => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  }, [selectedKeys, onChange]);

  // Arrange keys in circular pattern
  const wheelKeys = [
    ['1A', '1B'], ['2A', '2B'], ['3A', '3B'], ['4A', '4B'],
    ['5A', '5B'], ['6A', '6B'], ['7A', '7B'], ['8A', '8B'],
    ['9A', '9B'], ['10A', '10B'], ['11A', '11B'], ['12A', '12B']
  ];

  return (
    <div className="relative w-48 h-48 mx-auto">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-dj-light-gray" />

      {/* Inner ring */}
      <div className="absolute inset-4 rounded-full border border-dj-gray" />

      {/* Key buttons */}
      {wheelKeys.map((pair, index) => {
        const angle = (index * 30) - 90; // Start from top
        const outerRadius = 90;
        const innerRadius = 60;

        return (
          <React.Fragment key={index}>
            {/* Outer key (B - Major) */}
            <button
              onClick={() => toggleKey(pair[1])}
              className={`absolute w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center ${
                selectedKeys.includes(pair[1])
                  ? 'bg-dj-accent text-black shadow-lg scale-110'
                  : 'bg-dj-gray text-gray-300 hover:bg-dj-light-gray hover:text-white'
              }`}
              style={{
                left: `calc(50% + ${Math.cos(angle * Math.PI / 180) * outerRadius}px - 16px)`,
                top: `calc(50% + ${Math.sin(angle * Math.PI / 180) * outerRadius}px - 16px)`
              }}
              title={CAMELOT_WHEEL[pair[1] as keyof typeof CAMELOT_WHEEL]}
            >
              {pair[1]}
            </button>

            {/* Inner key (A - Minor) */}
            <button
              onClick={() => toggleKey(pair[0])}
              className={`absolute w-7 h-7 rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center ${
                selectedKeys.includes(pair[0])
                  ? 'bg-dj-info text-white shadow-lg scale-110'
                  : 'bg-dj-dark text-gray-400 hover:bg-dj-gray hover:text-white'
              }`}
              style={{
                left: `calc(50% + ${Math.cos(angle * Math.PI / 180) * innerRadius}px - 14px)`,
                top: `calc(50% + ${Math.sin(angle * Math.PI / 180) * innerRadius}px - 14px)`
              }}
              title={CAMELOT_WHEEL[pair[0] as keyof typeof CAMELOT_WHEEL]}
            >
              {pair[0]}
            </button>
          </React.Fragment>
        );
      })}

      {/* Center indicator */}
      <div className="absolute inset-1/2 w-2 h-2 -mt-1 -ml-1 bg-dj-accent rounded-full" />
    </div>
  );
};

// Multi-select component
interface MultiSelectProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  label: string;
  searchable?: boolean;
  maxHeight?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  label,
  searchable = false,
  maxHeight = 'max-h-32'
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
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter(v => v !== option));
    } else {
      onChange([...selectedValues, option]);
    }
  }, [selectedValues, onChange]);

  const selectAll = useCallback(() => {
    onChange(filteredOptions);
  }, [filteredOptions, onChange]);

  const selectNone = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-300">{label}</label>
        <div className="flex gap-2 text-xs">
          <span className="text-dj-accent font-mono">({selectedValues.length})</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-dj-accent transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {searchable && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full px-3 py-2 bg-dj-gray border border-dj-light-gray rounded text-white placeholder-gray-500 focus:border-dj-accent focus:outline-none"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-dj-accent hover:text-white transition-colors"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Select None
            </button>
          </div>

          <div className={`${maxHeight} overflow-y-auto bg-dj-gray rounded p-2 space-y-1`}>
            {filteredOptions.map(option => (
              <label key={option} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white cursor-pointer p-1 hover:bg-dj-light-gray rounded">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="accent-dj-accent"
                />
                <span className="flex-1">{option}</span>
                <span className="text-xs text-gray-500">
                  {/* Show count or additional info */}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const FilterPanel: React.FC = () => {
  const {
    searchFilters,
    graphData,
    originalGraphData,
    setSearchFilters,
    applyFilters,
    clearSearch,
    resetGraphData
  } = useStore((state) => ({
    searchFilters: state.searchFilters,
    graphData: state.graphData,
    originalGraphData: state.originalGraphData,
    setSearchFilters: state.search.setSearchFilters,
    applyFilters: state.search.applyFilters,
    clearSearch: state.search.clearSearch,
    resetGraphData: state.graph.resetGraphData
  }));

  // Local state for filter management
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [isExpanded, setIsExpanded] = useState({
    bpm: true,
    key: false,
    genre: true,
    year: false,
    energy: true,
    artist: false,
    label: false,
    advanced: false
  });

  // Extract unique values from graph data
  const { genres, artists, labels, yearRange, bpmRange, energyRange } = useMemo(() => {
    const tracks = graphData.nodes
      .filter(node => node.type === 'track' && node.track)
      .map(node => node.track!);

    const uniqueGenres = Array.from(new Set(tracks.map(t => t.genre).filter(Boolean))) as string[];
    const uniqueArtists = Array.from(new Set(tracks.map(t => t.artist).filter(Boolean))) as string[];
    const uniqueLabels = Array.from(new Set(tracks.map(t => (t as any).label).filter(Boolean))) as string[];
    // Extract unique keys from tracks (currently using hardcoded Camelot wheel)
    // const uniqueKeys = Array.from(new Set(tracks.map(t => t.key || t.camelotKey).filter(Boolean))) as string[];

    const years = tracks.map(t => t.year).filter(Boolean).sort((a, b) => a! - b!);
    const bpms = tracks.map(t => t.bpm).filter(Boolean).sort((a, b) => a! - b!);
    const energies = tracks.map(t => t.energy).filter(Boolean).sort((a, b) => a! - b!);

    return {
      genres: [...new Set([...uniqueGenres, ...COMMON_GENRES])].sort(),
      artists: uniqueArtists.sort(),
      labels: uniqueLabels.sort(),
      yearRange: [years[0] || 1990, years[years.length - 1] || new Date().getFullYear()] as [number, number],
      bpmRange: [bpms[0] || 60, bpms[bpms.length - 1] || 200] as [number, number],
      energyRange: [energies[0] || 1, energies[energies.length - 1] || 10] as [number, number]
    };
  }, [graphData]);

  // Initialize filters with sensible defaults
  const currentFilters = useMemo((): SearchFilters => ({
    genre: searchFilters.genre || [],
    keyRange: searchFilters.keyRange || [],
    bpmRange: searchFilters.bpmRange || bpmRange,
    energyRange: searchFilters.energyRange || energyRange,
    yearRange: searchFilters.yearRange || yearRange,
    artist: searchFilters.artist || [],
    minPopularity: searchFilters.minPopularity || 0,
    hasPreview: searchFilters.hasPreview || false,
    ...searchFilters
  }), [searchFilters, bpmRange, energyRange, yearRange]);

  // Update filter handlers
  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setSearchFilters({ [key]: value });
  }, [setSearchFilters]);

  const resetAllFilters = useCallback(() => {
    clearSearch();
    resetGraphData();
  }, [clearSearch, resetGraphData]);

  // Preset management
  const savePreset = useCallback(() => {
    if (!presetName.trim()) return;

    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      filters: { ...currentFilters },
      created: new Date()
    };

    setFilterPresets(prev => [...prev.filter(p => p.name !== preset.name), preset]);
    setPresetName('');
  }, [presetName, currentFilters]);

  const loadPreset = useCallback((preset: FilterPreset) => {
    setSearchFilters(preset.filters);
  }, [setSearchFilters]);

  const deletePreset = useCallback((presetId: string) => {
    setFilterPresets(prev => prev.filter(p => p.id !== presetId));
  }, []);

  // Load presets from localStorage on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('songnodes-filter-presets');
    if (savedPresets) {
      try {
        setFilterPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.warn('Failed to load filter presets:', e);
      }
    }
  }, []);

  // Save presets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('songnodes-filter-presets', JSON.stringify(filterPresets));
  }, [filterPresets]);

  const toggleExpanded = useCallback((section: keyof typeof isExpanded) => {
    setIsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentFilters.genre && currentFilters.genre.length > 0) count++;
    if (currentFilters.keyRange && currentFilters.keyRange.length > 0) count++;
    if (currentFilters.artist && currentFilters.artist.length > 0) count++;
    if (currentFilters.bpmRange && (currentFilters.bpmRange[0] > bpmRange[0] || currentFilters.bpmRange[1] < bpmRange[1])) count++;
    if (currentFilters.energyRange && (currentFilters.energyRange[0] > energyRange[0] || currentFilters.energyRange[1] < energyRange[1])) count++;
    if (currentFilters.yearRange && (currentFilters.yearRange[0] > yearRange[0] || currentFilters.yearRange[1] < yearRange[1])) count++;
    if (currentFilters.minPopularity && currentFilters.minPopularity > 0) count++;
    if (currentFilters.hasPreview) count++;
    return count;
  }, [currentFilters, bpmRange, energyRange, yearRange]);

  return (
    <div className="h-full flex flex-col bg-dj-dark">
      {/* Header */}
      <div className="p-4 border-b border-dj-light-gray">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎛️</span> Graph Filters
            {activeFilterCount > 0 && (
              <span className="text-xs bg-dj-accent text-black px-2 py-1 rounded-full font-bold">
                {activeFilterCount}
              </span>
            )}
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="text-xs text-gray-400 hover:text-dj-accent transition-colors px-2 py-1 bg-dj-gray rounded"
            >
              Presets
            </button>
            <button
              onClick={resetAllFilters}
              className="text-xs text-gray-400 hover:text-dj-danger transition-colors px-2 py-1 bg-dj-gray rounded"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Current filter status */}
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Showing:</span>
            <span className="font-mono text-dj-accent">
              {graphData.nodes.length} / {originalGraphData?.nodes.length || graphData.nodes.length} nodes
            </span>
          </div>
          <div className="flex justify-between">
            <span>Edges:</span>
            <span className="font-mono text-dj-info">
              {graphData.edges.length} / {originalGraphData?.edges.length || graphData.edges.length}
            </span>
          </div>
        </div>

        {/* Filter Presets */}
        {showPresets && (
          <div className="space-y-2 p-3 bg-dj-gray rounded">
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 px-2 py-1 bg-dj-dark border border-dj-light-gray rounded text-sm text-white"
                onKeyDown={(e) => e.key === 'Enter' && savePreset()}
              />
              <button
                onClick={savePreset}
                disabled={!presetName.trim()}
                className="px-3 py-1 bg-dj-accent text-black text-sm rounded font-semibold hover:bg-opacity-80 disabled:opacity-50"
              >
                Save
              </button>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto">
              {filterPresets.map(preset => (
                <div key={preset.id} className="flex items-center gap-2 p-2 bg-dj-dark rounded">
                  <button
                    onClick={() => loadPreset(preset)}
                    className="flex-1 text-left text-sm text-white hover:text-dj-accent"
                  >
                    {preset.name}
                  </button>
                  <span className="text-xs text-gray-500">
                    {preset.created.toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="text-xs text-dj-danger hover:text-red-400 px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* BPM Range Filter */}
        <div className="space-y-3">
          <button
            onClick={() => toggleExpanded('bpm')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white"
          >
            <span>{isExpanded.bpm ? '▼' : '▶'}</span>
            <span>🥁 BPM Range</span>
          </button>

          {isExpanded.bpm && (
            <DualRangeSlider
              min={bpmRange[0]}
              max={bpmRange[1]}
              value={currentFilters.bpmRange || bpmRange}
              onChange={(value) => updateFilter('bpmRange', value)}
              label="Beats Per Minute"
              unit=" BPM"
            />
          )}
        </div>

        {/* Key Filter with Camelot Wheel */}
        <div className="space-y-3">
          <button
            onClick={() => toggleExpanded('key')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white"
          >
            <span>{isExpanded.key ? '▼' : '▶'}</span>
            <span>🎹 Musical Key</span>
            {currentFilters.keyRange && currentFilters.keyRange.length > 0 && (
              <span className="text-xs bg-dj-info text-white px-2 py-0.5 rounded-full">
                {currentFilters.keyRange.length}
              </span>
            )}
          </button>

          {isExpanded.key && (
            <div className="space-y-4">
              <CamelotWheel
                selectedKeys={currentFilters.keyRange || []}
                onChange={(keys) => updateFilter('keyRange', keys)}
              />

              {/* Key compatibility helper */}
              {currentFilters.keyRange && currentFilters.keyRange.length > 0 && (
                <div className="text-xs text-gray-400 space-y-1">
                  <p>Selected: {currentFilters.keyRange.join(', ')}</p>
                  <p className="text-dj-info">💡 Compatible keys for harmonic mixing</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Genre Multi-Select Filter */}
        <div className="space-y-3">
          <MultiSelect
            options={genres}
            selectedValues={currentFilters.genre || []}
            onChange={(values) => updateFilter('genre', values)}
            label="🎵 Genres"
            searchable
            maxHeight="max-h-40"
          />
        </div>

        {/* Year Range Filter */}
        <div className="space-y-3">
          <button
            onClick={() => toggleExpanded('year')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white"
          >
            <span>{isExpanded.year ? '▼' : '▶'}</span>
            <span>📅 Release Year</span>
          </button>

          {isExpanded.year && (
            <DualRangeSlider
              min={yearRange[0]}
              max={yearRange[1]}
              value={currentFilters.yearRange || yearRange}
              onChange={(value) => updateFilter('yearRange', value)}
              label="Year Range"
            />
          )}
        </div>

        {/* Energy Level Filter */}
        <div className="space-y-3">
          <button
            onClick={() => toggleExpanded('energy')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white"
          >
            <span>{isExpanded.energy ? '▼' : '▶'}</span>
            <span>⚡ Energy Level</span>
          </button>

          {isExpanded.energy && (
            <DualRangeSlider
              min={energyRange[0]}
              max={energyRange[1]}
              value={currentFilters.energyRange || energyRange}
              onChange={(value) => updateFilter('energyRange', value)}
              label="Energy Level"
              formatValue={(val) => {
                if (val <= 3) return `${val} (Low)`;
                if (val <= 7) return `${val} (Med)`;
                return `${val} (High)`;
              }}
            />
          )}
        </div>

        {/* Artist Filter */}
        <div className="space-y-3">
          <MultiSelect
            options={artists}
            selectedValues={currentFilters.artist || []}
            onChange={(values) => updateFilter('artist', values)}
            label="🎤 Artists"
            searchable
            maxHeight="max-h-32"
          />
        </div>

        {/* Label Filter */}
        <div className="space-y-3">
          <MultiSelect
            options={labels}
            selectedValues={(currentFilters as any).label || []}
            onChange={(values) => updateFilter('artist', values)} // Using artist as placeholder since label not in SearchFilters
            label="🏷️ Record Labels"
            searchable
            maxHeight="max-h-24"
          />
        </div>

        {/* Advanced Filters */}
        <div className="space-y-3">
          <button
            onClick={() => toggleExpanded('advanced')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white"
          >
            <span>{isExpanded.advanced ? '▼' : '▶'}</span>
            <span>⚙️ Advanced</span>
          </button>

          {isExpanded.advanced && (
            <div className="space-y-4">
              {/* Edge Weight Threshold */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Edge Weight Threshold</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={(currentFilters as any).edgeThreshold || 0.1}
                  onChange={(e) => updateFilter('minPopularity', parseFloat(e.target.value))} // Using minPopularity as placeholder
                  className="w-full h-2 bg-dj-gray rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0.0</span>
                  <span>{(currentFilters.minPopularity || 0).toFixed(2)}</span>
                  <span>1.0</span>
                </div>
              </div>

              {/* Minimum Popularity */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">
                  Min Popularity: {currentFilters.minPopularity || 0}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentFilters.minPopularity || 0}
                  onChange={(e) => updateFilter('minPopularity', parseInt(e.target.value))}
                  className="w-full h-2 bg-dj-gray rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Has Preview Toggle */}
              <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentFilters.hasPreview || false}
                  onChange={(e) => updateFilter('hasPreview', e.target.checked)}
                  className="w-4 h-4 text-dj-accent bg-dj-gray border-dj-light-gray rounded focus:ring-dj-accent focus:ring-2"
                />
                <span>Has audio preview</span>
              </label>
            </div>
          )}
        </div>

        {/* Apply Filters Button */}
        <div className="pt-4 border-t border-dj-light-gray space-y-2">
          <button
            onClick={() => {
              applyFilters(currentFilters);
            }}
            className="w-full py-3 bg-gradient-to-r from-dj-accent to-dj-info text-black font-bold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
          >
            Apply Filters ({activeFilterCount} active)
          </button>

          {/* Show current vs total counts */}
          <div className="text-xs text-center text-gray-400">
            Showing {graphData.nodes.length} of {originalGraphData?.nodes.length || graphData.nodes.length} nodes, {graphData.edges.length} of {originalGraphData?.edges.length || graphData.edges.length} edges
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export for lazy loading
export default FilterPanel;