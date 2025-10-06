/**
 * Fuzzy Search Utilities using Fuse.js
 *
 * Provides intelligent search across tracks with:
 * - Typo tolerance
 * - Multi-field searching
 * - Weighted scoring
 * - Advanced filtering
 */

import Fuse, { type FuseResult, type IFuseOptions, type FuseResultMatch } from 'fuse.js';
import { GraphNode, Track } from '../types';

export interface SearchFilters {
  // Text search
  query?: string;

  // Genre filtering
  genres?: string[];

  // BPM range
  bpmMin?: number;
  bpmMax?: number;

  // Key filtering (Camelot notation)
  keys?: string[];

  // Energy range (0-1)
  energyMin?: number;
  energyMax?: number;

  // Mood categories
  moods?: string[];

  // Release year range
  yearMin?: number;
  yearMax?: number;

  // Duration range (seconds)
  durationMin?: number;
  durationMax?: number;

  // Artist filtering
  artists?: string[];

  // Label filtering
  labels?: string[];

  // Platform-specific IDs
  hasSpotifyId?: boolean;
  hasTidalId?: boolean;
  hasYoutubeId?: boolean;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matches?: readonly FuseResultMatch[];
  highlights?: string[];
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface SearchFacets {
  genres: FacetCount[];
  keys: FacetCount[];
  moods: FacetCount[];
  artists: FacetCount[];
  labels: FacetCount[];
  yearRanges: FacetCount[];
  bpmRanges: FacetCount[];
}

/**
 * Advanced Fuzzy Search Engine for Tracks
 */
export class TrackSearchEngine {
  private fuse: Fuse<GraphNode>;
  private allNodes: GraphNode[];

  // Fuse.js configuration for optimal music track searching
  private static readonly FUSE_OPTIONS: IFuseOptions<GraphNode> = {
    // Keys to search with weights (higher = more important)
    keys: [
      { name: 'track.title', weight: 2.0 },           // Track title most important
      { name: 'track.artist', weight: 1.5 },          // Artist name very important
      { name: 'metadata.genre', weight: 1.0 },        // Genre important
      { name: 'metadata.label', weight: 0.7 },        // Label moderately important
      { name: 'metadata.remix_type', weight: 0.5 },   // Remix info helpful
      { name: 'metadata.mood', weight: 0.8 },         // Mood helpful
    ],

    // Search algorithm settings
    threshold: 0.4,           // 0.0 = perfect match, 1.0 = match anything
    distance: 100,            // Max distance to search
    minMatchCharLength: 2,    // Minimum character length to match

    // Features
    includeScore: true,       // Include relevance score
    includeMatches: true,     // Include match locations for highlighting
    useExtendedSearch: true,  // Enable advanced query syntax
    ignoreLocation: true,     // Search entire string, not just beginning

    // Performance
    shouldSort: true,         // Sort by relevance
    findAllMatches: false,    // Stop at first match per key
  };

  constructor(nodes: GraphNode[]) {
    this.allNodes = nodes;
    this.fuse = new Fuse(nodes, TrackSearchEngine.FUSE_OPTIONS);
  }

  /**
   * Update search index with new data
   */
  updateIndex(nodes: GraphNode[]): void {
    this.allNodes = nodes;
    this.fuse.setCollection(nodes);
  }

  /**
   * Perform fuzzy search with advanced filtering
   */
  search(
    query: string,
    filters?: SearchFilters,
    limit: number = 50
  ): SearchResult<GraphNode>[] {
    // Apply fuzzy search first if query provided
    let results: GraphNode[];

    if (query && query.trim().length > 0) {
      const fuseResults = this.fuse.search(query, { limit: limit * 2 }); // Get more for filtering
      results = fuseResults.map(r => r.item);
    } else {
      results = [...this.allNodes];
    }

    // Apply filters
    if (filters) {
      results = this.applyFilters(results, filters);
    }

    // Limit results
    results = results.slice(0, limit);

    // Convert to SearchResult format
    return results.map((item, index) => ({
      item,
      score: 1.0 / (index + 1), // Inverse rank scoring
      matches: [],
      highlights: []
    }));
  }

  /**
   * Advanced search with extended Fuse.js syntax
   *
   * Supported syntax:
   * - "word" - Exact match
   * - ^word - Starts with
   * - word$ - Ends with
   * - !word - Exclude
   * - 'word - Include exact
   * - word1 word2 - OR search
   * - word1 | word2 - OR operator
   */
  advancedSearch(
    query: string,
    filters?: SearchFilters,
    limit: number = 50
  ): SearchResult<GraphNode>[] {
    const fuseResults = this.fuse.search(query, { limit: limit * 2 });

    let results = fuseResults.map(r => ({
      item: r.item,
      score: r.score || 0,
      matches: r.matches,
      highlights: this.extractHighlights(r.matches)
    }));

    // Apply additional filters
    if (filters) {
      results = results.filter(r => this.matchesFilters(r.item, filters));
    }

    return results.slice(0, limit);
  }

  /**
   * Apply filters to search results
   */
  private applyFilters(nodes: GraphNode[], filters: SearchFilters): GraphNode[] {
    return nodes.filter(node => this.matchesFilters(node, filters));
  }

  /**
   * Check if node matches all filters
   */
  private matchesFilters(node: GraphNode, filters: SearchFilters): boolean {
    const track = node.track;
    const metadata = node.metadata || {};

    // Genre filter
    if (filters.genres && filters.genres.length > 0) {
      const nodeGenre = metadata.genre || track?.genre;
      if (!nodeGenre || !filters.genres.some(g => {
        if (!g) return false;
        return nodeGenre.toLowerCase().includes(g.toLowerCase());
      })) {
        return false;
      }
    }

    // BPM range
    if (filters.bpmMin !== undefined || filters.bpmMax !== undefined) {
      const bpm = track?.bpm || metadata.bpm;
      if (bpm === undefined || bpm === null) return false;
      if (filters.bpmMin !== undefined && bpm < filters.bpmMin) return false;
      if (filters.bpmMax !== undefined && bpm > filters.bpmMax) return false;
    }

    // Key filter
    if (filters.keys && filters.keys.length > 0) {
      const key = track?.key || metadata.key || metadata.camelot_key;
      if (!key || !filters.keys.includes(key)) return false;
    }

    // Energy range
    if (filters.energyMin !== undefined || filters.energyMax !== undefined) {
      const energy = metadata.energy;
      if (energy === undefined || energy === null) return false;
      if (filters.energyMin !== undefined && energy < filters.energyMin) return false;
      if (filters.energyMax !== undefined && energy > filters.energyMax) return false;
    }

    // Mood filter
    if (filters.moods && filters.moods.length > 0) {
      const mood = metadata.mood || metadata.mood_category;
      if (!mood || !filters.moods.some(m => {
        if (!m) return false;
        return mood.toLowerCase().includes(m.toLowerCase());
      })) {
        return false;
      }
    }

    // Year range
    if (filters.yearMin !== undefined || filters.yearMax !== undefined) {
      const year = track?.release_year || metadata.release_year;
      if (year === undefined || year === null) return false;
      if (filters.yearMin !== undefined && year < filters.yearMin) return false;
      if (filters.yearMax !== undefined && year > filters.yearMax) return false;
    }

    // Duration range
    if (filters.durationMin !== undefined || filters.durationMax !== undefined) {
      const duration = track?.duration_seconds || metadata.duration_seconds;
      if (duration === undefined || duration === null) return false;
      if (filters.durationMin !== undefined && duration < filters.durationMin) return false;
      if (filters.durationMax !== undefined && duration > filters.durationMax) return false;
    }

    // Artist filter
    if (filters.artists && filters.artists.length > 0) {
      const artist = track?.artist || metadata.primary_artist;
      if (!artist || !filters.artists.some(a => {
        if (!a) return false;
        return artist.toLowerCase().includes(a.toLowerCase());
      })) {
        return false;
      }
    }

    // Label filter
    if (filters.labels && filters.labels.length > 0) {
      const label = metadata.label;
      if (!label || !filters.labels.some(l => {
        if (!l) return false;
        return label.toLowerCase().includes(l.toLowerCase());
      })) {
        return false;
      }
    }

    // Platform ID filters
    if (filters.hasSpotifyId !== undefined) {
      const hasId = !!metadata.spotify_id;
      if (hasId !== filters.hasSpotifyId) return false;
    }

    if (filters.hasTidalId !== undefined) {
      const hasId = !!metadata.tidal_id;
      if (hasId !== filters.hasTidalId) return false;
    }

    if (filters.hasYoutubeId !== undefined) {
      const hasId = !!metadata.youtube_music_id;
      if (hasId !== filters.hasYoutubeId) return false;
    }

    return true;
  }

  /**
   * Extract highlighted text from matches
   */
  private extractHighlights(matches?: readonly FuseResultMatch[]): string[] {
    if (!matches) return [];

    return matches.map(match => {
      const { value, indices } = match;
      if (!value) return '';

      let highlighted = '';
      let lastIndex = 0;

      indices.forEach(([start, end]) => {
        highlighted += value.substring(lastIndex, start);
        highlighted += `<mark>${value.substring(start, end + 1)}</mark>`;
        lastIndex = end + 1;
      });

      highlighted += value.substring(lastIndex);
      return highlighted;
    });
  }

  /**
   * Generate facets for filter UI
   */
  generateFacets(nodes?: GraphNode[]): SearchFacets {
    const dataSet = nodes || this.allNodes;

    const facets: SearchFacets = {
      genres: this.countFacet(dataSet, node => node.metadata?.genre || node.track?.genre),
      keys: this.countFacet(dataSet, node => node.track?.key || node.metadata?.key),
      moods: this.countFacet(dataSet, node => node.metadata?.mood || node.metadata?.mood_category),
      artists: this.countFacet(dataSet, node => node.track?.artist || node.metadata?.primary_artist),
      labels: this.countFacet(dataSet, node => node.metadata?.label),
      yearRanges: this.generateYearRangeFacets(dataSet),
      bpmRanges: this.generateBPMRangeFacets(dataSet)
    };

    return facets;
  }

  /**
   * Count occurrences for facet generation
   */
  private countFacet(nodes: GraphNode[], extractor: (node: GraphNode) => string | undefined): FacetCount[] {
    const counts = new Map<string, number>();

    nodes.forEach(node => {
      const value = extractor(node);
      if (value) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 facets
  }

  /**
   * Generate year range facets
   */
  private generateYearRangeFacets(nodes: GraphNode[]): FacetCount[] {
    const ranges = [
      { label: '2024-2025', min: 2024, max: 2025 },
      { label: '2020-2023', min: 2020, max: 2023 },
      { label: '2015-2019', min: 2015, max: 2019 },
      { label: '2010-2014', min: 2010, max: 2014 },
      { label: '2000-2009', min: 2000, max: 2009 },
      { label: '1990-1999', min: 1990, max: 1999 },
      { label: 'Before 1990', min: 0, max: 1989 }
    ];

    return ranges.map(range => ({
      value: range.label,
      count: nodes.filter(node => {
        const year = node.track?.release_year || node.metadata?.release_year;
        return year && year >= range.min && year <= range.max;
      }).length
    })).filter(r => r.count > 0);
  }

  /**
   * Generate BPM range facets
   */
  private generateBPMRangeFacets(nodes: GraphNode[]): FacetCount[] {
    const ranges = [
      { label: '60-90 (Downtempo)', min: 60, max: 90 },
      { label: '90-110 (Hip-Hop)', min: 90, max: 110 },
      { label: '110-130 (House)', min: 110, max: 130 },
      { label: '130-150 (Techno)', min: 130, max: 150 },
      { label: '150-180 (Drum & Bass)', min: 150, max: 180 },
      { label: '180+ (Hardcore)', min: 180, max: 300 }
    ];

    return ranges.map(range => ({
      value: range.label,
      count: nodes.filter(node => {
        const bpm = node.track?.bpm || node.metadata?.bpm;
        return bpm && bpm >= range.min && bpm <= range.max;
      }).length
    })).filter(r => r.count > 0);
  }

  /**
   * Get suggestions for autocomplete
   */
  getSuggestions(query: string, limit: number = 10): string[] {
    if (!query || query.length < 2) return [];

    const results = this.fuse.search(query, { limit: limit * 2 });

    const suggestions = new Set<string>();

    results.forEach(result => {
      const track = result.item.track;
      if (track?.title) suggestions.add(track.title);
      if (track?.artist) suggestions.add(track.artist);
    });

    return Array.from(suggestions).slice(0, limit);
  }
}

/**
 * Create search engine instance from graph nodes
 */
export function createSearchEngine(nodes: GraphNode[]): TrackSearchEngine {
  return new TrackSearchEngine(nodes);
}

/**
 * Highlight matching text in search results
 */
export function highlightMatches(text: string, query: string): string {
  if (!query || query.length < 2) return text;

  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}