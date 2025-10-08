/**
 * @file Camelot Wheel Utilities
 * @description Provides utility functions for processing and analyzing track data
 * in the context of the Camelot wheel for harmonic mixing.
 */

import { GraphNode, GraphEdge, CamelotKey, TrackConnection } from '../types';
import { CAMELOT_KEYS } from './camelotData';

/**
 * Extracts the Camelot key from a graph node, checking multiple possible fields.
 * @param {GraphNode} node - The graph node to process.
 * @returns {string | null} The Camelot key (e.g., '5A') or null if not found.
 */
export const getTrackKey = (node: GraphNode): string | null => {
  const key = node.key ||
              node.metadata?.key ||
              node.metadata?.camelot_key ||
              node.track?.key;
  if (!key) return null;
  // Basic validation to ensure it looks like a Camelot key
  return /^\d{1,2}[AB]$/.test(key) ? key : null;
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
 * Calculates the connections between keys on the Camelot wheel based on graph edges.
 * It prioritizes actual playlist connections over theoretical harmonic suggestions.
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
              weight: 1, // Give theoretical connections a base weight
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