/**
 * @file Harmonic Compatibility Utilities for Force Simulation
 * @description Provides music-specific helper functions for D3 force simulation,
 * including harmonic compatibility, BPM similarity, and genre clustering.
 * These functions enhance the force layout with domain-specific musical knowledge.
 */

import { GraphNode, GraphEdge } from '../types';
import { CAMELOT_KEYS } from './camelotData';

/**
 * Camelot key compatibility types with associated distance multipliers
 */
export type KeyCompatibilityType = 'same' | 'perfect' | 'compatible' | 'semitone' | 'incompatible';

/**
 * Musical genre clusters for force-based grouping
 */
export const GENRE_CLUSTERS: Record<string, string[]> = {
  // Electronic Dance Music
  electronic: ['techno', 'house', 'trance', 'electro', 'edm', 'progressive', 'deep house', 'tech house'],
  // Hip-Hop and related
  hiphop: ['hip hop', 'rap', 'trap', 'r&b', 'rnb', 'urban'],
  // Rock and variants
  rock: ['rock', 'indie', 'alternative', 'punk', 'metal', 'grunge'],
  // Pop and mainstream
  pop: ['pop', 'dance', 'disco', 'funk', 'soul'],
  // Latin and world
  latin: ['reggaeton', 'latin', 'salsa', 'bachata', 'merengue'],
  // Ambient and downtempo
  chill: ['ambient', 'chillout', 'lounge', 'downtempo', 'lo-fi', 'lofi'],
  // Bass music
  bass: ['dubstep', 'drum and bass', 'dnb', 'jungle', 'bass'],
};

/**
 * Checks if two Camelot keys are harmonically compatible.
 * Uses the Camelot Wheel system for DJ mixing compatibility.
 *
 * @param key1 - First Camelot key (e.g., '8A', '5B')
 * @param key2 - Second Camelot key (e.g., '8A', '5B')
 * @returns Compatibility type: 'same' | 'perfect' | 'compatible' | 'semitone' | 'incompatible'
 *
 * @example
 * checkKeyCompatibility('8A', '8A') // 'same' (identical key)
 * checkKeyCompatibility('8A', '8B') // 'perfect' (relative major/minor)
 * checkKeyCompatibility('8A', '9A') // 'compatible' (adjacent on wheel)
 * checkKeyCompatibility('8A', '10A') // 'semitone' (two steps away)
 * checkKeyCompatibility('8A', '3A') // 'incompatible' (distant keys)
 */
export function checkKeyCompatibility(
  key1: string | null | undefined,
  key2: string | null | undefined
): KeyCompatibilityType {
  if (!key1 || !key2) return 'incompatible';

  // Same key = perfect mix
  if (key1 === key2) return 'same';

  // Extract number and letter (A/B for minor/major)
  const num1 = parseInt(key1.slice(0, -1), 10);
  const letter1 = key1.slice(-1);
  const num2 = parseInt(key2.slice(0, -1), 10);
  const letter2 = key2.slice(-1);

  // Validate Camelot format (1-12 + A or B)
  if (isNaN(num1) || isNaN(num2) || num1 < 1 || num1 > 12 || num2 < 1 || num2 > 12) {
    return 'incompatible';
  }
  if (!['A', 'B'].includes(letter1) || !['A', 'B'].includes(letter2)) {
    return 'incompatible';
  }

  // Perfect: Same number, different letter (relative major/minor)
  // E.g., 8A (A Minor) ↔ 8B (C Major)
  if (num1 === num2 && letter1 !== letter2) {
    return 'perfect';
  }

  // Compatible: Adjacent numbers, same letter (±1 on the wheel)
  // E.g., 8A ↔ 7A or 8A ↔ 9A
  if (letter1 === letter2) {
    const numDiff = Math.abs(num1 - num2);
    const wrappedDiff = Math.min(numDiff, 12 - numDiff);

    if (wrappedDiff === 1) return 'compatible';
    if (wrappedDiff === 2) return 'semitone';
  }

  return 'incompatible';
}

/**
 * Calculates the harmonic distance multiplier for force simulation link distance.
 * Shorter distances = stronger attraction = more compatible keys.
 *
 * @param key1 - First Camelot key
 * @param key2 - Second Camelot key
 * @returns Distance multiplier (0.5 = very close, 2.0 = very far)
 *
 * @example
 * getHarmonicDistance('8A', '8A') // 0.5 (same key)
 * getHarmonicDistance('8A', '8B') // 0.6 (perfect match)
 * getHarmonicDistance('8A', '9A') // 0.8 (compatible)
 * getHarmonicDistance('8A', '3A') // 2.0 (incompatible)
 */
export function getHarmonicDistance(
  key1: string | null | undefined,
  key2: string | null | undefined
): number {
  const compatibility = checkKeyCompatibility(key1, key2);

  switch (compatibility) {
    case 'same':
      return 0.5; // Very close (same key)
    case 'perfect':
      return 0.6; // Close (relative major/minor)
    case 'compatible':
      return 0.8; // Moderate (adjacent on wheel)
    case 'semitone':
      return 1.2; // Further (two steps away)
    case 'incompatible':
    default:
      return 2.0; // Far (incompatible keys)
  }
}

/**
 * Calculates BPM similarity between two tracks.
 * Returns a value from 0 (very different) to 1 (very similar).
 *
 * @param bpm1 - First track's BPM
 * @param bpm2 - Second track's BPM
 * @returns Similarity score (0-1)
 *
 * @example
 * calculateBPMSimilarity(128, 128) // 1.0 (identical)
 * calculateBPMSimilarity(128, 130) // ~0.98 (very close)
 * calculateBPMSimilarity(128, 140) // ~0.91 (moderate)
 * calculateBPMSimilarity(80, 160) // ~0.5 (2x tempo relationship)
 */
export function calculateBPMSimilarity(
  bpm1: number | null | undefined,
  bpm2: number | null | undefined
): number {
  if (!bpm1 || !bpm2) return 0.5; // Neutral if BPM unknown

  // Handle tempo relationships (half-time, double-time)
  const ratio1 = Math.abs(bpm1 - bpm2);
  const ratio2 = Math.abs(bpm1 - bpm2 * 2); // Double-time
  const ratio3 = Math.abs(bpm1 * 2 - bpm2); // Half-time
  const minRatio = Math.min(ratio1, ratio2, ratio3);

  // Convert BPM difference to similarity (using exponential decay)
  // ±0 BPM = 1.0, ±5 BPM = ~0.95, ±10 BPM = ~0.9, ±20 BPM = ~0.82
  const similarity = Math.exp(-minRatio / 20);

  return Math.max(0, Math.min(1, similarity));
}

/**
 * Determines the genre cluster for a given genre string.
 *
 * @param genre - Genre string (case-insensitive)
 * @returns Cluster name or 'other' if not found
 *
 * @example
 * getGenreCluster('techno') // 'electronic'
 * getGenreCluster('Hip Hop') // 'hiphop'
 * getGenreCluster('unknown') // 'other'
 */
export function getGenreCluster(genre: string | null | undefined): string {
  if (!genre) return 'other';

  const normalizedGenre = genre.toLowerCase();

  for (const [cluster, genres] of Object.entries(GENRE_CLUSTERS)) {
    if (genres.some(g => normalizedGenre.includes(g))) {
      return cluster;
    }
  }

  return 'other';
}

/**
 * Checks if two tracks belong to the same genre cluster.
 *
 * @param genre1 - First track's genre
 * @param genre2 - Second track's genre
 * @returns True if both tracks are in the same cluster
 *
 * @example
 * isSameGenreCluster('techno', 'house') // true (both electronic)
 * isSameGenreCluster('rock', 'hip hop') // false (different clusters)
 */
export function isSameGenreCluster(
  genre1: string | null | undefined,
  genre2: string | null | undefined
): boolean {
  const cluster1 = getGenreCluster(genre1);
  const cluster2 = getGenreCluster(genre2);

  return cluster1 === cluster2 && cluster1 !== 'other';
}

/**
 * Calculates the radial position for BPM-based force.
 * Higher BPM = larger radius (outer ring).
 *
 * @param bpm - Track BPM
 * @param minBPM - Minimum BPM in dataset (default: 60)
 * @param maxBPM - Maximum BPM in dataset (default: 180)
 * @returns Normalized radius (0-1)
 *
 * @example
 * getBPMRadialPosition(120, 60, 180) // 0.5 (middle)
 * getBPMRadialPosition(180, 60, 180) // 1.0 (outer ring)
 * getBPMRadialPosition(60, 60, 180) // 0.0 (center)
 */
export function getBPMRadialPosition(
  bpm: number | null | undefined,
  minBPM: number = 60,
  maxBPM: number = 180
): number {
  if (!bpm) return 0.5; // Neutral position if BPM unknown

  const clampedBPM = Math.max(minBPM, Math.min(maxBPM, bpm));
  return (clampedBPM - minBPM) / (maxBPM - minBPM);
}

/**
 * Extracts the Camelot key from a graph node's various possible fields.
 *
 * @param node - Graph node
 * @returns Camelot key or null if not found
 */
export function getNodeKey(node: GraphNode): string | null {
  return (
    node.key ||
    node.camelot_key ||
    node.metadata?.key ||
    node.metadata?.camelot_key ||
    node.track?.key ||
    node.track?.camelotKey ||
    null
  );
}

/**
 * Extracts the BPM from a graph node's various possible fields.
 *
 * @param node - Graph node
 * @returns BPM or null if not found
 */
export function getNodeBPM(node: GraphNode): number | null {
  return (
    node.bpm ||
    node.metadata?.bpm ||
    node.track?.bpm ||
    null
  );
}

/**
 * Extracts the genre from a graph node's various possible fields.
 *
 * @param node - Graph node
 * @returns Genre or null if not found
 */
export function getNodeGenre(node: GraphNode): string | null {
  return (
    node.genre ||
    node.metadata?.genre ||
    node.track?.genre ||
    null
  );
}

/**
 * Calculates the degree centrality (number of connections) for a node.
 * Used to adjust repulsion force (higher degree = stronger repulsion).
 *
 * @param node - Graph node
 * @returns Connection count (defaults to 1 if not specified)
 */
export function getNodeDegree(node: GraphNode): number {
  return node.degree || node.connections || 1;
}

/**
 * Checks if an edge is a playlist edge (proven DJ transition) vs harmonic suggestion.
 *
 * @param edge - Graph edge
 * @returns True if playlist edge, false if harmonic suggestion
 */
export function isPlaylistEdge(edge: GraphEdge): boolean {
  return edge.type === 'adjacency' || edge.type === 'collaboration' || edge.weight > 1;
}

/**
 * Calculates the link strength multiplier based on edge type and weight.
 * Playlist edges get stronger links than harmonic suggestions.
 *
 * @param edge - Graph edge
 * @returns Link strength multiplier (0-1)
 *
 * @example
 * getLinkStrengthMultiplier({ type: 'adjacency', weight: 5 }) // 0.8 (strong playlist edge)
 * getLinkStrengthMultiplier({ type: 'key_compatibility', weight: 1 }) // 0.3 (weak suggestion)
 */
export function getLinkStrengthMultiplier(edge: GraphEdge): number {
  const isPlaylist = isPlaylistEdge(edge);

  if (isPlaylist) {
    // Playlist edges: 0.5 - 0.9 based on weight
    return Math.min(0.9, 0.5 + (edge.weight || 1) * 0.1);
  } else {
    // Harmonic suggestions: 0.2 - 0.4 (weaker)
    return 0.2 + (edge.weight || 1) * 0.05;
  }
}

/**
 * Calculates the recommended base distance for a link based on music properties.
 * Combines harmonic compatibility, BPM similarity, and edge type.
 *
 * @param sourceNode - Source graph node
 * @param targetNode - Target graph node
 * @param edge - Graph edge
 * @param baseDistance - Base distance (default: 120)
 * @returns Recommended link distance in pixels
 */
export function calculateMusicBasedDistance(
  sourceNode: GraphNode,
  targetNode: GraphNode,
  edge: GraphEdge,
  baseDistance: number = 120
): number {
  const sourceKey = getNodeKey(sourceNode);
  const targetKey = getNodeKey(targetNode);
  const sourceBPM = getNodeBPM(sourceNode);
  const targetBPM = getNodeBPM(targetNode);

  // Start with base distance
  let distance = baseDistance;

  // Apply harmonic compatibility (most important factor)
  const harmonicMultiplier = getHarmonicDistance(sourceKey, targetKey);
  distance *= harmonicMultiplier;

  // Apply BPM similarity (secondary factor)
  const bpmSimilarity = calculateBPMSimilarity(sourceBPM, targetBPM);
  const bpmMultiplier = 1.0 - (bpmSimilarity * 0.3); // Up to 30% reduction for similar BPM
  distance *= bpmMultiplier;

  // Apply edge type multiplier
  const edgeMultiplier = isPlaylistEdge(edge) ? 0.8 : 1.2; // Playlist edges closer
  distance *= edgeMultiplier;

  return distance;
}
