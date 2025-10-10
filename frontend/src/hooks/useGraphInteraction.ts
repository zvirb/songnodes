import { useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { GraphNode, Point, Bounds } from '../types';
import { getNeighborhood } from '../utils/graphHelpers';
import { SpatialIndex } from '../utils/spatialIndex';

export interface GraphInteractionOptions {
  useSpatialIndex?: boolean;
  hoverRadius?: number;
  enableBoxSelect?: boolean;
}

export const useGraphInteraction = (options: GraphInteractionOptions = {}) => {
  const {
    useSpatialIndex = true,
    hoverRadius = 20,
    enableBoxSelect = true,
  } = options;

  const selectNode = useStore(state => state.graph.selectNode);
  const setHoveredNode = useStore(state => state.graph.setHoveredNode);
  const addTrackToSetlist = useStore(state => state.setlist.addTrackToSetlist);
  const updateNodePositions = useStore(state => state.graph.updateNodePositions);
  const highlightNeighborhood = useStore(state => state.community?.highlightNeighborhood);
  const clearHighlight = useStore(state => state.community?.clearHighlight);
  const graphData = useStore(state => state.graphData);

  // Spatial index for optimized queries
  const spatialIndexRef = useRef<SpatialIndex | null>(null);

  // Initialize spatial index
  useEffect(() => {
    if (useSpatialIndex) {
      if (!spatialIndexRef.current) {
        spatialIndexRef.current = new SpatialIndex();
      }
      // Rebuild index when graph data changes
      if (graphData.nodes.length > 0) {
        spatialIndexRef.current.buildIndex(graphData.nodes);
      }
    }
  }, [graphData.nodes, useSpatialIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      spatialIndexRef.current?.clear();
    };
  }, []);

  const handleNodeClick = useCallback((node: GraphNode, event?: MouseEvent | React.MouseEvent) => {
    // Check for modifier keys for multi-select
    const isCtrlPressed = event?.ctrlKey || event?.metaKey;
    const isShiftPressed = event?.shiftKey;

    if (isCtrlPressed || isShiftPressed) {
      // Toggle selection without highlighting neighborhood
      selectNode(node.id);
    } else {
      // Single selection with neighborhood highlighting
      selectNode(node.id);

      // Get neighborhood data
      const neighborhood = getNeighborhood(graphData, node.id, 1);

      // Highlight the neighborhood if the function is available
      if (highlightNeighborhood) {
        highlightNeighborhood(node.id, neighborhood.nodes.map(n => n.id));
      }
    }
  }, [selectNode, highlightNeighborhood, graphData]);

  const handleNodeRightClick = useCallback((node: GraphNode, event: React.MouseEvent) => {
    event.preventDefault();
    // Could show context menu here
    if (node.track) {
      addTrackToSetlist(node.track);
    }
  }, [addTrackToSetlist]);

  const handleNodeHover = useCallback((node: GraphNode, isHovering: boolean) => {
    setHoveredNode(isHovering ? node.id : null);
  }, [setHoveredNode]);

  const handleDrag = useCallback((nodeId: string, x: number, y: number) => {
    updateNodePositions([{ id: nodeId, x, y }]);

    // Update spatial index for dragged node
    if (spatialIndexRef.current) {
      spatialIndexRef.current.updateNode(nodeId, x, y);
    }
  }, [updateNodePositions]);

  const handleDoubleClick = useCallback((node: GraphNode) => {
    // Focus on node and its neighbors with enhanced highlighting
    selectNode(node.id);

    // Get 2-hop neighborhood for double-click
    const neighborhood = getNeighborhood(graphData, node.id, 2);

    if (highlightNeighborhood) {
      highlightNeighborhood(node.id, neighborhood.nodes.map(n => n.id));
    }
  }, [selectNode, highlightNeighborhood, graphData]);

  const handleClearHighlight = useCallback(() => {
    if (clearHighlight) {
      clearHighlight();
    }
  }, [clearHighlight]);

  /**
   * Find node at a specific point using spatial index
   * Optimized O(log n) query for hover detection
   */
  const findNodeAtPoint = useCallback((point: Point, maxRadius: number = hoverRadius): GraphNode | null => {
    if (spatialIndexRef.current && useSpatialIndex) {
      return spatialIndexRef.current.findNodeAtPoint(point, maxRadius);
    }

    // Fallback to linear search
    let closestNode: GraphNode | null = null;
    let closestDistance = maxRadius;

    for (const node of graphData.nodes) {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        const dx = node.x - point.x;
        const dy = node.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestNode = node;
        }
      }
    }

    return closestNode;
  }, [graphData.nodes, hoverRadius, useSpatialIndex]);

  /**
   * Find nodes within a circular radius using spatial index
   * Optimized O(log n + k) query for area selection
   */
  const findNodesInRadius = useCallback((center: Point, radius: number): GraphNode[] => {
    if (spatialIndexRef.current && useSpatialIndex) {
      return spatialIndexRef.current.findNodesInRadius(center, radius);
    }

    // Fallback to linear search
    return graphData.nodes.filter(node => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        const dx = node.x - center.x;
        const dy = node.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= radius;
      }
      return false;
    });
  }, [graphData.nodes, useSpatialIndex]);

  /**
   * Find nodes within a rectangular bounds using spatial index
   * Optimized O(log n + k) query for box selection
   */
  const findNodesInRectangle = useCallback((bounds: Bounds): GraphNode[] => {
    if (spatialIndexRef.current && useSpatialIndex) {
      return spatialIndexRef.current.findNodesInRectangle(bounds);
    }

    // Fallback to linear search
    const x1 = bounds.x;
    const y1 = bounds.y;
    const x2 = bounds.x + bounds.width;
    const y2 = bounds.y + bounds.height;

    return graphData.nodes.filter(node => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        return node.x >= x1 && node.x <= x2 && node.y >= y1 && node.y <= y2;
      }
      return false;
    });
  }, [graphData.nodes, useSpatialIndex]);

  /**
   * Handle box selection (drag to select multiple nodes)
   */
  const handleBoxSelect = useCallback((bounds: Bounds) => {
    if (!enableBoxSelect) return;

    const selectedNodes = findNodesInRectangle(bounds);
    selectedNodes.forEach(node => selectNode(node.id));
  }, [findNodesInRectangle, selectNode, enableBoxSelect]);

  /**
   * Get spatial index performance statistics
   */
  const getSpatialIndexStats = useCallback(() => {
    return spatialIndexRef.current?.getStats() || null;
  }, []);

  /**
   * Rebuild spatial index manually (use when many nodes updated)
   */
  const rebuildSpatialIndex = useCallback(() => {
    if (spatialIndexRef.current && graphData.nodes.length > 0) {
      spatialIndexRef.current.buildIndex(graphData.nodes);
    }
  }, [graphData.nodes]);

  return {
    handleNodeClick,
    handleNodeRightClick,
    handleNodeHover,
    handleDrag,
    handleDoubleClick,
    handleClearHighlight,
    // Spatial query methods
    findNodeAtPoint,
    findNodesInRadius,
    findNodesInRectangle,
    handleBoxSelect,
    // Utilities
    getSpatialIndexStats,
    rebuildSpatialIndex,
  };
};