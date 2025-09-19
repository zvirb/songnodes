import { EdgeVisual, NodeVisual } from '@types/graph';

export interface RouteInput {
  start: string;
  end: string;
  waypoints: string[]; // unordered, optional
}

type GraphAdj = Map<string, Array<{ to: string; w: number }>>;

function buildAdj(nodes: NodeVisual[], edges: EdgeVisual[]): GraphAdj {
  const adj: GraphAdj = new Map();
  const add = (a: string, b: string, w: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, w });
  };
  edges.forEach(e => {
    const w = Math.max(0.001, e.weight || e.metadata?.adjacency_frequency || 1);
    // Convert frequency to distance: higher freq => shorter distance
    const dist = 1 / w;
    add(e.source, e.target, dist);
    add(e.target, e.source, dist);
  });
  return adj;
}

function dijkstra(adj: GraphAdj, src: string, dst: string): string[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const Q = new Set<string>(adj.keys());
  Q.add(src);
  dist.set(src, 0);
  prev.set(src, null);
  // Include isolated nodes
  for (const k of adj.keys()) { if (!dist.has(k)) dist.set(k, Infinity); if (!prev.has(k)) prev.set(k, null); }

  while (Q.size) {
    let u: string | null = null; let best = Infinity;
    for (const v of Q) { const d = dist.get(v) ?? Infinity; if (d < best) { best = d; u = v; } }
    if (u === null) break;
    Q.delete(u);
    if (u === dst) break;
    const neigh = adj.get(u) || [];
    for (const { to, w } of neigh) {
      const alt = (dist.get(u) ?? Infinity) + w;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt); prev.set(to, u);
        Q.add(to);
      }
    }
  }
  if (!prev.has(dst)) return null;
  const path: string[] = [];
  let cur: string | null = dst;
  while (cur) { path.unshift(cur); cur = prev.get(cur) ?? null; }
  if (path[0] !== src) return null;
  return path;
}

export function computeRoute(nodes: NodeVisual[], edges: EdgeVisual[], input: RouteInput): string[] | null {
  const { start, end, waypoints } = input;
  const points = [start, ...(waypoints || []), end];
  const unique = Array.from(new Set(points));
  const adj = buildAdj(nodes, edges);
  // Precompute pairwise shortest paths
  const pathCache = new Map<string, string[] | null>();
  const key = (a: string, b: string) => `${a}->${b}`;
  const getPath = (a: string, b: string) => {
    const k = key(a, b);
    if (!pathCache.has(k)) pathCache.set(k, dijkstra(adj, a, b));
    return pathCache.get(k)!;
  };

  // Greedy visit waypoints: start -> nearest remaining -> ... -> end
  const remaining = new Set(waypoints || []);
  let current = start;
  let route: string[] = [start];
  while (remaining.size) {
    let bestWP: string | null = null; let bestLen = Infinity; let bestPath: string[] | null = null;
    for (const wp of remaining) {
      const p = getPath(current, wp);
      if (p && p.length < bestLen) { bestLen = p.length; bestWP = wp; bestPath = p; }
    }
    if (!bestWP || !bestPath) return null;
    // append bestPath excluding first node (already in route)
    route = route.concat(bestPath.slice(1));
    remaining.delete(bestWP);
    current = bestWP;
  }
  const endPath = getPath(current, end);
  if (!endPath) return null;
  route = route.concat(endPath.slice(1));
  return route;
}

