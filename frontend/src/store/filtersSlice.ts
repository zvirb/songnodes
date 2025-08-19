import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GraphFilters } from '@types/graph';

// Utility function to ensure arrays for Redux serialization
function ensureArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object' && 'has' in value) {
    // Handle Set-like objects
    return Array.from(value as any);
  }
  if (value && typeof value === 'object' && 'keys' in value) {
    // Handle Map-like objects
    return Array.from((value as any).keys());
  }
  return [];
}

interface FiltersState extends GraphFilters {
  // Additional UI state for filters
  isFiltersOpen: boolean;
  activeFilterCount: number;
  recentFilters: GraphFilters[];
  savedFilters: Array<{
    id: string;
    name: string;
    filters: GraphFilters;
    createdAt: number;
  }>;
}

const initialState: FiltersState = {
  // Filter values
  genres: [],
  artists: [],
  yearRange: undefined,
  bpmRange: undefined,
  energyRange: undefined,
  popularityMin: undefined,
  nodeIds: undefined,
  edgeTypes: undefined,
  minWeight: undefined,
  maxDegree: undefined,
  searchQuery: undefined,
  
  // UI state
  isFiltersOpen: false,
  activeFilterCount: 0,
  recentFilters: [],
  savedFilters: [],
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<GraphFilters>>) => {
      Object.assign(state, action.payload);
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setGenres: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      state.genres = payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    addGenre: (state, action: PayloadAction<string>) => {
      if (!state.genres.includes(action.payload)) {
        state.genres.push(action.payload);
        state.activeFilterCount = calculateActiveFilterCount(state);
      }
    },
    
    removeGenre: (state, action: PayloadAction<string>) => {
      state.genres = state.genres.filter(genre => genre !== action.payload);
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setArtists: (state, action: PayloadAction<string[]>) => {
      // Runtime guard: Ensure payload is an array, not a Set or other non-serializable type
      const payload = ensureArray(action.payload);
      
      state.artists = payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    addArtist: (state, action: PayloadAction<string>) => {
      if (!state.artists.includes(action.payload)) {
        state.artists.push(action.payload);
        state.activeFilterCount = calculateActiveFilterCount(state);
      }
    },
    
    removeArtist: (state, action: PayloadAction<string>) => {
      state.artists = state.artists.filter(artist => artist !== action.payload);
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setYearRange: (state, action: PayloadAction<[number, number] | undefined>) => {
      state.yearRange = action.payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setBpmRange: (state, action: PayloadAction<[number, number] | undefined>) => {
      state.bpmRange = action.payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setEnergyRange: (state, action: PayloadAction<[number, number] | undefined>) => {
      state.energyRange = action.payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setPopularityMin: (state, action: PayloadAction<number | undefined>) => {
      state.popularityMin = action.payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setMinWeight: (state, action: PayloadAction<number | undefined>) => {
      state.minWeight = action.payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setMaxDegree: (state, action: PayloadAction<number | undefined>) => {
      state.maxDegree = action.payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    setSearchQuery: (state, action: PayloadAction<string | undefined>) => {
      state.searchQuery = action.payload;
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    clearAllFilters: (state) => {
      // Save current filters to recent before clearing
      if (state.activeFilterCount > 0) {
        const currentFilters = extractFilters(state);
        state.recentFilters = [currentFilters, ...state.recentFilters.slice(0, 9)]; // Keep last 10
      }
      
      // Clear all filters
      state.genres = [];
      state.artists = [];
      state.yearRange = undefined;
      state.bpmRange = undefined;
      state.energyRange = undefined;
      state.popularityMin = undefined;
      state.nodeIds = undefined;
      state.edgeTypes = undefined;
      state.minWeight = undefined;
      state.maxDegree = undefined;
      state.searchQuery = undefined;
      state.activeFilterCount = 0;
    },
    
    // UI state
    toggleFiltersOpen: (state) => {
      state.isFiltersOpen = !state.isFiltersOpen;
    },
    
    setFiltersOpen: (state, action: PayloadAction<boolean>) => {
      state.isFiltersOpen = action.payload;
    },
    
    // Recent filters
    applyRecentFilter: (state, action: PayloadAction<number>) => {
      const recentFilter = state.recentFilters[action.payload];
      if (recentFilter) {
        Object.assign(state, recentFilter);
        state.activeFilterCount = calculateActiveFilterCount(state);
      }
    },
    
    clearRecentFilters: (state) => {
      state.recentFilters = [];
    },
    
    // Saved filters
    saveCurrentFilters: (state, action: PayloadAction<{ name: string }>) => {
      const filters = extractFilters(state);
      const savedFilter = {
        id: `filter_${Date.now()}`,
        name: action.payload.name,
        filters,
        createdAt: Date.now(),
      };
      
      state.savedFilters.push(savedFilter);
    },
    
    applySavedFilter: (state, action: PayloadAction<string>) => {
      const savedFilter = state.savedFilters.find(f => f.id === action.payload);
      if (savedFilter) {
        Object.assign(state, savedFilter.filters);
        state.activeFilterCount = calculateActiveFilterCount(state);
      }
    },
    
    deleteSavedFilter: (state, action: PayloadAction<string>) => {
      state.savedFilters = state.savedFilters.filter(f => f.id !== action.payload);
    },
    
    renameSavedFilter: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const filter = state.savedFilters.find(f => f.id === action.payload.id);
      if (filter) {
        filter.name = action.payload.name;
      }
    },
    
    // Preset filters
    applyGenreFilter: (state, action: PayloadAction<string>) => {
      state.genres = [action.payload];
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    applyDecadeFilter: (state, action: PayloadAction<string>) => {
      const decade = parseInt(action.payload);
      state.yearRange = [decade, decade + 9];
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    applyEnergyFilter: (state, action: PayloadAction<'low' | 'medium' | 'high'>) => {
      switch (action.payload) {
        case 'low':
          state.energyRange = [0, 0.4];
          break;
        case 'medium':
          state.energyRange = [0.4, 0.7];
          break;
        case 'high':
          state.energyRange = [0.7, 1];
          break;
      }
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
    
    applyBpmFilter: (state, action: PayloadAction<'slow' | 'medium' | 'fast'>) => {
      switch (action.payload) {
        case 'slow':
          state.bpmRange = [60, 100];
          break;
        case 'medium':
          state.bpmRange = [100, 140];
          break;
        case 'fast':
          state.bpmRange = [140, 200];
          break;
      }
      state.activeFilterCount = calculateActiveFilterCount(state);
    },
  },
});

// Helper functions
function calculateActiveFilterCount(state: FiltersState): number {
  let count = 0;
  
  if (state.genres.length > 0) count++;
  if (state.artists.length > 0) count++;
  if (state.yearRange) count++;
  if (state.bpmRange) count++;
  if (state.energyRange) count++;
  if (state.popularityMin !== undefined) count++;
  if (state.nodeIds && state.nodeIds.length > 0) count++;
  if (state.edgeTypes && state.edgeTypes.length > 0) count++;
  if (state.minWeight !== undefined) count++;
  if (state.maxDegree !== undefined) count++;
  if (state.searchQuery) count++;
  
  return count;
}

function extractFilters(state: FiltersState): GraphFilters {
  return {
    genres: state.genres,
    artists: state.artists,
    yearRange: state.yearRange,
    bpmRange: state.bpmRange,
    energyRange: state.energyRange,
    popularityMin: state.popularityMin,
    nodeIds: state.nodeIds,
    edgeTypes: state.edgeTypes,
    minWeight: state.minWeight,
    maxDegree: state.maxDegree,
    searchQuery: state.searchQuery,
  };
}

export const {
  setFilters,
  setGenres,
  addGenre,
  removeGenre,
  setArtists,
  addArtist,
  removeArtist,
  setYearRange,
  setBpmRange,
  setEnergyRange,
  setPopularityMin,
  setMinWeight,
  setMaxDegree,
  setSearchQuery,
  clearAllFilters,
  toggleFiltersOpen,
  setFiltersOpen,
  applyRecentFilter,
  clearRecentFilters,
  saveCurrentFilters,
  applySavedFilter,
  deleteSavedFilter,
  renameSavedFilter,
  applyGenreFilter,
  applyDecadeFilter,
  applyEnergyFilter,
  applyBpmFilter,
} = filtersSlice.actions;

export default filtersSlice.reducer;