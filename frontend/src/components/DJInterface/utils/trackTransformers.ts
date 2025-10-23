/**
 * Track Transformation Utilities
 *
 * Pure functions for transforming graph node data into Track objects
 * and validating track data integrity. These functions ensure consistent
 * track data structure across the DJ interface.
 *
 * @module DJInterface/utils/trackTransformers
 */

import type { Track, GraphNode } from '../../../types';
import { getStableHashValue } from './stableHash';

/**
 * Validate if a graph node has sufficient data to be displayed as a track
 *
 * Critical artist attribution requirement:
 * - Tracks MUST have both title AND artist name
 * - "Unknown Artist" tracks are REJECTED
 * - NULL or empty artists are REJECTED
 *
 * This enforces the graph visualization's core requirement that all
 * displayed tracks must have valid artist attribution.
 *
 * @param node - Graph node to validate
 * @returns true if node has valid title and artist
 *
 * @example
 * ```typescript
 * const validNodes = graphData.nodes.filter(isValidTrackNode);
 * ```
 */
export function isValidTrackNode(node: any): boolean {
  if (!node) return false;

  // Check for title from multiple sources
  const hasTitle = Boolean(
    node.title ||
    node.metadata?.title ||
    node.metadata?.label ||
    node.label ||
    node.name
  );

  // Check for artist from multiple sources
  const rawArtist = node.artist || node.metadata?.artist;

  // CRITICAL: Reject NULL, empty, or "Unknown Artist" variations
  const hasValidArtist = Boolean(rawArtist) &&
    rawArtist.trim() !== '' &&
    !rawArtist.toLowerCase().includes('unknown') &&
    !rawArtist.toLowerCase().includes('various');

  return hasTitle && hasValidArtist;
}

/**
 * Transform a graph node into a standardized Track object
 *
 * This function normalizes graph node data into the Track interface,
 * handling multiple data source locations (node properties, metadata object)
 * and providing stable fallback values when metadata is missing.
 *
 * Data Priority:
 * 1. Direct node properties (node.title, node.artist, etc.)
 * 2. Metadata object (node.metadata.title, node.metadata.artist, etc.)
 * 3. Stable fallback values (using deterministic hash)
 *
 * Fallback Strategy:
 * - Duration: 3-8 minutes (180-480 seconds) via stable hash
 * - BPM: Use stable hash if needed (caller's responsibility)
 * - Key: undefined (no fallback - should be enriched separately)
 * - Energy: undefined (no fallback - should be enriched separately)
 *
 * @param node - Graph node to transform
 * @returns Standardized Track object
 *
 * @throws {Error} If node is invalid or missing required fields
 *
 * @example
 * ```typescript
 * const tracks = validNodes.map(transformNodeToTrack);
 * ```
 */
export function transformNodeToTrack(node: GraphNode): Track {
  if (!isValidTrackNode(node)) {
    throw new Error(`Invalid track node: missing title or artist`);
  }

  const metadata = node.metadata || {};
  const trackId = node.id || node.track?.id || '';

  // Extract track name from multiple potential sources
  const trackName =
    node.title ||
    node.name ||
    metadata.title ||
    metadata.label ||
    node.label ||
    'Unknown Track';

  // Extract artist name from multiple potential sources
  const artistName =
    node.artist ||
    metadata.artist ||
    'Unknown Artist';

  return {
    id: trackId,
    name: trackName,
    title: trackName, // Alias for compatibility
    artist: artistName,

    // Musical metadata (may be undefined)
    bpm: node.bpm || metadata.bpm || undefined,
    key: node.key || metadata.key || metadata.camelotKey || undefined,
    energy: node.energy || metadata.energy || undefined,

    // Duration with stable fallback (3-8 minutes)
    duration: node.duration || metadata.duration ||
      getStableHashValue(trackId + '_duration', 180, 480),

    // Track status (default to unplayed)
    status: 'unplayed' as const,

    // Genre/category
    genre: node.genre || metadata.genre || metadata.category || 'Electronic',

    // Platform identifiers
    isrc: metadata.isrc || metadata.upc || undefined,
    spotify_id: metadata.spotify_id || undefined,
    apple_music_id: metadata.apple_music_id || undefined,
    beatport_id: metadata.beatport_id || undefined,
  };
}

/**
 * Deduplicate an array of tracks by ID
 *
 * Backend may return duplicate nodes in graph data. This function
 * ensures only unique tracks are retained, keeping the first occurrence
 * of each track ID.
 *
 * @param tracks - Array of tracks (may contain duplicates)
 * @returns Array of unique tracks
 *
 * @example
 * ```typescript
 * const uniqueTracks = deduplicateTracks(rawTracks);
 * ```
 */
export function deduplicateTracks(tracks: Track[]): Track[] {
  const uniqueTracksMap = new Map<string, Track>();

  tracks.forEach(track => {
    if (!uniqueTracksMap.has(track.id)) {
      uniqueTracksMap.set(track.id, track);
    }
  });

  return Array.from(uniqueTracksMap.values());
}

/**
 * Sort tracks by artist name (primary) and track name (secondary)
 *
 * Provides alphabetical sorting for library browsing.
 * Case-insensitive comparison for better UX.
 *
 * @param tracks - Array of tracks to sort
 * @returns Sorted array of tracks
 *
 * @example
 * ```typescript
 * const sortedTracks = sortTracksByArtist(tracks);
 * ```
 */
export function sortTracksByArtist(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    const artistCompare = a.artist.localeCompare(b.artist);
    if (artistCompare !== 0) return artistCompare;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Calculate a fuzzy search score for a track against search terms
 *
 * Scoring Algorithm:
 * - Exact phrase match: 1000 points
 * - Word starts with term: 500 points
 * - Contains term: 300 points
 * - Fuzzy match (1 char diff): 10 points
 *
 * Searched Fields:
 * - Track name (highest weight)
 * - Artist name
 * - Genre
 * - Key (Camelot notation)
 * - BPM
 *
 * @param track - Track to score
 * @param searchTerms - Array of search terms (already lowercased)
 * @returns Numeric score (higher = better match)
 *
 * @example
 * ```typescript
 * const query = 'deadmau5 strobe';
 * const terms = query.toLowerCase().split(/\s+/);
 * const score = calculateTrackSearchScore(track, terms);
 * ```
 */
export function calculateTrackSearchScore(track: Track, searchTerms: string[]): number {
  let score = 0;

  const name = track.name?.toLowerCase() || '';
  const artist = track.artist?.toLowerCase() || '';
  const genre = track.genre?.toLowerCase() || '';
  const key = track.key?.toLowerCase() || '';
  const bpm = track.bpm?.toString() || '';

  searchTerms.forEach(term => {
    // Exact phrase matches (highest priority)
    if (name === term) score += 1000;
    if (artist === term) score += 900;

    // Word starts with term (high priority)
    const nameWords = name.split(/\s+/);
    const artistWords = artist.split(/\s+/);
    if (nameWords.some(word => word.startsWith(term))) score += 500;
    if (artistWords.some(word => word.startsWith(term))) score += 400;

    // Contains exact term (medium priority)
    if (name.includes(term)) score += 300;
    if (artist.includes(term)) score += 250;
    if (genre.includes(term)) score += 200;
    if (key.includes(term)) score += 150;
    if (bpm.includes(term)) score += 150;

    // Fuzzy match (1 char difference) - low priority
    const fuzzyMatch = (str: string, term: string): boolean => {
      if (Math.abs(str.length - term.length) > 1) return false;
      let diff = 0;
      const maxLen = Math.max(str.length, term.length);
      for (let i = 0; i < maxLen; i++) {
        if (str[i] !== term[i]) diff++;
        if (diff > 1) return false;
      }
      return diff === 1;
    };

    if (nameWords.some(word => fuzzyMatch(word, term))) score += 10;
    if (artistWords.some(word => fuzzyMatch(word, term))) score += 8;
  });

  return score;
}

/**
 * Filter and score tracks based on search query
 *
 * Combines fuzzy search scoring with filtering to provide
 * ranked search results.
 *
 * @param tracks - Array of all tracks
 * @param query - Search query string
 * @returns Sorted array of matching tracks (highest score first)
 *
 * @example
 * ```typescript
 * const results = searchTracks(allTracks, 'progressive house 128 bpm');
 * ```
 */
export function searchTracks(tracks: Track[], query: string): Track[] {
  if (!query.trim()) return tracks;

  const searchTerms = query.toLowerCase().trim().split(/\s+/);

  const scoredTracks = tracks
    .map(track => ({
      track,
      score: calculateTrackSearchScore(track, searchTerms)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ track }) => track);

  return scoredTracks;
}
