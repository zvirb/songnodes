/**
 * @file DJ Interface Utilities
 * @description Contains helper functions and constants for the main DJInterface component.
 */

import { GraphNode, Track } from '../types';

/**
 * A stable, deterministic hash function to generate consistent pseudo-random values from a string.
 * Used for generating stable placeholder values (e.g., track duration) when real data is missing.
 * @param {string} str - The input string to hash.
 * @param {number} min - The minimum value of the desired range.
 * @param {number} max - The maximum value of the desired range.
 * @returns {number} A number within the specified range.
 */
export const getStableHashValue = (str: string, min: number, max: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % (max - min + 1) + min;
};

/**
 * Transforms a graph node into a standardized Track object.
 * It safely checks multiple potential fields for each piece of track information.
 * @param {GraphNode} node - The graph node to transform.
 * @returns {Track} The standardized Track object.
 */
export const transformNodeToTrack = (node: GraphNode): Track => {
  const metadata = node.metadata || {};
  const trackId = node.id || node.track_id || '';

  return {
    id: trackId,
    name: node.title || metadata.title || metadata.label || node.label || 'Unknown Track',
    title: node.title || metadata.title || metadata.label || node.label || 'Unknown Track',
    artist: node.artist || metadata.artist || 'Unknown Artist',
    bpm: metadata.bpm,
    key: metadata.key || metadata.camelotKey,
    energy: metadata.energy,
    duration: metadata.duration || getStableHashValue(trackId + '_duration', 180, 480),
    status: 'unplayed',
    genre: metadata.genre || metadata.category || 'Electronic',
    isrc: metadata.isrc || metadata.upc,
  };
};

/**
 * Validates if a graph node contains the minimum required data to be considered a track.
 * @param {GraphNode} node - The node to validate.
 * @returns {boolean} True if the node is a valid track node, false otherwise.
 */
export const isValidTrackNode = (node: GraphNode): boolean => {
  const hasTitle = node.title || node.metadata?.title || node.metadata?.label;
  const hasArtist = node.artist || node.metadata?.artist;
  return Boolean(hasTitle && hasArtist);
};