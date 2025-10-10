import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { GraphData, GraphNode, GraphEdge } from '../types';
import { hashStringToColor } from './graphHelpers';

/**
 * Community detection using Louvain algorithm
 */

export interface Community {
  id: number;
  nodes: string[];
  size: number;
  color: string;
  centroid?: { x: number; y: number };
  averageBPM?: number;
  dominantGenre?: string;
  keyDistribution?: Record<string, number>;
}

export interface CommunityDetectionResult {
  communities: Community[];
  nodesCommunityMap: Map<string, number>;
  modularity: number;
  communityCount: number;
}

/**
 * Convert GraphData to graphology Graph
 */
export function convertToGraphology(graphData: GraphData): Graph {
  const graph = new Graph({ type: 'undirected' });

  // Add nodes
  graphData.nodes.forEach(node => {
    graph.addNode(node.id, {
      label: node.label,
      x: node.x,
      y: node.y,
      ...node
    });
  });

  // Add edges
  graphData.edges.forEach(edge => {
    try {
      // Avoid duplicate edges
      if (!graph.hasEdge(edge.source, edge.target)) {
        graph.addEdge(edge.source, edge.target, {
          weight: edge.weight || 1,
          ...edge
        });
      }
    } catch (err) {
      // Skip edges with invalid nodes
      console.warn(`Skipping edge ${edge.id}: ${err}`);
    }
  });

  return graph;
}

/**
 * Convert graphology Graph back to GraphData with community metadata
 */
export function convertFromGraphology(graph: Graph): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  graph.forEachNode((nodeId, attributes) => {
    nodes.push({
      id: nodeId,
      label: attributes.label || nodeId,
      x: attributes.x,
      y: attributes.y,
      ...attributes
    } as GraphNode);
  });

  graph.forEachEdge((edgeId, attributes, source, target) => {
    edges.push({
      id: edgeId,
      source,
      target,
      weight: attributes.weight || 1,
      type: attributes.type || 'adjacency',
      ...attributes
    } as GraphEdge);
  });

  return { nodes, edges };
}

/**
 * Calculate centroid of a community
 */
function calculateCentroid(nodes: GraphNode[]): { x: number; y: number } {
  if (nodes.length === 0) {
    return { x: 0, y: 0 };
  }

  const validNodes = nodes.filter(n => typeof n.x === 'number' && typeof n.y === 'number');

  if (validNodes.length === 0) {
    return { x: 0, y: 0 };
  }

  const sumX = validNodes.reduce((sum, node) => sum + (node.x || 0), 0);
  const sumY = validNodes.reduce((sum, node) => sum + (node.y || 0), 0);

  return {
    x: sumX / validNodes.length,
    y: sumY / validNodes.length
  };
}

/**
 * Calculate community metadata (BPM, genre, key distribution)
 */
function calculateCommunityMetadata(nodes: GraphNode[]): {
  averageBPM?: number;
  dominantGenre?: string;
  keyDistribution?: Record<string, number>;
} {
  const bpms: number[] = [];
  const genres: string[] = [];
  const keys: string[] = [];

  nodes.forEach(node => {
    if (node.bpm) bpms.push(node.bpm);
    if (node.genre) genres.push(node.genre);
    if (node.key) keys.push(node.key);
    if (node.camelot_key) keys.push(node.camelot_key);
  });

  // Calculate average BPM
  const averageBPM = bpms.length > 0
    ? bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length
    : undefined;

  // Find dominant genre
  const genreCounts: Record<string, number> = {};
  genres.forEach(genre => {
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  });
  const dominantGenre = Object.keys(genreCounts).length > 0
    ? Object.keys(genreCounts).reduce((a, b) => genreCounts[a] > genreCounts[b] ? a : b)
    : undefined;

  // Calculate key distribution
  const keyDistribution: Record<string, number> = {};
  keys.forEach(key => {
    keyDistribution[key] = (keyDistribution[key] || 0) + 1;
  });

  return {
    averageBPM,
    dominantGenre,
    keyDistribution: Object.keys(keyDistribution).length > 0 ? keyDistribution : undefined
  };
}

/**
 * Detect communities using Louvain algorithm
 *
 * @param graphData - The graph data to analyze
 * @param options - Configuration options
 * @returns Community detection results with metadata
 */
export function detectCommunities(
  graphData: GraphData,
  options: {
    resolution?: number; // Higher = more communities, default = 1
    randomWalk?: boolean; // Use random walk instead of standard Louvain
  } = {}
): CommunityDetectionResult {
  const { resolution = 1.0 } = options;

  // Convert to graphology format
  const graph = convertToGraphology(graphData);

  // Run Louvain algorithm
  const communityAssignments = louvain(graph, {
    resolution,
    // Note: graphology-communities-louvain uses 'resolution' parameter
  });

  // Build community map and collect community data
  const nodesCommunityMap = new Map<string, number>();
  const communityNodesMap = new Map<number, string[]>();

  Object.entries(communityAssignments).forEach(([nodeId, communityId]) => {
    const commId = communityId as number;
    nodesCommunityMap.set(nodeId, commId);

    if (!communityNodesMap.has(commId)) {
      communityNodesMap.set(commId, []);
    }
    communityNodesMap.get(commId)!.push(nodeId);
  });

  // Create node map for quick lookups
  const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

  // Build community objects with metadata
  const communities: Community[] = [];
  let communityIndex = 0;

  communityNodesMap.forEach((nodeIds, communityId) => {
    const communityNodes = nodeIds
      .map(id => nodeMap.get(id))
      .filter((n): n is GraphNode => n !== undefined);

    const centroid = calculateCentroid(communityNodes);
    const metadata = calculateCommunityMetadata(communityNodes);

    // Generate a color based on community ID
    const color = hashStringToColor(`community-${communityId}`);
    const colorHex = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;

    communities.push({
      id: communityId,
      nodes: nodeIds,
      size: nodeIds.length,
      color: colorHex,
      centroid,
      ...metadata
    });

    communityIndex++;
  });

  // Sort communities by size (largest first)
  communities.sort((a, b) => b.size - a.size);

  // Calculate modularity (quality metric)
  // Higher modularity (closer to 1) indicates better community structure
  const modularity = calculateModularity(graph, communityAssignments);

  return {
    communities,
    nodesCommunityMap,
    modularity,
    communityCount: communities.length
  };
}

/**
 * Calculate modularity score for community detection
 * Modularity measures the strength of division of a network into communities
 * Range: [-0.5, 1], higher is better
 */
function calculateModularity(
  graph: Graph,
  communityAssignments: { [key: string]: number }
): number {
  const m = graph.size; // Total number of edges
  if (m === 0) return 0;

  let modularity = 0;

  graph.forEachEdge((edge, attributes, source, target) => {
    const communitySource = communityAssignments[source];
    const communityTarget = communityAssignments[target];

    // If nodes are in the same community
    if (communitySource === communityTarget) {
      const degreeSource = graph.degree(source);
      const degreeTarget = graph.degree(target);

      // Actual edges - expected edges
      const contribution = 1 - (degreeSource * degreeTarget) / (2 * m);
      modularity += contribution;
    }
  });

  return modularity / (2 * m);
}

/**
 * Assign community colors to nodes in GraphData
 */
export function assignCommunityColors(
  graphData: GraphData,
  communities: Community[],
  nodesCommunityMap: Map<string, number>
): GraphData {
  // Create a community ID to color map
  const colorMap = new Map(communities.map(c => [c.id, c.color]));

  const nodesWithColors = graphData.nodes.map(node => {
    const communityId = nodesCommunityMap.get(node.id);
    const color = communityId !== undefined ? colorMap.get(communityId) : undefined;

    return {
      ...node,
      communityId,
      communityColor: color,
      metadata: {
        ...node.metadata,
        communityId,
        communityColor: color
      }
    };
  });

  return {
    nodes: nodesWithColors,
    edges: graphData.edges
  };
}

/**
 * Filter graph to show only nodes from specific communities
 */
export function filterByCommunities(
  graphData: GraphData,
  communityIds: number[],
  nodesCommunityMap: Map<string, number>
): GraphData {
  const communitySet = new Set(communityIds);

  const filteredNodes = graphData.nodes.filter(node => {
    const communityId = nodesCommunityMap.get(node.id);
    return communityId !== undefined && communitySet.has(communityId);
  });

  const nodeIdSet = new Set(filteredNodes.map(n => n.id));

  const filteredEdges = graphData.edges.filter(edge =>
    nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges
  };
}

/**
 * Get the community that a node belongs to
 */
export function getNodeCommunity(
  nodeId: string,
  communities: Community[]
): Community | undefined {
  return communities.find(c => c.nodes.includes(nodeId));
}

/**
 * Get all neighbors of a community (communities connected by at least one edge)
 */
export function getNeighboringCommunities(
  communityId: number,
  graphData: GraphData,
  nodesCommunityMap: Map<string, number>
): Set<number> {
  const neighborCommunities = new Set<number>();

  // Get all nodes in the community
  const communityNodes = new Set(
    Array.from(nodesCommunityMap.entries())
      .filter(([_, commId]) => commId === communityId)
      .map(([nodeId, _]) => nodeId)
  );

  // Find edges that connect to nodes outside the community
  graphData.edges.forEach(edge => {
    const sourceInCommunity = communityNodes.has(edge.source);
    const targetInCommunity = communityNodes.has(edge.target);

    // If one end is in the community and the other is not
    if (sourceInCommunity && !targetInCommunity) {
      const targetCommunity = nodesCommunityMap.get(edge.target);
      if (targetCommunity !== undefined) {
        neighborCommunities.add(targetCommunity);
      }
    } else if (!sourceInCommunity && targetInCommunity) {
      const sourceCommunity = nodesCommunityMap.get(edge.source);
      if (sourceCommunity !== undefined) {
        neighborCommunities.add(sourceCommunity);
      }
    }
  });

  return neighborCommunities;
}
