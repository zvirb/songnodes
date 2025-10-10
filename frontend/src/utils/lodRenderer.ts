/**
 * @file Level of Detail (LOD) Rendering Utilities
 * @description Implements zoom-based detail levels for optimal rendering performance
 *
 * LOD Levels:
 * - Level 0 (Close): Full detail with labels, metadata, effects
 * - Level 1 (Medium): Standard rendering, labels for selected/important nodes
 * - Level 2 (Far): Simplified rendering, no labels, reduced effects
 * - Level 3 (Culled): Outside viewport, not rendered
 *
 * Performance target: 60fps with 1000+ nodes
 */

import * as PIXI from 'pixi.js';
import { GraphNode, GraphEdge } from '../types';

// LOD thresholds based on zoom level
export const LOD_THRESHOLDS = {
  // Zoom levels (1.0 = default, >1.0 = zoomed in, <1.0 = zoomed out)
  CLOSE_ZOOM: 1.5,     // Above this zoom: full detail (Level 0)
  MEDIUM_ZOOM: 0.75,   // Between this and close: standard detail (Level 1)
  FAR_ZOOM: 0.3,       // Between this and medium: simplified (Level 2)
  // Below FAR_ZOOM: minimal detail or culled (Level 3)

  // Distance from viewport center (normalized 0-1)
  CLOSE_DISTANCE: 0.3,   // Within 30% of viewport diagonal
  MEDIUM_DISTANCE: 0.6,  // Within 60% of viewport diagonal
  FAR_DISTANCE: 0.9,     // Within 90% of viewport diagonal
  // Beyond FAR_DISTANCE: culled

  // Node count thresholds for adaptive LOD
  HIGH_NODE_COUNT: 500,   // Above this: more aggressive LOD
  VERY_HIGH_NODE_COUNT: 1000, // Above this: most aggressive LOD
} as const;

// Visual detail levels for each LOD
export const LOD_VISUAL_DETAIL = {
  LEVEL_0: {
    name: 'Close/Full Detail',
    showLabels: true,
    showAllLabels: true,
    showMetadata: true,
    showEffects: true,
    nodeQuality: 'high' as const,
    edgeQuality: 'high' as const,
    labelFontSize: 12,
    enableAnimations: true,
  },
  LEVEL_1: {
    name: 'Medium/Standard Detail',
    showLabels: true,
    showAllLabels: false, // Only selected/important nodes
    showMetadata: false,
    showEffects: true,
    nodeQuality: 'medium' as const,
    edgeQuality: 'medium' as const,
    labelFontSize: 11,
    enableAnimations: true,
  },
  LEVEL_2: {
    name: 'Far/Simplified',
    showLabels: false,
    showAllLabels: false,
    showMetadata: false,
    showEffects: false,
    nodeQuality: 'low' as const,
    edgeQuality: 'low' as const,
    labelFontSize: 10,
    enableAnimations: false,
  },
  LEVEL_3: {
    name: 'Culled/Not Rendered',
    showLabels: false,
    showAllLabels: false,
    showMetadata: false,
    showEffects: false,
    nodeQuality: 'none' as const,
    edgeQuality: 'none' as const,
    labelFontSize: 0,
    enableAnimations: false,
  },
} as const;

export type LODLevel = 0 | 1 | 2 | 3;
export type LODQuality = 'high' | 'medium' | 'low' | 'none';

/**
 * Viewport information for LOD calculations
 */
export interface LODViewport {
  x: number;          // Pan offset X
  y: number;          // Pan offset Y
  width: number;      // Viewport width in pixels
  height: number;     // Viewport height in pixels
  zoom: number;       // Current zoom level
  centerX: number;    // Viewport center X
  centerY: number;    // Viewport center Y
}

/**
 * Node position in world and screen space
 */
export interface NodePosition {
  worldX: number;     // World space X
  worldY: number;     // World space Y
  screenX: number;    // Screen space X
  screenY: number;    // Screen space Y
}

/**
 * Calculate LOD level based on zoom and distance from viewport center
 */
export function calculateLODLevel(
  nodePosition: NodePosition,
  viewport: LODViewport,
  nodeCount: number,
  isSelected: boolean = false,
  isHovered: boolean = false
): LODLevel {
  // Selected and hovered nodes always get highest detail
  if (isSelected || isHovered) {
    return 0;
  }

  // Check if node is outside viewport (with buffer)
  const buffer = 200; // pixels
  const isOutsideViewport =
    nodePosition.screenX < -buffer ||
    nodePosition.screenX > viewport.width + buffer ||
    nodePosition.screenY < -buffer ||
    nodePosition.screenY > viewport.height + buffer;

  if (isOutsideViewport) {
    return 3; // Culled
  }

  // Calculate distance from viewport center (normalized)
  const dx = nodePosition.screenX - viewport.centerX;
  const dy = nodePosition.screenY - viewport.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const viewportDiagonal = Math.sqrt(
    viewport.width * viewport.width + viewport.height * viewport.height
  );
  const normalizedDistance = distance / viewportDiagonal;

  // Determine LOD based on zoom level first, then distance
  const zoom = viewport.zoom;

  // High zoom (zoomed in) - prioritize detail
  if (zoom >= LOD_THRESHOLDS.CLOSE_ZOOM) {
    if (normalizedDistance < LOD_THRESHOLDS.CLOSE_DISTANCE) return 0;
    if (normalizedDistance < LOD_THRESHOLDS.MEDIUM_DISTANCE) return 1;
    return 2;
  }

  // Medium zoom - balanced approach
  if (zoom >= LOD_THRESHOLDS.MEDIUM_ZOOM) {
    if (normalizedDistance < LOD_THRESHOLDS.CLOSE_DISTANCE) return 1;
    if (normalizedDistance < LOD_THRESHOLDS.FAR_DISTANCE) return 2;
    return 3;
  }

  // Low zoom (zoomed out) - prioritize performance
  if (zoom >= LOD_THRESHOLDS.FAR_ZOOM) {
    // With many nodes, be more aggressive
    if (nodeCount > LOD_THRESHOLDS.VERY_HIGH_NODE_COUNT) {
      if (normalizedDistance < LOD_THRESHOLDS.CLOSE_DISTANCE) return 2;
      return 3;
    }
    if (normalizedDistance < LOD_THRESHOLDS.MEDIUM_DISTANCE) return 2;
    return 3;
  }

  // Very low zoom - most aggressive LOD
  if (nodeCount > LOD_THRESHOLDS.HIGH_NODE_COUNT) {
    return 3; // Cull most nodes when very zoomed out with many nodes
  }
  if (normalizedDistance < LOD_THRESHOLDS.CLOSE_DISTANCE) return 2;
  return 3;
}

/**
 * Transform world coordinates to screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: LODViewport
): { x: number; y: number } {
  return {
    x: worldX * viewport.zoom + viewport.x + viewport.centerX,
    y: worldY * viewport.zoom + viewport.y + viewport.centerY,
  };
}

/**
 * Calculate node position in both world and screen space
 */
export function calculateNodePosition(
  node: { x?: number; y?: number },
  viewport: LODViewport
): NodePosition {
  const worldX = node.x || 0;
  const worldY = node.y || 0;
  const screen = worldToScreen(worldX, worldY, viewport);

  return {
    worldX,
    worldY,
    screenX: screen.x,
    screenY: screen.y,
  };
}

/**
 * Get visual detail configuration for a given LOD level
 */
export function getLODVisualDetail(level: LODLevel) {
  switch (level) {
    case 0: return LOD_VISUAL_DETAIL.LEVEL_0;
    case 1: return LOD_VISUAL_DETAIL.LEVEL_1;
    case 2: return LOD_VISUAL_DETAIL.LEVEL_2;
    case 3: return LOD_VISUAL_DETAIL.LEVEL_3;
    default: return LOD_VISUAL_DETAIL.LEVEL_1;
  }
}

/**
 * Apply LOD-based styling to a PIXI node
 */
export function applyNodeLOD(
  node: PIXI.Container,
  circle: PIXI.Graphics | PIXI.Sprite,
  label: PIXI.Text | null,
  level: LODLevel,
  baseRadius: number
): void {
  const detail = getLODVisualDetail(level);

  // Level 3: Culled - hide everything
  if (level === 3) {
    node.visible = false;
    return;
  }

  node.visible = true;

  // Apply node quality
  if (circle instanceof PIXI.Graphics) {
    switch (detail.nodeQuality) {
      case 'high':
        // Full quality with antialiasing
        circle.alpha = 1.0;
        break;
      case 'medium':
        // Standard quality
        circle.alpha = 0.95;
        break;
      case 'low':
        // Simplified - smaller size
        circle.alpha = 0.85;
        circle.scale.set(0.8);
        break;
    }
  } else if (circle instanceof PIXI.Sprite) {
    switch (detail.nodeQuality) {
      case 'high':
        circle.alpha = 1.0;
        circle.scale.set(1.0);
        break;
      case 'medium':
        circle.alpha = 0.95;
        circle.scale.set(0.95);
        break;
      case 'low':
        circle.alpha = 0.85;
        circle.scale.set(0.7);
        break;
    }
  }

  // Apply label visibility and styling
  if (label) {
    label.visible = detail.showLabels;
    if (detail.showLabels) {
      label.style.fontSize = detail.labelFontSize;
      label.alpha = level === 0 ? 1.0 : 0.85;
    }
  }
}

/**
 * Apply LOD-based styling to a PIXI edge
 */
export function applyEdgeLOD(
  edge: PIXI.Graphics,
  level: LODLevel,
  baseThickness: number
): void {
  const detail = getLODVisualDetail(level);

  // Level 3: Culled - hide
  if (level === 3) {
    edge.visible = false;
    return;
  }

  edge.visible = true;

  // Apply edge quality
  switch (detail.edgeQuality) {
    case 'high':
      // Full quality
      edge.alpha = 0.6;
      break;
    case 'medium':
      // Standard quality with reduced thickness
      edge.alpha = 0.5;
      break;
    case 'low':
      // Simplified - thinner lines
      edge.alpha = 0.3;
      break;
  }
}

/**
 * Batch calculate LOD levels for all nodes
 * Optimized for performance
 */
export function batchCalculateNodeLOD(
  nodes: Array<{ id: string; x?: number; y?: number }>,
  viewport: LODViewport,
  selectedNodes: Set<string>,
  hoveredNode: string | null
): Map<string, LODLevel> {
  const lodMap = new Map<string, LODLevel>();
  const nodeCount = nodes.length;

  for (const node of nodes) {
    const position = calculateNodePosition(node, viewport);
    const isSelected = selectedNodes.has(node.id);
    const isHovered = hoveredNode === node.id;
    const level = calculateLODLevel(position, viewport, nodeCount, isSelected, isHovered);
    lodMap.set(node.id, level);
  }

  return lodMap;
}

/**
 * Calculate LOD statistics for monitoring/debugging
 */
export interface LODStats {
  level0Count: number;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  totalNodes: number;
  visibleNodes: number;
  culledNodes: number;
  averageLevel: number;
}

export function calculateLODStats(lodMap: Map<string, LODLevel>): LODStats {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };

  for (const level of lodMap.values()) {
    counts[level]++;
  }

  const totalNodes = lodMap.size;
  const visibleNodes = counts[0] + counts[1] + counts[2];
  const culledNodes = counts[3];

  const levelSum = counts[0] * 0 + counts[1] * 1 + counts[2] * 2 + counts[3] * 3;
  const averageLevel = totalNodes > 0 ? levelSum / totalNodes : 0;

  return {
    level0Count: counts[0],
    level1Count: counts[1],
    level2Count: counts[2],
    level3Count: counts[3],
    totalNodes,
    visibleNodes,
    culledNodes,
    averageLevel,
  };
}

/**
 * Determine if LOD system should use aggressive culling
 */
export function shouldUseAggressiveLOD(
  nodeCount: number,
  edgeCount: number,
  zoom: number
): boolean {
  // Use aggressive LOD when:
  // 1. Very high node count
  if (nodeCount > LOD_THRESHOLDS.VERY_HIGH_NODE_COUNT) return true;

  // 2. High node count and zoomed out
  if (nodeCount > LOD_THRESHOLDS.HIGH_NODE_COUNT && zoom < LOD_THRESHOLDS.MEDIUM_ZOOM) {
    return true;
  }

  // 3. Very high edge count
  if (edgeCount > 2000) return true;

  return false;
}
