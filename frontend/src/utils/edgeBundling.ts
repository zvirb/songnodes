/**
 * @file Edge Bundling Utilities
 * @description Implements edge bundling for dense graph connections
 * Uses simplified force-directed edge bundling for performance
 *
 * Edge bundling reduces visual clutter by routing edges along similar paths,
 * creating visual "highways" of connections that are easier to follow.
 *
 * Performance target: 60fps with 500+ nodes and 1000+ edges
 */

import { GraphNode, GraphEdge } from '../types';

// Edge bundling configuration
export const EDGE_BUNDLING = {
  ENABLED: true,
  // Bundling strength (0 = no bundling, 1 = maximum bundling)
  STRENGTH: 0.6,
  // Number of subdivision points for curved edges
  SUBDIVISION_POINTS: 3,
  // Minimum edge count to enable bundling
  MIN_EDGE_COUNT: 50,
  // Distance threshold for bundling similar edges
  SIMILARITY_THRESHOLD: 150, // pixels
  // Use curved lines for bundled edges
  USE_CURVES: true,
  // Control point offset factor for curves
  CURVE_CONTROL_OFFSET: 0.3,
} as const;

/**
 * Edge with position information
 */
export interface PositionedEdge extends GraphEdge {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  angle: number;
  length: number;
}

/**
 * Bundled edge group
 */
export interface EdgeBundle {
  edges: PositionedEdge[];
  centroidX: number;
  centroidY: number;
  avgAngle: number;
  weight: number;
}

/**
 * Control points for curved edge rendering
 */
export interface EdgeControlPoints {
  edgeId: string;
  sourceX: number;
  sourceY: number;
  controlX1: number;
  controlY1: number;
  controlX2?: number;
  controlY2?: number;
  targetX: number;
  targetY: number;
  isBundled: boolean;
  bundleStrength: number;
}

/**
 * Calculate angle between two points
 */
function calculateAngle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Calculate distance between two points
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize angle to 0-2π range
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
}

/**
 * Check if two angles are similar (within threshold)
 */
function areAnglesSimilar(angle1: number, angle2: number, threshold: number = Math.PI / 6): boolean {
  const norm1 = normalizeAngle(angle1);
  const norm2 = normalizeAngle(angle2);
  const diff = Math.abs(norm1 - norm2);
  return diff < threshold || diff > (Math.PI * 2 - threshold);
}

/**
 * Calculate positioned edges with geometric information
 */
export function calculatePositionedEdges(
  edges: GraphEdge[],
  nodePositions: Map<string, { x: number; y: number }>
): PositionedEdge[] {
  const positionedEdges: PositionedEdge[] = [];

  for (const edge of edges) {
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);

    if (!sourcePos || !targetPos) continue;

    const angle = calculateAngle(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
    const length = calculateDistance(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);

    positionedEdges.push({
      ...edge,
      sourceX: sourcePos.x,
      sourceY: sourcePos.y,
      targetX: targetPos.x,
      targetY: targetPos.y,
      angle,
      length,
    });
  }

  return positionedEdges;
}

/**
 * Group edges into bundles based on similarity
 * Simplified algorithm for performance
 */
export function groupEdgesIntoBundles(
  positionedEdges: PositionedEdge[]
): EdgeBundle[] {
  if (positionedEdges.length < EDGE_BUNDLING.MIN_EDGE_COUNT) {
    // Not enough edges to justify bundling
    return [];
  }

  const bundles: EdgeBundle[] = [];
  const processed = new Set<string>();

  // Sort edges by angle for faster grouping
  const sortedEdges = [...positionedEdges].sort((a, b) => a.angle - b.angle);

  for (const edge of sortedEdges) {
    if (processed.has(edge.id)) continue;

    // Create new bundle
    const bundle: EdgeBundle = {
      edges: [edge],
      centroidX: (edge.sourceX + edge.targetX) / 2,
      centroidY: (edge.sourceY + edge.targetY) / 2,
      avgAngle: edge.angle,
      weight: edge.weight,
    };

    processed.add(edge.id);

    // Find similar edges
    for (const otherEdge of sortedEdges) {
      if (processed.has(otherEdge.id)) continue;

      // Check if edges are similar
      const angleSimilar = areAnglesSimilar(edge.angle, otherEdge.angle);
      const centroidDistance = calculateDistance(
        bundle.centroidX,
        bundle.centroidY,
        (otherEdge.sourceX + otherEdge.targetX) / 2,
        (otherEdge.sourceY + otherEdge.targetY) / 2
      );

      if (angleSimilar && centroidDistance < EDGE_BUNDLING.SIMILARITY_THRESHOLD) {
        bundle.edges.push(otherEdge);
        processed.add(otherEdge.id);

        // Update bundle centroid and angle
        const totalX = bundle.edges.reduce((sum, e) => sum + (e.sourceX + e.targetX) / 2, 0);
        const totalY = bundle.edges.reduce((sum, e) => sum + (e.sourceY + e.targetY) / 2, 0);
        bundle.centroidX = totalX / bundle.edges.length;
        bundle.centroidY = totalY / bundle.edges.length;

        const totalAngle = bundle.edges.reduce((sum, e) => sum + e.angle, 0);
        bundle.avgAngle = totalAngle / bundle.edges.length;

        bundle.weight += otherEdge.weight;
      }
    }

    // Only add bundles with multiple edges
    if (bundle.edges.length >= 2) {
      bundles.push(bundle);
    }
  }

  return bundles;
}

/**
 * Calculate control points for curved edge rendering
 */
export function calculateEdgeControlPoints(
  positionedEdges: PositionedEdge[],
  bundles: EdgeBundle[]
): Map<string, EdgeControlPoints> {
  const controlPoints = new Map<string, EdgeControlPoints>();

  // Create a map of edge ID to bundle
  const edgeToBundleMap = new Map<string, EdgeBundle>();
  for (const bundle of bundles) {
    for (const edge of bundle.edges) {
      edgeToBundleMap.set(edge.id, bundle);
    }
  }

  for (const edge of positionedEdges) {
    const bundle = edgeToBundleMap.get(edge.id);

    if (!bundle || bundle.edges.length < 2) {
      // Non-bundled edge - use simple straight line or gentle curve
      const controlPoints1 = calculateSimpleCurveControlPoint(
        edge.sourceX,
        edge.sourceY,
        edge.targetX,
        edge.targetY,
        0.2 // Slight curve for visual appeal
      );

      controlPoints.set(edge.id, {
        edgeId: edge.id,
        sourceX: edge.sourceX,
        sourceY: edge.sourceY,
        controlX1: controlPoints1.x,
        controlY1: controlPoints1.y,
        targetX: edge.targetX,
        targetY: edge.targetY,
        isBundled: false,
        bundleStrength: 0,
      });
    } else {
      // Bundled edge - route through bundle centroid
      const bundleStrength = EDGE_BUNDLING.STRENGTH * Math.min(1, bundle.edges.length / 10);

      // Calculate control points that route through bundle centroid
      const controlPoints1 = calculateBundleControlPoint(
        edge.sourceX,
        edge.sourceY,
        bundle.centroidX,
        bundle.centroidY,
        bundleStrength
      );

      const controlPoints2 = calculateBundleControlPoint(
        edge.targetX,
        edge.targetY,
        bundle.centroidX,
        bundle.centroidY,
        bundleStrength
      );

      controlPoints.set(edge.id, {
        edgeId: edge.id,
        sourceX: edge.sourceX,
        sourceY: edge.sourceY,
        controlX1: controlPoints1.x,
        controlY1: controlPoints1.y,
        controlX2: controlPoints2.x,
        controlY2: controlPoints2.y,
        targetX: edge.targetX,
        targetY: edge.targetY,
        isBundled: true,
        bundleStrength,
      });
    }
  }

  return controlPoints;
}

/**
 * Calculate simple curve control point (for non-bundled edges)
 */
function calculateSimpleCurveControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number
): { x: number; y: number } {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Perpendicular offset
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return { x: midX, y: midY };
  }

  const perpX = -dy / length;
  const perpY = dx / length;

  return {
    x: midX + perpX * length * offset,
    y: midY + perpY * length * offset,
  };
}

/**
 * Calculate bundle control point (for bundled edges)
 */
function calculateBundleControlPoint(
  x: number,
  y: number,
  centroidX: number,
  centroidY: number,
  strength: number
): { x: number; y: number } {
  // Interpolate between original position and centroid
  return {
    x: x + (centroidX - x) * strength,
    y: y + (centroidY - y) * strength,
  };
}

/**
 * Main edge bundling function
 * Returns control points for all edges
 */
export function performEdgeBundling(
  edges: GraphEdge[],
  nodePositions: Map<string, { x: number; y: number }>
): Map<string, EdgeControlPoints> {
  // Skip bundling if not enough edges
  if (edges.length < EDGE_BUNDLING.MIN_EDGE_COUNT || !EDGE_BUNDLING.ENABLED) {
    // Return simple straight lines
    const controlPoints = new Map<string, EdgeControlPoints>();
    for (const edge of edges) {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);
      if (!sourcePos || !targetPos) continue;

      controlPoints.set(edge.id, {
        edgeId: edge.id,
        sourceX: sourcePos.x,
        sourceY: sourcePos.y,
        controlX1: (sourcePos.x + targetPos.x) / 2,
        controlY1: (sourcePos.y + targetPos.y) / 2,
        targetX: targetPos.x,
        targetY: targetPos.y,
        isBundled: false,
        bundleStrength: 0,
      });
    }
    return controlPoints;
  }

  // Step 1: Calculate positioned edges
  const positionedEdges = calculatePositionedEdges(edges, nodePositions);

  // Step 2: Group edges into bundles
  const bundles = groupEdgesIntoBundles(positionedEdges);

  // Step 3: Calculate control points
  const controlPoints = calculateEdgeControlPoints(positionedEdges, bundles);

  return controlPoints;
}

/**
 * Edge bundling statistics for monitoring/debugging
 */
export interface EdgeBundlingStats {
  totalEdges: number;
  bundledEdges: number;
  unbundledEdges: number;
  bundleCount: number;
  avgEdgesPerBundle: number;
  maxEdgesInBundle: number;
}

export function getEdgeBundlingStats(
  controlPoints: Map<string, EdgeControlPoints>
): EdgeBundlingStats {
  const bundled = Array.from(controlPoints.values()).filter(cp => cp.isBundled);
  const unbundled = Array.from(controlPoints.values()).filter(cp => !cp.isBundled);

  // Count bundles (rough estimate based on bundled edges)
  const bundleCount = bundled.length > 0 ? Math.ceil(bundled.length / 5) : 0;

  return {
    totalEdges: controlPoints.size,
    bundledEdges: bundled.length,
    unbundledEdges: unbundled.length,
    bundleCount,
    avgEdgesPerBundle: bundleCount > 0 ? bundled.length / bundleCount : 0,
    maxEdgesInBundle: bundleCount > 0 ? Math.max(...bundled.map(e => e.bundleStrength * 10)) : 0,
  };
}
