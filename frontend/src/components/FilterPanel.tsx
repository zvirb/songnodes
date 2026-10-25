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
              left: `${((value[0] - min) / (max - min)) * 100}%`,
              width: `${((value[1] - value[0]) / (max - min)) * 100}%`
            }}
          />
        </div>

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
          style={{ position: 'absolute', top: 0, width: '100%', height: '16px', opacity: 0, cursor: 'pointer', zIndex: 2 }}
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
          style={{ position: 'absolute', top: 0, width: '100%', height: '16px', opacity: 0, cursor: 'pointer', zIndex: 3 }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
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
    <div style={{ position: 'relative', width: '192px', height: '192px', margin: '0 auto' }}>
      {/* Outer ring */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--line)' }} />

      {/* Inner ring */}
      <div style={{ position: 'absolute', inset: '16px', borderRadius: '50%', border: '1px solid var(--line-strong)' }} />

      {/* Key buttons */}
      {wheelKeys.map((pair, index) => {
        const angle = (index * 30) - 90; // Start from top
        const outerRadius = 90;
        const innerRadius = 60;

        const isOuterSelected = selectedKeys.includes(pair[1]);
        const isInnerSelected = selectedKeys.includes(pair[0]);

        const outerKeyToken = `var(--key-${pair[1].toLowerCase()})`;
        const innerKeyToken = `var(--key-${pair[0].toLowerCase()})`;

        return (
          <React.Fragment key={index}>
            {/* Outer key (B - Major) */}
            <button
              type="button"
              onClick={() => toggleKey(pair[1])}
              aria-pressed={isOuterSelected}
              aria-label={`Key ${pair[1]}: ${CAMELOT_WHEEL[pair[1] as keyof typeof CAMELOT_WHEEL]}`}
              style={{
                position: 'absolute',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isOuterSelected ? outerKeyToken : 'var(--surface-2)',
                color: isOuterSelected ? '#000000' : 'var(--fg-2)',
                border: isOuterSelected ? '2px solid var(--fg)' : '1px solid var(--line)',
                transform: isOuterSelected ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                left: `calc(50% + ${Math.cos(angle * Math.PI / 180) * outerRadius}px - 16px)`,
                top: `calc(50% + ${Math.sin(angle * Math.PI / 180) * outerRadius}px - 16px)`
              }}
              title={CAMELOT_WHEEL[pair[1] as keyof typeof CAMELOT_WHEEL]}
            >
              {pair[1]}
            </button>

            {/* Inner key (A - Minor) */}
            <button
              type="button"
              onClick={() => toggleKey(pair[0])}
              aria-pressed={isInnerSelected}
              aria-label={`Key ${pair[0]}: ${CAMELOT_WHEEL[pair[0] as keyof typeof CAMELOT_WHEEL]}`}
              style={{
                position: 'absolute',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                fontSize: '0.6875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isInnerSelected ? innerKeyToken : 'var(--surface-1)',
                color: isInnerSelected ? '#ffffff' : 'var(--fg-3)',
                border: isInnerSelected ? '2px solid var(--fg)' : '1px solid var(--line)',
                transform: isInnerSelected ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
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
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: '8px', height: '8px', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--brand)', borderRadius: '50%' }} />
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
            <span>🎛️</span> Graph Filters
            {activeFilterCount > 0 && (
              <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--brand)', color: 'var(--on-brand)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                {activeFilterCount}
              </span>
            )}
          </h2>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              style={{ fontSize: '0.75rem', color: 'var(--fg-2)', backgroundColor: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', padding: 'var(--space-1) var(--space-2)', cursor: 'pointer' }}
            >
              Presets
            </button>
            <button
              type="button"
              onClick={resetAllFilters}
              style={{ fontSize: '0.75rem', color: 'var(--status-bad)', backgroundColor: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', padding: 'var(--space-1) var(--space-2)', cursor: 'pointer' }}
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Current filter status */}
        <div style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Showing:</span>
            <span style={{ fontFamily: 'var(--font-data)', color: 'var(--brand-strong)' }}>
              {graphData.nodes.length} / {originalGraphData?.nodes.length || graphData.nodes.length} nodes
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Edges:</span>
            <span style={{ fontFamily: 'var(--font-data)', color: 'var(--fg-2)' }}>
              {graphData.edges.length} / {originalGraphData?.edges.length || graphData.edges.length}
            </span>
          </div>
        </div>

        {/* Filter Presets */}
        {showPresets && (
          <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'var(--surface-2)', borderRadius: 'var(--radius-control)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                aria-label="Preset name"
                style={{ flex: 1, padding: 'var(--space-1) var(--space-2)', backgroundColor: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', color: 'var(--fg)', fontSize: '0.8125rem' }}
                onKeyDown={(e) => e.key === 'Enter' && savePreset()}
              />
              <button
                type="button"
                onClick={savePreset}
                disabled={!presetName.trim()}
                className="sn-btn sn-btn--sm"
              >
                Save
              </button>
            </div>

            <div style={{ maxHeight: '128px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {filterPresets.map(preset => (
                <div key={preset.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-chip)' }}>
                  <button
                    type="button"
                    onClick={() => loadPreset(preset)}
                    style={{ flex: 1, textAlign: 'left', fontSize: '0.8125rem', color: 'var(--fg)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {preset.name}
                  </button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                    {preset.created.toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => deletePreset(preset.id)}
                    style={{ fontSize: '0.75rem', color: 'var(--status-bad)', background: 'none', border: 'none', cursor: 'pointer' }}
                    aria-label={`Delete preset ${preset.name}`}
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
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* BPM Range Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => toggleExpanded('bpm')}
            aria-expanded={isExpanded.bpm}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => toggleExpanded('key')}
            aria-expanded={isExpanded.key}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span>{isExpanded.key ? '▼' : '▶'}</span>
            <span>🎹 Musical Key</span>
            {currentFilters.keyRange && currentFilters.keyRange.length > 0 && (
              <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--surface-3)', color: 'var(--fg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                {currentFilters.keyRange.length}
              </span>
            )}
          </button>

          {isExpanded.key && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <CamelotWheel
                selectedKeys={currentFilters.keyRange || []}
                onChange={(keys) => updateFilter('keyRange', keys)}
              />

              {/* Key compatibility helper */}
              {currentFilters.keyRange && currentFilters.keyRange.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <p style={{ margin: 0 }}>Selected: {currentFilters.keyRange.join(', ')}</p>
                  <p style={{ margin: 0, color: 'var(--brand-strong)' }}>💡 Compatible keys for harmonic mixing</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Genre Multi-Select Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => toggleExpanded('year')}
            aria-expanded={isExpanded.year}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => toggleExpanded('energy')}
            aria-expanded={isExpanded.energy}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <MultiSelect
            options={labels}
            selectedValues={(currentFilters as any).label || []}
            onChange={(values) => updateFilter('artist', values)}
            label="🏷️ Record Labels"
            searchable
            maxHeight="max-h-24"
          />
        </div>

        {/* Advanced Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => toggleExpanded('advanced')}
            aria-expanded={isExpanded.advanced}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span>{isExpanded.advanced ? '▼' : '▶'}</span>
            <span>⚙️ Advanced</span>
          </button>

          {isExpanded.advanced && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Edge Weight Threshold */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)' }}>
                  Edge Weight Threshold: {((currentFilters as any).edgeThreshold || 0.1).toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={(currentFilters as any).edgeThreshold || 0.1}
                  aria-label="Edge Weight Threshold"
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={(currentFilters as any).edgeThreshold || 0.1}
                  onChange={(e) => updateFilter('minPopularity', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                  <span>0.0</span>
                  <span>1.0</span>
                </div>
              </div>

              {/* Minimum Popularity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-2)' }}>
                  Min Popularity: {currentFilters.minPopularity || 0}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentFilters.minPopularity || 0}
                  aria-label="Minimum popularity"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={currentFilters.minPopularity || 0}
                  onChange={(e) => updateFilter('minPopularity', parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)', cursor: 'pointer' }}
                />
              </div>

              {/* Has Preview Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--fg-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={currentFilters.hasPreview || false}
                  onChange={(e) => updateFilter('hasPreview', e.target.checked)}
                  style={{ accentColor: 'var(--brand)' }}
                />
                <span>Has audio preview</span>
              </label>
            </div>
          )}
        </div>

        {/* Apply Filters Button */}
        <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => {
              applyFilters(currentFilters);
            }}
            className="sn-btn"
            style={{ width: '100%', backgroundColor: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 700 }}
          >
            Apply Filters ({activeFilterCount} active)
          </button>

          {/* Show current vs total counts */}
          <div style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--fg-3)' }}>
            Showing {graphData.nodes.length} of {originalGraphData?.nodes.length || graphData.nodes.length} nodes, {graphData.edges.length} of {originalGraphData?.edges.length || graphData.edges.length} edges
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export for lazy loading
export default FilterPanel;