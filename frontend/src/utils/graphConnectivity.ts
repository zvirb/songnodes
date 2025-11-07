import { GraphEdge } from '../types';

/**
 * Performs BFS to find all nodes reachable from a start node
 */
export function bfsReachableNodes(
  startNodeId: string,
  edges: GraphEdge[],
  maxNodes?: number
): Set<string> {
  const reachable = new Set<string>([startNodeId]);
  const queue: string[] = [startNodeId];

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  });

  while (queue.length > 0 && (maxNodes === undefined || reachable.size < maxNodes)) {
    const currentId = queue.shift()!;
    const neighbors = adjacency.get(currentId) || [];

    for (const neighborId of neighbors) {
      if (!reachable.has(neighborId)) {
        reachable.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return reachable;
}

/**
 * Checks if two nodes are connected in the graph
 */
export function areNodesConnected(
  sourceId: string,
  targetId: string,
  edges: GraphEdge[]
): boolean {
  const reachable = bfsReachableNodes(sourceId, edges, 10000);
  return reachable.has(targetId);
}

/**
 * Gets connectivity stats for a node
 */
export function getNodeConnectivity(
  nodeId: string,
  edges: GraphEdge[]
): {
  outDegree: number;
  inDegree: number;
  totalDegree: number;
  reachableCount: number;
} {
  const outgoing = edges.filter(e => e.source === nodeId);
  const incoming = edges.filter(e => e.target === nodeId);
  const reachable = bfsReachableNodes(nodeId, edges, 5000);

  return {
    outDegree: outgoing.length,
    inDegree: incoming.length,
    totalDegree: outgoing.length + incoming.length,
    reachableCount: reachable.size,
  };
}
