import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Slider,
  Stack,
  Autocomplete,
  CircularProgress,
  Fade,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  Star as StarIcon,
  MusicNote as MusicNoteIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setSearchQuery, setSearchResults, setSearchFilters } from '@store/searchSlice';
import { addToast } from '@store/uiSlice';
import { SearchRequest, AdvancedSearchRequest, SearchResult } from '@types/api';
import { searchService } from '@services/searchService';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
import { useHotkeys } from 'react-hotkeys-hook';

interface EnhancedMuiSearchPanelProps {
  isCompact?: boolean;
  onResultSelect?: (result: SearchResult) => void;
  onClose?: () => void;
}

const GENRE_OPTIONS = [
  'Rock', 'Pop', 'Electronic', 'Hip-Hop', 'Jazz', 'Classical', 
  'Alternative', 'Indie', 'Folk', 'Country', 'R&B', 'Reggae',
  'Punk', 'Metal', 'Blues', 'Funk', 'Soul', 'Disco'
];

const QUICK_FILTERS = [
  { label: 'Rock', value: 'Rock', count: 1234, icon: '🎸' },
  { label: 'Pop', value: 'Pop', count: 987, icon: '🎵' },
  { label: 'Electronic', value: 'Electronic', count: 765, icon: '🎛️' },
  { label: '2020s', value: '2020s', count: 543, icon: '📅' },
  { label: 'High Energy', value: 'high-energy', count: 321, icon: '⚡' },
];

export const EnhancedMuiSearchPanel: React.FC<EnhancedMuiSearchPanelProps> = ({
  isCompact = false,
  onResultSelect,
  onClose,
}) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Local state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [bpmRange, setBpmRange] = useState<number[]>([60, 200]);
  const [yearRange, setYearRange] = useState<number[]>([1950, new Date().getFullYear()]);
  
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
  
  // Clear search
  const clearSearch = useCallback(() => {
    setLocalQuery('');
    dispatch(setSearchQuery(''));
    dispatch(setSearchResults({ results: [], total: 0, hasMore: false }));
  }, [dispatch]);
  
  // Handle quick filter selection
  const handleQuickFilter = useCallback((filterValue: string) => {
    const newFilters = { ...filters };
    if (filterValue === 'high-energy') {
      newFilters.advanced = true;
      // Set energy range filter
    } else if (GENRE_OPTIONS.includes(filterValue)) {
      if (newFilters.genres.includes(filterValue)) {
        newFilters.genres = newFilters.genres.filter(g => g !== filterValue);
      } else {
        newFilters.genres = [...newFilters.genres, filterValue];
      }
    }
    dispatch(setSearchFilters(newFilters));
  }, [filters, dispatch]);
  
  // Handle genre change
  const handleGenreChange = useCallback((selectedGenres: string[]) => {
    dispatch(setSearchFilters({ ...filters, genres: selectedGenres }));
  }, [filters, dispatch]);
  
  return (
    <Card 
      elevation={isCompact ? 1 : 2}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
      }}
    >
      <CardContent sx={{ p: isCompact ? 2 : 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Search Input */}
        <TextField
          inputRef={searchInputRef}
          fullWidth
          variant="outlined"
          placeholder="Search songs, artists, albums, or genres..."
          value={localQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {isSearching ? (
                  <CircularProgress size={20} />
                ) : (
                  <SearchIcon color="action" />
                )}
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Stack direction="row" spacing={1}>
                  {localQuery && (
                    <IconButton
                      size="small"
                      onClick={clearSearch}
                      edge="end"
                    >
                      <ClearIcon />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    color={showAdvanced ? 'primary' : 'default'}
                    edge="end"
                  >
                    <FilterListIcon />
                  </IconButton>
                </Stack>
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.1)}`,
              },
              '&.Mui-focused': {
                boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
              },
            },
          }}
        />
        
        {/* Quick Filters */}
        {!isCompact && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {QUICK_FILTERS.map((filter) => (
                <Chip
                  key={filter.value}
                  icon={<span style={{ fontSize: '0.875rem' }}>{filter.icon}</span>}
                  label={`${filter.label} (${filter.count.toLocaleString()})`}
                  onClick={() => handleQuickFilter(filter.value)}
                  color={filters.genres.includes(filter.value) ? 'primary' : 'default'}
                  variant={filters.genres.includes(filter.value) ? 'filled' : 'outlined'}
                  sx={{
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: theme.shadows[2],
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
        
        {/* Advanced Search Filters */}
        <Collapse in={showAdvanced}>
          <Card 
            variant="outlined" 
            sx={{ 
              mb: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.02),
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterListIcon />
                Advanced Filters
              </Typography>
              
              <Grid container spacing={3}>
                {/* Genre Filter */}
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    multiple
                    options={GENRE_OPTIONS}
                    value={filters.genres}
                    onChange={(_, newValue) => handleGenreChange(newValue)}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option}
                          size="small"
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        label="Genres"
                        placeholder="Select genres"
                      />
                    )}
                  />
                </Grid>
                
                {/* BPM Range */}
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>
                    BPM Range: {bpmRange[0]} - {bpmRange[1]}
                  </Typography>
                  <Slider
                    value={bpmRange}
                    onChange={(_, newValue) => setBpmRange(newValue as number[])}
                    valueLabelDisplay="auto"
                    min={60}
                    max={200}
                    marks={[
                      { value: 60, label: '60' },
                      { value: 120, label: '120' },
                      { value: 180, label: '180' },
                      { value: 200, label: '200' },
                    ]}
                  />
                </Grid>
                
                {/* Year Range */}
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Release Year: {yearRange[0]} - {yearRange[1]}
                  </Typography>
                  <Slider
                    value={yearRange}
                    onChange={(_, newValue) => setYearRange(newValue as number[])}
                    valueLabelDisplay="auto"
                    min={1950}
                    max={new Date().getFullYear()}
                    marks={[
                      { value: 1950, label: '1950' },
                      { value: 1980, label: '1980' },
                      { value: 2000, label: '2000' },
                      { value: 2020, label: '2020' },
                      { value: new Date().getFullYear(), label: 'Now' },
                    ]}
                  />
                </Grid>
              </Grid>
              
              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button
                  onClick={() => {
                    dispatch(setSearchFilters({
                      genres: [],
                      artists: [],
                      types: [],
                      advanced: false,
                    }));
                    setBpmRange([60, 200]);
                    setYearRange([1950, new Date().getFullYear()]);
                  }}
                  color="inherit"
                >
                  Clear Filters
                </Button>
                <Button
                  onClick={handleAdvancedSearch}
                  variant="contained"
                  startIcon={<SearchIcon />}
                >
                  Apply Filters
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Collapse>
        
        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <HistoryIcon fontSize="small" />
              Recent Searches
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {recentSearches.slice(0, 5).map((search, index) => (
                <Chip
                  key={index}
                  label={search}
                  size="small"
                  variant="outlined"
                  onClick={() => handleSearchChange(search)}
                  sx={{
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
        
        {/* Search Results */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {results.length > 0 ? (
            <Fade in timeout={300}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Search Results ({results.length} found)
                </Typography>
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {results.map((result, index) => (
                    <ListItem key={result.node.id} disablePadding>
                      <ListItemButton
                        onClick={() => handleResultSelect(result, index)}
                        selected={index === selectedResultIndex}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                          },
                          '&.Mui-selected': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.12),
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                          <MusicNoteIcon color="primary" fontSize="small" />
                        </Box>
                        <ListItemText
                          primary={
                            <Typography 
                              variant="subtitle2" 
                              dangerouslySetInnerHTML={{ 
                                __html: result.highlights.title || result.node.title 
                              }} 
                            />
                          }
                          secondary={
                            <Box>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                dangerouslySetInnerHTML={{ 
                                  __html: result.highlights.artist || result.node.artist 
                                }} 
                              />
                              {result.node.album && (
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  Album: {result.node.album}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {result.reason}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Stack alignItems="flex-end" spacing={0.5}>
                            <Chip
                              icon={<StarIcon />}
                              label={`${(result.score * 100).toFixed(0)}%`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Stack direction="row" spacing={0.5}>
                              {result.node.genres.slice(0, 2).map(genre => (
                                <Chip
                                  key={genre}
                                  label={genre}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              ))}
                            </Stack>
                          </Stack>
                        </ListItemSecondaryAction>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Fade>
          ) : query && !isSearching ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No results found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                We couldn't find any songs matching "{query}"
              </Typography>
              <Button
                onClick={() => setShowAdvanced(true)}
                color="primary"
                startIcon={<FilterListIcon />}
              >
                Try advanced search options
              </Button>
            </Box>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
};