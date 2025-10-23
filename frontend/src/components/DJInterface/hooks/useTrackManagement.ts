/**
 * useTrackManagement Hook
 *
 * Manages track state including selection, playback, and track history.
 * Transforms raw graph node data into validated Track objects and provides
 * methods for track interaction.
 *
 * @module DJInterface/hooks/useTrackManagement
 */

import { useState, useMemo, useCallback } from 'react';
import type { Track, GraphNode } from '../../../types';
import type { TrackManagementState } from '../types';
import {
  isValidTrackNode,
  transformNodeToTrack,
  deduplicateTracks,
  sortTracksByArtist,
} from '../utils/trackTransformers';

/**
 * Custom hook for managing track selection and playback state
 *
 * Features:
 * - Transforms and validates graph nodes into Track objects
 * - Deduplicates tracks by ID
 * - Maintains selected track state
 * - Maintains now playing state
 * - Tracks play history (last 50 tracks)
 * - Memoizes transformed tracks for performance
 *
 * Data Flow:
 * 1. Raw graph nodes → Validation → Transformation → Deduplication → Sorting
 * 2. User interactions → State updates → UI re-render
 *
 * @param nodes - Array of graph nodes from data loader
 * @returns TrackManagementState with tracks and control functions
 *
 * @example
 * ```typescript
 * function TrackBrowser() {
 *   const { nodes } = useDataLoader();
 *   const {
 *     tracks,
 *     selectedTrack,
 *     nowPlaying,
 *     selectTrack,
 *     playTrack
 *   } = useTrackManagement(nodes);
 *
 *   return (
 *     <div>
 *       {tracks.map(track => (
 *         <TrackItem
 *           key={track.id}
 *           track={track}
 *           isSelected={selectedTrack?.id === track.id}
 *           isPlaying={nowPlaying?.id === track.id}
 *           onSelect={() => selectTrack(track)}
 *           onPlay={() => playTrack(track)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTrackManagement(nodes: GraphNode[]): TrackManagementState {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [playHistory, setPlayHistory] = useState<Track[]>([]);

  /**
   * Transform, validate, deduplicate, and sort tracks
   *
   * Memoized to prevent recalculation on every render.
   * Only recalculates when nodes array length changes.
   */
  const tracks = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];

    try {
      // Step 1: Filter valid nodes (has title and artist)
      const validNodes = nodes.filter(isValidTrackNode);

      // Step 2: Transform to Track objects
      const transformedTracks = validNodes
        .map(node => {
          try {
            return transformNodeToTrack(node);
          } catch (error) {
            console.warn('[useTrackManagement] Failed to transform node:', node.id, error);
            return null;
          }
        })
        .filter((track): track is Track => track !== null);

      // Step 3: Deduplicate by ID
      const uniqueTracks = deduplicateTracks(transformedTracks);

      // Step 4: Sort by artist name
      const sortedTracks = sortTracksByArtist(uniqueTracks);

      return sortedTracks;
    } catch (error) {
      console.error('[useTrackManagement] Error processing tracks:', error);
      return [];
    }
  }, [nodes.length]); // Dependency: Only recalculate when node count changes

  /**
   * Select a track for inspection
   *
   * Opens track details modal and highlights node in graph.
   */
  const selectTrack = useCallback((track: Track) => {
    setSelectedTrack(track);
  }, []);

  /**
   * Start playing a track
   *
   * Updates now playing state and adds to play history.
   * Maintains last 50 played tracks for recommendations.
   */
  const playTrack = useCallback((track: Track) => {
    setNowPlaying(track);

    // Add to play history (keep last 50)
    setPlayHistory(prev => {
      const updated = [track, ...prev.filter(t => t.id !== track.id)];
      return updated.slice(0, 50);
    });
  }, []);

  /**
   * Clear current track selection
   */
  const clearSelection = useCallback(() => {
    setSelectedTrack(null);
  }, []);

  /**
   * Clear now playing track
   */
  const clearNowPlaying = useCallback(() => {
    setNowPlaying(null);
  }, []);

  return {
    tracks,
    selectedTrack,
    nowPlaying,
    playHistory,
    selectTrack,
    playTrack,
    clearSelection,
    clearNowPlaying,
  };
}
