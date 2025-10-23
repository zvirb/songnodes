/**
 * Level of Detail (LOD) Manager
 * Dynamically adjusts rendering quality based on:
 * - Zoom level
 * - Distance from camera
 * - Node count (performance adaptation)
 * - Screen space size
 */

import type {
  LODLevel,
  LODConfig,
  Viewport,
  EnhancedGraphNode,
  EnhancedGraphEdge,
  PerformanceThresholds,
} from '../types';

/**
 * Default LOD configuration
 */
const DEFAULT_LOD_CONFIG: LODConfig = {
  thresholds: {
    near: 0.5,    // 50% of screen diagonal for full detail
    medium: 0.7,  // 70% for medium detail
    far: 0.9,     // 90% for low detail
  },
  nodeCountAdjustment: true,
  transitionDuration: 300, // ms
};

/**
 * Default performance thresholds
 */
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  NODE_COUNT_HIGH: 5000,
  NODE_COUNT_MEDIUM: 2500,
  EDGE_COUNT_HIGH: 12000,
  EDGE_COUNT_MEDIUM: 7000,
  LOD_DISTANCE_1: 400,
  LOD_DISTANCE_2: 800,
  MIN_NODE_SIZE: 2,
  MAX_NODE_SIZE: 32,
  MIN_EDGE_WIDTH: 1,
  MAX_EDGE_WIDTH: 8,
  VIEWPORT_BUFFER: 400,
};

/**
 * LOD Manager for adaptive rendering quality
 */
export class LODManager {
  private config: LODConfig;
  private thresholds: PerformanceThresholds;
  private viewport: Viewport;
  private nodeCount: number = 0;
  private edgeCount: number = 0;
  private currentGlobalLOD: LODLevel = 0;

  /**
   * Create a new LODManager
   * @param viewport - Current viewport state
   * @param config - LOD configuration
   * @param thresholds - Performance thresholds
   */
  constructor(
    viewport: Viewport,
    config: Partial<LODConfig> = {},
    thresholds: Partial<PerformanceThresholds> = {}
  ) {
    this.config = { ...DEFAULT_LOD_CONFIG, ...config };
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.viewport = viewport;
  }

  /**
   * Update viewport
   * @param viewport - New viewport state
   */
  updateViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  /**
   * Update node and edge counts
   * @param nodeCount - Total number of nodes
   * @param edgeCount - Total number of edges
   */
  updateCounts(nodeCount: number, edgeCount: number): void {
    this.nodeCount = nodeCount;
    this.edgeCount = edgeCount;
    this.currentGlobalLOD = this.calculateGlobalLOD();
  }

  /**
   * Calculate global LOD based on total graph size
   * @returns Global LOD level
   */
  private calculateGlobalLOD(): LODLevel {
    // For very large graphs, reduce global detail level
    if (this.nodeCount > this.thresholds.NODE_COUNT_HIGH * 2) {
      return 2; // Large graph: minimal detail by default
    } else if (this.nodeCount > this.thresholds.NODE_COUNT_HIGH) {
      return 1; // Medium graph: reduced detail by default
    }
    return 0; // Small graph: full detail
  }

  /**
   * Get adjusted thresholds based on node count
   */
  private getAdjustedThresholds(): {
    near: number;
    medium: number;
    far: number;
  } {
    const { near, medium, far } = this.config.thresholds;

    if (!this.config.nodeCountAdjustment) {
      return { near, medium, far };
    }

    // Adjust thresholds based on node count
    let adjustmentFactor = 1.0;

    if (this.nodeCount > this.thresholds.NODE_COUNT_HIGH * 2) {
      // 10000+ nodes: more aggressive LOD
      adjustmentFactor = 0.7;
    } else if (this.nodeCount > this.thresholds.NODE_COUNT_HIGH) {
      // 5000-10000 nodes: moderate LOD
      adjustmentFactor = 0.85;
    }
    // < 5000 nodes: full thresholds

    return {
      near: near * adjustmentFactor,
      medium: medium * adjustmentFactor,
      far: far * adjustmentFactor,
    };
  }

  /**
   * Transform world coordinates to screen coordinates
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   * @returns Screen coordinates
   */
  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const { width, height, zoom, x, y } = this.viewport;
    const centerX = width / 2;
    const centerY = height / 2;

    return {
      x: worldX * zoom + x + centerX,
      y: worldY * zoom + y + centerY,
    };
  }

  /**
   * Calculate LOD level for a node
   * @param node - The node to evaluate
   * @returns LOD level (0-3)
   */
  getNodeLOD(node: EnhancedGraphNode): LODLevel {
    if (node.x === undefined || node.y === undefined) {
      return 3; // Cull nodes without positions
    }

    // Transform to screen space
    const screen = this.worldToScreen(node.x, node.y);
    const { width, height } = this.viewport;

    // Check if outside viewport (with buffer)
    const buffer = this.thresholds.VIEWPORT_BUFFER * 2;
    if (
      screen.x < -buffer ||
      screen.x > width + buffer ||
      screen.y < -buffer ||
      screen.y > height + buffer
    ) {
      return 3; // Cull completely
    }

    // Calculate distance from viewport center (normalized)
    const centerX = width / 2;
    const centerY = height / 2;
    const distanceFromCenter = Math.sqrt(
      (screen.x - centerX) ** 2 + (screen.y - centerY) ** 2
    );

    // Normalize distance by screen diagonal
    const screenDiagonal = Math.sqrt(width * width + height * height);
    const normalizedDistance = distanceFromCenter / screenDiagonal;

    // Get adjusted thresholds
    const { near, medium, far } = this.getAdjustedThresholds();

    // Determine LOD level
    if (normalizedDistance > far) {
      return 2; // Minimal detail
    } else if (normalizedDistance > medium) {
      return 1; // Reduced detail
    } else if (normalizedDistance > near) {
      return 0; // Full detail (but might hide some labels)
    } else {
      return 0; // Full detail
    }
  }

  /**
   * Calculate LOD level for an edge
   * @param edge - The edge to evaluate
   * @returns LOD level (0-3)
   */
  getEdgeLOD(edge: EnhancedGraphEdge): LODLevel {
    const source = typeof edge.source === 'object' ? edge.source : null;
    const target = typeof edge.target === 'object' ? edge.target : null;

    if (!source || !target) {
      return 0; // Default to full detail if nodes aren't resolved
    }

    const sourceLOD = this.getNodeLOD(source);
    const targetLOD = this.getNodeLOD(target);

    // Only cull edge if BOTH endpoints are culled
    if (sourceLOD === 3 && targetLOD === 3) {
      return 3;
    }

    // Use minimum LOD to keep edges visible
    return Math.min(sourceLOD, targetLOD) as LODLevel;
  }

  /**
   * Check if a node should be rendered
   * @param node - The node to check
   * @returns true if should render
   */
  shouldRenderNode(node: EnhancedGraphNode): boolean {
    return this.getNodeLOD(node) < 3;
  }

  /**
   * Check if an edge should be rendered
   * @param edge - The edge to check
   * @returns true if should render
   */
  shouldRenderEdge(edge: EnhancedGraphEdge): boolean {
    return this.getEdgeLOD(edge) < 3;
  }

  /**
   * Check if labels should be rendered for a given LOD level
   * @param lod - LOD level
   * @returns true if labels should show
   */
  shouldRenderLabel(lod: LODLevel): boolean {
    // Show labels at LOD 0 and 1
    return lod <= 1;
  }

  /**
   * Check if node details (album art, metadata) should render
   * @param lod - LOD level
   * @returns true if details should show
   */
  shouldRenderDetails(lod: LODLevel): boolean {
    // Only show details at LOD 0 (closest to camera)
    return lod === 0;
  }

  /**
   * Get node size multiplier based on LOD
   * @param lod - LOD level
   * @returns Size multiplier (0-1)
   */
  getNodeSizeMultiplier(lod: LODLevel): number {
    switch (lod) {
      case 0:
        return 1.0; // Full size
      case 1:
        return 0.8; // 80% size
      case 2:
        return 0.6; // 60% size
      case 3:
        return 0.0; // Culled
      default:
        return 1.0;
    }
  }

  /**
   * Get edge width multiplier based on LOD
   * @param lod - LOD level
   * @returns Width multiplier (0-1)
   */
  getEdgeWidthMultiplier(lod: LODLevel): number {
    switch (lod) {
      case 0:
        return 1.0; // Full width
      case 1:
        return 0.7; // 70% width
      case 2:
        return 0.5; // 50% width
      case 3:
        return 0.0; // Culled
      default:
        return 1.0;
    }
  }

  /**
   * Get label alpha (opacity) based on LOD
   * @param lod - LOD level
   * @returns Alpha value (0-1)
   */
  getLabelAlpha(lod: LODLevel): number {
    switch (lod) {
      case 0:
        return 1.0; // Fully visible
      case 1:
        return 0.7; // Slightly transparent
      case 2:
      case 3:
        return 0.0; // Hidden
      default:
        return 1.0;
    }
  }

  /**
   * Calculate screen-space size of a node
   * @param node - The node
   * @param baseSize - Base world-space size
   * @returns Screen-space size in pixels
   */
  calculateScreenSize(node: EnhancedGraphNode, baseSize: number): number {
    const { zoom } = this.viewport;
    const lod = this.getNodeLOD(node);
    const multiplier = this.getNodeSizeMultiplier(lod);

    return baseSize * zoom * multiplier;
  }

  /**
   * Get LOD statistics for debugging
   */
  getLODStats(nodes: EnhancedGraphNode[]): {
    lod0: number;
    lod1: number;
    lod2: number;
    lod3: number;
    total: number;
  } {
    const stats = { lod0: 0, lod1: 0, lod2: 0, lod3: 0, total: nodes.length };

    for (const node of nodes) {
      const lod = this.getNodeLOD(node);
      switch (lod) {
        case 0:
          stats.lod0++;
          break;
        case 1:
          stats.lod1++;
          break;
        case 2:
          stats.lod2++;
          break;
        case 3:
          stats.lod3++;
          break;
      }
    }

    return stats;
  }

  /**
   * Get current global LOD level
   */
  getGlobalLOD(): LODLevel {
    return this.currentGlobalLOD;
  }

  /**
   * Check if performance mode should be enabled
   * @returns true if performance optimizations needed
   */
  shouldUsePerformanceMode(): boolean {
    return (
      this.nodeCount > this.thresholds.NODE_COUNT_HIGH ||
      this.edgeCount > this.thresholds.EDGE_COUNT_HIGH
    );
  }

  /**
   * Get recommended render mode based on graph size
   */
  getRecommendedRenderMode(): 'sprites' | 'graphics' | 'instanced' {
    if (this.nodeCount > 10000) {
      return 'instanced'; // Use instanced rendering for massive graphs
    } else if (this.nodeCount > 1000) {
      return 'sprites'; // Use sprite-based rendering for large graphs
    }
    return 'graphics'; // Use Graphics for small graphs (more flexible)
  }

  /**
   * Update configuration
   * @param config - Partial LOD configuration to update
   */
  updateConfig(config: Partial<LODConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update performance thresholds
   * @param thresholds - Partial thresholds to update
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
}
