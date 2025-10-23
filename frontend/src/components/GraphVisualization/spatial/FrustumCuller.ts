/**
 * Frustum Culler for Viewport-Based Visibility
 * Determines which nodes/edges are visible in the current viewport
 * Provides efficient culling using the Quadtree spatial index
 */

import type { Viewport, Rectangle, EnhancedGraphNode, EnhancedGraphEdge } from '../types';
import { Quadtree } from './Quadtree';

/**
 * Frustum culler for efficient visibility testing
 */
export class FrustumCuller {
  private quadtree: Quadtree<EnhancedGraphNode> | null = null;
  private viewport: Viewport;
  private buffer: number;

  /**
   * Create a new FrustumCuller
   * @param viewport - Current viewport state
   * @param buffer - Extra pixels beyond viewport to consider visible (prevents popping)
   */
  constructor(viewport: Viewport, buffer: number = 100) {
    this.viewport = viewport;
    this.buffer = buffer;
  }

  /**
   * Update the spatial index with new nodes
   * @param nodes - Array of graph nodes
   */
  updateSpatialIndex(nodes: EnhancedGraphNode[]): void {
    // Calculate graph bounds
    const bounds = this.calculateBounds(nodes);

    // Create new quadtree
    this.quadtree = new Quadtree<EnhancedGraphNode>(
      {
        x: bounds.centerX,
        y: bounds.centerY,
        width: bounds.halfWidth,
        height: bounds.halfHeight,
      },
      4, // capacity
      8  // maxDepth
    );

    // Insert all nodes
    for (const node of nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        this.quadtree.insert(node);
      }
    }
  }

  /**
   * Calculate bounds for the graph
   */
  private calculateBounds(nodes: EnhancedGraphNode[]): {
    centerX: number;
    centerY: number;
    halfWidth: number;
    halfHeight: number;
  } {
    if (nodes.length === 0) {
      return { centerX: 0, centerY: 0, halfWidth: 1000, halfHeight: 1000 };
    }

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
    const padding = this.buffer;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const halfWidth = (maxX - minX) / 2;
    const halfHeight = (maxY - minY) / 2;

    return { centerX, centerY, halfWidth, halfHeight };
  }

  /**
   * Update viewport
   * @param viewport - New viewport state
   */
  updateViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  /**
   * Transform world coordinates to screen coordinates
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   * @returns Screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const { width, height, zoom, x, y } = this.viewport;
    const centerX = width / 2;
    const centerY = height / 2;

    return {
      x: worldX * zoom + x + centerX,
      y: worldY * zoom + y + centerY,
    };
  }

  /**
   * Transform screen coordinates to world coordinates
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @returns World coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const { width, height, zoom, x, y } = this.viewport;
    const centerX = width / 2;
    const centerY = height / 2;

    return {
      x: (screenX - x - centerX) / zoom,
      y: (screenY - y - centerY) / zoom,
    };
  }

  /**
   * Get the viewport rectangle in world coordinates
   * @returns Rectangle in world space
   */
  getViewportRectangle(): Rectangle {
    const { width, height } = this.viewport;

    // Add buffer
    const topLeft = this.screenToWorld(-this.buffer, -this.buffer);
    const bottomRight = this.screenToWorld(
      width + this.buffer,
      height + this.buffer
    );

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  /**
   * Query visible nodes in the current viewport
   * @returns Array of visible nodes
   */
  queryVisibleNodes(): EnhancedGraphNode[] {
    if (!this.quadtree) {
      return [];
    }

    const viewportRect = this.getViewportRectangle();
    return this.quadtree.query(viewportRect);
  }

  /**
   * Check if a node is visible in the viewport
   * @param node - The node to check
   * @returns true if visible
   */
  isNodeVisible(node: EnhancedGraphNode): boolean {
    if (node.x === undefined || node.y === undefined) {
      return false;
    }

    const { width, height } = this.viewport;
    const screen = this.worldToScreen(node.x, node.y);

    // Check if within screen bounds (with buffer)
    return (
      screen.x >= -this.buffer &&
      screen.x <= width + this.buffer &&
      screen.y >= -this.buffer &&
      screen.y <= height + this.buffer
    );
  }

  /**
   * Check if an edge is visible in the viewport
   * At least one endpoint must be visible
   * @param edge - The edge to check
   * @returns true if visible
   */
  isEdgeVisible(edge: EnhancedGraphEdge): boolean {
    const source = typeof edge.source === 'object' ? edge.source : null;
    const target = typeof edge.target === 'object' ? edge.target : null;

    if (!source || !target) {
      return false;
    }

    // If either endpoint is visible, the edge is visible
    return this.isNodeVisible(source) || this.isNodeVisible(target);
  }

  /**
   * Check if an edge crosses the viewport
   * Even if both endpoints are outside, the edge might cross through
   * @param edge - The edge to check
   * @returns true if edge crosses viewport
   */
  isEdgeCrossingViewport(edge: EnhancedGraphEdge): boolean {
    const source = typeof edge.source === 'object' ? edge.source : null;
    const target = typeof edge.target === 'object' ? edge.target : null;

    if (
      !source ||
      !target ||
      source.x === undefined ||
      source.y === undefined ||
      target.x === undefined ||
      target.y === undefined
    ) {
      return false;
    }

    const viewportRect = this.getViewportRectangle();

    // Check if line segment intersects with viewport rectangle
    return this.lineIntersectsRectangle(
      source.x,
      source.y,
      target.x,
      target.y,
      viewportRect
    );
  }

  /**
   * Check if a line segment intersects with a rectangle
   * Uses Cohen-Sutherland algorithm
   */
  private lineIntersectsRectangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rect: Rectangle
  ): boolean {
    const INSIDE = 0; // 0000
    const LEFT = 1;   // 0001
    const RIGHT = 2;  // 0010
    const BOTTOM = 4; // 0100
    const TOP = 8;    // 1000

    const computeOutCode = (x: number, y: number): number => {
      let code = INSIDE;

      if (x < rect.x) {
        code |= LEFT;
      } else if (x > rect.x + rect.width) {
        code |= RIGHT;
      }

      if (y < rect.y) {
        code |= TOP;
      } else if (y > rect.y + rect.height) {
        code |= BOTTOM;
      }

      return code;
    };

    let outcode1 = computeOutCode(x1, y1);
    let outcode2 = computeOutCode(x2, y2);

    while (true) {
      if (!(outcode1 | outcode2)) {
        // Both points inside
        return true;
      } else if (outcode1 & outcode2) {
        // Both points on the same outside region
        return false;
      } else {
        // Line might intersect
        const outcodeOut = outcode1 ? outcode1 : outcode2;
        let x: number, y: number;

        // Find intersection point
        if (outcodeOut & TOP) {
          x = x1 + (x2 - x1) * (rect.y - y1) / (y2 - y1);
          y = rect.y;
        } else if (outcodeOut & BOTTOM) {
          x = x1 + (x2 - x1) * (rect.y + rect.height - y1) / (y2 - y1);
          y = rect.y + rect.height;
        } else if (outcodeOut & RIGHT) {
          y = y1 + (y2 - y1) * (rect.x + rect.width - x1) / (x2 - x1);
          x = rect.x + rect.width;
        } else if (outcodeOut & LEFT) {
          y = y1 + (y2 - y1) * (rect.x - x1) / (x2 - x1);
          x = rect.x;
        } else {
          break;
        }

        // Move outside point to intersection point
        if (outcodeOut === outcode1) {
          x1 = x;
          y1 = y;
          outcode1 = computeOutCode(x1, y1);
        } else {
          x2 = x;
          y2 = y;
          outcode2 = computeOutCode(x2, y2);
        }
      }
    }

    return false;
  }

  /**
   * Query nodes near a point (useful for hit testing)
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   * @param radius - Search radius in world units
   * @returns Array of nodes within radius
   */
  queryNodesNearPoint(
    worldX: number,
    worldY: number,
    radius: number
  ): EnhancedGraphNode[] {
    if (!this.quadtree) {
      return [];
    }

    return this.quadtree.queryCircle(worldX, worldY, radius);
  }

  /**
   * Find the nearest node to a point
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   * @param maxDistance - Maximum search distance
   * @returns The nearest node or null
   */
  findNearestNode(
    worldX: number,
    worldY: number,
    maxDistance: number = Infinity
  ): EnhancedGraphNode | null {
    if (!this.quadtree) {
      return null;
    }

    return this.quadtree.findNearest(worldX, worldY, maxDistance);
  }

  /**
   * Get statistics about visible content
   */
  getVisibilityStats(): {
    totalNodes: number;
    visibleNodes: number;
    culledNodes: number;
    visibilityRatio: number;
  } {
    if (!this.quadtree) {
      return {
        totalNodes: 0,
        visibleNodes: 0,
        culledNodes: 0,
        visibilityRatio: 0,
      };
    }

    const totalNodes = this.quadtree.count();
    const visibleNodes = this.queryVisibleNodes().length;
    const culledNodes = totalNodes - visibleNodes;
    const visibilityRatio = totalNodes > 0 ? visibleNodes / totalNodes : 0;

    return {
      totalNodes,
      visibleNodes,
      culledNodes,
      visibilityRatio,
    };
  }

  /**
   * Clear the spatial index
   */
  clear(): void {
    this.quadtree?.clear();
    this.quadtree = null;
  }
}
