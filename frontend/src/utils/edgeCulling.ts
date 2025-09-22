/**
 * Edge culling utilities for performance optimization
 * Filters edges based on viewport, zoom level, strength, and special conditions
 */

export interface Edge {
  id: string;
  source: string | any;
  target: string | any;
  weight?: number;
  metadata?: {
    adjacency_frequency?: number;
    strength_category?: string;
    [key: string]: any;
  };
  visible?: boolean;
}

export interface Node {
  id: string;
  x?: number;
  y?: number;
  z?: number;
  visible?: boolean;
  [key: string]: any;
}

export interface ViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near?: number;  // For 3D
  far?: number;   // For 3D
}

export interface EdgeCullingOptions {
  viewport: ViewportBounds;
  zoomLevel: number;
  nodes: Node[];
  edges: Edge[];
  highlightedPath?: string[];  // Node IDs in the highlighted route
  selectedNodes?: string[];
  maxEdgesPerNode?: number;
  maxTotalEdges?: number;
  strengthThreshold?: number;
  preserveHighlighted?: boolean;
  is3D?: boolean;
}

export interface CulledEdgeResult {
  visibleEdges: Edge[];
  culledCount: number;
  totalCount: number;
  stats: {
    viewportCulled: number;
    strengthCulled: number;
    densityCulled: number;
    preserved: number;
  };
}

/**
 * Calculate edge strength score for prioritization
 */
function getEdgeStrength(edge: Edge): number {
  const weight = edge.weight || 1;
  const frequency = edge.metadata?.adjacency_frequency || 1;
  const categoryMultiplier = {
    'very_strong': 10,
    'strong': 5,
    'moderate': 2,
    'weak': 1
  }[edge.metadata?.strength_category || 'weak'] || 1;

  return weight * frequency * categoryMultiplier;
}

/**
 * Check if a node is within viewport bounds
 */
function isNodeInViewport(node: Node, bounds: ViewportBounds, is3D: boolean = false): boolean {
  if (!node.x || !node.y) return false;

  const inXY = node.x >= bounds.left &&
               node.x <= bounds.right &&
               node.y >= bounds.top &&
               node.y <= bounds.bottom;

  if (!is3D) return inXY;

  // For 3D, also check Z bounds
  if (bounds.near !== undefined && bounds.far !== undefined) {
    const z = node.z || 0;
    return inXY && z >= bounds.near && z <= bounds.far;
  }

  return inXY;
}

/**
 * Check if an edge should be highlighted (part of route or connected to selected nodes)
 */
function isEdgeHighlighted(
  edge: Edge,
  highlightedPath?: string[],
  selectedNodes?: string[]
): boolean {
  const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
  const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

  // Check if part of highlighted path
  if (highlightedPath && highlightedPath.length > 1) {
    for (let i = 0; i < highlightedPath.length - 1; i++) {
      if ((highlightedPath[i] === sourceId && highlightedPath[i + 1] === targetId) ||
          (highlightedPath[i] === targetId && highlightedPath[i + 1] === sourceId)) {
        return true;
      }
    }
  }

  // Check if connected to selected nodes
  if (selectedNodes && selectedNodes.length > 0) {
    return selectedNodes.includes(sourceId) || selectedNodes.includes(targetId);
  }

  return false;
}

/**
 * Calculate adaptive edge density based on zoom level
 */
function getAdaptiveEdgeLimits(zoomLevel: number): {
  maxEdgesPerNode: number;
  maxTotalEdges: number;
  strengthThreshold: number;
} {
  // More edges when zoomed in, fewer when zoomed out
  const zoomFactor = Math.max(0.1, Math.min(5, zoomLevel));

  // Zoomed out (zoomLevel < 1): Show fewer, stronger edges
  // Zoomed in (zoomLevel > 1): Show more, including weaker edges
  if (zoomLevel < 0.5) {
    // Very zoomed out - only strongest connections
    return {
      maxEdgesPerNode: 3,
      maxTotalEdges: 100,
      strengthThreshold: 5.0
    };
  } else if (zoomLevel < 1.0) {
    // Moderately zoomed out
    return {
      maxEdgesPerNode: 5,
      maxTotalEdges: 300,
      strengthThreshold: 2.0
    };
  } else if (zoomLevel < 2.0) {
    // Default view
    return {
      maxEdgesPerNode: 10,
      maxTotalEdges: 500,
      strengthThreshold: 0.5
    };
  } else if (zoomLevel < 5.0) {
    // Zoomed in - show more detail
    return {
      maxEdgesPerNode: 20,
      maxTotalEdges: 1000,
      strengthThreshold: 0.1
    };
  } else {
    // Very zoomed in - show all details
    return {
      maxEdgesPerNode: 50,
      maxTotalEdges: 2000,
      strengthThreshold: 0
    };
  }
}

/**
 * Main edge culling function
 */
export function cullEdges(options: EdgeCullingOptions): CulledEdgeResult {
  const {
    viewport,
    zoomLevel,
    nodes,
    edges,
    highlightedPath,
    selectedNodes,
    preserveHighlighted = true,
    is3D = false
  } = options;

  // Get adaptive limits based on zoom
  const adaptiveLimits = getAdaptiveEdgeLimits(zoomLevel);
  const maxEdgesPerNode = options.maxEdgesPerNode || adaptiveLimits.maxEdgesPerNode;
  const maxTotalEdges = options.maxTotalEdges || adaptiveLimits.maxTotalEdges;
  const strengthThreshold = options.strengthThreshold ?? adaptiveLimits.strengthThreshold;

  // Create node visibility map
  const visibleNodeIds = new Set<string>();
  const nodeMap = new Map<string, Node>();

  nodes.forEach(node => {
    nodeMap.set(node.id, node);
    if (isNodeInViewport(node, viewport, is3D)) {
      visibleNodeIds.add(node.id);
    }
  });

  // Track statistics
  const stats = {
    viewportCulled: 0,
    strengthCulled: 0,
    densityCulled: 0,
    preserved: 0
  };

  // First pass: Filter edges and calculate scores
  const edgesWithScores = edges.map(edge => {
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

    // Check if edge should be preserved
    const isHighlighted = isEdgeHighlighted(edge, highlightedPath, selectedNodes);

    // Check if both nodes are in viewport
    const bothNodesVisible = visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);

    // Calculate strength score
    const strength = getEdgeStrength(edge);

    return {
      edge,
      sourceId,
      targetId,
      isHighlighted,
      bothNodesVisible,
      strength,
      shouldShow: false
    };
  });

  // Sort edges by priority (highlighted first, then by strength)
  edgesWithScores.sort((a, b) => {
    // Highlighted edges always come first
    if (a.isHighlighted && !b.isHighlighted) return -1;
    if (!a.isHighlighted && b.isHighlighted) return 1;

    // Then sort by strength
    return b.strength - a.strength;
  });

  // Track edges per node
  const edgesPerNode = new Map<string, number>();

  // Second pass: Select edges to show
  let visibleCount = 0;
  const visibleEdges: Edge[] = [];

  for (const item of edgesWithScores) {
    const { edge, sourceId, targetId, isHighlighted, bothNodesVisible, strength } = item;

    // Always preserve highlighted edges
    if (preserveHighlighted && isHighlighted) {
      visibleEdges.push(edge);
      visibleCount++;
      stats.preserved++;
      continue;
    }

    // Skip if we've hit total edge limit
    if (visibleCount >= maxTotalEdges) {
      stats.densityCulled++;
      continue;
    }

    // Skip if neither node is visible (viewport culling)
    if (!visibleNodeIds.has(sourceId) && !visibleNodeIds.has(targetId)) {
      stats.viewportCulled++;
      continue;
    }

    // For edges with only one visible node, only show if very strong or zoomed in
    if (!bothNodesVisible && zoomLevel < 2.0 && strength < strengthThreshold * 2) {
      stats.viewportCulled++;
      continue;
    }

    // Skip if strength is below threshold
    if (strength < strengthThreshold) {
      stats.strengthCulled++;
      continue;
    }

    // Check per-node edge limits
    const sourceEdges = edgesPerNode.get(sourceId) || 0;
    const targetEdges = edgesPerNode.get(targetId) || 0;

    if (sourceEdges >= maxEdgesPerNode || targetEdges >= maxEdgesPerNode) {
      stats.densityCulled++;
      continue;
    }

    // Add the edge
    visibleEdges.push(edge);
    visibleCount++;
    edgesPerNode.set(sourceId, sourceEdges + 1);
    edgesPerNode.set(targetId, targetEdges + 1);
  }

  return {
    visibleEdges,
    culledCount: edges.length - visibleEdges.length,
    totalCount: edges.length,
    stats
  };
}

/**
 * Quick visibility check for individual edges (used during interaction)
 */
export function isEdgeVisible(
  edge: Edge,
  viewport: ViewportBounds,
  nodeMap: Map<string, Node>,
  zoomLevel: number,
  is3D: boolean = false
): boolean {
  const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
  const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

  const sourceNode = nodeMap.get(sourceId);
  const targetNode = nodeMap.get(targetId);

  if (!sourceNode || !targetNode) return false;

  // Check if at least one node is in viewport
  const sourceInView = isNodeInViewport(sourceNode, viewport, is3D);
  const targetInView = isNodeInViewport(targetNode, viewport, is3D);

  if (!sourceInView && !targetInView) return false;

  // Apply zoom-based filtering for edges with only one visible node
  if ((!sourceInView || !targetInView) && zoomLevel < 1.0) {
    const strength = getEdgeStrength(edge);
    const threshold = getAdaptiveEdgeLimits(zoomLevel).strengthThreshold;
    return strength >= threshold * 2;
  }

  return true;
}

/**
 * Get edge rendering style based on strength and zoom
 */
export function getEdgeStyle(
  edge: Edge,
  zoomLevel: number,
  isHighlighted: boolean = false
): {
  opacity: number;
  strokeWidth: number;
  color: string;
} {
  const strength = getEdgeStrength(edge);

  // Highlighted edges get special treatment
  if (isHighlighted) {
    return {
      opacity: 1.0,
      strokeWidth: Math.max(2, Math.min(5, 2 + strength * 0.1)),
      color: '#EF4444' // Red for highlighted paths
    };
  }

  // Adjust opacity based on zoom and strength
  const baseOpacity = Math.min(0.8, 0.1 + strength * 0.05);
  const zoomOpacity = zoomLevel > 2 ? baseOpacity : baseOpacity * 0.7;

  // Adjust stroke width based on strength
  const strokeWidth = Math.max(0.5, Math.min(3, strength * 0.2));

  // Color based on strength category
  const color = {
    'very_strong': '#3B82F6',
    'strong': '#60A5FA',
    'moderate': '#93C5FD',
    'weak': '#DBEAFE'
  }[edge.metadata?.strength_category || 'weak'] || '#E5E7EB';

  return {
    opacity: zoomOpacity,
    strokeWidth: strokeWidth * Math.min(1.5, zoomLevel),
    color
  };
}