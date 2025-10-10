/**
 * @file Visual Encoding Utilities
 * @description Advanced visual encoding functions for rich graph visualization
 * Implements node sizing by centrality, edge thickness by weight, energy-based coloring
 *
 * Performance target: 60fps with 500+ nodes
 */

import { GraphNode, GraphEdge } from '../types';
import { CAMELOT_KEYS } from './camelotData';
import { getEnergyColor } from './energyUtils';

// Visual encoding constants
export const VISUAL_ENCODING = {
  // Node sizing by centrality (degree count)
  NODE_SIZE: {
    MIN: 4,          // Minimum node radius (low degree)
    MAX: 24,         // Maximum node radius (high degree)
    DEFAULT: 8,      // Default for nodes without degree info
    SCALE_FACTOR: 2, // Logarithmic scaling factor for better visual distribution
  },
  // Edge thickness by weight
  EDGE_THICKNESS: {
    MIN: 0.5,        // Minimum edge width (weak connection)
    MAX: 8,          // Maximum edge width (strong connection)
    DEFAULT: 1.5,    // Default edge width
    SCALE_POWER: 0.7, // Power scaling to prevent oversized edges
  },
  // Opacity variations
  OPACITY: {
    NODE_DEFAULT: 1.0,
    NODE_FADED: 0.3,
    EDGE_DEFAULT: 0.6,
    EDGE_FADED: 0.15,
    EDGE_STRONG: 0.9,
    RECENCY_DECAY_DAYS: 30, // Days for full opacity decay
  },
  // Energy-based coloring
  ENERGY_COLORS: {
    ENABLED: true,
    USE_CAMELOT: true, // Use Camelot wheel energy colors when available
  },
} as const;

/**
 * Calculate node degree (number of connections) from edges
 */
export function calculateNodeDegrees(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, number> {
  const degreeMap = new Map<string, number>();

  // Initialize all nodes with degree 0
  nodes.forEach(node => degreeMap.set(node.id, 0));

  // Count edges for each node
  edges.forEach(edge => {
    const sourceDegree = degreeMap.get(edge.source) || 0;
    const targetDegree = degreeMap.get(edge.target) || 0;
    degreeMap.set(edge.source, sourceDegree + 1);
    degreeMap.set(edge.target, targetDegree + 1);
  });

  return degreeMap;
}

/**
 * Calculate node size based on centrality (degree count)
 * Uses logarithmic scaling for better visual distribution
 */
export function getNodeSizeByCentrality(
  nodeId: string,
  degreeMap: Map<string, number>
): number {
  const degree = degreeMap.get(nodeId) || 0;

  if (degree === 0) {
    return VISUAL_ENCODING.NODE_SIZE.DEFAULT;
  }

  // Logarithmic scaling: size = MIN + log(degree + 1) * SCALE_FACTOR
  // This prevents highly connected nodes from becoming too large
  const logDegree = Math.log(degree + 1);
  const scaledSize = VISUAL_ENCODING.NODE_SIZE.MIN +
                     logDegree * VISUAL_ENCODING.NODE_SIZE.SCALE_FACTOR;

  // Clamp to min/max bounds
  return Math.max(
    VISUAL_ENCODING.NODE_SIZE.MIN,
    Math.min(VISUAL_ENCODING.NODE_SIZE.MAX, scaledSize)
  );
}

/**
 * Calculate edge thickness based on weight
 * Uses power scaling to prevent oversized edges
 */
export function getEdgeThicknessByWeight(weight: number): number {
  if (weight <= 0) {
    return VISUAL_ENCODING.EDGE_THICKNESS.MIN;
  }

  // Normalize weight to 0-1 range (assuming weights are typically 0-1)
  const normalizedWeight = Math.max(0, Math.min(1, weight));

  // Power scaling: thickness = MIN + (normalized^POWER) * (MAX - MIN)
  const scaledThickness = VISUAL_ENCODING.EDGE_THICKNESS.MIN +
    Math.pow(normalizedWeight, VISUAL_ENCODING.EDGE_THICKNESS.SCALE_POWER) *
    (VISUAL_ENCODING.EDGE_THICKNESS.MAX - VISUAL_ENCODING.EDGE_THICKNESS.MIN);

  return Math.max(
    VISUAL_ENCODING.EDGE_THICKNESS.MIN,
    Math.min(VISUAL_ENCODING.EDGE_THICKNESS.MAX, scaledThickness)
  );
}

/**
 * Get energy-based color for a node
 * Integrates with CamelotWheel color logic
 */
export function getEnergyBasedColor(node: GraphNode): number {
  // Priority 1: Use Camelot wheel energy colors if available
  if (VISUAL_ENCODING.ENERGY_COLORS.USE_CAMELOT && node.key) {
    const camelotKey = CAMELOT_KEYS.find(k => k.id === node.key);
    if (camelotKey) {
      // Convert hex color to number
      return parseInt(camelotKey.energyColor.replace('#', ''), 16);
    }
  }

  // Priority 2: Use energy level directly
  if (node.energy !== undefined && node.energy > 0) {
    const energyColor = getEnergyColor(Math.round(node.energy));
    return parseInt(energyColor.replace('#', ''), 16);
  }

  // Priority 3: Derive from metadata
  if (node.metadata?.energy) {
    const energyColor = getEnergyColor(Math.round(node.metadata.energy));
    return parseInt(energyColor.replace('#', ''), 16);
  }

  // Priority 4: Default blue
  return 0x4a90e2;
}

/**
 * Calculate opacity based on connection recency
 * Newer connections have higher opacity
 */
export function getOpacityByRecency(
  lastConnectionDate?: Date | string
): number {
  if (!lastConnectionDate) {
    return VISUAL_ENCODING.OPACITY.EDGE_DEFAULT;
  }

  const date = typeof lastConnectionDate === 'string'
    ? new Date(lastConnectionDate)
    : lastConnectionDate;

  const daysSinceConnection = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

  // Linear decay over RECENCY_DECAY_DAYS
  const recencyFactor = Math.max(
    0,
    1 - (daysSinceConnection / VISUAL_ENCODING.OPACITY.RECENCY_DECAY_DAYS)
  );

  // Scale between FADED and DEFAULT
  return VISUAL_ENCODING.OPACITY.EDGE_FADED +
         recencyFactor * (VISUAL_ENCODING.OPACITY.EDGE_DEFAULT - VISUAL_ENCODING.OPACITY.EDGE_FADED);
}

/**
 * Get edge opacity based on weight and recency
 */
export function getEdgeOpacity(
  weight: number,
  lastConnectionDate?: Date | string
): number {
  const baseOpacity = weight > 0.7
    ? VISUAL_ENCODING.OPACITY.EDGE_STRONG
    : VISUAL_ENCODING.OPACITY.EDGE_DEFAULT;

  if (!lastConnectionDate) {
    return baseOpacity;
  }

  // Combine weight-based and recency-based opacity
  const recencyOpacity = getOpacityByRecency(lastConnectionDate);
  return Math.max(recencyOpacity, baseOpacity * 0.5); // Ensure minimum visibility
}

/**
 * Batch calculate visual properties for all nodes
 * Optimized for performance with large graphs
 */
export interface NodeVisualProperties {
  size: number;
  color: number;
  opacity: number;
}

export function calculateNodeVisualProperties(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    enableCentralitySizing?: boolean;
    enableEnergyColors?: boolean;
  } = {}
): Map<string, NodeVisualProperties> {
  const {
    enableCentralitySizing = true,
    enableEnergyColors = true,
  } = options;

  const properties = new Map<string, NodeVisualProperties>();
  const degreeMap = enableCentralitySizing
    ? calculateNodeDegrees(nodes, edges)
    : new Map<string, number>();

  // Batch process all nodes
  nodes.forEach(node => {
    const size = enableCentralitySizing
      ? getNodeSizeByCentrality(node.id, degreeMap)
      : VISUAL_ENCODING.NODE_SIZE.DEFAULT;

    const color = enableEnergyColors
      ? getEnergyBasedColor(node)
      : 0x4a90e2;

    properties.set(node.id, {
      size,
      color,
      opacity: VISUAL_ENCODING.OPACITY.NODE_DEFAULT,
    });
  });

  return properties;
}

/**
 * Batch calculate visual properties for all edges
 * Optimized for performance with large graphs
 */
export interface EdgeVisualProperties {
  thickness: number;
  opacity: number;
}

export function calculateEdgeVisualProperties(
  edges: GraphEdge[]
): Map<string, EdgeVisualProperties> {
  const properties = new Map<string, EdgeVisualProperties>();

  edges.forEach(edge => {
    const thickness = getEdgeThicknessByWeight(edge.weight);
    const opacity = getEdgeOpacity(edge.weight);

    properties.set(edge.id, {
      thickness,
      opacity,
    });
  });

  return properties;
}

/**
 * Calculate visual encoding statistics for debugging/monitoring
 */
export interface VisualEncodingStats {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  avgNodeSize: number;
  avgEdgeThickness: number;
  degreeDistribution: {
    low: number;    // degree 0-2
    medium: number; // degree 3-5
    high: number;   // degree 6+
  };
}

export function getVisualEncodingStats(
  nodes: GraphNode[],
  edges: GraphEdge[],
  nodeProps: Map<string, NodeVisualProperties>,
  edgeProps: Map<string, EdgeVisualProperties>
): VisualEncodingStats {
  const degreeMap = calculateNodeDegrees(nodes, edges);
  const degrees = Array.from(degreeMap.values());

  const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length || 0;
  const maxDegree = Math.max(...degrees, 0);
  const minDegree = Math.min(...degrees, 0);

  const sizes = Array.from(nodeProps.values()).map(p => p.size);
  const avgNodeSize = sizes.reduce((a, b) => a + b, 0) / sizes.length || 0;

  const thicknesses = Array.from(edgeProps.values()).map(p => p.thickness);
  const avgEdgeThickness = thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length || 0;

  const degreeDistribution = {
    low: degrees.filter(d => d <= 2).length,
    medium: degrees.filter(d => d > 2 && d <= 5).length,
    high: degrees.filter(d => d > 5).length,
  };

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    avgDegree,
    maxDegree,
    minDegree,
    avgNodeSize,
    avgEdgeThickness,
    degreeDistribution,
  };
}
