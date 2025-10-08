/**
 * @file Graph Filter Utilities
 * @description Contains helper functions for processing and filtering graph data
 * for the GraphFilterPanel component.
 */

import { GraphData, GraphNode, GraphEdge } from '../types';

export interface GraphFilterValues {
  genres: { genre: string; count: number }[];
  years: number[];
  connectionStrengths: number[];
  totalNodes: number;
  totalEdges: number;
}

export interface GraphFilters {
  selectedGenres: string[];
  yearRange: [number, number];
  minConnectionStrength: number;
  maxNodes: number;
  maxEdges: number;
}

/**
 * Extracts unique, filterable values from the graph data.
 * @param {GraphData} graphData - The full graph data from the store.
 * @returns {GraphFilterValues} An object containing lists of genres, years, etc.
 */
export const extractFilterValues = (graphData: GraphData): GraphFilterValues => {
  const genreMap = new Map<string, number>();
  const yearSet = new Set<number>();
  const strengthSet = new Set<number>();
  let unclassifiedCount = 0;

  for (const node of graphData.nodes) {
    const genre = node.metadata?.genre || node.metadata?.category;
    if (genre) {
      genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    } else {
      unclassifiedCount++;
    }
    if (node.metadata?.release_year) {
      yearSet.add(node.metadata.release_year);
    }
  }

  for (const edge of graphData.edges) {
    if (edge.weight) {
      strengthSet.add(Math.floor(edge.weight));
    }
  }

  const classifiedGenres = Array.from(genreMap.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);

  const allGenres = unclassifiedCount > 0
    ? [...classifiedGenres, { genre: 'Unclassified', count: unclassifiedCount }]
    : classifiedGenres;

  return {
    genres: allGenres,
    years: Array.from(yearSet).sort((a, b) => a - b),
    connectionStrengths: Array.from(strengthSet).sort((a, b) => a - b),
    totalNodes: graphData.nodes.length,
    totalEdges: graphData.edges.length,
  };
};

/**
 * Applies a set of filters to the graph data using an edge-first approach for performance.
 * This ensures that node filtering is only performed on nodes that are part of the visible edge set.
 * @param {GraphData} graphData - The original, unfiltered graph data.
 * @param {GraphFilters} filters - The filter criteria to apply.
 * @returns {GraphData} The new, filtered graph data.
 */
export const applyGraphFilters = (graphData: GraphData, filters: GraphFilters): GraphData => {
  const { selectedGenres, yearRange, minConnectionStrength, maxNodes, maxEdges } = filters;

  // Step 1: Filter edges by weight and limit by maxEdges.
  const candidateEdges = graphData.edges
    .filter(edge => (edge.weight || 0) >= minConnectionStrength)
    .slice(0, maxEdges);

  // Step 2: Collect all unique node IDs from the candidate edges.
  const edgeNodeIds = new Set<string>();
  for (const edge of candidateEdges) {
    edgeNodeIds.add(edge.source);
    edgeNodeIds.add(edge.target);
  }

  // Step 3: Filter the collected nodes by genre and year, then limit by maxNodes.
  const filteredNodes = graphData.nodes
    .filter(node => {
      if (!edgeNodeIds.has(node.id)) return false;

      if (selectedGenres.length > 0) {
        const nodeGenre = node.metadata?.genre || node.metadata?.category;
        if (!nodeGenre && !selectedGenres.includes('Unclassified')) return false;
        if (nodeGenre && !selectedGenres.includes(nodeGenre)) return false;
      }

      const releaseYear = node.metadata?.release_year;
      if (releaseYear && (releaseYear < yearRange[0] || releaseYear > yearRange[1])) {
        return false;
      }

      return true;
    })
    .slice(0, maxNodes);

  // Step 4: Create a final set of node IDs that survived all filters.
  const finalNodeIds = new Set(filteredNodes.map(n => n.id));

  // Step 5: The final edge set includes only those edges where both nodes are in the final node set.
  const filteredEdges = candidateEdges.filter(
    edge => finalNodeIds.has(edge.source) && finalNodeIds.has(edge.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
};