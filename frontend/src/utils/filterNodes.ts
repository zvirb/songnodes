import { GraphNode, GraphEdge, SearchFilters } from '../types';

/**
 * Unified node filtering logic used by both visualization and pathfinder
 *
 * This ensures that:
 * 1. The visualization shows filtered nodes based on user criteria
 * 2. The pathfinder uses the same filtered set for track selection
 * 3. Both systems see identical node sets, preventing ID mismatch errors
 */
export function filterNodes(nodes: GraphNode[], filters: SearchFilters): GraphNode[] {
  return nodes.filter(node => {
    // Only filter track nodes
    if (node.type !== 'track' || !node.track) return true;

    const track = node.track;

    // Genre filter
    if (filters.genre && filters.genre.length > 0) {
      if (!track.genre || !filters.genre.includes(track.genre)) {
        return false;
      }
    }

    // Key range filter
    if (filters.keyRange && filters.keyRange.length > 0) {
      if (!track.camelotKey || !filters.keyRange.includes(track.camelotKey)) {
        return false;
      }
    }

    // BPM range filter
    if (filters.bpmRange) {
      if (!track.bpm || track.bpm < filters.bpmRange[0] || track.bpm > filters.bpmRange[1]) {
        return false;
      }
    }

    // Energy range filter
    if (filters.energyRange) {
      if (!track.energy || track.energy < filters.energyRange[0] || track.energy > filters.energyRange[1]) {
        return false;
      }
    }

    // Year range filter
    if (filters.yearRange) {
      const year = track.year || track.release_year;
      if (!year || year < filters.yearRange[0] || year > filters.yearRange[1]) {
        return false;
      }
    }

    // Artist filter
    if (filters.artist && filters.artist.length > 0) {
      if (!track.artist || !filters.artist.includes(track.artist)) {
        return false;
      }
    }

    // Min popularity filter
    if (filters.minPopularity !== undefined && filters.minPopularity > 0) {
      if (!track.popularity || track.popularity < filters.minPopularity) {
        return false;
      }
    }

    // Has preview filter
    if (filters.hasPreview) {
      if (!track.preview_url) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter edges to only include those where both endpoints are in the filtered node set
 * and the edge type is not hidden
 */
export function filterEdges(
  edges: GraphEdge[],
  visibleNodeIds: Set<string>,
  hiddenEdgeTypes?: Set<GraphEdge['type']>
): GraphEdge[] {
  return edges.filter(edge => {
    // Check if both endpoints are visible
    const endpointsVisible =
      visibleNodeIds.has(edge.source.toString()) &&
      visibleNodeIds.has(edge.target.toString());

    // Check if edge type is not hidden
    const typeVisible = !hiddenEdgeTypes || !hiddenEdgeTypes.has(edge.type);

    return endpointsVisible && typeVisible;
  });
}
