import { GraphData, GraphNode, GraphEdge, Point, Bounds, Color } from '../types';

/**
 * Graph manipulation and analysis utilities
 */

/**
 * Filter graph data based on node and edge criteria
 */
export function filterGraph(
  graphData: GraphData,
  nodeFilter?: (node: GraphNode) => boolean,
  edgeFilter?: (edge: GraphEdge, sourceNode: GraphNode, targetNode: GraphNode) => boolean
): GraphData {
  // Filter nodes first
  const filteredNodes = nodeFilter ? graphData.nodes.filter(nodeFilter) : graphData.nodes;
  const nodeIdSet = new Set(filteredNodes.map(n => n.id));

  // Filter edges to only include those between filtered nodes
  let filteredEdges = graphData.edges.filter(edge =>
    nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
  );

  // Apply edge filter if provided
  if (edgeFilter) {
    const nodeMap = new Map(filteredNodes.map(n => [n.id, n]));
    filteredEdges = filteredEdges.filter(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      return sourceNode && targetNode && edgeFilter(edge, sourceNode, targetNode);
    });
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}

/**
 * Find connected components in the graph
 */
export function findConnectedComponents(graphData: GraphData): GraphNode[][] {
  const visited = new Set<string>();
  const components: GraphNode[][] = [];
  const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  graphData.nodes.forEach(node => {
    adjacencyList.set(node.id, []);
  });

  graphData.edges.forEach(edge => {
    adjacencyList.get(edge.source)?.push(edge.target);
    adjacencyList.get(edge.target)?.push(edge.source);
  });

  // DFS to find components
  const dfs = (nodeId: string, component: GraphNode[]) => {
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) {
      component.push(node);
    }

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        dfs(neighborId, component);
      }
    }
  };

  // Find all components
  for (const node of graphData.nodes) {
    if (!visited.has(node.id)) {
      const component: GraphNode[] = [];
      dfs(node.id, component);
      components.push(component);
    }
  }

  return components;
}

/**
 * Calculate node degrees (number of connections)
 */
export function calculateNodeDegrees(graphData: GraphData): Map<string, number> {
  const degrees = new Map<string, number>();

  // Initialize all nodes with degree 0
  graphData.nodes.forEach(node => {
    degrees.set(node.id, 0);
  });

  // Count edges for each node
  graphData.edges.forEach(edge => {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
  });

  return degrees;
}

/**
 * Find shortest path between two nodes using BFS
 */
export function findShortestPath(
  graphData: GraphData,
  startId: string,
  endId: string
): string[] | null {
  if (startId === endId) return [startId];

  const adjacencyList = new Map<string, string[]>();
  graphData.nodes.forEach(node => {
    adjacencyList.set(node.id, []);
  });

  graphData.edges.forEach(edge => {
    adjacencyList.get(edge.source)?.push(edge.target);
    adjacencyList.get(edge.target)?.push(edge.source);
  });

  const queue = [startId];
  const visited = new Set([startId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === endId) {
      // Reconstruct path
      const path = [endId];
      let current = endId;

      while (parent.has(current)) {
        current = parent.get(current)!;
        path.unshift(current);
      }

      return path;
    }

    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        parent.set(neighborId, currentId);
        queue.push(neighborId);
      }
    }
  }

  return null; // No path found
}

/**
 * Get neighbors of a node within a specified distance
 */
export function getNeighborhood(
  graphData: GraphData,
  nodeId: string,
  maxDistance: number = 1
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
  const adjacencyList = new Map<string, string[]>();

  graphData.nodes.forEach(node => {
    adjacencyList.set(node.id, []);
  });

  graphData.edges.forEach(edge => {
    adjacencyList.get(edge.source)?.push(edge.target);
    adjacencyList.get(edge.target)?.push(edge.source);
  });

  // BFS to find nodes within distance
  const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId, distance: 0 }];
  const visited = new Map<string, number>();
  visited.set(nodeId, 0);

  while (queue.length > 0) {
    const { nodeId: currentId, distance } = queue.shift()!;

    if (distance < maxDistance) {
      const neighbors = adjacencyList.get(currentId) || [];

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId) || visited.get(neighborId)! > distance + 1) {
          visited.set(neighborId, distance + 1);
          queue.push({ nodeId: neighborId, distance: distance + 1 });
        }
      }
    }
  }

  // Collect nodes and edges in the neighborhood
  const neighborhoodNodeIds = new Set(visited.keys());
  const neighborhoodNodes = Array.from(neighborhoodNodeIds)
    .map(id => nodeMap.get(id))
    .filter((node): node is GraphNode => node !== undefined);

  const neighborhoodEdges = graphData.edges.filter(edge =>
    neighborhoodNodeIds.has(edge.source) && neighborhoodNodeIds.has(edge.target)
  );

  return {
    nodes: neighborhoodNodes,
    edges: neighborhoodEdges,
  };
}

/**
 * Calculate graph statistics
 */
export function calculateGraphStats(graphData: GraphData): {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  maxDegree: number;
  minDegree: number;
  componentCount: number;
  largestComponentSize: number;
} {
  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.edges.length;

  // Calculate density
  const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
  const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

  // Calculate degrees
  const degrees = calculateNodeDegrees(graphData);
  const degreeValues = Array.from(degrees.values());

  const averageDegree = degreeValues.length > 0 ? degreeValues.reduce((sum, d) => sum + d, 0) / degreeValues.length : 0;
  const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 0;
  const minDegree = degreeValues.length > 0 ? Math.min(...degreeValues) : 0;

  // Find connected components
  const components = findConnectedComponents(graphData);
  const componentCount = components.length;
  const largestComponentSize = components.length > 0 ? Math.max(...components.map(c => c.length)) : 0;

  return {
    nodeCount,
    edgeCount,
    density,
    averageDegree,
    maxDegree,
    minDegree,
    componentCount,
    largestComponentSize,
  };
}

/**
 * Calculate bounding box of graph nodes
 */
export function calculateGraphBounds(nodes: GraphNode[]): Bounds {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const positions = nodes
    .filter(node => typeof node.x === 'number' && typeof node.y === 'number')
    .map(node => ({ x: node.x!, y: node.y! }));

  if (positions.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Check if a point is inside a bounding box
 */
export function isPointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find nodes within a circular area
 */
export function findNodesInRadius(
  nodes: GraphNode[],
  center: Point,
  radius: number
): GraphNode[] {
  return nodes.filter(node => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return false;

    const distance = calculateDistance(center, { x: node.x, y: node.y });
    return distance <= radius;
  });
}

/**
 * Find nodes within a rectangular selection
 */
export function findNodesInRectangle(
  nodes: GraphNode[],
  bounds: Bounds
): GraphNode[] {
  return nodes.filter(node => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return false;

    return isPointInBounds({ x: node.x, y: node.y }, bounds);
  });
}

/**
 * Interpolate between two colors
 */
export function interpolateColor(color1: Color, color2: Color, t: number): Color {
  const clampedT = Math.max(0, Math.min(1, t));

  return {
    r: Math.round(color1.r + (color2.r - color1.r) * clampedT),
    g: Math.round(color1.g + (color2.g - color1.g) * clampedT),
    b: Math.round(color1.b + (color2.b - color1.b) * clampedT),
    a: color1.a !== undefined && color2.a !== undefined
      ? color1.a + (color2.a - color1.a) * clampedT
      : undefined,
  };
}

/**
 * Convert color to CSS string
 */
export function colorToCSS(color: Color): string {
  if (color.a !== undefined) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
  }
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Parse CSS color string to Color object
 */
export function parseColor(colorString: string): Color {
  // Handle hex colors
  if (colorString.startsWith('#')) {
    const hex = colorString.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : undefined;

    return { r, g, b, a };
  }

  // Handle rgb/rgba colors
  const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const a = rgbMatch[4] ? parseFloat(rgbMatch[4]) : undefined;

    return { r, g, b, a };
  }

  // Default fallback
  return { r: 0, g: 0, b: 0 };
}

/**
 * Generate a color based on a string hash
 */
export function hashStringToColor(str: string): Color {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate HSL values
  const h = Math.abs(hash) % 360;
  const s = 60 + (Math.abs(hash) % 40); // 60-100%
  const l = 40 + (Math.abs(hash) % 20); // 40-60%

  // Convert HSL to RGB
  const hslToRgb = (h: number, s: number, l: number): Color => {
    const hue = h / 360;
    const saturation = s / 100;
    const lightness = l / 100;

    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (saturation === 0) {
      r = g = b = lightness;
    } else {
      const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
      const p = 2 * lightness - q;
      r = hue2rgb(p, q, hue + 1/3);
      g = hue2rgb(p, q, hue);
      b = hue2rgb(p, q, hue - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  };

  return hslToRgb(h, s, l);
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function executedFunction(...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone an object (for immutable updates)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map(item => deepClone(item))) as unknown as T;
  }

  if (obj instanceof Map) {
    const clonedMap = new Map();
    Array.from(obj.entries()).forEach(([key, value]) => {
      clonedMap.set(deepClone(key), deepClone(value));
    });
    return clonedMap as unknown as T;
  }

  const clonedObj = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }

  return clonedObj;
}