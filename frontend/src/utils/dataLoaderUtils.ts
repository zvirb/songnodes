/**
 * @file Data Loader Utilities
 * @description Contains helper functions for the LiveDataLoader component.
 */

import { GraphNode } from '../types';

/**
 * Checks if a graph node has a valid, non-generic artist attribution.
 * This is used to filter out tracks that are likely part of a mix or compilation
 * with generic artist names like "Various Artists".
 *
 * @param {GraphNode} node - The graph node to validate.
 * @returns {boolean} True if the artist name is considered valid, false otherwise.
 */
export const hasValidArtist = (node: GraphNode): boolean => {
  const artist = node.artist || node.metadata?.artist;

  if (!artist) return false;

  const normalizedArtist = String(artist).toLowerCase().trim();

  const invalidArtists = new Set(['unknown', 'unknown artist', 'various artists', 'various', 'va']);
  if (invalidArtists.has(normalizedArtist)) return false;

  const invalidPrefixes = ['va @', 'various artists @', 'unknown artist,', 'unknown artist @'];
  if (invalidPrefixes.some(prefix => normalizedArtist.startsWith(prefix))) return false;

  return true;
};