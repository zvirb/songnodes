import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Filter, ChevronDown, ChevronUp, Sliders, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { TrackSearchEngine, SearchFilters, SearchFacets, createSearchEngine } from '../utils/fuzzySearch';

interface AdvancedSearchProps {
  onClose?: () => void;
  className?: string;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onClose, className = '' }) => {
  const graphData = useStore(state => state.graphData);
  const selectNode = useStore(state => state.graph.selectNode);
  const clearSelection = useStore(state => state.graph.clearSelection);

  // Search state
  const [query, setQuery] = useState('');
  const [searchEngine, setSearchEngine] = useState<TrackSearchEngine | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilterGroups, setActiveFilterGroups] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);

  // Initialize search engine
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const engine = createSearchEngine(graphData.nodes);
      setSearchEngine(engine);
      setFacets(engine.generateFacets());
    }
  }, [graphData.nodes]);

  // Perform search
  useEffect(() => {
    if (!searchEngine) return;

    setIsSearching(true);

    const performSearch = () => {
      const searchResults = searchEngine.search(query, filters, 100);
      setResults(searchResults.map(r => r.item));
      setIsSearching(false);
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [query, filters, searchEngine]);

  // Update facets when filters change
  useEffect(() => {
    if (!searchEngine || results.length === 0) return;
    const newFacets = searchEngine.generateFacets(results);
    setFacets(newFacets);
  }, [results, searchEngine]);

  // Toggle filter group expansion
  const toggleFilterGroup = useCallback((group: string) => {
    setActiveFilterGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  // Update filters
  const updateFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setQuery('');
  }, []);

  // Select search result
  const handleResultClick = useCallback((nodeId: string) => {
    clearSelection();
    selectNode(nodeId);
  }, [selectNode, clearSelection]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.genres?.length) count++;
    if (filters.keys?.length) count++;
    if (filters.moods?.length) count++;
    if (filters.bpmMin !== undefined || filters.bpmMax !== undefined) count++;
    if (filters.energyMin !== undefined || filters.energyMax !== undefined) count++;
    if (filters.yearMin !== undefined || filters.yearMax !== undefined) count++;
    return count;
  }, [filters]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query) {
        setQuery('');
      } else if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div
      className={`advanced-search ${className}`}
      onKeyDown={handleKeyDown}
      style={{
        backgroundColor: 'var(--surface-1)',
        color: 'var(--fg)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-2)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--line)'
        }}
      >
        <h2 className="sn-title title-s" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Search size={20} strokeWidth={2} aria-hidden="true" />
          Advanced Search
        </h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="sn-btn sn-btn--icon sn-btn--quiet"
            aria-label="Close search"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Search Input */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 'var(--space-3)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--fg-3)',
              pointerEvents: 'none',
              display: 'inline-flex'
            }}
          >
            <Search size={18} strokeWidth={2} aria-hidden="true" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, artists, genres... (supports fuzzy matching)"
            className="sn-input"
            style={{
              width: '100%',
              paddingLeft: 'var(--space-10)',
              paddingRight: 'var(--space-10)',
              height: 'var(--control-md)'
            }}
            aria-label="Search query"
          />
          {isSearching ? (
            <Loader2
              style={{
                position: 'absolute',
                right: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--brand)',
                animation: 'spin 1s linear infinite'
              }}
              size={18}
              aria-label="Searching..."
            />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--fg-3)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                borderRadius: 'var(--radius-chip)'
              }}
              aria-label="Clear search"
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Filter Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="sn-btn sn-btn--quiet"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <Filter size={16} strokeWidth={2} aria-hidden="true" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="sn-pill" style={{ backgroundColor: 'var(--brand)', color: 'var(--on-brand)' }}>
                {activeFilterCount}
              </span>
            ) : null}
            {showFilters ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
          </button>

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="sn-btn sn-btn--quiet sn-btn--sm"
              style={{ color: 'var(--brand)' }}
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters ? (
        <div
          style={{
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--line)',
            backgroundColor: 'var(--surface-2)',
            maxHeight: '384px',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* BPM Range */}
            <FilterGroup
              title="BPM Range"
              icon={<Sliders size={16} strokeWidth={2} />}
              isExpanded={activeFilterGroups.has('bpm')}
              onToggle={() => toggleFilterGroup('bpm')}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--fg-3)' }}>
                    Min BPM
                  </label>
                  <input
                    type="number"
                    value={filters.bpmMin || ''}
                    onChange={(e) => updateFilter('bpmMin', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="60"
                    className="sn-input"
                    style={{ width: '100%', height: 'var(--control-sm)' }}
                  />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--fg-3)' }}>
                    Max BPM
                  </label>
                  <input
                    type="number"
                    value={filters.bpmMax || ''}
                    onChange={(e) => updateFilter('bpmMax', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="180"
                    className="sn-input"
                    style={{ width: '100%', height: 'var(--control-sm)' }}
                  />
                </div>
              </div>
              {facets?.bpmRanges && facets.bpmRanges.length > 0 ? (
                <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                  {facets.bpmRanges.map(range => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => {
                        const [min, max] = range.value.match(/\d+/g)?.map(Number) || [];
                        if (min !== undefined) updateFilter('bpmMin', min);
                        if (max !== undefined) updateFilter('bpmMax', max);
                      }}
                      className="sn-btn sn-btn--quiet sn-btn--sm"
                    >
                      {range.value} ({range.count})
                    </button>
                  ))}
                </div>
              ) : null}
            </FilterGroup>

            {/* Genres */}
            {facets?.genres && facets.genres.length > 0 ? (
              <FilterGroup
                title="Genres"
                icon={<Filter size={16} strokeWidth={2} />}
                isExpanded={activeFilterGroups.has('genres')}
                onToggle={() => toggleFilterGroup('genres')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {facets.genres.slice(0, 10).map(genre => (
                    <label key={genre.value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.875rem', cursor: 'pointer', color: 'var(--fg)' }}>
                      <input
                        type="checkbox"
                        checked={filters.genres?.includes(genre.value) || false}
                        onChange={(e) => {
                          const current = filters.genres || [];
                          const updated = e.target.checked
                            ? [...current, genre.value]
                            : current.filter(g => g !== genre.value);
                          updateFilter('genres', updated.length > 0 ? updated : undefined);
                        }}
                      />
                      <span style={{ flex: 1 }}>{genre.value}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--fg-3)' }}>({genre.count})</span>
                    </label>
                  ))}
                </div>
              </FilterGroup>
            ) : null}

            {/* Keys */}
            {facets?.keys && facets.keys.length > 0 ? (
              <FilterGroup
                title="Keys"
                icon={<Filter size={16} strokeWidth={2} />}
                isExpanded={activeFilterGroups.has('keys')}
                onToggle={() => toggleFilterGroup('keys')}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-1)' }}>
                  {facets.keys.slice(0, 24).map(key => {
                    const isSelected = filters.keys?.includes(key.value);
                    return (
                      <button
                        key={key.value}
                        type="button"
                        onClick={() => {
                          const current = filters.keys || [];
                          const updated = current.includes(key.value)
                            ? current.filter(k => k !== key.value)
                            : [...current, key.value];
                          updateFilter('keys', updated.length > 0 ? updated : undefined);
                        }}
                        className={`sn-btn sn-btn--sm ${isSelected ? 'sn-btn--primary' : 'sn-btn--quiet'}`}
                      >
                        {key.value}
                      </button>
                    );
                  })}
                </div>
              </FilterGroup>
            ) : null}

            {/* Moods */}
            {facets?.moods && facets.moods.length > 0 ? (
              <FilterGroup
                title="Moods"
                icon={<Filter size={16} strokeWidth={2} />}
                isExpanded={activeFilterGroups.has('moods')}
                onToggle={() => toggleFilterGroup('moods')}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                  {facets.moods.slice(0, 10).map(mood => {
                    const isSelected = filters.moods?.includes(mood.value);
                    return (
                      <button
                        key={mood.value}
                        type="button"
                        onClick={() => {
                          const current = filters.moods || [];
                          const updated = current.includes(mood.value)
                            ? current.filter(m => m !== mood.value)
                            : [...current, mood.value];
                          updateFilter('moods', updated.length > 0 ? updated : undefined);
                        }}
                        className={`sn-btn sn-btn--sm ${isSelected ? 'sn-btn--primary' : 'sn-btn--quiet'}`}
                      >
                        {mood.value} ({mood.count})
                      </button>
                    );
                  })}
                </div>
              </FilterGroup>
            ) : null}

            {/* Energy Range */}
            <FilterGroup
              title="Energy Level"
              icon={<Sliders size={16} strokeWidth={2} />}
              isExpanded={activeFilterGroups.has('energy')}
              onToggle={() => toggleFilterGroup('energy')}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--fg-3)' }}>
                    Min Energy
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={filters.energyMin || ''}
                    onChange={(e) => updateFilter('energyMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0.0"
                    className="sn-input"
                    style={{ width: '100%', height: 'var(--control-sm)' }}
                  />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--fg-3)' }}>
                    Max Energy
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={filters.energyMax || ''}
                    onChange={(e) => updateFilter('energyMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0"
                    className="sn-input"
                    style={{ width: '100%', height: 'var(--control-sm)' }}
                  />
                </div>
              </div>
            </FilterGroup>
          </div>
        </div>
      ) : null}

      {/* Results */}
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <span className="caption" style={{ color: 'var(--fg-3)', fontWeight: 600 }}>
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '384px', overflowY: 'auto' }}>
          {results.map(node => (
            <button
              key={node.id}
              type="button"
              onClick={() => handleResultClick(node.id)}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-control)',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--fg)',
                transition: 'background var(--duration-fast) var(--ease-standard)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-2)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {node.track?.title || node.label || 'Unknown Track'}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--fg-2)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {node.track?.artist || 'Unknown Artist'}
                  </p>
                </div>
                <div style={{ marginLeft: 'var(--space-3)', textAlign: 'right', flexShrink: 0 }}>
                  {node.track?.bpm ? (
                    <span style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-data)', color: 'var(--fg-2)' }}>
                      {node.track.bpm} BPM
                    </span>
                  ) : null}
                  {node.track?.key ? (
                    <span style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-data)', color: 'var(--fg-2)' }}>
                      {node.track.key}
                    </span>
                  ) : null}
                </div>
              </div>
              {node.metadata?.genre ? (
                <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                  <span className="sn-tag">{node.metadata.genre}</span>
                  {node.metadata?.mood ? (
                    <span className="sn-tag">{node.metadata.mood}</span>
                  ) : null}
                </div>
              ) : null}
            </button>
          ))}

          {results.length === 0 && query && !isSearching ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--fg-3)' }}>
              <Search size={40} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }} />
              <p style={{ color: 'var(--fg)', marginBottom: 'var(--space-2)' }}>No results found for "{query}"</p>

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="sn-btn sn-btn--quiet sn-btn--sm"
                  style={{ color: 'var(--brand)' }}
                >
                  Try clearing {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
                </button>
              ) : null}
            </div>
          ) : null}

          {results.length === 0 && !query ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--fg-3)' }}>
              <Search size={40} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }} />
              <p style={{ margin: 0 }}>Start typing to search tracks</p>
              <p className="caption" style={{ marginTop: 'var(--space-1)' }}>Supports fuzzy matching and advanced filters</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

interface FilterGroupProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterGroup: React.FC<FilterGroupProps> = ({ title, icon, isExpanded, onToggle, children }) => {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-control)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--surface-1)',
          border: 'none',
          color: 'var(--fg)',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {icon}
          {title}
        </div>
        {isExpanded ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
      </button>
      {isExpanded ? (
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--surface-2)', borderTop: '1px solid var(--line)' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
};
