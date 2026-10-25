/**
 * @file Camelot Wheel Utilities
 * @description Provides utility functions for processing and analyzing track data
 * in the context of the Camelot wheel for harmonic mixing.
 */

import { GraphNode, GraphEdge, TrackConnection } from '../types';
import { CAMELOT_KEYS } from './camelotData';
import { SN } from '../lib/songnodes';

/**
 * Normalizes a key string to standard Camelot notation (e.g. '8A', '8B').
 * Handles null/undefined inputs.
 */
export const normalizeCamelotKey = (key?: string | null): string | null => {
  if (!key) return null;
  return SN.camelot(String(key)) || null;
};

/**
 * Extracts the Camelot key from a graph node, checking multiple possible fields.
 * @param {GraphNode} node - The graph node to process.
 * @returns {string | null} The Camelot key (e.g., '5A') or null if not found.
 */
export const getTrackKey = (node: GraphNode): string | null => {
  const raw = node.key ||
              node.camelotKey ||
              node.camelot_key ||
              node.metadata?.key ||
              node.metadata?.camelot_key ||
              node.metadata?.musical_key ||
              node.track?.camelotKey ||
              node.track?.key;
  return normalizeCamelotKey(raw);
};

/**
 * Groups graph nodes by their Camelot key.
 * @param {GraphNode[]} nodes - An array of graph nodes.
 * @returns {Record<string, GraphNode[]>} A dictionary mapping Camelot keys to arrays of nodes.
 */
export const getTracksByKey = (nodes: GraphNode[]): Record<string, GraphNode[]> => {
  const result: Record<string, GraphNode[]> = {};
  for (const node of nodes) {
    const key = getTrackKey(node);
    if (key) {
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(node);
    }
  }
  return result;
};

/**
 * Modulation relationship calculation from a reference Camelot key.
 */
export interface ModulationInfo {
  exactMatch: string;
  relative: string; // Inner/outer ring swap (e.g. 8A -> 8B or 8B -> 8A)
  adjacentPlus1: string; // +1 hour step (e.g. 8A -> 9A)
  adjacentMinus1: string; // -1 hour step (e.g. 8A -> 7A)
  energyBoostPlus2: string; // +2 hour steps energy boost (e.g. 8A -> 10A)
  energyBoostPlus7: string; // +7 semitones / hour steps lift (e.g. 8A -> 3A)
}

/**
 * Computes all harmonic modulation targets for a given key code.
 * @param {string} code - Camelot key code e.g. '8A' or '8B'.
 * @returns {ModulationInfo | null}
 */
export const getModulationTargets = (code: string | null | undefined): ModulationInfo | null => {
  const normalized = normalizeCamelotKey(code);
  if (!normalized) return null;

  const letter = normalized.slice(-1) as 'A' | 'B';
  const num = parseInt(normalized, 10);
  if (isNaN(num) || num < 1 || num > 12) return null;

  const otherLetter = letter === 'A' ? 'B' : 'A';
  const plus1Num = (num % 12) + 1;
  const minus1Num = ((num + 10) % 12) + 1;
  const plus2Num = ((num + 1) % 12) + 1;
  const plus7Num = ((num + 6) % 12) + 1;

  return {
    exactMatch: `${num}${letter}`,
    relative: `${num}${otherLetter}`,
    adjacentPlus1: `${plus1Num}${letter}`,
    adjacentMinus1: `${minus1Num}${letter}`,
    energyBoostPlus2: `${plus2Num}${letter}`,
    energyBoostPlus7: `${plus7Num}${letter}`,
  };
};

/**
 * Calculates the connections between keys on the Camelot wheel based on graph edges.
 * @param {GraphNode[]} nodes - All nodes in the graph.
 * @param {GraphEdge[]} edges - All edges in the graph.
 * @param {boolean} showHarmonicSuggestions - Whether to include theoretical compatible connections.
 * @returns {TrackConnection[]} An array of connections between keys.
 */
export const getTrackConnections = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  showHarmonicSuggestions: boolean
): TrackConnection[] => {
  const connectionMap = new Map<string, TrackConnection>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const tracksByKey = getTracksByKey(nodes);

  // Process existing graph edges as high-priority connections
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode && targetNode) {
      const sourceKey = getTrackKey(sourceNode);
      const targetKey = getTrackKey(targetNode);
      if (sourceKey && targetKey) {
        const connectionId = [sourceKey, targetKey].sort().join('-');
        let connection = connectionMap.get(connectionId);
        if (!connection) {
          connection = {
            sourceKey,
            targetKey,
            weight: 0,
            isPlaylistEdge: true,
            isHarmonicSuggestion: false,
            trackPairs: [],
          };
          connectionMap.set(connectionId, connection);
        }
        connection.weight += edge.weight || 1;
        connection.trackPairs.push({ source: sourceNode, target: targetNode, edge });
      }
    }
  }

  // Add theoretical harmonic suggestions if enabled
  if (showHarmonicSuggestions) {
    for (const sourceKey in tracksByKey) {
      const keyData = CAMELOT_KEYS.find(k => k.id === sourceKey);
      if (keyData) {
        for (const targetKey of keyData.compatible) {
          const connectionId = [sourceKey, targetKey].sort().join('-');
          if (!connectionMap.has(connectionId) && tracksByKey[targetKey]) {
            connectionMap.set(connectionId, {
              sourceKey,
              targetKey,
              weight: 1,
              isPlaylistEdge: false,
              isHarmonicSuggestion: true,
              trackPairs: [],
            });
          }
        }
      }
    }
  }

  return Array.from(connectionMap.values());
};
