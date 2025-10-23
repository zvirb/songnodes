/**
 * Edge Color Helper Utilities
 * Determines edge color based on relationship type and state
 */

import type { EnhancedGraphEdge } from '../types';

/**
 * Edge relationship types
 */
export type EdgeRelationType = 'harmonic' | 'energy' | 'tempo' | 'genre' | 'default';

/**
 * Get edge color based on relationship type and state
 * @param edge - The edge
 * @param isSelected - Is edge selected
 * @param isInPath - Is edge part of a path
 * @returns Color value
 */
export function getEdgeColor(
  edge: EnhancedGraphEdge,
  isSelected: boolean = false,
  isInPath: boolean = false
): number {
  // Override colors for special states
  if (isSelected) {
    return 0xff6b35; // Orange
  }

  if (isInPath) {
    return 0x9013fe; // Purple
  }

  // Determine relationship type and return appropriate color
  const relationType = determineRelationType(edge);

  switch (relationType) {
    case 'harmonic':
      return 0x7ed321; // Green (harmonic compatibility)
    case 'energy':
      return 0xff1744; // Red (energy similarity)
    case 'tempo':
      return 0x4a90e2; // Blue (tempo similarity)
    case 'genre':
      return 0xf5a623; // Amber (genre match)
    case 'default':
    default:
      return 0x718096; // Gray-600
  }
}

/**
 * Determine edge relationship type based on metadata
 */
function determineRelationType(edge: EnhancedGraphEdge): EdgeRelationType {
  // Check if edge has harmonic distance (low distance = strong harmonic relationship)
  if (edge.avg_harmonic_distance !== undefined) {
    if (edge.avg_harmonic_distance < 2) {
      return 'harmonic';
    }
  }

  // Check BPM difference (small difference = tempo match)
  if (edge.avg_bpm_difference !== undefined) {
    if (edge.avg_bpm_difference < 5) {
      return 'tempo';
    }
  }

  // Check transition quality score
  if (edge.transition_quality !== undefined) {
    if (edge.transition_quality > 0.8) {
      return 'harmonic'; // High quality likely due to harmonic compatibility
    } else if (edge.transition_quality > 0.6) {
      return 'energy';
    }
  }

  return 'default';
}

/**
 * Get edge alpha (opacity) based on weight and quality
 * @param edge - The edge
 * @param baseAlpha - Base alpha value
 * @returns Adjusted alpha value
 */
export function getEdgeAlpha(edge: EnhancedGraphEdge, baseAlpha: number = 0.5): number {
  let alpha = baseAlpha;

  // Increase alpha for high-weight edges
  if (edge.weight && edge.weight > 0.7) {
    alpha = Math.min(1.0, baseAlpha * 1.3);
  }

  // Increase alpha for high-quality transitions
  if (edge.transition_quality && edge.transition_quality > 0.8) {
    alpha = Math.min(1.0, baseAlpha * 1.2);
  }

  return alpha;
}

/**
 * Calculate edge width based on transition count
 * More transitions = thicker edge
 */
export function calculateEdgeWidth(
  edge: EnhancedGraphEdge,
  baseWidth: number = 1.5,
  minWidth: number = 0.5,
  maxWidth: number = 4
): number {
  if (!edge.transition_count) {
    return baseWidth;
  }

  // Normalize transition count (log scale for better distribution)
  const logCount = Math.log10(edge.transition_count + 1);
  const maxLogCount = Math.log10(100); // Assume max 100 transitions

  const normalizedCount = Math.min(1, logCount / maxLogCount);

  // Interpolate between min and max width
  const width = minWidth + (maxWidth - minWidth) * normalizedCount;

  return width;
}

/**
 * Get edge style based on relationship strength
 */
export interface EdgeStyle {
  color: number;
  width: number;
  alpha: number;
  dashPattern?: number[];
}

export function getEdgeStyle(
  edge: EnhancedGraphEdge,
  isSelected: boolean = false,
  isInPath: boolean = false
): EdgeStyle {
  const color = getEdgeColor(edge, isSelected, isInPath);
  const width = calculateEdgeWidth(edge);
  const alpha = getEdgeAlpha(edge);

  // Use dashed lines for weak relationships
  const dashPattern = edge.weight && edge.weight < 0.3 ? [5, 5] : undefined;

  return {
    color,
    width,
    alpha,
    dashPattern,
  };
}
