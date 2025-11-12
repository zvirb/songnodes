/**
 * useGraphData Hook
 * Fetches and normalizes graph data from the backend API
 *
 * Features:
 * - Fetch nodes and edges from Graph API endpoint
 * - Normalize raw API data to Phase 1 type system (GraphNode, GraphEdge)
 * - Handle loading/error states with automatic retries
 * - Support filtering (by artist, genre, date range)
 * - Memoize processed data to prevent unnecessary re-renders
 * - CRITICAL: Validate nodes per CLAUDE.md artist attribution requirements
 *
 * MANDATORY ARTIST VALIDATION (from CLAUDE.md):
 * The graph visualization REQUIRES valid artist attribution on BOTH endpoints
 * of every track transition. Tracks with NULL, empty, or "Unknown Artist"
 * attribution MUST NOT appear in the graph under any circumstances.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { GraphData, GraphNode, GraphEdge, Track } from '../types';

/* ============================================
   TYPES
   ============================================ */

/**
 * Filter criteria for graph data
 */
export interface GraphFilters {
  artistName?: string;
  genre?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  minTransitions?: number;
  maxNodes?: number;
}

/**
 * Hook options
 */
export interface UseGraphDataOptions {
  autoFetch?: boolean;
  filters?: GraphFilters;
  endpoint?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Hook return value
 */
export interface UseGraphDataReturn {
  data: GraphData | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  stats: {
    totalNodes: number;
    totalEdges: number;
    filteredNodes: number;
    filteredEdges: number;
    rejectedNodes: number;
    rejectedEdges: number;
  };
}

/**
 * Raw API response structure
 */
interface RawAPIResponse {
  nodes?: Array<{
    id?: string;
    track_id?: string;
    artist_name?: string;
    artist?: string;
    track_name?: string;
    title?: string;
    album?: string;
    genre?: string;
    bpm?: number;
    key?: string;
    camelot_key?: string;
    energy?: number;
    danceability?: number;
    valence?: number;
    duration_ms?: number;
    release_date?: string;
    spotify_id?: string;
    isrc?: string;
    album_art_url?: string;
    degree?: number;
    betweenness?: number;
    clustering?: number;
    community?: number;
    x?: number;
    y?: number;
    metadata?: Record<string, any>;
  }>;
  edges?: Array<{
    source: string | number;
    target: string | number;
    weight?: number;
    transition_count?: number;
    avg_harmonic_distance?: number;
    avg_bpm_difference?: number;
    transition_quality?: number;
  }>;
  metadata?: {
    total_tracks?: number;
    total_transitions?: number;
    date_range?: {
      start: string;
      end: string;
    };
  };
}

/* ============================================
   ARTIST VALIDATION CONSTANTS
   ============================================ */

/**
 * Invalid artist name patterns (per CLAUDE.md requirements)
 * These tracks MUST be filtered out - NO EXCEPTIONS
 */
const INVALID_ARTIST_PATTERNS = [
  'Unknown Artist',
  'Unknown',
  'Various Artists',
  'Various',
  'VA',
  'Unknown Artist @',
  'VA @',
] as const;

/* ============================================
   VALIDATION HELPERS
   ============================================ */

/**
 * Validate artist name per CLAUDE.md requirements
 * CRITICAL: Artist attribution is MANDATORY for graph nodes
 *
 * Invalid patterns:
 * - NULL or undefined
 * - Empty string ('')
 * - "Unknown Artist", "Unknown", "Various Artists", "VA"
 * - Artist names starting with "Unknown Artist @" or "VA @"
 *
 * @param artistName - Artist name to validate
 * @returns true if valid, false if invalid
 */
function validateArtistName(artistName: string | null | undefined): boolean {
  // Reject NULL, undefined, or empty strings
  if (!artistName || artistName.trim() === '') {
    return false;
  }

  const trimmedName = artistName.trim();

  // Reject exact matches to invalid patterns
  for (const pattern of INVALID_ARTIST_PATTERNS) {
    if (trimmedName === pattern) {
      return false;
    }
  }

  // Reject names starting with invalid prefixes
  if (trimmedName.startsWith('Unknown Artist @') || trimmedName.startsWith('VA @')) {
    return false;
  }

  return true;
}

/**
 * Validate track title
 * @param title - Track title to validate
 * @returns true if valid, false if invalid
 */
function validateTrackTitle(title: string | null | undefined): boolean {
  if (!title || title.trim() === '') {
    return false;
  }

  const trimmedTitle = title.trim();

  // Reject "Unknown Track" or similar
  if (trimmedTitle === 'Unknown Track' || trimmedTitle === 'Unknown' || trimmedTitle === '') {
    return false;
  }

  return true;
}

/* ============================================
   NORMALIZATION HELPERS
   ============================================ */

/**
 * Normalize raw API node to typed GraphNode
 * @param rawNode - Raw node data from API
 * @returns Normalized GraphNode
 */
function normalizeNode(rawNode: RawAPIResponse['nodes'][number]): GraphNode | null {
  // Extract artist name (try multiple fields)
  const artistName = rawNode.artist_name || rawNode.artist;

  // Validate artist name (MANDATORY per CLAUDE.md)
  if (!validateArtistName(artistName)) {
    return null; // REJECT node with invalid artist
  }

  // Extract track title
  const trackTitle = rawNode.track_name || rawNode.title;

  // Validate track title
  if (!validateTrackTitle(trackTitle)) {
    return null; // REJECT node with invalid title
  }

  // Extract track ID
  const trackId = rawNode.id || rawNode.track_id;
  if (!trackId) {
    console.warn('[useGraphData] Node missing ID, skipping');
    return null;
  }

  // Build Track object
  const track: Track = {
    id: trackId,
    title: trackTitle!,
    artist_name: artistName!,
    album: rawNode.album,
    genre: rawNode.genre,
    bpm: rawNode.bpm,
    key: rawNode.key || rawNode.camelot_key,
    energy: rawNode.energy,
    danceability: rawNode.danceability,
    valence: rawNode.valence,
    duration_ms: rawNode.duration_ms,
    release_date: rawNode.release_date,
    spotify_id: rawNode.spotify_id,
    isrc: rawNode.isrc,
    album_art_url: rawNode.album_art_url,
  };

  // Build GraphNode
  const node: GraphNode = {
    id: trackId,
    track,
    degree: rawNode.degree || 0,
    betweenness: rawNode.betweenness,
    clustering: rawNode.clustering,
    community: rawNode.community,
    x: rawNode.x || Math.random() * 1000 - 500,
    y: rawNode.y || Math.random() * 1000 - 500,
  };

  return node;
}

/**
 * Normalize raw API edge to typed GraphEdge
 * @param rawEdge - Raw edge data from API
 * @param validNodeIds - Set of valid node IDs (for filtering)
 * @returns Normalized GraphEdge or null if invalid
 */
function normalizeEdge(
  rawEdge: RawAPIResponse['edges'][number],
  validNodeIds: Set<string>
): GraphEdge | null {
  const sourceId = String(rawEdge.source);
  const targetId = String(rawEdge.target);

  // CRITICAL: Both endpoints must have valid artist attribution
  // Filter out edges where either endpoint is invalid
  if (!validNodeIds.has(sourceId) || !validNodeIds.has(targetId)) {
    return null;
  }

  const edge: GraphEdge = {
    source: sourceId,
    target: targetId,
    weight: rawEdge.weight || 1,
    transition_count: rawEdge.transition_count,
    avg_harmonic_distance: rawEdge.avg_harmonic_distance,
    avg_bpm_difference: rawEdge.avg_bpm_difference,
    transition_quality: rawEdge.transition_quality,
  };

  return edge;
}

/* ============================================
   FILTERING HELPERS
   ============================================ */

/**
 * Apply user-defined filters to nodes
 * @param nodes - Array of normalized nodes
 * @param filters - Filter criteria
 * @returns Filtered nodes
 */
function applyFilters(nodes: GraphNode[], filters?: GraphFilters): GraphNode[] {
  if (!filters) return nodes;

  let filtered = nodes;

  // Filter by artist name
  if (filters.artistName) {
    const searchTerm = filters.artistName.toLowerCase();
    filtered = filtered.filter((node) =>
      node.track.artist_name.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by genre
  if (filters.genre) {
    const searchGenre = filters.genre.toLowerCase();
    filtered = filtered.filter((node) =>
      node.track.genre?.toLowerCase().includes(searchGenre)
    );
  }

  // Filter by date range
  if (filters.dateRange && filters.dateRange.start && filters.dateRange.end) {
    const startDate = new Date(filters.dateRange.start);
    const endDate = new Date(filters.dateRange.end);

    filtered = filtered.filter((node) => {
      if (!node.track.release_date) return false;
      const releaseDate = new Date(node.track.release_date);
      return releaseDate >= startDate && releaseDate <= endDate;
    });
  }

  // Limit max nodes
  if (filters.maxNodes && filtered.length > filters.maxNodes) {
    // Sort by degree (keep most connected nodes)
    filtered = filtered
      .sort((a, b) => b.degree - a.degree)
      .slice(0, filters.maxNodes);
  }

  return filtered;
}

/**
 * Filter edges by valid node set
 * @param edges - Array of normalized edges
 * @param nodes - Array of valid nodes
 * @returns Filtered edges
 */
function filterEdgesByNodes(edges: GraphEdge[], nodes: GraphNode[]): GraphEdge[] {
  const nodeIds = new Set(nodes.map((n) => n.id));

  return edges.filter((edge) => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;

    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });
}

/* ============================================
   MAIN HOOK
   ============================================ */

/**
 * Custom hook for fetching and managing graph data
 * @param options - Hook options
 * @returns Graph data, loading state, error, and refetch function
 */
export function useGraphData(options: UseGraphDataOptions = {}): UseGraphDataReturn {
  const {
    autoFetch = true,
    filters,
    endpoint = '/api/graph-data',
    retryAttempts = 3,
    retryDelay = 1000,
  } = options;

  // State
  const [rawData, setRawData] = useState<RawAPIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  /**
   * Fetch graph data from API
   */
  const fetchData = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch graph data: ${response.status} ${response.statusText}`);
      }

      const json: RawAPIResponse = await response.json();
      setRawData(json);
      retryCountRef.current = 0; // Reset retry count on success
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }

      const fetchError = err instanceof Error ? err : new Error('Unknown error');
      console.error('[useGraphData] Fetch error:', fetchError);

      // Retry logic
      if (retryCountRef.current < retryAttempts) {
        retryCountRef.current++;
        console.log(
          `[useGraphData] Retrying... (${retryCountRef.current}/${retryAttempts})`
        );

        setTimeout(() => {
          fetchData();
        }, retryDelay * retryCountRef.current); // Exponential backoff
      } else {
        setError(fetchError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, retryAttempts, retryDelay]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }

    // Cleanup: abort pending request
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoFetch, fetchData]);

  /**
   * Process raw data: normalize, validate, filter
   * Memoized to prevent unnecessary re-renders
   */
  const processedData = useMemo(() => {
    if (!rawData || !rawData.nodes) {
      return {
        nodes: [],
        edges: [],
        totalNodes: 0,
        totalEdges: 0,
        rejectedNodes: 0,
        rejectedEdges: 0,
      };
    }

    const totalNodes = rawData.nodes.length;
    const totalEdges = rawData.edges?.length || 0;

    // Step 1: Normalize and validate nodes
    const normalizedNodes: GraphNode[] = [];
    let rejectedNodes = 0;

    for (const rawNode of rawData.nodes) {
      const node = normalizeNode(rawNode);

      if (node) {
        normalizedNodes.push(node);
      } else {
        rejectedNodes++;
      }
    }

    // Step 2: Create set of valid node IDs
    const validNodeIds = new Set(normalizedNodes.map((n) => n.id));

    // Step 3: Normalize and validate edges
    const normalizedEdges: GraphEdge[] = [];
    let rejectedEdges = 0;

    if (rawData.edges) {
      for (const rawEdge of rawData.edges) {
        const edge = normalizeEdge(rawEdge, validNodeIds);

        if (edge) {
          normalizedEdges.push(edge);
        } else {
          rejectedEdges++;
        }
      }
    }

    // Step 4: Apply user-defined filters
    const filteredNodes = applyFilters(normalizedNodes, filters);

    // Step 5: Filter edges to match filtered nodes
    const filteredEdges = filterEdgesByNodes(normalizedEdges, filteredNodes);

    // Calculate additional rejections from filtering
    const additionalRejectedNodes = normalizedNodes.length - filteredNodes.length;
    const additionalRejectedEdges = normalizedEdges.length - filteredEdges.length;

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      totalNodes,
      totalEdges,
      rejectedNodes: rejectedNodes + additionalRejectedNodes,
      rejectedEdges: rejectedEdges + additionalRejectedEdges,
    };
  }, [rawData, filters]);

  /**
   * Build GraphData structure
   */
  const graphData = useMemo<GraphData | null>(() => {
    if (processedData.nodes.length === 0) {
      return null;
    }

    return {
      nodes: processedData.nodes,
      edges: processedData.edges,
      metadata: {
        total_tracks: processedData.totalNodes,
        total_transitions: processedData.totalEdges,
        date_range: rawData?.metadata?.date_range,
      },
    };
  }, [processedData, rawData]);

  /**
   * Statistics
   */
  const stats = useMemo(
    () => ({
      totalNodes: processedData.totalNodes,
      totalEdges: processedData.totalEdges,
      filteredNodes: processedData.nodes.length,
      filteredEdges: processedData.edges.length,
      rejectedNodes: processedData.rejectedNodes,
      rejectedEdges: processedData.rejectedEdges,
    }),
    [processedData]
  );

  // Log validation results
  useEffect(() => {
    if (stats.rejectedNodes > 0 || stats.rejectedEdges > 0) {
      console.log(
        `[useGraphData] Artist validation: Rejected ${stats.rejectedNodes} nodes and ${stats.rejectedEdges} edges with invalid artist attribution`
      );
    }
  }, [stats]);

  return {
    data: graphData,
    nodes: processedData.nodes,
    edges: processedData.edges,
    isLoading,
    error,
    refetch: fetchData,
    stats,
  };
}
