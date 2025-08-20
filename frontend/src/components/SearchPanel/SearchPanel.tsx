import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setSearchQuery, setSearchResults, setSearchFilters } from '@store/searchSlice';
import { addToast } from '@store/uiSlice';
import { SearchRequest, AdvancedSearchRequest, SearchResult } from '@types/api';
import { GraphFilters } from '@types/graph';
import { searchService } from '@services/searchService';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  StarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon as MagnifyingGlassIconSolid } from '@heroicons/react/24/solid';

interface SearchPanelProps {
  className?: string;
  isCompact?: boolean;
  onResultSelect?: (result: SearchResult) => void;
  onClose?: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  className,
  isCompact = false,
  onResultSelect,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Local state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  
  // Redux state
  const {
    query,
    isSearching,
    results,
    suggestions,
    recentSearches,
    filters,
    selectedResultIndex,
  } = useAppSelector(state => state.search);
  
  const { nodes } = useAppSelector(state => state.graph);
  
  // Debounced search function
  const debouncedSearch = useDebouncedCallback(
    useCallback(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        dispatch(setSearchResults({ results: [], total: 0, hasMore: false }));
        return;
      }
      
      try {
        const request: SearchRequest = {
          q: searchQuery,
          type: 'fuzzy',
          fields: ['title', 'artist', 'album', 'genres'],
          limit: 20,
        };
        
        const response = await searchService.search(request);
        
        const searchResults = response.data.results.map(result => ({
          node: nodes.find(n => n.id === result.id)!,
          score: result.score,
          highlights: result.highlights,
          reason: `Matched in ${Object.keys(result.highlights).join(', ')}`,
        }));
        
        dispatch(setSearchResults({
          results: searchResults,
          total: response.data.totalResults,
          hasMore: response.data.totalResults > searchResults.length,
        }));
        
      } catch (error) {
        console.error('Search failed:', error);
        dispatch(addToast({
          type: 'error',
          title: 'Search Failed',
          message: 'Unable to perform search. Please try again.',
        }));
      }
    }, [dispatch, nodes]),
    300
  );
  
  // Handle search input changes
  const handleSearchChange = useCallback((value: string) => {
    setLocalQuery(value);
    dispatch(setSearchQuery(value));
    debouncedSearch(value);
  }, [dispatch, debouncedSearch]);
  
  // Advanced search
  const handleAdvancedSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    try {
      const request: AdvancedSearchRequest = {
        criteria: {
          text: {
            query,
            fields: ['title', 'artist', 'album', 'genres'],
            fuzzy: true,
          },
          filters: {
            genres: filters.genres.length > 0 ? filters.genres : undefined,
            bpmRange: filters.bpmRange || undefined,
            yearRange: filters.yearRange || undefined,
          },
        },
        options: {
          limit: 50,
          offset: 0,
          sortBy: 'relevance',
          includeFacets: true,
        },
      };
      
      const response = await searchService.advancedSearch(request);
      
      const searchResults = response.data.results.map(result => ({
        node: nodes.find(n => n.id === result.id)!,
        score: result.score,
        highlights: result.highlights,
        reason: `Matched in ${Object.keys(result.highlights).join(', ')}`,
      }));
      
      dispatch(setSearchResults({
        results: searchResults,
        total: response.data.totalResults,
        hasMore: response.data.totalResults > searchResults.length,
      }));
      
    } catch (error) {
      console.error('Advanced search failed:', error);
      dispatch(addToast({
        type: 'error',
        title: 'Advanced Search Failed',
        message: 'Unable to perform advanced search. Please try again.',
      }));
    }
  }, [query, filters, nodes, dispatch]);
  
  // Handle result selection
  const handleResultSelect = useCallback((result: SearchResult, index: number) => {
    dispatch(setSearchQuery(result.node.title));
    onResultSelect?.(result);
  }, [dispatch, onResultSelect]);
  
  // Keyboard shortcuts
  useHotkeys('ctrl+f, cmd+f', (event) => {
    event.preventDefault();
    searchInputRef.current?.focus();
  }, { enableOnFormTags: true });
  
  useHotkeys('escape', () => {
    if (searchInputRef.current === document.activeElement) {
      searchInputRef.current?.blur();
    }
    onClose?.();
  }, { enableOnFormTags: true });
  
  // Navigation in results
  useHotkeys('ArrowDown', (event) => {
    if (searchInputRef.current === document.activeElement && results.length > 0) {
      event.preventDefault();
      // Handle arrow down navigation
    }
  }, { enableOnFormTags: true });
  
  useHotkeys('ArrowUp', (event) => {
    if (searchInputRef.current === document.activeElement && results.length > 0) {
      event.preventDefault();
      // Handle arrow up navigation
    }
  }, { enableOnFormTags: true });
  
  useHotkeys('Enter', (event) => {
    if (searchInputRef.current === document.activeElement && results.length > 0) {
      event.preventDefault();
      // Handle enter to select result
      if (selectedResultIndex >= 0 && results[selectedResultIndex]) {
        handleResultSelect(results[selectedResultIndex], selectedResultIndex);
      }
    }
  }, { enableOnFormTags: true });
  
  // Clear search
  const clearSearch = useCallback(() => {
    setLocalQuery('');
    dispatch(setSearchQuery(''));
    dispatch(setSearchResults({ results: [], total: 0, hasMore: false }));
  }, [dispatch]);
  
  // Quick filters
  const quickFilters = [
    { label: 'Rock', value: 'Rock', count: 1234 },
    { label: 'Pop', value: 'Pop', count: 987 },
    { label: 'Electronic', value: 'Electronic', count: 765 },
    { label: '2020s', value: '2020s', count: 543 },
    { label: 'High Energy', value: 'high-energy', count: 321 },
  ];
  
  return (
    <div className={classNames(
      'bg-white dark:bg-gray-900 shadow-lg border-b border-gray-200 dark:border-gray-700',
      isCompact ? 'p-3' : 'p-4',
      className
    )}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
          ) : (
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          ref={searchInputRef}
          type="text"
          value={localQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search songs, artists, albums, or genres..."
          className={classNames(
            'block w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600',
            'rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
            'placeholder-gray-500 dark:placeholder-gray-400',
            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'transition-colors duration-200',
            isCompact ? 'text-sm py-2' : 'text-base py-3'
          )}
          autoComplete="off"
          spellCheck="false"
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
          {localQuery && (
            <button
              onClick={clearSearch}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Clear search"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={classNames(
              'p-1 transition-colors',
              showAdvanced 
                ? 'text-primary-500' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            )}
            title="Advanced search"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Quick Filters */}
      {!isCompact && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => {
                // Handle quick filter selection
                const newFilters = { ...filters };
                if (filter.value === 'high-energy') {
                  newFilters.advanced = true;
                  // Set energy range filter
                } else if (['Rock', 'Pop', 'Electronic'].includes(filter.value)) {
                  if (newFilters.genres.includes(filter.value)) {
                    newFilters.genres = newFilters.genres.filter(g => g !== filter.value);
                  } else {
                    newFilters.genres = [...newFilters.genres, filter.value];
                  }
                }
                dispatch(setSearchFilters(newFilters));
              }}
              className={classNames(
                'inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full',
                'border border-gray-200 dark:border-gray-600',
                'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300',
                'hover:bg-gray-50 dark:hover:bg-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                'transition-colors duration-200',
                filters.genres.includes(filter.value) && 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-primary-300'
              )}
            >
              <span>{filter.label}</span>
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      )}
      
      {/* Advanced Search Filters */}
      {showAdvanced && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Genre Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Genres
              </label>
              <select
                multiple
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={filters.genres}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  dispatch(setSearchFilters({ ...filters, genres: selected }));
                }}
              >
                <option value="Rock">Rock</option>
                <option value="Pop">Pop</option>
                <option value="Electronic">Electronic</option>
                <option value="Hip-Hop">Hip-Hop</option>
                <option value="Jazz">Jazz</option>
                <option value="Classical">Classical</option>
              </select>
            </div>
            
            {/* BPM Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                BPM Range
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.bpmRange?.[0] || ''}
                  onChange={(e) => {
                    const min = e.target.value ? parseInt(e.target.value) : undefined;
                    dispatch(setSearchFilters({
                      ...filters,
                      bpmRange: min ? [min, filters.bpmRange?.[1] || 200] : undefined
                    }));
                  }}
                />
                <input
                  type="number"
                  placeholder="Max"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.bpmRange?.[1] || ''}
                  onChange={(e) => {
                    const max = e.target.value ? parseInt(e.target.value) : undefined;
                    dispatch(setSearchFilters({
                      ...filters,
                      bpmRange: max ? [filters.bpmRange?.[0] || 60, max] : undefined
                    }));
                  }}
                />
              </div>
            </div>
            
            {/* Year Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Release Year
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="From"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.yearRange?.[0] || ''}
                  onChange={(e) => {
                    const from = e.target.value ? parseInt(e.target.value) : undefined;
                    dispatch(setSearchFilters({
                      ...filters,
                      yearRange: from ? [from, filters.yearRange?.[1] || new Date().getFullYear()] : undefined
                    }));
                  }}
                />
                <input
                  type="number"
                  placeholder="To"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.yearRange?.[1] || ''}
                  onChange={(e) => {
                    const to = e.target.value ? parseInt(e.target.value) : undefined;
                    dispatch(setSearchFilters({
                      ...filters,
                      yearRange: to ? [filters.yearRange?.[0] || 1950, to] : undefined
                    }));
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => {
                dispatch(setSearchFilters({
                  genres: [],
                  artists: [],
                  types: [],
                  advanced: false,
                }));
              }}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Clear Filters
            </button>
            <button
              onClick={handleAdvancedSearch}
              className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-md hover:bg-primary-600 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
      
      {/* Recent Searches */}
      {!query && recentSearches.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
            <ClockIcon className="h-4 w-4 mr-1" />
            Recent Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.slice(0, 5).map((search, index) => (
              <button
                key={index}
                onClick={() => handleSearchChange(search)}
                className="inline-flex items-center px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Search Results */}
      {results.length > 0 && (
        <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={result.node.id}
              onClick={() => handleResultSelect(result, index)}
              className={classNames(
                'w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                index === selectedResultIndex && 'bg-primary-50 dark:bg-primary-900',
                index < results.length - 1 && 'border-b border-gray-200 dark:border-gray-600'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      <span dangerouslySetInnerHTML={{ __html: result.highlights.title || result.node.title }} />
                    </h4>
                    <div className="flex items-center text-xs text-gray-500">
                      <StarIcon className="h-3 w-3 mr-1" />
                      {(result.score * 100).toFixed(0)}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    <span dangerouslySetInnerHTML={{ __html: result.highlights.artist || result.node.artist }} />
                    {result.node.album && (
                      <>
                        {' • '}
                        <span dangerouslySetInnerHTML={{ __html: result.highlights.album || result.node.album }} />
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {result.reason}
                  </p>
                </div>
                <div className="flex flex-col items-end text-xs text-gray-500 dark:text-gray-500">
                  {result.node.genres.slice(0, 2).map(genre => (
                    <span key={genre} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded mb-1">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* No Results */}
      {query && !isSearching && results.length === 0 && (
        <div className="mt-4 text-center py-8">
          <MagnifyingGlassIconSolid className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            No results found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            We couldn't find any songs matching "{query}"
          </p>
          <button
            onClick={() => setShowAdvanced(true)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
          >
            Try advanced search options
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;