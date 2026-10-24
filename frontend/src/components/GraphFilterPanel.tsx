import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge } from '../types';

interface GraphFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GraphFilterPanel: React.FC<GraphFilterPanelProps> = ({ isOpen, onClose }) => {
  const { graphData, graph } = useStore();

  // Filter state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1990, new Date().getFullYear()]);
  const [minConnectionStrength, setMinConnectionStrength] = useState<number>(1);
  const [maxNodes, setMaxNodes] = useState<number>(15000);
  const [maxEdges, setMaxEdges] = useState<number>(50000);

  // Extract available data
  const { genres, years, connectionStrengths, totalNodes, totalEdges } = useMemo(() => {
    const genreMap = new Map<string, number>();
    const yearSet = new Set<number>();
    const strengthSet = new Set<number>();
    let unclassifiedCount = 0;

    // Count genres and unclassified nodes
    graphData.nodes.forEach(node => {
      const genre = node.metadata?.genre || node.metadata?.category;
      if (genre) {
        genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
      } else {
        unclassifiedCount++;
      }

      const releaseYear = node.metadata?.release_year;
      if (releaseYear) {
        yearSet.add(releaseYear);
      }
    });

    // Get connection strengths from edges
    graphData.edges.forEach(edge => {
      if (edge.weight) {
        strengthSet.add(Math.floor(edge.weight));
      }
    });

    const sortedYears = Array.from(yearSet).sort((a, b) => a - b);
    const sortedStrengths = Array.from(strengthSet).sort((a, b) => a - b);

    // Build genres array with classified genres first, then unclassified
    const classifiedGenres = Array.from(genreMap.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);

    // Add unclassified as the last genre if there are any
    const allGenres = unclassifiedCount > 0
      ? [...classifiedGenres, { genre: 'Unclassified', count: unclassifiedCount }]
      : classifiedGenres;

    return {
      genres: allGenres,
      years: sortedYears,
      connectionStrengths: sortedStrengths,
      totalNodes: graphData.nodes.length,
      totalEdges: graphData.edges.length
    };
  }, [graphData]);

  // Initialize year range from available data
  useEffect(() => {
    if (years.length > 0) {
      setYearRange([years[0], years[years.length - 1]]);
    }
  }, [years]);

  // Calculate filtered counts
  const { filteredNodeCount, filteredEdgeCount, filteredGenreCounts } = useMemo(() => {
    // EDGE-FIRST APPROACH: Start with edges, then derive nodes

    // Step 1: Filter and limit edges first
    const candidateEdges = graphData.edges
      .filter(edge => {
        // Connection strength filter
        if (edge.weight && edge.weight < minConnectionStrength) {
          return false;
        }
        return true;
      })
      .slice(0, maxEdges); // Limit edges first

    // Step 2: Get all nodes referenced by these edges
    const edgeNodeIds = new Set<string>();
    candidateEdges.forEach(edge => {
      edgeNodeIds.add(edge.source);
      edgeNodeIds.add(edge.target);
    });

    // Step 3: Filter nodes by genre/year (only from nodes in edges)
    const filteredNodes = graphData.nodes
      .filter(node => {
        // Must be referenced by an edge
        if (!edgeNodeIds.has(node.id)) {
          return false;
        }

        // Genre filter
        if (selectedGenres.length > 0) {
          const nodeGenre = node.metadata?.genre || node.metadata?.category;
          const hasMatchingGenre = nodeGenre && selectedGenres.includes(nodeGenre);
          const isUnclassifiedSelected = selectedGenres.includes('Unclassified');
          const isNodeUnclassified = !nodeGenre;

          if (!hasMatchingGenre && !(isUnclassifiedSelected && isNodeUnclassified)) {
            return false;
          }
        }

        // Year filter
        const releaseYear = node.metadata?.release_year;
        if (releaseYear && (releaseYear < yearRange[0] || releaseYear > yearRange[1])) {
          return false;
        }

        return true;
      })
      .slice(0, maxNodes); // Limit nodes after filtering

    // Step 4: Keep only edges where BOTH endpoints survived filtering
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = candidateEdges.filter(edge =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );

    // Count genres in filtered nodes
    const genreCounts = new Map<string, number>();
    filteredNodes.forEach(node => {
      const genre = node.metadata?.genre || node.metadata?.category;
      if (genre) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      } else {
        // Count unclassified nodes
        genreCounts.set('Unclassified', (genreCounts.get('Unclassified') || 0) + 1);
      }
    });

    return {
      filteredNodeCount: filteredNodes.length,
      filteredEdgeCount: filteredEdges.length,
      filteredGenreCounts: genreCounts
    };
  }, [graphData, selectedGenres, yearRange, minConnectionStrength, maxNodes, maxEdges]);

  // Apply filters to store
  const applyFilters = useCallback(() => {
    // EDGE-FIRST APPROACH: Match the preview logic

    // Step 1: Filter and limit edges first
    const candidateEdges = graphData.edges
      .filter(edge => {
        if (edge.weight && edge.weight < minConnectionStrength) {
          return false;
        }
        return true;
      })
      .slice(0, maxEdges);

    // Step 2: Get all nodes referenced by these edges
    const edgeNodeIds = new Set<string>();
    candidateEdges.forEach(edge => {
      edgeNodeIds.add(edge.source);
      edgeNodeIds.add(edge.target);
    });

    // Step 3: Filter nodes by genre/year
    const filteredNodes = graphData.nodes
      .filter(node => {
        // Must be referenced by an edge
        if (!edgeNodeIds.has(node.id)) {
          return false;
        }

        // Genre filter
        if (selectedGenres.length > 0) {
          const nodeGenre = node.metadata?.genre || node.metadata?.category;
          const hasMatchingGenre = nodeGenre && selectedGenres.includes(nodeGenre);
          const isUnclassifiedSelected = selectedGenres.includes('Unclassified');
          const isNodeUnclassified = !nodeGenre;

          if (!hasMatchingGenre && !(isUnclassifiedSelected && isNodeUnclassified)) {
            return false;
          }
        }

        // Year filter
        const releaseYear = node.metadata?.release_year;
        if (releaseYear && (releaseYear < yearRange[0] || releaseYear > yearRange[1])) {
          return false;
        }

        return true;
      })
      .slice(0, maxNodes);

    // Step 4: Keep only edges where BOTH endpoints survived filtering
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = candidateEdges.filter(edge =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );

    // Update store with filtered data using setGraphData to preserve original
    graph.setGraphData({
      nodes: filteredNodes,
      edges: filteredEdges
    });

    onClose();
  }, [graphData, selectedGenres, yearRange, minConnectionStrength, maxNodes, maxEdges, onClose, graph]);

  const resetFilters = useCallback(() => {
    // Reset UI state
    setSelectedGenres([]);
    if (years.length > 0) {
      setYearRange([years[0], years[years.length - 1]]);
    }
    setMinConnectionStrength(1);
    setMaxNodes(totalNodes);
    setMaxEdges(totalEdges);

    // Reset graph data to original
    graph.resetGraphData();

    onClose();
  }, [years, totalNodes, totalEdges, graph, onClose]);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[var(--color-modal-overlay)] flex items-center justify-center z-[var(--z-modal)] backdrop-blur-md p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a1a] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] w-full max-w-[700px] max-h-[85vh] overflow-hidden text-[var(--color-text-primary)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--color-border-subtle)]">
          <div>
            <h2 className="m-0 text-lg font-bold flex items-center gap-2 text-[var(--color-text-primary)]">
              <span>🎛️</span> Graph Filters
            </h2>
            <p className="m-0 mt-1 text-xs text-[var(--color-text-secondary)]">
              Showing {filteredNodeCount} of {totalNodes} nodes, {filteredEdgeCount} of {totalEdges} edges
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-2xl cursor-pointer p-1 transition-colors leading-none rounded-[var(--radius-sm)] bg-transparent border-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6 flex flex-col">

          {/* Node Limit Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Maximum Nodes
              </label>
              <span className="text-sm font-bold text-[var(--color-brand-primary)]">
                {filteredNodeCount} nodes
              </span>
            </div>
            <input
              type="range"
              min="10"
              max={totalNodes}
              value={maxNodes}
              onChange={(e) => setMaxNodes(parseInt(e.target.value))}
              className="w-full h-2 rounded-[var(--radius-full)] cursor-pointer accent-[var(--color-brand-primary)] bg-[var(--color-bg-elevated-3)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1 font-mono">
              <span>10</span>
              <span>{maxNodes}</span>
              <span>{totalNodes}</span>
            </div>
          </div>

          {/* Edge Limit Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Maximum Edges
              </label>
              <span className="text-sm font-bold text-[var(--color-brand-secondary)]">
                {filteredEdgeCount} edges
              </span>
            </div>
            <input
              type="range"
              min="10"
              max={totalEdges}
              value={maxEdges}
              onChange={(e) => setMaxEdges(parseInt(e.target.value))}
              className="w-full h-2 rounded-[var(--radius-full)] cursor-pointer accent-[var(--color-brand-secondary)] bg-[var(--color-bg-elevated-3)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1 font-mono">
              <span>10</span>
              <span>{maxEdges}</span>
              <span>{totalEdges}</span>
            </div>
          </div>

          {/* Connection Strength Filter */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Minimum Connection Strength
              </label>
              <span className="text-sm font-bold text-[var(--color-warning)]">
                {minConnectionStrength}+
              </span>
            </div>
            <input
              type="range"
              min="1"
              max={Math.max(...connectionStrengths, 10)}
              value={minConnectionStrength}
              onChange={(e) => setMinConnectionStrength(parseInt(e.target.value))}
              className="w-full h-2 rounded-[var(--radius-full)] cursor-pointer accent-[var(--color-warning)] bg-[var(--color-bg-elevated-3)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1 font-mono">
              <span>1 (weakest)</span>
              <span>{Math.max(...connectionStrengths, 10)} (strongest)</span>
            </div>
          </div>

          {/* Year Range Filter */}
          {years.length > 0 && (
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Release Year Range
                </label>
                <span className="text-sm font-bold text-[var(--color-brand-secondary)]">
                  {yearRange[0]} - {yearRange[1]}
                </span>
              </div>
              <div className="flex gap-4 items-center">
                <input
                  type="range"
                  min={years[0]}
                  max={years[years.length - 1]}
                  value={yearRange[0]}
                  onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                  className="flex-1 h-2 rounded-[var(--radius-full)] cursor-pointer accent-[var(--color-brand-secondary)] bg-[var(--color-bg-elevated-3)]"
                />
                <input
                  type="range"
                  min={years[0]}
                  max={years[years.length - 1]}
                  value={yearRange[1]}
                  onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                  className="flex-1 h-2 rounded-[var(--radius-full)] cursor-pointer accent-[var(--color-brand-secondary)] bg-[var(--color-bg-elevated-3)]"
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1 font-mono">
                <span>{years[0]}</span>
                <span>{years[years.length - 1]}</span>
              </div>
            </div>
          )}

          {/* Genre Filter */}
          <div>
            <div className="flex justify-between mb-3">
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Genres
              </label>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {selectedGenres.length} selected
              </span>
            </div>
            <div className="max-h-[200px] overflow-y-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] p-2 space-y-1 bg-[var(--color-bg-elevated-2)]">
              {genres.map(({ genre, count }) => {
                const isSelected = selectedGenres.includes(genre);
                const filteredCount = filteredGenreCounts.get(genre) || 0;

                return (
                  <label
                    key={genre}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-[var(--radius-md)] transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-brand-primary-muted)] border border-[var(--color-brand-primary)]'
                        : 'border border-transparent hover:bg-[var(--color-bg-elevated-3)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGenre(genre)}
                        className="w-4 h-4 accent-[var(--color-brand-primary)] cursor-pointer rounded-[var(--radius-sm)]"
                      />
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">{genre}</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      {isSelected && filteredCount !== count && (
                        <span className="text-xs font-bold text-[var(--color-brand-primary)]">
                          {filteredCount}
                        </span>
                      )}
                      <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        {count}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-2)] mt-auto">
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-transparent border border-[var(--color-error-border)] rounded-[var(--radius-md)] text-[var(--color-error)] text-xs font-semibold cursor-pointer hover:bg-[var(--color-error-bg)] transition-colors"
          >
            Reset All Filters
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-transparent border border-[var(--color-border-default)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] text-xs font-semibold cursor-pointer hover:bg-[var(--color-bg-elevated-3)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] border-none rounded-[var(--radius-md)] text-[var(--color-text-inverse)] text-xs font-bold cursor-pointer transition-all shadow-md active:scale-95"
            >
              Apply Filters ({filteredNodeCount} nodes, {filteredEdgeCount} edges)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphFilterPanel;
