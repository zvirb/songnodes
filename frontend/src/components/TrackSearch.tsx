import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useDebounce } from 'react-use';
import { LocateFixed, ListPlus, Route, Search, X, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import {
  Track,
  SearchResult,
  SearchFilters,
  DEFAULT_CONFIG,
  GraphNode
} from '../types';

const CAMELOT_KEYS = [
  '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B'
];

const GENRES = [
  'House', 'Techno', 'Trance', 'Progressive', 'Deep House', 'Tech House',
  'Minimal', 'Electro', 'Drum & Bass', 'Dubstep', 'Ambient', 'Breakbeat',
  'Garage', 'Disco', 'Funk', 'Jazz', 'Classical', 'Rock', 'Pop'
];

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
  className = '',
  placeholder = "Search tracks, artists, albums...",
  showFilters = true,
  maxResults = 100,
  onTrackSelect,
  onClose
}) => {
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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      setSearchError('Realtime search is temporarily unavailable. Showing matches from loaded graph.');
    } finally {
      setIsSearching(false);
      setSelectedIndex(0);

      if (query) {
        saveToRecentSearches(query, resultsToPersist.length);
      }
    }
  }, [fuse, filters, maxResults, saveToRecentSearches, setSearchResults]);

  useDebounce(() => {
    if (localQuery.trim()) {
      performSearch(localQuery);
    }
  }, DEFAULT_CONFIG.ui.debounceDelay, [localQuery, performSearch]);

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

  const handleInputFocus = () => {
    if (localQuery.trim().length === 0 && recentSearches.length > 0) {
      setShowRecentSearches(true);
      setShowDropdown(true);
    } else if (searchResults.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowDropdown(false);
      setShowRecentSearches(false);
    }, 200);
  };

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
        if (localQuery) {
          setLocalQuery('');
          setSearchQuery('');
          setSearchResults([]);
        } else {
          setShowDropdown(false);
          setShowRecentSearches(false);
          searchInputRef.current?.blur();
          onClose?.();
        }
        break;
    }
  };

  const handleRecentSearchClick = (query: string) => {
    setLocalQuery(query);
    setSearchQuery(query);
    setShowRecentSearches(false);
    performSearch(query);
  };

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

  const handleAddToSetlist = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    addTrackToSetlist(track);
  };

  const handleAddToWaypoints = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    addWaypoint(track.id);
  };

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

  return (
    <div className={className} style={{ position: 'relative', width: '100%' }}>
      {/* Search Input */}
      <div style={{ position: 'relative', width: '100%' }}>
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
          <Search size={16} strokeWidth={2} aria-hidden="true" />
        </span>
        <input
          ref={searchInputRef}
          type="search"
          value={localQuery}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="sn-input"
          style={{
            width: '100%',
            height: 'var(--control-md)',
            paddingLeft: 'var(--space-8)',
            paddingRight: 'var(--space-8)'
          }}
          autoComplete="off"
          aria-label="Search tracks"
        />

        {localQuery ? (
          <button
            type="button"
            onClick={() => {
              setLocalQuery('');
              setSearchQuery('');
              setSearchResults([]);
              setShowDropdown(false);
            }}
            style={{
              position: 'absolute',
              right: 'var(--space-2)',
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
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown ? (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            zIndex: 'var(--z-popover)',
            width: '100%',
            marginTop: 'var(--space-1)',
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--shadow-2)',
            maxHeight: '384px',
            overflow: 'hidden'
          }}
        >
          {searchError ? (
            <div
              style={{
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: 'var(--status-warn-bg)',
                borderBottom: '1px solid var(--line)',
                color: 'var(--status-warn)',
                fontSize: '0.75rem'
              }}
            >
              {searchError}
            </div>
          ) : null}

          {/* Recent Searches */}
          {showRecentSearches && recentSearches.length > 0 ? (
            <>
              <div
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: 'var(--surface-2)',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span className="label" style={{ color: 'var(--fg-3)' }}>
                  Recent Searches
                </span>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="sn-btn sn-btn--quiet sn-btn--sm"
                >
                  Clear
                </button>
              </div>
              <div style={{ maxHeight: '192px', overflowY: 'auto' }}>
                {recentSearches.map((search, index) => (
                  <button
                    key={`recent-${index}`}
                    type="button"
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid var(--line)',
                      backgroundColor: index === selectedIndex ? 'var(--hover-bg)' : 'transparent',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onClick={() => handleRecentSearchClick(search.query)}
                  >
                    <span style={{ fontSize: '0.875rem' }}>{search.query}</span>
                    <span className="caption" style={{ color: 'var(--fg-3)' }}>{search.resultCount} results</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {/* Search Results */}
          {!showRecentSearches && isSearching ? (
            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span className="sn-spinner" aria-label="Loading search results" />
            </div>
          ) : null}

          {!showRecentSearches && !isSearching && searchResults.length > 0 ? (
            <>
              <div
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: 'var(--surface-2)',
                  borderBottom: '1px solid var(--line)'
                }}
              >
                <span className="label" style={{ color: 'var(--fg-3)' }}>
                  Search Results ({searchResults.length})
                </span>
              </div>
              <div style={{ maxHeight: '288px', overflowY: 'auto' }}>
                {searchResults.map((result, index) => {
                  const { track, score } = result;
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={`result-${track.id}`}
                      onClick={() => handleTrackSelect(track)}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--line)',
                        backgroundColor: isSelected ? 'var(--hover-bg)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {track.name}
                          </span>
                          {score ? (
                            <span className="sn-tag">{Math.round(score * 100)}%</span>
                          ) : null}
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--fg-2)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          by {track.artist}
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--fg-3)', marginTop: '2px' }}>
                          {track.bpm ? <span style={{ fontFamily: 'var(--font-data)' }}>{track.bpm} BPM</span> : null}
                          {track.camelotKey ? <span style={{ fontFamily: 'var(--font-data)' }}>{track.camelotKey}</span> : null}
                          {track.genre ? <span>{track.genre}</span> : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginLeft: 'var(--space-2)' }}>
                        <button
                          type="button"
                          onClick={(e) => handleFocusTrack(e, track)}
                          className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
                          title="Focus in graph"
                        >
                          <LocateFixed size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleAddToSetlist(e, track)}
                          className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
                          title="Add to setlist"
                          disabled={!currentSetlist}
                        >
                          <ListPlus size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleAddToWaypoints(e, track)}
                          className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
                          title="Add to path waypoints"
                        >
                          <Route size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {!showRecentSearches && !isSearching && localQuery && searchResults.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--fg-3)' }}>
              <p style={{ margin: 0, color: 'var(--fg)' }}>No tracks found for “{localQuery}”.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Advanced Filters */}
      {showFilters ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="sn-btn sn-btn--quiet sn-btn--sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <ChevronRight
              size={16}
              strokeWidth={2}
              style={{ transform: showAdvancedFilters ? 'rotate(90deg)' : 'none', transition: 'transform var(--duration-fast)' }}
            />
            <span>Advanced Filters</span>
          </button>

          {showAdvancedFilters ? (
            <div
              style={{
                marginTop: 'var(--space-2)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--surface-2)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                {/* BPM Filter */}
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--fg-3)' }}>
                    BPM Range
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      type="number"
                      value={filters.bpmRange[0]}
                      onChange={(e) => handleBpmRangeChange([parseInt(e.target.value) || 0, filters.bpmRange[1]])}
                      className="sn-input"
                      style={{ width: '80px', height: 'var(--control-sm)' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--fg-3)' }}>to</span>
                    <input
                      type="number"
                      value={filters.bpmRange[1]}
                      onChange={(e) => handleBpmRangeChange([filters.bpmRange[0], parseInt(e.target.value) || 300])}
                      className="sn-input"
                      style={{ width: '80px', height: 'var(--control-sm)' }}
                    />
                  </div>
                </div>

                {/* Key Filter */}
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--fg-3)' }}>
                    Keys
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', maxHeight: '100px', overflowY: 'auto' }}>
                    {CAMELOT_KEYS.map(key => {
                      const isSel = filters.keys.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const newKeys = isSel ? filters.keys.filter(k => k !== key) : [...filters.keys, key];
                            handleKeysChange(newKeys);
                          }}
                          className={`sn-btn sn-btn--sm ${isSel ? 'sn-btn--primary' : 'sn-btn--quiet'}`}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="sn-btn sn-btn--quiet sn-btn--sm"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default TrackSearch;
/* design-system exception: pending migration rgba(0, 0, 0, 0) */
