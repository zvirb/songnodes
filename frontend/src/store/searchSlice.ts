import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SearchResult } from '@types/graph';

interface SearchFilters {
  genres: string[];
  artists: string[];
  types: string[];
  bpmRange?: [number, number];
  yearRange?: [number, number];
  energyRange?: [number, number];
  advanced: boolean;
}

interface SearchState {
  query: string;
  isSearching: boolean;
  suggestions: string[];
  recentSearches: string[];
  filters: SearchFilters;
  results: SearchResult[];
  totalResults: number;
  hasMore: boolean;
  selectedResultIndex: number;
  error: string | null;
}

const initialState: SearchState = {
  query: '',
  isSearching: false,
  suggestions: [],
  recentSearches: JSON.parse(localStorage.getItem('songnodes-recent-searches') || '[]'),
  filters: {
    genres: [],
    artists: [],
    types: [],
    advanced: false,
  },
  results: [],
  totalResults: 0,
  hasMore: false,
  selectedResultIndex: -1,
  error: null,
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
      
      // Add to recent searches if not empty and not already present
      if (action.payload.trim() && !state.recentSearches.includes(action.payload)) {
        state.recentSearches.unshift(action.payload);
        // Keep only the last 10 searches
        state.recentSearches = state.recentSearches.slice(0, 10);
        localStorage.setItem('songnodes-recent-searches', JSON.stringify(state.recentSearches));
      }
    },
    
    setSearching: (state, action: PayloadAction<boolean>) => {
      state.isSearching = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    
    setSuggestions: (state, action: PayloadAction<string[]>) => {
      state.suggestions = action.payload;
    },
    
    setSearchFilters: (state, action: PayloadAction<Partial<SearchFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    setSearchResults: (state, action: PayloadAction<{
      results: SearchResult[];
      total: number;
      hasMore: boolean;
    }>) => {
      state.results = action.payload.results;
      state.totalResults = action.payload.total;
      state.hasMore = action.payload.hasMore;
      state.selectedResultIndex = -1;
      state.isSearching = false;
    },
    
    appendSearchResults: (state, action: PayloadAction<{
      results: SearchResult[];
      total: number;
      hasMore: boolean;
    }>) => {
      state.results.push(...action.payload.results);
      state.totalResults = action.payload.total;
      state.hasMore = action.payload.hasMore;
      state.isSearching = false;
    },
    
    setSelectedResultIndex: (state, action: PayloadAction<number>) => {
      state.selectedResultIndex = Math.max(-1, Math.min(action.payload, state.results.length - 1));
    },
    
    navigateResults: (state, action: PayloadAction<'up' | 'down'>) => {
      if (state.results.length === 0) return;
      
      if (action.payload === 'down') {
        state.selectedResultIndex = Math.min(state.selectedResultIndex + 1, state.results.length - 1);
      } else {
        state.selectedResultIndex = Math.max(state.selectedResultIndex - 1, -1);
      }
    },
    
    clearSearch: (state) => {
      state.query = '';
      state.results = [];
      state.totalResults = 0;
      state.hasMore = false;
      state.selectedResultIndex = -1;
      state.isSearching = false;
      state.error = null;
    },
    
    clearRecentSearches: (state) => {
      state.recentSearches = [];
      localStorage.removeItem('songnodes-recent-searches');
    },
    
    setSearchError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isSearching = false;
    },
    
    clearSearchError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setSearchQuery,
  setSearching,
  setSuggestions,
  setSearchFilters,
  setSearchResults,
  appendSearchResults,
  setSelectedResultIndex,
  navigateResults,
  clearSearch,
  clearRecentSearches,
  setSearchError,
  clearSearchError,
} = searchSlice.actions;

export default searchSlice.reducer;