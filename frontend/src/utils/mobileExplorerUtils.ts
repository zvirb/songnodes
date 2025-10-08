/**
 * @file Mobile Track Explorer Utilities
 * @description Contains helper functions for the MobileTrackExplorer component.
 */

import { GraphNode, GraphEdge, Track } from '../types';

export interface ConnectedTrack {
  track: Track;
  connectionStrength: number;
}

/**
 * Transforms an array of graph nodes into a simplified array of Track objects
 * suitable for the mobile explorer UI.
 * @param {GraphNode[]} nodes - The array of graph nodes to transform.
 * @returns {Track[]} A list of simplified track objects.
 */
export const transformNodesToTracks = (nodes: GraphNode[]): Track[] => {
  return (nodes || []).map(node => ({
    id: node.id,
    name: node.title || node.metadata?.title || node.label || 'Unknown Track',
    artist: node.artist || node.metadata?.artist || 'Unknown Artist',
    bpm: node.metadata?.bpm || 120,
    key: node.metadata?.key || node.metadata?.camelotKey || '1A',
    energy: node.metadata?.energy || 5,
    duration: node.metadata?.duration || 180,
    genre: node.metadata?.genre || 'Electronic',
    album: node.metadata?.album,
    year: node.metadata?.year,
  }));
};

/**
 * Finds all tracks connected to a given track ID from the graph data.
 * @param {string} currentTrackId - The ID of the track to find connections for.
 * @param {GraphEdge[]} edges - The list of all edges in the graph.
 * @param {Track[]} allTracks - A list of all available tracks.
 * @returns {ConnectedTrack[]} A list of connected tracks, sorted by connection strength.
 */
export const getConnectedTracks = (
  currentTrackId: string,
  edges: GraphEdge[],
  allTracks: Track[]
): ConnectedTrack[] => {
  if (!currentTrackId || !edges) return [];

  const connections: ConnectedTrack[] = [];
  const trackMap = new Map(allTracks.map(t => [t.id, t]));

  for (const edge of edges) {
    // Safely get source and target IDs, whether they are strings or objects
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;

    let connectedId: string | null = null;
    if (sourceId === currentTrackId) {
      connectedId = targetId;
    } else if (targetId === currentTrackId) {
      connectedId = sourceId;
    }

    if (connectedId) {
      const track = trackMap.get(connectedId);
      if (track) {
        connections.push({
          track,
          connectionStrength: edge.weight || 1,
        });
      }
    }
  }

  // Sort by connection strength, highest first
  return connections.sort((a, b) => b.connectionStrength - a.connectionStrength);
};