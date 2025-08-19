import {
  SearchRequest,
  AdvancedSearchRequest,
  SearchResponse,
  SimilarSongsRequest,
  ApiResponse,
  ApiError,
} from '@types/api';

class SearchService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = '/api/v1', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  async search(request: SearchRequest): Promise<ApiResponse<SearchResponse>> {
    const searchParams = new URLSearchParams();
    
    searchParams.set('q', request.q);
    
    if (request.type) {
      searchParams.set('type', request.type);
    }
    if (request.fields) {
      searchParams.set('fields', request.fields.join(','));
    }
    if (request.limit !== undefined) {
      searchParams.set('limit', request.limit.toString());
    }
    if (request.offset !== undefined) {
      searchParams.set('offset', request.offset.toString());
    }
    
    const endpoint = `/visualization/search?${searchParams.toString()}`;
    return this.request<SearchResponse>(endpoint);
  }

  async advancedSearch(request: AdvancedSearchRequest): Promise<ApiResponse<SearchResponse>> {
    const endpoint = '/visualization/search/advanced';
    return this.request<SearchResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSimilarSongs(request: SimilarSongsRequest): Promise<ApiResponse<SearchResponse>> {
    const { nodeId, ...params } = request;
    const searchParams = new URLSearchParams();
    
    if (params.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params.threshold !== undefined) {
      searchParams.set('threshold', params.threshold.toString());
    }
    if (params.attributes) {
      searchParams.set('attributes', params.attributes.join(','));
    }
    if (params.includeReasons !== undefined) {
      searchParams.set('includeReasons', params.includeReasons.toString());
    }
    
    const endpoint = `/visualization/similar/${nodeId}?${searchParams.toString()}`;
    return this.request<SearchResponse>(endpoint);
  }

  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (query.length < 2) {
      return [];
    }

    try {
      const response = await this.search({
        q: query,
        type: 'prefix',
        fields: ['title', 'artist'],
        limit,
      });

      return response.data.suggestions || [];
    } catch (error) {
      console.warn('Failed to get search suggestions:', error);
      return [];
    }
  }

  // Autocomplete service
  async autocomplete(query: string, types: ('song' | 'artist' | 'album' | 'genre')[] = ['song', 'artist']): Promise<{
    songs: Array<{ id: string; title: string; artist: string; score: number }>;
    artists: Array<{ name: string; songCount: number; score: number }>;
    albums: Array<{ name: string; artist: string; year?: number; score: number }>;
    genres: Array<{ name: string; songCount: number; score: number }>;
  }> {
    if (query.length < 2) {
      return { songs: [], artists: [], albums: [], genres: [] };
    }

    try {
      const response = await this.advancedSearch({
        criteria: {
          text: {
            query,
            fields: ['title', 'artist', 'album', 'genres'],
            fuzzy: true,
          },
        },
        options: {
          limit: 10,
          offset: 0,
          sortBy: 'relevance',
          includeFacets: true,
        },
      });

      // Process results into categories
      const songs = response.data.results.map(result => ({
        id: result.id,
        title: result.title,
        artist: result.artist,
        score: result.score,
      }));

      // Extract facets for other categories
      const facets = response.data.facets || {};
      
      const artists = facets.artists?.map(facet => ({
        name: facet.value,
        songCount: facet.count,
        score: 1.0, // Facets don't have scores
      })) || [];

      const albums = facets.albums?.map(facet => ({
        name: facet.value,
        artist: '', // Would need additional API call to get artist
        score: 1.0,
      })) || [];

      const genres = facets.genres?.map(facet => ({
        name: facet.value,
        songCount: facet.count,
        score: 1.0,
      })) || [];

      return { songs, artists, albums, genres };
    } catch (error) {
      console.warn('Autocomplete failed:', error);
      return { songs: [], artists: [], albums: [], genres: [] };
    }
  }

  // Search history management
  private getSearchHistory(): string[] {
    try {
      return JSON.parse(localStorage.getItem('songnodes-search-history') || '[]');
    } catch {
      return [];
    }
  }

  private saveSearchHistory(history: string[]): void {
    try {
      localStorage.setItem('songnodes-search-history', JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }

  addToSearchHistory(query: string): void {
    if (!query.trim()) return;

    const history = this.getSearchHistory();
    const filtered = history.filter(item => item !== query);
    const newHistory = [query, ...filtered].slice(0, 20); // Keep last 20 searches
    
    this.saveSearchHistory(newHistory);
  }

  getRecentSearches(limit: number = 10): string[] {
    return this.getSearchHistory().slice(0, limit);
  }

  clearSearchHistory(): void {
    localStorage.removeItem('songnodes-search-history');
  }

  // Search analytics
  async recordSearchAnalytics(query: string, resultCount: number, clickedResultId?: string): Promise<void> {
    try {
      // This would typically send analytics data to the backend
      const analyticsData = {
        query,
        resultCount,
        clickedResultId,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      };

      // For now, just log locally
      console.debug('Search analytics:', analyticsData);
      
      // In a real implementation, you might send this to an analytics endpoint
      // await this.request('/analytics/search', {
      //   method: 'POST',
      //   body: JSON.stringify(analyticsData),
      // });
    } catch (error) {
      console.warn('Failed to record search analytics:', error);
    }
  }

  // Utility methods
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  // Search query parsing and validation
  parseSearchQuery(query: string): {
    terms: string[];
    filters: {
      artist?: string;
      album?: string;
      genre?: string;
      year?: number;
      bpm?: number;
    };
    modifiers: {
      exact?: boolean;
      fuzzy?: boolean;
      exclude?: string[];
    };
  } {
    const result = {
      terms: [] as string[],
      filters: {} as any,
      modifiers: {} as any,
    };

    // Simple parsing - in a real implementation, you might use a more sophisticated parser
    const parts = query.split(/\s+/);
    
    for (const part of parts) {
      if (part.startsWith('artist:')) {
        result.filters.artist = part.substring(7);
      } else if (part.startsWith('album:')) {
        result.filters.album = part.substring(6);
      } else if (part.startsWith('genre:')) {
        result.filters.genre = part.substring(6);
      } else if (part.startsWith('year:')) {
        result.filters.year = parseInt(part.substring(5));
      } else if (part.startsWith('bpm:')) {
        result.filters.bpm = parseInt(part.substring(4));
      } else if (part.startsWith('-')) {
        result.modifiers.exclude = result.modifiers.exclude || [];
        result.modifiers.exclude.push(part.substring(1));
      } else if (part.startsWith('"') && part.endsWith('"')) {
        result.modifiers.exact = true;
        result.terms.push(part.slice(1, -1));
      } else if (part.includes('*') || part.includes('?')) {
        result.modifiers.fuzzy = true;
        result.terms.push(part);
      } else {
        result.terms.push(part);
      }
    }

    return result;
  }

  // Build search query from components
  buildSearchQuery(components: {
    terms: string[];
    filters: Record<string, string | number>;
    modifiers: {
      exact?: boolean;
      exclude?: string[];
    };
  }): string {
    const parts = [...components.terms];

    // Add filters
    Object.entries(components.filters).forEach(([key, value]) => {
      parts.push(`${key}:${value}`);
    });

    // Add exclusions
    if (components.modifiers.exclude) {
      components.modifiers.exclude.forEach(term => {
        parts.push(`-${term}`);
      });
    }

    // Handle exact matching
    if (components.modifiers.exact && components.terms.length > 0) {
      const exactTerms = components.terms.map(term => `"${term}"`);
      return [
        ...exactTerms,
        ...parts.slice(components.terms.length)
      ].join(' ');
    }

    return parts.join(' ');
  }
}

// Create singleton instance
export const searchService = new SearchService();
export default searchService;