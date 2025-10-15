import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// import { FixedSizeList as List } from 'react-window'; // Removed for TypeScript compatibility
import Fuse from 'fuse.js';
import { useDebounce } from 'react-use';
import clsx from 'clsx';
import { LocateFixed, ListPlus, Route } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import {
  Track,
  SearchResult,
  SearchFilters,
  DEFAULT_CONFIG,
  GraphNode
} from '../types';

// Musical key mappings for filtering
const CAMELOT_KEYS = [
  '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B'
];

const GENRES = [
  'House', 'Techno', 'Trance', 'Progressive', 'Deep House', 'Tech House',
  'Minimal', 'Electro', 'Drum & Bass', 'Dubstep', 'Ambient', 'Breakbeat',
  'Garage', 'Disco', 'Funk', 'Jazz', 'Classical', 'Rock', 'Pop'
];

// Recent searches storage key
const RECENT_SEARCHES_KEY = 'songnodes-recent-searches';
const MAX_RECENT_SEARCHES = 10;

interface TrackSearchProps {
  className?: string;
  placeholder?: string;
  showFilters?: boolean;
  maxResults?: number;
  onTrackSelect?: (track: Track) => void;
  onClose?: () => void;
}

interface RecentSearch {
  query: string;
  timestamp: number;
  resultCount: number;
}

interface FilterState {
  bpmRange: [number, number];
  keys: string[];
  genres: string[];
  yearRange: [number, number];
  energyRange: [number, number];
  minPopularity: number;
  hasPreview: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  bpmRange: [60, 200],
  keys: [],
  genres: [],
  yearRange: [1950, new Date().getFullYear()],
  energyRange: [0, 1],
  minPopularity: 0,
  hasPreview: false,
};

const convertFiltersToSearchFilters = (filters: FilterState): SearchFilters => ({
  bpmRange: filters.bpmRange,
  keyRange: filters.keys,
  genre: filters.genres,
  yearRange: filters.yearRange,
  energyRange: filters.energyRange,
  minPopularity: filters.minPopularity,
  hasPreview: filters.hasPreview
});

const applyLocalFilters = (results: SearchResult[], filters: FilterState): SearchResult[] => {
  return results.filter(result => {
    const track = result.track;

    if (track.bpm && (track.bpm < filters.bpmRange[0] || track.bpm > filters.bpmRange[1])) {
      return false;
    }

    if (filters.keys.length > 0 && track.camelotKey && !filters.keys.includes(track.camelotKey)) {
      return false;
    }

    if (filters.genres.length > 0 && track.genre && !filters.genres.includes(track.genre)) {
      return false;
    }

    if (track.year && (track.year < filters.yearRange[0] || track.year > filters.yearRange[1])) {
      return false;
    }

    if (track.energy !== undefined && (track.energy < filters.energyRange[0] || track.energy > filters.energyRange[1])) {
      return false;
    }

    if (track.popularity !== undefined && track.popularity < filters.minPopularity) {
      return false;
    }

    if (filters.hasPreview && !track.preview_url) {
      return false;
    }

    return true;
  });
};

const TrackSearch: React.FC<TrackSearchProps> = ({
  className,
  placeholder = "Search tracks, artists, albums...",
  showFilters = true,
  maxResults = 100,
  onTrackSelect,
  onClose
}) => {
  // Store hooks
  const {
    searchQuery,
    searchResults,
    searchFilters,
    viewState,
    currentSetlist,
    pathfindingState,
    setSearchQuery,
    setSearchResults,
    setSearchFilters,
    selectNode,
    addTrackToSetlist,
    addWaypoint,
    navigateToNode
  } = useStore((state) => ({
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    searchFilters: state.searchFilters,
    viewState: state.viewState,
    currentSetlist: state.currentSetlist,
    pathfindingState: state.pathfindingState,
    setSearchQuery: state.search.setSearchQuery,
    setSearchResults: state.search.setSearchResults,
    setSearchFilters: state.search.setSearchFilters,
    selectNode: state.graph.selectNode,
    addTrackToSetlist: state.setlist.addTrackToSetlist,
    addWaypoint: state.pathfinding.addWaypoint,
    navigateToNode: state.view.navigateToNode
  }));

  const graphNodes = useStore((state) => state.graphData.nodes);

  // Local state
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  // const listRef = useRef<any>(null); // Removed for now
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const savedSearches = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (savedSearches) {
      try {
        const searches: RecentSearch[] = JSON.parse(savedSearches);
        setRecentSearches(searches.sort((a, b) => b.timestamp - a.timestamp));
      } catch (error) {
        console.error('Error parsing recent searches:', error);
      }
    }
  }, []);

  // Initialize filters from store
  useEffect(() => {
    if (searchFilters) {
      setFilters(prev => ({
        ...prev,
        bpmRange: searchFilters.bpmRange || prev.bpmRange,
        keys: searchFilters.keyRange || prev.keys,
        genres: searchFilters.genre || prev.genres,
        yearRange: searchFilters.yearRange || prev.yearRange,
        energyRange: searchFilters.energyRange || prev.energyRange,
        minPopularity: searchFilters.minPopularity || prev.minPopularity,
        hasPreview: searchFilters.hasPreview || prev.hasPreview,
      }));
    }
  }, [searchFilters]);

  // Load all tracks for local search (fallback when API is unavailable)
  useEffect(() => {
    const normaliseNodeToTrack = (node: GraphNode): Track | null => {
      const metadata = node.metadata || {};
      const baseTrack = node.track as Track | undefined;

      const name = baseTrack?.name || baseTrack?.title || node.title || metadata.title || node.label;
      const artist = baseTrack?.artist || metadata.artist || node.artist;

      if (!name || !artist) {
        return null;
      }

      const trackId = baseTrack?.id ?? node.id;

      return {
        id: trackId,
        name,
        title: name,
        artist,
        album: baseTrack?.album ?? metadata.album ?? node.metadata?.album,
        bpm: baseTrack?.bpm ?? metadata.bpm ?? node.bpm,
        key: baseTrack?.key ?? metadata.key ?? node.key,
        camelotKey: baseTrack?.camelotKey ?? metadata.camelotKey ?? metadata.camelot_key ?? node.camelot_key,
        genre: baseTrack?.genre ?? metadata.genre ?? node.genre,
        year: baseTrack?.year ?? metadata.year ?? node.year ?? metadata.release_year,
        energy: baseTrack?.energy ?? metadata.energy ?? node.energy,
        duration: baseTrack?.duration ?? metadata.duration ?? node.duration,
        preview_url: baseTrack?.preview_url ?? metadata.preview_url ?? metadata.previewUrl,
        popularity: baseTrack?.popularity ?? metadata.popularity ?? node.popularity,
        danceability: baseTrack?.danceability ?? metadata.danceability,
        valence: baseTrack?.valence ?? metadata.valence,
      };
    };

    const unique = new Map<string, Track>();

    graphNodes.forEach((node) => {
      const track = normaliseNodeToTrack(node);
      if (track && !unique.has(track.id)) {
        unique.set(track.id, track);
      }
    });

    const sortedTracks = Array.from(unique.values()).sort((a, b) => {
      const artistCompare = (a.artist || '').localeCompare(b.artist || '');
      if (artistCompare !== 0) return artistCompare;
      return (a.name || '').localeCompare(b.name || '');
    });

    setAllTracks(sortedTracks);
  }, [graphNodes]);

  // Fuse.js configuration for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'name', weight: 0.3 },
      { name: 'artist', weight: 0.3 },
      { name: 'album', weight: 0.2 },
      { name: 'genre', weight: 0.2 }
    ],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  };

  const fuse = useMemo(() => new Fuse(allTracks, fuseOptions), [allTracks]);

  // Save search to recent searches function
  const saveToRecentSearches = useCallback((query: string, resultCount: number) => {
    const newSearch: RecentSearch = {
      query,
      timestamp: Date.now(),
      resultCount
    };

    const updatedSearches = [
      newSearch,
      ...recentSearches.filter(s => s.query !== query)
    ].slice(0, MAX_RECENT_SEARCHES);

    setRecentSearches(updatedSearches);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches));
  }, [recentSearches]);

  // Search function
  const performSearch = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();

    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);
    setSearchError(null);

    let resultsToPersist: SearchResult[] = [];

    try {
      const apiResponse = await api.search.searchTracks(query, convertFiltersToSearchFilters(filters));

      if (apiResponse.status === 'success') {
        const apiResults = (apiResponse.data || []).slice(0, maxResults);
        setSearchResults(apiResults);
        resultsToPersist = apiResults;
      } else {
        throw new Error(apiResponse.message || 'Search service error');
      }
    } catch (error) {
      console.warn('API search failed, falling back to local graph data:', error);
      const fuseResults = fuse.search(query).slice(0, maxResults);

      const fallbackResults: SearchResult[] = fuseResults.map(result => ({
        track: result.item,
        score: result.score ? 1 - result.score : 1,
        matches: (result.matches || []).map(match => ({
          field: match.key || '',
          value: match.value || '',
          indices: (match.indices || []).map(range => [range[0], range[1]])
        }))
      }));

      const filtered = applyLocalFilters(fallbackResults, filters);
      setSearchResults(filtered);
      resultsToPersist = filtered;
      setSearchError('Realtime search is temporarily unavailable. Showing matches from the loaded graph.');
    } finally {
      setIsSearching(false);
      setSelectedIndex(0);

      if (query) {
        saveToRecentSearches(query, resultsToPersist.length);
      }
    }
  }, [fuse, filters, maxResults, saveToRecentSearches, setSearchResults]);

  // Debounced search effect
  useDebounce(() => {
    if (localQuery.trim()) {
      performSearch(localQuery);
    }
  }, DEFAULT_CONFIG.ui.debounceDelay, [localQuery, performSearch]);


  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setLocalQuery(query);
    setSearchQuery(query);
    setSearchError(null);

    if (query.trim().length === 0) {
      setShowDropdown(false);
      setSearchResults([]);
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (localQuery.trim().length === 0 && recentSearches.length > 0) {
      setShowRecentSearches(true);
      setShowDropdown(true);
    } else if (searchResults.length > 0) {
      setShowDropdown(true);
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    // Delay to allow clicking on dropdown items
    setTimeout(() => {
      setShowDropdown(false);
      setShowRecentSearches(false);
    }, 200);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const resultsCount = showRecentSearches ? recentSearches.length : searchResults.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, resultsCount - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (showRecentSearches && recentSearches[selectedIndex]) {
          handleRecentSearchClick(recentSearches[selectedIndex].query);
        } else if (searchResults[selectedIndex]) {
          handleTrackSelect(searchResults[selectedIndex].track);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setShowRecentSearches(false);
        searchInputRef.current?.blur();
        onClose?.();
        break;
    }
  };

  // Handle recent search click
  const handleRecentSearchClick = (query: string) => {
    setLocalQuery(query);
    setSearchQuery(query);
    setShowRecentSearches(false);
    performSearch(query);
  };

  // Handle track selection
  const handleTrackSelect = (track: Track) => {
    selectNode(track.id);
    navigateToNode(track.id, { highlight: true, selectNode: true });
    setShowDropdown(false);
    onTrackSelect?.(track);
  };

  const handleFocusTrack = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    navigateToNode(track.id, { highlight: true, selectNode: true });
    selectNode(track.id);
    setShowDropdown(false);
    onTrackSelect?.(track);
  };

  // Handle add to setlist
  const handleAddToSetlist = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    addTrackToSetlist(track);
  };

  // Handle add to path waypoints
  const handleAddToWaypoints = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    addWaypoint(track.id);
  };

  // Filter change handlers
  const handleBpmRangeChange = (range: [number, number]) => {
    const newFilters = { ...filters, bpmRange: range };
    setFilters(newFilters);
    setSearchFilters(convertFiltersToSearchFilters(newFilters));
    if (localQuery) performSearch(localQuery);
  };

  const handleKeysChange = (keys: string[]) => {
    const newFilters = { ...filters, keys };
    setFilters(newFilters);
    setSearchFilters(convertFiltersToSearchFilters(newFilters));
    if (localQuery) performSearch(localQuery);
  };

  const handleGenresChange = (genres: string[]) => {
    const newFilters = { ...filters, genres };
    setFilters(newFilters);
    setSearchFilters(convertFiltersToSearchFilters(newFilters));
    if (localQuery) performSearch(localQuery);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchFilters({});
    if (localQuery) performSearch(localQuery);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Virtualized list item renderer for recent searches
  const RecentSearchItem: React.FC<{ index: number; style: React.CSSProperties }> = ({ index, style }) => {
    const search = recentSearches[index];
    if (!search) return null;

    return (
      <div
        style={style}
        className={clsx(
          'px-4 py-2 cursor-pointer border-b border-gray-100 hover:bg-gray-50',
          index === selectedIndex && 'bg-blue-50'
        )}
        onClick={() => handleRecentSearchClick(search.query)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{search.query}</span>
          </div>
          <span className="text-xs text-gray-500">{search.resultCount} results</span>
        </div>
      </div>
    );
  };

  // Virtualized list item renderer for search results
  const SearchResultItem: React.FC<{ index: number; style: React.CSSProperties }> = ({ index, style }) => {
    const searchResult = searchResults[index];
    if (!searchResult) return null;

    const { track, score, matches } = searchResult;

    return (
      <div
        style={style}
        className={clsx(
          'px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors',
          index === selectedIndex && 'bg-blue-50',
          viewState.selectedNodes.has(track.id) && 'ring-2 ring-blue-400'
        )}
        onClick={() => handleTrackSelect(track)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {track.name}
              </h4>
              {score && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                  {Math.round(score * 100)}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate mb-1">
              by {track.artist}
              {track.album && ` • ${track.album}`}
            </p>
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              {track.bpm && <span>{track.bpm} BPM</span>}
              {track.camelotKey && <span>{track.camelotKey}</span>}
              {track.genre && <span>{track.genre}</span>}
              {track.year && <span>{track.year}</span>}
            </div>

            {/* Highlight matches */}
            {matches.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                Matches: {matches.map((match: any) => match.field).join(', ')}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1 ml-3">
            <button
              onClick={(e) => handleFocusTrack(e, track)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Focus in graph"
            >
              <LocateFixed size={16} strokeWidth={1.8} />
            </button>

            <button
              onClick={(e) => handleAddToSetlist(e, track)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title={currentSetlist ? 'Add to setlist' : 'Create a setlist to store this track'}
              disabled={!currentSetlist}
            >
              <ListPlus size={16} strokeWidth={1.8} />
            </button>

            <button
              onClick={(e) => handleAddToWaypoints(e, track)}
              className={clsx(
                'p-1.5 rounded transition-colors',
                pathfindingState.selectedWaypoints.has(track.id)
                  ? 'text-purple-500 bg-purple-50'
                  : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
              )}
              title={pathfindingState.selectedWaypoints.has(track.id) ? 'Waypoint added' : 'Add to path waypoints'}
              disabled={pathfindingState.selectedWaypoints.has(track.id)}
            >
              <Route size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    );
  };


  // Filter components
  const BpmRangeFilter = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">BPM Range</label>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          value={filters.bpmRange[0]}
          onChange={(e) => handleBpmRangeChange([parseInt(e.target.value) || 0, filters.bpmRange[1]])}
          className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min="0"
          max="300"
        />
        <span className="text-xs text-gray-500">to</span>
        <input
          type="number"
          value={filters.bpmRange[1]}
          onChange={(e) => handleBpmRangeChange([filters.bpmRange[0], parseInt(e.target.value) || 300])}
          className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min="0"
          max="300"
        />
      </div>
    </div>
  );

  const KeyFilter = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Keys</label>
      <div className="grid grid-cols-6 gap-1">
        {CAMELOT_KEYS.map(key => (
          <button
            key={key}
            onClick={() => {
              const newKeys = filters.keys.includes(key)
                ? filters.keys.filter(k => k !== key)
                : [...filters.keys, key];
              handleKeysChange(newKeys);
            }}
            className={clsx(
              'px-2 py-1 text-xs rounded border transition-colors',
              filters.keys.includes(key)
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );

  const GenreFilter = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Genres</label>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {GENRES.map(genre => (
          <label key={genre} className="flex items-center">
            <input
              type="checkbox"
              checked={filters.genres.includes(genre)}
              onChange={(e) => {
                const newGenres = e.target.checked
                  ? [...filters.genres, genre]
                  : filters.genres.filter(g => g !== genre);
                handleGenresChange(newGenres);
              }}
              className="mr-2 w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{genre}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className={clsx('relative w-full', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={localQuery}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-12 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoComplete="off"
        />

        {/* Loading indicator */}
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {/* Clear button */}
        {localQuery && (
          <button
            onClick={() => {
              setLocalQuery('');
              setSearchQuery('');
              setSearchResults([]);
              setShowDropdown(false);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden"
        >
          {searchError && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                borderBottom: '1px solid rgba(251, 191, 36, 0.35)',
                color: '#965400',
                fontSize: '12px'
              }}
            >
              {searchError}
            </div>
          )}

          {/* Recent Searches */}
          {showRecentSearches && recentSearches.length > 0 && (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Recent Searches
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {recentSearches.map((_search, index) => (
                  <RecentSearchItem
                    key={`recent-${index}`}
                    index={index}
                    style={{}}
                  />
                ))}
              </div>
            </>
          )}

          {/* Search Results */}
          {!showRecentSearches && isSearching && (
            <div className="px-4 py-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="animate-pulse rounded-lg border border-gray-200 bg-gray-100 px-4 py-3"
                >
                  <div className="h-4 w-1/2 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-gray-200 rounded mb-2" />
                  <div className="flex gap-2">
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                    <div className="h-3 w-14 bg-gray-200 rounded" />
                    <div className="h-3 w-12 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showRecentSearches && !isSearching && searchResults.length > 0 && (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Search Results ({searchResults.length})
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <SearchResultItem
                    key={`result-${result.track.id}`}
                    index={index}
                    style={{}}
                  />
                ))}
              </div>
            </>
          )}

          {/* No Results */}
          {!showRecentSearches && !isSearching && localQuery && searchResults.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-500 space-y-2">
              <svg className="mx-auto h-8 w-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">No tracks found for “{localQuery}”.</p>
              {allTracks.length === 0 ? (
                <p className="text-xs text-gray-400">
                  The library looks empty. Start the gateway stack with
                  <span className="font-mono"> docker compose up -d postgres redis rest-api api-gateway</span>
                  {' '}and feed targets to scrape.
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Try widening your filters or queue new material in Target Tracks, then trigger the scrapers from the dashboard.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <div className="mt-4">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className={clsx(
                'w-4 h-4 transition-transform',
                showAdvancedFilters && 'rotate-90'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>Advanced Filters</span>
            {(filters.bpmRange[0] !== DEFAULT_FILTERS.bpmRange[0] ||
              filters.bpmRange[1] !== DEFAULT_FILTERS.bpmRange[1] ||
              filters.keys.length > 0 ||
              filters.genres.length > 0) && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                Active
              </span>
            )}
          </button>

          {showAdvancedFilters && (
            <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <BpmRangeFilter />
                <KeyFilter />
                <GenreFilter />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.hasPreview}
                      onChange={(e) => {
                        const newFilters = { ...filters, hasPreview: e.target.checked };
                        setFilters(newFilters);
                        setSearchFilters(convertFiltersToSearchFilters(newFilters));
                        if (localQuery) performSearch(localQuery);
                      }}
                      className="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Has Preview</span>
                  </label>
                </div>

                <button
                  onClick={clearFilters}
                  className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrackSearch;
