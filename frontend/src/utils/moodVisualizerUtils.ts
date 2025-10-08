/**
 * @file Mood Visualizer Utilities
 * @description Contains helper functions and constants for the MoodVisualizer component.
 */

import { GraphNode, GraphEdge, SetlistTrack } from '../types';

export interface EnergyPoint {
  position: number;
  energy: number;
  key: string | null;
  track: GraphNode;
  mood: string;
  transition: 'boost' | 'maintain' | 'drop' | 'unknown';
}

export const MOOD_COLORS: { [key: string]: string } = {
  euphoric: '#ef4444',
  energetic: '#f97316',
  uplifting: '#f59e0b',
  balanced: '#10b981',
  mellow: '#06b6d4',
  contemplative: '#3b82f6',
  melancholic: '#8b5cf6',
  ambient: '#6b7280',
};

const classifyMood = (energy: number): string => {
  if (energy >= 0.8) return 'euphoric';
  if (energy >= 0.7) return 'energetic';
  if (energy >= 0.6) return 'uplifting';
  if (energy >= 0.5) return 'balanced';
  if (energy >= 0.4) return 'mellow';
  if (energy >= 0.3) return 'contemplative';
  if (energy >= 0.2) return 'melancholic';
  return 'ambient';
};

const getTrackEnergy = (node: GraphNode): number => {
  return node.energy || node.metadata?.energy || node.track?.energy || 0.5;
};

const getTrackKey = (node: GraphNode): string | null => {
  return node.key || node.metadata?.key || node.metadata?.camelot_key || node.track?.key || null;
};

const orderNodesByEdges = (nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] => {
  if (nodes.length === 0) return [];
  const nodeSet = new Set(nodes.map(n => n.id));
  const adjMap = new Map<string, string[]>();

  edges.forEach(edge => {
    if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
      if (!adjMap.has(edge.source)) adjMap.set(edge.source, []);
      adjMap.get(edge.source)!.push(edge.target);
    }
  });

  const ordered: GraphNode[] = [];
  const visited = new Set<string>();
  const startNode = nodes.reduce((a, b) => ((adjMap.get(a.id)?.length || 0) > (adjMap.get(b.id)?.length || 0) ? a : b));

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) ordered.push(node);
    const connections = adjMap.get(nodeId) || [];
    connections.forEach(nextId => traverse(nextId));
  }

  traverse(startNode.id);
  nodes.forEach(node => !visited.has(node.id) && ordered.push(node));
  return ordered;
};

/**
 * Calculates the energy sequence from a given set of tracks or graph data.
 * @param {object} params - The data required for calculation.
 * @returns {EnergyPoint[]} An array of points representing the energy flow.
 */
export const calculateEnergySequence = ({
  nodes,
  edges,
  setlist,
  selectedNodeIds,
  usePlaylistData,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  setlist?: { tracks: SetlistTrack[] };
  selectedNodeIds: Set<string>;
  usePlaylistData: boolean;
}): EnergyPoint[] => {
  let sequenceNodes: GraphNode[];

  if (usePlaylistData && setlist?.tracks?.length) {
    sequenceNodes = setlist.tracks.map(st => nodes.find(n => n.id === st.track.id)).filter(Boolean) as GraphNode[];
  } else {
    const sourceNodes = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds).map(id => nodes.find(n => n.id === id)).filter(Boolean) as GraphNode[]
      : nodes.slice(0, 20);
    sequenceNodes = orderNodesByEdges(sourceNodes, edges);
  }

  if (sequenceNodes.length === 0) return [];

  const sequence = sequenceNodes.map((node, index) => {
    const energy = getTrackEnergy(node);
    return {
      position: sequenceNodes.length > 1 ? index / (sequenceNodes.length - 1) : 0.5,
      energy,
      key: getTrackKey(node),
      track: node,
      mood: classifyMood(energy),
      transition: 'unknown' as EnergyPoint['transition'],
    };
  });

  for (let i = 1; i < sequence.length; i++) {
    const energyDiff = sequence[i].energy - sequence[i - 1].energy;
    if (energyDiff > 0.15) sequence[i].transition = 'boost';
    else if (energyDiff < -0.15) sequence[i].transition = 'drop';
    else sequence[i].transition = 'maintain';
  }

  return sequence;
};