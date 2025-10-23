/**
 * Quadtree Spatial Index for Efficient Spatial Queries
 * Provides O(log n) insertion and query performance
 *
 * Usage:
 *   const quadtree = new Quadtree(bounds, 4, 8);
 *   quadtree.insert(node);
 *   const nodesInRange = quadtree.query(rectangle);
 */

import type { Rectangle, Point, EnhancedGraphNode } from '../types';

/**
 * Quadtree node boundary
 */
export interface QuadtreeBoundary {
  x: number;      // Center X
  y: number;      // Center Y
  width: number;  // Half-width
  height: number; // Half-height
}

/**
 * Quadtree node containing graph nodes
 */
export class Quadtree<T extends Point> {
  private boundary: QuadtreeBoundary;
  private capacity: number;
  private maxDepth: number;
  private depth: number;
  private points: T[] = [];
  private divided = false;

  // Child quadrants
  private northeast?: Quadtree<T>;
  private northwest?: Quadtree<T>;
  private southeast?: Quadtree<T>;
  private southwest?: Quadtree<T>;

  /**
   * Create a new Quadtree
   * @param boundary - The boundary of this quadtree node
   * @param capacity - Max points before subdivision (default: 4)
   * @param maxDepth - Max depth to prevent infinite subdivision (default: 8)
   * @param depth - Current depth (internal use)
   */
  constructor(
    boundary: QuadtreeBoundary,
    capacity: number = 4,
    maxDepth: number = 8,
    depth: number = 0
  ) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  /**
   * Check if a point is within the boundary
   */
  private contains(point: Point): boolean {
    const { x, y, width, height } = this.boundary;
    return (
      point.x >= x - width &&
      point.x <= x + width &&
      point.y >= y - height &&
      point.y <= y + height
    );
  }

  /**
   * Check if a rectangle intersects with the boundary
   */
  private intersects(range: Rectangle): boolean {
    const { x, y, width, height } = this.boundary;

    // Rectangle corners
    const rangeLeft = range.x;
    const rangeRight = range.x + range.width;
    const rangeTop = range.y;
    const rangeBottom = range.y + range.height;

    // Boundary corners
    const boundaryLeft = x - width;
    const boundaryRight = x + width;
    const boundaryTop = y - height;
    const boundaryBottom = y + height;

    // Check for intersection
    return !(
      rangeRight < boundaryLeft ||
      rangeLeft > boundaryRight ||
      rangeBottom < boundaryTop ||
      rangeTop > boundaryBottom
    );
  }

  /**
   * Subdivide this quadtree node into four children
   */
  private subdivide(): void {
    const { x, y, width, height } = this.boundary;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const newCapacity = this.capacity;
    const newMaxDepth = this.maxDepth;
    const newDepth = this.depth + 1;

    // Northeast quadrant
    this.northeast = new Quadtree<T>(
      { x: x + halfWidth, y: y - halfHeight, width: halfWidth, height: halfHeight },
      newCapacity,
      newMaxDepth,
      newDepth
    );

    // Northwest quadrant
    this.northwest = new Quadtree<T>(
      { x: x - halfWidth, y: y - halfHeight, width: halfWidth, height: halfHeight },
      newCapacity,
      newMaxDepth,
      newDepth
    );

    // Southeast quadrant
    this.southeast = new Quadtree<T>(
      { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
      newCapacity,
      newMaxDepth,
      newDepth
    );

    // Southwest quadrant
    this.southwest = new Quadtree<T>(
      { x: x - halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
      newCapacity,
      newMaxDepth,
      newDepth
    );

    this.divided = true;

    // Redistribute existing points to children
    for (const point of this.points) {
      this.insertIntoChildren(point);
    }

    // Clear parent's points (now stored in children)
    this.points = [];
  }

  /**
   * Insert a point into the appropriate child quadrant
   */
  private insertIntoChildren(point: T): boolean {
    if (this.northeast!.insert(point)) return true;
    if (this.northwest!.insert(point)) return true;
    if (this.southeast!.insert(point)) return true;
    if (this.southwest!.insert(point)) return true;
    return false;
  }

  /**
   * Insert a point into the quadtree
   * @param point - The point to insert
   * @returns true if successful, false if outside boundary
   */
  insert(point: T): boolean {
    // Point is outside boundary
    if (!this.contains(point)) {
      return false;
    }

    // If we have room and haven't subdivided, add point here
    if (this.points.length < this.capacity && !this.divided) {
      this.points.push(point);
      return true;
    }

    // If we've reached max depth, force add here (prevent infinite subdivision)
    if (this.depth >= this.maxDepth) {
      this.points.push(point);
      return true;
    }

    // Need to subdivide
    if (!this.divided) {
      this.subdivide();
    }

    // Insert into appropriate child
    return this.insertIntoChildren(point);
  }

  /**
   * Query all points within a rectangular range
   * @param range - The rectangle to query
   * @returns Array of points within the range
   */
  query(range: Rectangle): T[] {
    const found: T[] = [];

    // No intersection, return empty
    if (!this.intersects(range)) {
      return found;
    }

    // Check points at this node
    for (const point of this.points) {
      if (this.pointInRectangle(point, range)) {
        found.push(point);
      }
    }

    // Recursively check children if divided
    if (this.divided) {
      found.push(...this.northeast!.query(range));
      found.push(...this.northwest!.query(range));
      found.push(...this.southeast!.query(range));
      found.push(...this.southwest!.query(range));
    }

    return found;
  }

  /**
   * Check if a point is within a rectangle
   */
  private pointInRectangle(point: Point, rect: Rectangle): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  /**
   * Find the nearest point to a given location
   * @param x - Target X coordinate
   * @param y - Target Y coordinate
   * @param maxDistance - Maximum search distance (default: Infinity)
   * @returns The nearest point or null if none found
   */
  findNearest(x: number, y: number, maxDistance: number = Infinity): T | null {
    let nearest: T | null = null;
    let minDistanceSquared = maxDistance * maxDistance;

    this.findNearestRecursive(x, y, nearest, minDistanceSquared);

    return nearest;
  }

  /**
   * Recursive helper for findNearest
   */
  private findNearestRecursive(
    x: number,
    y: number,
    currentNearest: T | null,
    currentMinDistSquared: number
  ): { nearest: T | null; minDistSquared: number } {
    let nearest = currentNearest;
    let minDistSquared = currentMinDistSquared;

    // Check if boundary could possibly contain a closer point
    const distToBoundary = this.distanceSquaredToRectangle(
      x,
      y,
      this.boundary
    );

    if (distToBoundary > minDistSquared) {
      return { nearest, minDistSquared };
    }

    // Check points at this node
    for (const point of this.points) {
      const distSquared = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distSquared < minDistSquared) {
        minDistSquared = distSquared;
        nearest = point;
      }
    }

    // Recursively check children
    if (this.divided) {
      // Check children in order of proximity to target point
      const children = [
        this.northeast!,
        this.northwest!,
        this.southeast!,
        this.southwest!,
      ].sort((a, b) => {
        const distA = this.distanceSquaredToRectangle(x, y, a.boundary);
        const distB = this.distanceSquaredToRectangle(x, y, b.boundary);
        return distA - distB;
      });

      for (const child of children) {
        const result = child.findNearestRecursive(x, y, nearest, minDistSquared);
        nearest = result.nearest;
        minDistSquared = result.minDistSquared;
      }
    }

    return { nearest, minDistSquared };
  }

  /**
   * Calculate squared distance from point to rectangle boundary
   */
  private distanceSquaredToRectangle(
    x: number,
    y: number,
    boundary: QuadtreeBoundary
  ): number {
    const { x: cx, y: cy, width, height } = boundary;
    const left = cx - width;
    const right = cx + width;
    const top = cy - height;
    const bottom = cy + height;

    const dx = Math.max(left - x, 0, x - right);
    const dy = Math.max(top - y, 0, y - bottom);

    return dx * dx + dy * dy;
  }

  /**
   * Query all points within a circular range
   * @param x - Center X
   * @param y - Center Y
   * @param radius - Search radius
   * @returns Array of points within the circle
   */
  queryCircle(x: number, y: number, radius: number): T[] {
    // First query rectangle that contains the circle
    const rect: Rectangle = {
      x: x - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2,
    };

    const candidates = this.query(rect);
    const radiusSquared = radius * radius;

    // Filter to only points actually within the circle
    return candidates.filter((point) => {
      const dx = point.x - x;
      const dy = point.y - y;
      return dx * dx + dy * dy <= radiusSquared;
    });
  }

  /**
   * Get total number of points in the tree
   */
  count(): number {
    let total = this.points.length;

    if (this.divided) {
      total += this.northeast!.count();
      total += this.northwest!.count();
      total += this.southeast!.count();
      total += this.southwest!.count();
    }

    return total;
  }

  /**
   * Clear all points from the tree
   */
  clear(): void {
    this.points = [];
    this.divided = false;
    this.northeast = undefined;
    this.northwest = undefined;
    this.southeast = undefined;
    this.southwest = undefined;
  }

  /**
   * Get all points in the tree (for debugging)
   */
  getAllPoints(): T[] {
    const allPoints = [...this.points];

    if (this.divided) {
      allPoints.push(...this.northeast!.getAllPoints());
      allPoints.push(...this.northwest!.getAllPoints());
      allPoints.push(...this.southeast!.getAllPoints());
      allPoints.push(...this.southwest!.getAllPoints());
    }

    return allPoints;
  }

  /**
   * Rebuild the tree with new points
   * @param points - Array of points to insert
   */
  rebuild(points: T[]): void {
    this.clear();
    for (const point of points) {
      this.insert(point);
    }
  }

  /**
   * Get depth statistics for debugging/optimization
   */
  getDepthStats(): { maxDepth: number; avgDepth: number; nodeCount: number } {
    const depths: number[] = [];

    const collectDepths = (node: Quadtree<T>): void => {
      if (node.points.length > 0) {
        depths.push(node.depth);
      }
      if (node.divided) {
        collectDepths(node.northeast!);
        collectDepths(node.northwest!);
        collectDepths(node.southeast!);
        collectDepths(node.southwest!);
      }
    };

    collectDepths(this);

    return {
      maxDepth: Math.max(...depths, 0),
      avgDepth: depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0,
      nodeCount: depths.length,
    };
  }
}

/**
 * Helper function to create a quadtree from graph nodes
 */
export function createQuadtreeFromNodes(
  nodes: EnhancedGraphNode[],
  padding: number = 100
): Quadtree<EnhancedGraphNode> {
  if (nodes.length === 0) {
    // Default boundary for empty graph
    return new Quadtree<EnhancedGraphNode>(
      { x: 0, y: 0, width: 1000, height: 1000 },
      4,
      8
    );
  }

  // Calculate bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (node.x !== undefined && node.y !== undefined) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }
  }

  // Add padding
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  // Calculate center and half-dimensions
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfWidth = (maxX - minX) / 2;
  const halfHeight = (maxY - minY) / 2;

  // Create quadtree
  const quadtree = new Quadtree<EnhancedGraphNode>(
    { x: centerX, y: centerY, width: halfWidth, height: halfHeight },
    4, // capacity
    8  // maxDepth
  );

  // Insert all nodes
  for (const node of nodes) {
    if (node.x !== undefined && node.y !== undefined) {
      quadtree.insert(node);
    }
  }

  return quadtree;
}
