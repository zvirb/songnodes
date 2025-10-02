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

    // Debounce search
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

  return (
    <div className={`advanced-search bg-gray-900 rounded-lg shadow-2xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Search size={24} />
          Advanced Search
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Close search"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, artists, genres... (supports fuzzy matching)"
            className="w-full pl-10 pr-12 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
          {isSearching && (
            <Loader2
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 animate-spin"
              size={18}
              aria-label="Searching..."
            />
          )}
          {query && !isSearching && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-gray-700 bg-gray-850 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            {/* BPM Range */}
            <FilterGroup
              title="BPM Range"
              icon={<Sliders size={16} />}
              isExpanded={activeFilterGroups.has('bpm')}
              onToggle={() => toggleFilterGroup('bpm')}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Min BPM</label>
                  <input
                    type="number"
                    value={filters.bpmMin || ''}
                    onChange={(e) => updateFilter('bpmMin', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="60"
                    className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Max BPM</label>
                  <input
                    type="number"
                    value={filters.bpmMax || ''}
                    onChange={(e) => updateFilter('bpmMax', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="180"
                    className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              {/* BPM Quick Select */}
              {facets?.bpmRanges && facets.bpmRanges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {facets.bpmRanges.map(range => (
                    <button
                      key={range.value}
                      onClick={() => {
                        const [min, max] = range.value.match(/\d+/g)?.map(Number) || [];
                        if (min !== undefined) updateFilter('bpmMin', min);
                        if (max !== undefined) updateFilter('bpmMax', max);
                      }}
                      className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                    >
                      {range.value} ({range.count})
                    </button>
                  ))}
                </div>
              )}
            </FilterGroup>

            {/* Genres */}
            {facets?.genres && facets.genres.length > 0 && (
              <FilterGroup
                title="Genres"
                icon={<Filter size={16} />}
                isExpanded={activeFilterGroups.has('genres')}
                onToggle={() => toggleFilterGroup('genres')}
              >
                <div className="space-y-2">
                  {facets.genres.slice(0, 10).map(genre => (
                    <label key={genre.value} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white cursor-pointer">
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
                        className="rounded"
                      />
                      <span className="flex-1">{genre.value}</span>
                      <span className="text-xs text-gray-500">({genre.count})</span>
                    </label>
                  ))}
                </div>
              </FilterGroup>
            )}

            {/* Keys */}
            {facets?.keys && facets.keys.length > 0 && (
              <FilterGroup
                title="Keys"
                icon={<Filter size={16} />}
                isExpanded={activeFilterGroups.has('keys')}
                onToggle={() => toggleFilterGroup('keys')}
              >
                <div className="grid grid-cols-4 gap-2">
                  {facets.keys.slice(0, 24).map(key => (
                    <button
                      key={key.value}
                      onClick={() => {
                        const current = filters.keys || [];
                        const updated = current.includes(key.value)
                          ? current.filter(k => k !== key.value)
                          : [...current, key.value];
                        updateFilter('keys', updated.length > 0 ? updated : undefined);
                      }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filters.keys?.includes(key.value)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {key.value}
                    </button>
                  ))}
                </div>
              </FilterGroup>
            )}

            {/* Moods */}
            {facets?.moods && facets.moods.length > 0 && (
              <FilterGroup
                title="Moods"
                icon={<Filter size={16} />}
                isExpanded={activeFilterGroups.has('moods')}
                onToggle={() => toggleFilterGroup('moods')}
              >
                <div className="flex flex-wrap gap-2">
                  {facets.moods.slice(0, 10).map(mood => (
                    <button
                      key={mood.value}
                      onClick={() => {
                        const current = filters.moods || [];
                        const updated = current.includes(mood.value)
                          ? current.filter(m => m !== mood.value)
                          : [...current, mood.value];
                        updateFilter('moods', updated.length > 0 ? updated : undefined);
                      }}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        filters.moods?.includes(mood.value)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {mood.value} ({mood.count})
                    </button>
                  ))}
                </div>
              </FilterGroup>
            )}

            {/* Energy Range */}
            <FilterGroup
              title="Energy Level"
              icon={<Sliders size={16} />}
              isExpanded={activeFilterGroups.has('energy')}
              onToggle={() => toggleFilterGroup('energy')}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Min Energy</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={filters.energyMin || ''}
                    onChange={(e) => updateFilter('energyMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0.0"
                    className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Max Energy</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={filters.energyMax || ''}
                    onChange={(e) => updateFilter('energyMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0"
                    className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </FilterGroup>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-400">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </h3>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map(node => (
            <button
              key={node.id}
              onClick={() => handleResultClick(node.id)}
              className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate group-hover:text-blue-400">
                    {node.track?.title || node.label || 'Unknown Track'}
                  </h4>
                  <p className="text-sm text-gray-400 truncate">
                    {node.track?.artist || 'Unknown Artist'}
                  </p>
                </div>
                <div className="ml-3 text-right flex-shrink-0">
                  {node.track?.bpm && (
                    <span className="text-xs text-gray-500">{node.track.bpm} BPM</span>
                  )}
                  {node.track?.key && (
                    <span className="block text-xs text-gray-500">{node.track.key}</span>
                  )}
                </div>
              </div>
              {node.metadata?.genre && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                    {node.metadata.genre}
                  </span>
                  {node.metadata?.mood && (
                    <span className="px-2 py-0.5 bg-purple-900/30 text-purple-300 text-xs rounded">
                      {node.metadata.mood}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}

          {results.length === 0 && query && !isSearching && (
            <div className="text-center py-8 text-gray-500">
              <Search size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-white mb-2">No results found for "{query}"</p>

              {/* Specific suggestions based on active filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-blue-400 hover:text-blue-300 underline mb-3 inline-block"
                >
                  Try clearing {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
                </button>
              )}

              {/* General suggestions */}
              {activeFilterCount === 0 && (
                <div className="text-sm mt-3 space-y-1">
                  <p>Suggestions:</p>
                  <ul className="list-disc list-inside text-gray-400">
                    <li>Check for typos in your search</li>
                    <li>Try broader search terms</li>
                    <li>Use fewer words in your search</li>
                    <li>Search by BPM, key, or genre instead</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {results.length === 0 && !query && (
            <div className="text-center py-8 text-gray-500">
              <Search size={48} className="mx-auto mb-3 opacity-50" />
              <p>Start typing to search tracks</p>
              <p className="text-sm mt-1">Supports fuzzy matching and advanced filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Filter Group Component
interface FilterGroupProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterGroup: React.FC<FilterGroupProps> = ({ title, icon, isExpanded, onToggle, children }) => {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2 text-white font-medium">
          {icon}
          {title}
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isExpanded && (
        <div className="p-3 bg-gray-800/50">
          {children}
        </div>
      )}
    </div>
  );
};