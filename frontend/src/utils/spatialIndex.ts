import { quadtree, Quadtree } from 'd3-quadtree';
import { GraphNode, Point, Bounds } from '../types';

/**
 * Spatial Index for Graph Nodes using d3-quadtree
 *
 * Provides O(log n) spatial queries for graph visualization performance optimization.
 * Designed for graphs with 500+ nodes where linear O(n) searches become prohibitive.
 *
 * Key Features:
 * - Build quadtree index from node positions
 * - Find node at specific point (hover detection)
 * - Find nodes within radius (neighborhood queries)
 * - Find nodes in rectangle (box selection)
 * - Incremental updates for node position changes
 *
 * Performance Characteristics:
 * - Build: O(n log n)
 * - Point query: O(log n)
 * - Radius query: O(log n + k) where k = nodes in radius
 * - Rectangle query: O(log n + k) where k = nodes in rectangle
 * - Update single node: O(log n)
 */

export interface SpatialIndexNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  node: GraphNode;
}

export interface SpatialQueryMetrics {
  queryType: 'point' | 'radius' | 'rectangle' | 'rebuild';
  duration: number;
  resultCount: number;
  totalNodes: number;
  timestamp: number;
}

export class SpatialIndex {
  private quadtree: Quadtree<SpatialIndexNode>;
  private nodeMap: Map<string, SpatialIndexNode>;
  private metrics: SpatialQueryMetrics[];
  private maxMetrics: number = 100;

  constructor() {
    this.quadtree = quadtree<SpatialIndexNode>()
      .x(d => d.x)
      .y(d => d.y);
    this.nodeMap = new Map();
    this.metrics = [];
  }

  /**
   * Build spatial index from graph nodes
   * Call this when graph data changes significantly (new data load, layout complete)
   */
  buildIndex(nodes: GraphNode[]): void {
    const startTime = performance.now();

    // Clear existing index
    this.nodeMap.clear();

    // Filter nodes with valid positions and create spatial nodes
    const spatialNodes = nodes
      .filter(node =>
        typeof node.x === 'number' &&
        typeof node.y === 'number' &&
        !isNaN(node.x) &&
        !isNaN(node.y)
      )
      .map(node => {
        const spatialNode: SpatialIndexNode = {
          id: node.id,
          x: node.x!,
          y: node.y!,
          radius: node.radius || 8,
          node: node,
        };
        this.nodeMap.set(node.id, spatialNode);
        return spatialNode;
      });

    // Rebuild quadtree
    this.quadtree = quadtree<SpatialIndexNode>()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(spatialNodes);

    const duration = performance.now() - startTime;
    this.addMetric({
      queryType: 'rebuild',
      duration,
      resultCount: spatialNodes.length,
      totalNodes: nodes.length,
      timestamp: Date.now(),
    });
  }

  /**
   * Update position of a single node in the index
   * Use this during drag operations or continuous animations
   */
  updateNode(nodeId: string, x: number, y: number, radius?: number): void {
    const existingSpatialNode = this.nodeMap.get(nodeId);

    if (existingSpatialNode) {
      // Remove old position
      this.quadtree.remove(existingSpatialNode);

      // Update position
      existingSpatialNode.x = x;
      existingSpatialNode.y = y;
      if (radius !== undefined) {
        existingSpatialNode.radius = radius;
      }

      // Re-add with new position
      this.quadtree.add(existingSpatialNode);
    }
  }

  /**
   * Batch update multiple node positions
   * More efficient than multiple updateNode calls
   */
  updateNodes(updates: Array<{ id: string; x: number; y: number; radius?: number }>): void {
    // Remove all nodes being updated
    const spatialNodes: SpatialIndexNode[] = [];

    for (const update of updates) {
      const spatialNode = this.nodeMap.get(update.id);
      if (spatialNode) {
        this.quadtree.remove(spatialNode);
        spatialNode.x = update.x;
        spatialNode.y = update.y;
        if (update.radius !== undefined) {
          spatialNode.radius = update.radius;
        }
        spatialNodes.push(spatialNode);
      }
    }

    // Re-add all updated nodes
    spatialNodes.forEach(node => this.quadtree.add(node));
  }

  /**
   * Find the closest node to a point within a search radius
   * Returns null if no node found within radius
   *
   * Use for: Hover detection, click handling
   */
  findNodeAtPoint(point: Point, maxRadius: number = 20): GraphNode | null {
    const startTime = performance.now();
    let closestNode: SpatialIndexNode | null = null;
    let closestDistance = maxRadius;

    this.quadtree.visit((node, x1, y1, x2, y2) => {
      // Skip if this quad is too far away
      if (x1 > point.x + maxRadius || x2 < point.x - maxRadius ||
          y1 > point.y + maxRadius || y2 < point.y - maxRadius) {
        return true; // Skip this quad
      }

      // Check data points in this quad
      const data = node.data;
      if (data) {
        // Calculate distance to node edge (accounting for node radius)
        const dx = data.x - point.x;
        const dy = data.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const effectiveDistance = distance - data.radius;

        if (effectiveDistance < closestDistance) {
          closestDistance = effectiveDistance;
          closestNode = data;
        }
      }

      return false; // Continue visiting
    });

    const duration = performance.now() - startTime;
    this.addMetric({
      queryType: 'point',
      duration,
      resultCount: closestNode ? 1 : 0,
      totalNodes: this.nodeMap.size,
      timestamp: Date.now(),
    });

    return closestNode?.node || null;
  }

  /**
   * Find all nodes within a circular radius
   *
   * Use for: Neighborhood queries, area selection
   */
  findNodesInRadius(center: Point, radius: number): GraphNode[] {
    const startTime = performance.now();
    const results: GraphNode[] = [];
    const radiusSquared = radius * radius;

    this.quadtree.visit((node, x1, y1, x2, y2) => {
      // Skip if this quad is completely outside the search circle
      // Use circle-rectangle intersection test
      const closestX = Math.max(x1, Math.min(center.x, x2));
      const closestY = Math.max(y1, Math.min(center.y, y2));
      const dx = closestX - center.x;
      const dy = closestY - center.y;

      if (dx * dx + dy * dy > radiusSquared) {
        return true; // Skip this quad
      }

      // Check data points in this quad
      const data = node.data;
      if (data) {
        const dx = data.x - center.x;
        const dy = data.y - center.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared <= radiusSquared) {
          results.push(data.node);
        }
      }

      return false; // Continue visiting
    });

    const duration = performance.now() - startTime;
    this.addMetric({
      queryType: 'radius',
      duration,
      resultCount: results.length,
      totalNodes: this.nodeMap.size,
      timestamp: Date.now(),
    });

    return results;
  }

  /**
   * Find all nodes within a rectangular bounds
   *
   * Use for: Box selection, viewport culling
   */
  findNodesInRectangle(bounds: Bounds): GraphNode[] {
    const startTime = performance.now();
    const results: GraphNode[] = [];

    const x1 = bounds.x;
    const y1 = bounds.y;
    const x2 = bounds.x + bounds.width;
    const y2 = bounds.y + bounds.height;

    this.quadtree.visit((node, qx1, qy1, qx2, qy2) => {
      // Skip if this quad doesn't overlap the search rectangle
      if (qx1 > x2 || qx2 < x1 || qy1 > y2 || qy2 < y1) {
        return true; // Skip this quad
      }

      // Check data points in this quad
      const data = node.data;
      if (data) {
        if (data.x >= x1 && data.x <= x2 && data.y >= y1 && data.y <= y2) {
          results.push(data.node);
        }
      }

      return false; // Continue visiting
    });

    const duration = performance.now() - startTime;
    this.addMetric({
      queryType: 'rectangle',
      duration,
      resultCount: results.length,
      totalNodes: this.nodeMap.size,
      timestamp: Date.now(),
    });

    return results;
  }

  /**
   * Find k-nearest neighbors to a point
   *
   * Use for: Recommendation systems, similarity queries
   */
  findKNearestNeighbors(point: Point, k: number, maxSearchRadius: number = Infinity): GraphNode[] {
    const startTime = performance.now();
    const candidates: Array<{ node: GraphNode; distance: number }> = [];

    this.quadtree.visit((node, x1, y1, x2, y2) => {
      // Check data points in this quad
      const data = node.data;
      if (data) {
        const dx = data.x - point.x;
        const dy = data.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= maxSearchRadius) {
          candidates.push({ node: data.node, distance });
        }
      }

      return false; // Continue visiting all nodes
    });

    // Sort by distance and take k closest
    candidates.sort((a, b) => a.distance - b.distance);
    const results = candidates.slice(0, k).map(c => c.node);

    const duration = performance.now() - startTime;
    this.addMetric({
      queryType: 'point',
      duration,
      resultCount: results.length,
      totalNodes: this.nodeMap.size,
      timestamp: Date.now(),
    });

    return results;
  }

  /**
   * Get all nodes currently in the index
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodeMap.values()).map(sn => sn.node);
  }

  /**
   * Get the number of nodes in the index
   */
  size(): number {
    return this.nodeMap.size;
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.quadtree = quadtree<SpatialIndexNode>()
      .x(d => d.x)
      .y(d => d.y);
    this.nodeMap.clear();
    this.metrics = [];
  }

  /**
   * Get performance metrics for recent queries
   */
  getMetrics(): SpatialQueryMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get average query performance by type
   */
  getAverageMetrics(): Record<string, { avgDuration: number; count: number }> {
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.queryType]) {
        acc[metric.queryType] = { totalDuration: 0, count: 0 };
      }
      acc[metric.queryType].totalDuration += metric.duration;
      acc[metric.queryType].count += 1;
      return acc;
    }, {} as Record<string, { totalDuration: number; count: number }>);

    const result: Record<string, { avgDuration: number; count: number }> = {};
    for (const [type, stats] of Object.entries(grouped)) {
      result[type] = {
        avgDuration: stats.totalDuration / stats.count,
        count: stats.count,
      };
    }

    return result;
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = [];
  }

  /**
   * Add a performance metric (internal)
   */
  private addMetric(metric: SpatialQueryMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get detailed index statistics
   */
  getStats(): {
    nodeCount: number;
    avgQueryDuration: number;
    totalQueries: number;
    metricsByType: Record<string, { avgDuration: number; count: number }>;
  } {
    const avgMetrics = this.getAverageMetrics();
    const totalQueries = this.metrics.length;
    const avgQueryDuration = totalQueries > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries
      : 0;

    return {
      nodeCount: this.nodeMap.size,
      avgQueryDuration,
      totalQueries,
      metricsByType: avgMetrics,
    };
  }
}

/**
 * Singleton instance for application-wide spatial indexing
 * Use this for the main graph visualization
 */
export const globalSpatialIndex = new SpatialIndex();

/**
 * Hook-friendly factory function
 * Creates a new spatial index instance
 */
export function createSpatialIndex(): SpatialIndex {
  return new SpatialIndex();
}

/**
 * Utility: Compare performance of spatial vs linear search
 * Use for benchmarking and optimization validation
 */
export function benchmarkSpatialVsLinear(
  nodes: GraphNode[],
  testPoint: Point,
  radius: number = 20
): {
  spatial: { duration: number; result: GraphNode | null };
  linear: { duration: number; result: GraphNode | null };
  speedup: number;
} {
  // Build spatial index
  const spatialIndex = new SpatialIndex();
  spatialIndex.buildIndex(nodes);

  // Spatial query
  const spatialStart = performance.now();
  const spatialResult = spatialIndex.findNodeAtPoint(testPoint, radius);
  const spatialDuration = performance.now() - spatialStart;

  // Linear query
  const linearStart = performance.now();
  let linearResult: GraphNode | null = null;
  let minDistance = radius;

  for (const node of nodes) {
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      const dx = node.x - testPoint.x;
      const dy = node.y - testPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        linearResult = node;
      }
    }
  }
  const linearDuration = performance.now() - linearStart;

  return {
    spatial: { duration: spatialDuration, result: spatialResult },
    linear: { duration: linearDuration, result: linearResult },
    speedup: linearDuration / spatialDuration,
  };
}
