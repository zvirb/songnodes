/**
 * Edge Renderer for High-Performance Graph Visualization
 * Renders 50,000+ edges efficiently using PIXI.js Graphics batching
 * Integrates with LODManager and FrustumCuller for optimized rendering
 *
 * Performance Targets:
 * - 50,000+ edges @ 60 FPS (with culling)
 * - Single draw call per frame (batched)
 * - 70-80% viewport culling
 * - Edge intersection tests < 2ms per frame
 */

import * as PIXI from 'pixi.js';
import type { Application, Graphics } from 'pixi.js';
import type { EnhancedGraphNode, EnhancedGraphEdge, LODLevel, Viewport, Rectangle } from '../types';
import { LODManager } from './LODManager';
import { FrustumCuller } from '../spatial/FrustumCuller';
import { getEdgeColor, getEdgeAlpha } from './edgeColorHelpers';

/**
 * Edge rendering statistics
 */
export interface EdgeRenderStats {
  totalEdges: number;
  visibleEdges: number;
  culledEdges: number;
  drawCalls: number;
  renderTimeMs: number;
}

/**
 * Edge renderer configuration
 */
export interface EdgeRendererConfig {
  baseEdgeWidth: number;
  enableWeightedWidth: boolean;
  enableColorByType: boolean;
  enableAlphaByDistance: boolean;
  minEdgeWidth: number;
  maxEdgeWidth: number;
  minAlpha: number;
  maxAlpha: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EdgeRendererConfig = {
  baseEdgeWidth: 1.5,
  enableWeightedWidth: true,
  enableColorByType: true,
  enableAlphaByDistance: true,
  minEdgeWidth: 0.5,
  maxEdgeWidth: 4,
  minAlpha: 0.2,
  maxAlpha: 0.7,
};

/**
 * Cached edge draw data for performance
 */
interface EdgeDrawData {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color: number;
  width: number;
  alpha: number;
  lod: LODLevel;
}

/**
 * Edge Renderer
 * Manages rendering of all graph edges with LOD and culling
 */
export class EdgeRenderer {
  private app: Application;
  private graphics: PIXI.Graphics;
  private lodManager: LODManager;
  private frustumCuller: FrustumCuller;

  private config: EdgeRendererConfig;
  private edgeCache: Map<string, EdgeDrawData> = new Map();

  // Interaction state
  private selectedEdgeIds: Set<string> = new Set();
  private pathEdgeIds: Set<string> = new Set();

  // Performance tracking
  private lastRenderTime: number = 0;

  /**
   * Create a new EdgeRenderer
   */
  constructor(
    app: Application,
    lodManager: LODManager,
    frustumCuller: FrustumCuller,
    config: Partial<EdgeRendererConfig> = {}
  ) {
    this.app = app;
    this.lodManager = lodManager;
    this.frustumCuller = frustumCuller;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create graphics object for edge rendering
    this.graphics = new PIXI.Graphics();
    this.graphics.name = 'EdgeGraphics';

    // Add to stage (behind nodes)
    this.app.stage.addChildAt(this.graphics, 0);
  }

  /**
   * Main render method
   * @param edges - All graph edges
   * @param nodes - Map of node ID to node (for lookups)
   * @param viewport - Current viewport state
   */
  render(
    edges: EnhancedGraphEdge[],
    nodes: Map<string, EnhancedGraphNode>,
    viewport: Viewport
  ): void {
    const startTime = performance.now();

    // Clear previous frame
    this.graphics.clear();

    // Update frustum culler
    this.frustumCuller.updateViewport(viewport);

    // Update LOD manager
    this.lodManager.updateCounts(nodes.size, edges.length);

    // Cull edges outside viewport
    const visibleEdges = this.cullEdges(edges, nodes, viewport);

    // Batch draw all visible edges
    this.batchDrawEdges(visibleEdges, nodes, viewport.zoom);

    // Track render time
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Cull edges outside viewport using frustum culling
   * Only render edges where at least one endpoint is visible OR edge crosses viewport
   */
  private cullEdges(
    edges: EnhancedGraphEdge[],
    nodes: Map<string, EnhancedGraphNode>,
    viewport: Viewport
  ): EnhancedGraphEdge[] {
    const viewportRect = this.frustumCuller.getViewportRectangle();
    const visibleEdges: EnhancedGraphEdge[] = [];

    for (const edge of edges) {
      // Get source and target nodes
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;

      const source = nodes.get(sourceId);
      const target = nodes.get(targetId);

      if (!source || !target || !source.x || !source.y || !target.x || !target.y) {
        continue;
      }

      // Check if edge is visible
      const isVisible = this.isEdgeVisible(source, target, viewportRect);

      if (isVisible) {
        // Cache resolved nodes
        edge.sourceNode = source;
        edge.targetNode = target;
        edge.isVisible = true;
        visibleEdges.push(edge);
      } else {
        edge.isVisible = false;
      }
    }

    return visibleEdges;
  }

  /**
   * Check if edge is visible in viewport
   * Uses Cohen-Sutherland line clipping algorithm
   */
  private isEdgeVisible(
    source: EnhancedGraphNode,
    target: EnhancedGraphNode,
    viewportRect: Rectangle
  ): boolean {
    if (!source.x || !source.y || !target.x || !target.y) {
      return false;
    }

    // Quick check: if either endpoint is visible, edge is visible
    const sourceInView = this.pointInRectangle(source.x, source.y, viewportRect);
    const targetInView = this.pointInRectangle(target.x, target.y, viewportRect);

    if (sourceInView || targetInView) {
      return true;
    }

    // Check if line segment intersects viewport
    return this.lineIntersectsRectangle(
      source.x,
      source.y,
      target.x,
      target.y,
      viewportRect
    );
  }

  /**
   * Check if point is within rectangle
   */
  private pointInRectangle(x: number, y: number, rect: Rectangle): boolean {
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    );
  }

  /**
   * Check if line segment intersects rectangle (Cohen-Sutherland)
   */
  private lineIntersectsRectangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rect: Rectangle
  ): boolean {
    const INSIDE = 0;
    const LEFT = 1;
    const RIGHT = 2;
    const BOTTOM = 4;
    const TOP = 8;

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
        // Both points on same outside region
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

        // Move outside point to intersection
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
   * Batch draw all visible edges in a single draw call
   */
  private batchDrawEdges(
    edges: EnhancedGraphEdge[],
    nodes: Map<string, EnhancedGraphNode>,
    zoom: number
  ): void {
    if (edges.length === 0) {
      return;
    }

    // Group edges by rendering style for batching
    const edgesByStyle = this.groupEdgesByStyle(edges, nodes, zoom);

    // Draw each group
    for (const [style, edgeGroup] of edgesByStyle) {
      this.drawEdgeGroup(edgeGroup, style);
    }
  }

  /**
   * Group edges by rendering style (color, width, alpha)
   */
  private groupEdgesByStyle(
    edges: EnhancedGraphEdge[],
    nodes: Map<string, EnhancedGraphNode>,
    zoom: number
  ): Map<string, EdgeDrawData[]> {
    const groups = new Map<string, EdgeDrawData[]>();

    for (const edge of edges) {
      const source = edge.sourceNode!;
      const target = edge.targetNode!;

      if (!source.x || !source.y || !target.x || !target.y) {
        continue;
      }

      // Calculate LOD
      const lod = this.lodManager.getEdgeLOD(edge);
      edge.lodLevel = lod;

      // Skip if culled
      if (lod === 3) {
        continue;
      }

      // Determine edge style
      const isSelected = this.selectedEdgeIds.has(this.getEdgeId(edge));
      const isInPath = this.pathEdgeIds.has(this.getEdgeId(edge));

      const color = this.config.enableColorByType
        ? getEdgeColor(edge, isSelected, isInPath)
        : 0x4a5568; // Default gray

      const width = this.calculateEdgeWidth(edge, lod, zoom);
      const alpha = this.calculateEdgeAlpha(edge, lod);

      // Create draw data
      const drawData: EdgeDrawData = {
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        color,
        width,
        alpha,
        lod,
      };

      // Group by style key (color_width_alpha)
      const styleKey = `${color}_${width.toFixed(1)}_${alpha.toFixed(2)}`;

      if (!groups.has(styleKey)) {
        groups.set(styleKey, []);
      }

      groups.get(styleKey)!.push(drawData);
    }

    return groups;
  }

  /**
   * Calculate edge width based on weight and LOD
   */
  private calculateEdgeWidth(edge: EnhancedGraphEdge, lod: LODLevel, zoom: number): number {
    let width = this.config.baseEdgeWidth;

    // Apply weight-based width
    if (this.config.enableWeightedWidth && edge.weight) {
      // Normalize weight (assuming weight range 0-1)
      const normalizedWeight = Math.min(1, Math.max(0, edge.weight));
      width = this.config.minEdgeWidth + (this.config.maxEdgeWidth - this.config.minEdgeWidth) * normalizedWeight;
    }

    // Apply LOD multiplier
    const lodMultiplier = this.lodManager.getEdgeWidthMultiplier(lod);
    width *= lodMultiplier;

    // Apply zoom (keep consistent screen-space width)
    width = Math.max(this.config.minEdgeWidth, width);

    return width;
  }

  /**
   * Calculate edge alpha based on LOD and distance
   */
  private calculateEdgeAlpha(edge: EnhancedGraphEdge, lod: LODLevel): number {
    let alpha = this.config.maxAlpha;

    // Base alpha on LOD
    switch (lod) {
      case 0:
        alpha = this.config.maxAlpha;
        break;
      case 1:
        alpha = this.config.maxAlpha * 0.7;
        break;
      case 2:
        alpha = this.config.minAlpha;
        break;
      case 3:
        alpha = 0;
        break;
    }

    return alpha;
  }

  /**
   * Draw a group of edges with the same style
   */
  private drawEdgeGroup(edges: EdgeDrawData[], styleKey: string): void {
    if (edges.length === 0) {
      return;
    }

    // Parse style from key
    const [colorStr, widthStr, alphaStr] = styleKey.split('_');
    const color = parseInt(colorStr);
    const width = parseFloat(widthStr);
    const alpha = parseFloat(alphaStr);

    // Set line style
    this.graphics.lineStyle({
      width,
      color,
      alpha,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND,
    });

    // Draw all edges in this group
    for (const edge of edges) {
      this.graphics.moveTo(edge.sourceX, edge.sourceY);
      this.graphics.lineTo(edge.targetX, edge.targetY);
    }
  }

  /**
   * Get unique edge ID
   */
  private getEdgeId(edge: EnhancedGraphEdge): string {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    return `${sourceId}->${targetId}`;
  }

  /**
   * Update interaction state
   */
  setSelectedEdges(edgeIds: Set<string>): void {
    this.selectedEdgeIds = edgeIds;
  }

  setPathEdges(edgeIds: Set<string>): void {
    this.pathEdgeIds = edgeIds;
  }

  /**
   * Get render statistics
   */
  getStats(edges: EnhancedGraphEdge[]): EdgeRenderStats {
    const visibleEdges = edges.filter(e => e.isVisible).length;

    return {
      totalEdges: edges.length,
      visibleEdges,
      culledEdges: edges.length - visibleEdges,
      drawCalls: 1, // Single batched draw call
      renderTimeMs: this.lastRenderTime,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EdgeRendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear edge cache
   */
  clearCache(): void {
    this.edgeCache.clear();
  }

  /**
   * Cleanup and destroy renderer
   */
  cleanup(): void {
    console.log('[EdgeRenderer] Cleaning up...');

    // Clear graphics
    this.graphics.clear();
    this.graphics.destroy();

    // Clear cache
    this.edgeCache.clear();
    this.selectedEdgeIds.clear();
    this.pathEdgeIds.clear();

    console.log('[EdgeRenderer] Cleanup complete');
  }
}
