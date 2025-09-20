import { EdgeVisual, NodeVisual } from '../types/graph';

export interface RouteInput {
  start: string;
  end: string;
  waypoints: string[]; // unordered, optional
  preventCycles?: boolean; // Prevent revisiting nodes (default: true)
}

type GraphAdj = Map<string, Array<{ to: string; w: number }>>;

function buildAdj(nodes: NodeVisual[], edges: EdgeVisual[]): GraphAdj {
  const adj: GraphAdj = new Map();

  // Initialize adjacency list for all nodes
  nodes.forEach(node => {
    adj.set(node.id, []);
  });

  const add = (a: string, b: string, w: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, w });
  };

  edges.forEach(e => {
    const adjacencyFreq = e.metadata && typeof e.metadata.adjacency_frequency === 'number'
      ? e.metadata.adjacency_frequency
      : undefined;
    const w = Math.max(0.001, e.weight || adjacencyFreq || 1);
    // Convert frequency to distance: higher freq => shorter distance
    const dist = 1 / w;
    add(e.source, e.target, dist);
    add(e.target, e.source, dist);
  });

  return adj;
}

function dijkstra(adj: GraphAdj, src: string, dst: string, excludeNodes: Set<string> = new Set()): string[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const Q = new Set<string>(adj.keys());

  // Initialize distances
  for (const k of adj.keys()) {
    if (excludeNodes.has(k) && k !== src && k !== dst) {
      // Skip excluded nodes except src and dst
      continue;
    }
    dist.set(k, k === src ? 0 : Infinity);
    prev.set(k, null);
  }

  while (Q.size) {
    let u: string | null = null;
    let best = Infinity;

    for (const v of Q) {
      if (!dist.has(v)) continue;
      const d = dist.get(v) ?? Infinity;
      if (d < best) {
        best = d;
        u = v;
      }
    }

    if (u === null || best === Infinity) break;
    Q.delete(u);

    if (u === dst) {
      // Found destination, build path
      const path: string[] = [];
      let cur: string | null = dst;
      while (cur) {
        path.unshift(cur);
        cur = prev.get(cur) ?? null;
      }
      if (path[0] === src) {
        return path;
      }
      return null;
    }

    const neigh = adj.get(u) || [];
    for (const { to, w } of neigh) {
      // Skip excluded nodes unless it's the destination
      if (excludeNodes.has(to) && to !== dst) continue;

      const alt = (dist.get(u) ?? Infinity) + w;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, u);
      }
    }
  }

  return null;
}

// Helper function to find optimal waypoint ordering
function findOptimalWaypointOrder(
  adj: GraphAdj,
  start: string,
  end: string,
  waypoints: string[],
  visitedSoFar: Set<string>
): { path: string[] | null; waypointOrder: string[] } {
  if (waypoints.length === 0) {
    // Direct path from start to end
    const finalPath = dijkstra(adj, start, end, visitedSoFar);
    return { path: finalPath, waypointOrder: [] };
  }

  let bestPath: string[] | null = null;
  let bestWaypointOrder: string[] = [];
  let bestTotalLength = Infinity;

  // Try each waypoint as the next destination
  for (const wp of waypoints) {
    // Skip if already visited
    if (visitedSoFar.has(wp)) continue;

    // Find path to this waypoint
    const pathToWaypoint = dijkstra(adj, start, wp, visitedSoFar);
    if (!pathToWaypoint) continue;

    // Check if this path would create cycles
    const wouldRevisit = pathToWaypoint.slice(1, -1).some(node => visitedSoFar.has(node));
    if (wouldRevisit) continue;

    // Create new visited set with this path
    const newVisited = new Set(visitedSoFar);
    for (const node of pathToWaypoint) {
      newVisited.add(node);
    }

    // Recursively find the rest of the path
    const remainingWaypoints = waypoints.filter(w => w !== wp);
    const { path: restOfPath, waypointOrder: restOrder } = findOptimalWaypointOrder(
      adj,
      wp,
      end,
      remainingWaypoints,
      newVisited
    );

    if (restOfPath) {
      // Combine paths (avoiding duplication of the waypoint node)
      const fullPath = [...pathToWaypoint, ...restOfPath.slice(1)];
      const totalLength = fullPath.length;

      if (totalLength < bestTotalLength) {
        bestPath = fullPath;
        bestWaypointOrder = [wp, ...restOrder];
        bestTotalLength = totalLength;
      }
    }
  }

  return { path: bestPath, waypointOrder: bestWaypointOrder };
}

export function computeRoute(nodes: NodeVisual[], edges: EdgeVisual[], input: RouteInput): string[] | null {
  const { start, end, waypoints = [], preventCycles = true } = input;

  // Build adjacency list
  const adj = buildAdj(nodes, edges);

  // Remove duplicates from waypoints
  const uniqueWaypoints = Array.from(new Set(waypoints));

  // Remove start and end from waypoints if they're there
  const cleanWaypoints = uniqueWaypoints.filter(wp => wp !== start && wp !== end);

  if (!preventCycles) {
    // Simple greedy approach without cycle prevention (old behavior)
    const remaining = new Set(cleanWaypoints);
    let current = start;
    let route: string[] = [start];

    while (remaining.size) {
      let bestWP: string | null = null;
      let bestLen = Infinity;
      let bestPath: string[] | null = null;

      for (const wp of remaining) {
        const p = dijkstra(adj, current, wp, new Set());
        if (p && p.length < bestLen) {
          bestLen = p.length;
          bestWP = wp;
          bestPath = p;
        }
      }

      if (!bestWP || !bestPath) return null;
      route = route.concat(bestPath.slice(1));
      remaining.delete(bestWP);
      current = bestWP;
    }

    const endPath = dijkstra(adj, current, end, new Set());
    if (!endPath) return null;
    route = route.concat(endPath.slice(1));
    return route;
  }

  // With cycle prevention - find optimal waypoint ordering
  const initialVisited = new Set<string>();
  initialVisited.add(start);

  // For small number of waypoints, try to find optimal ordering
  if (cleanWaypoints.length <= 6) {
    const { path } = findOptimalWaypointOrder(adj, start, end, cleanWaypoints, initialVisited);
    return path;
  }

  // For larger number of waypoints, use greedy approach with strict cycle prevention
  const visited = new Set<string>();
  visited.add(start);
  let current = start;
  let route: string[] = [start];
  const remaining = new Set(cleanWaypoints);

  // Visit waypoints in a greedy manner
  while (remaining.size > 0) {
    let bestWP: string | null = null;
    let bestPath: string[] | null = null;
    let bestLen = Infinity;

    for (const wp of remaining) {
      if (visited.has(wp)) continue;

      // Find path excluding already visited nodes
      const path = dijkstra(adj, current, wp, visited);
      if (!path) continue;

      // Verify no cycles in the path segment
      const pathNodes = path.slice(1, -1); // Exclude start and end of segment
      const hasCycle = pathNodes.some(node => visited.has(node));
      if (hasCycle) continue;

      if (path.length < bestLen) {
        bestLen = path.length;
        bestWP = wp;
        bestPath = path;
      }
    }

    if (!bestWP || !bestPath) {
      // Can't reach any more waypoints without cycles
      break;
    }

    // Add this segment to the route
    const segment = bestPath.slice(1); // Exclude the starting node (already in route)
    route = route.concat(segment);

    // Mark all nodes in this segment as visited
    for (const node of segment) {
      visited.add(node);
    }

    remaining.delete(bestWP);
    current = bestWP;
  }

  // Now add path to the end
  const endPath = dijkstra(adj, current, end, visited);
  if (!endPath) {
    return null; // Cannot reach end without revisiting nodes
  }

  // Verify the final segment doesn't create cycles
  const finalSegment = endPath.slice(1, -1); // Exclude current and end
  const hasCycle = finalSegment.some(node => visited.has(node));
  if (hasCycle) {
    return null; // Cannot reach end without revisiting nodes
  }

  // Add final segment
  route = route.concat(endPath.slice(1));

  // Final verification: ensure no repeated nodes
  const nodeSet = new Set(route);
  if (nodeSet.size !== route.length) {
    console.error('Route has repeated nodes:', route);
    return null;
  }

  // Ensure route starts with start and ends with end
  if (route[0] !== start || route[route.length - 1] !== end) {
    console.error('Route does not properly start/end:', route);
    return null;
  }

  return route;
}