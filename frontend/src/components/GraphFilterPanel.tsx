import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { SN } from '../lib/songnodes';
import { Dialog } from './ds';
import './GraphFilterPanel.css';
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

  const maxStrength = Math.max(...connectionStrengths, 10);
  const count = (n: number) => SN.format.count(n);

  return (
    <Dialog
      open={isOpen}
      title="Graph filters"
      sub={`Showing ${count(filteredNodeCount)} of ${count(totalNodes)} tracks and ${count(filteredEdgeCount)} of ${count(totalEdges)} links`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sn-btn sn-btn--quiet sn-dialog__foot-start" onClick={resetFilters}>
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            Clear filters
          </button>
          <button type="button" className="sn-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="sn-btn sn-btn--primary" onClick={applyFilters}>
            Show {count(filteredNodeCount)} tracks
          </button>
        </>
      }
    >
      <div className="gfp">
        <div className="sn-field">
          <label htmlFor="gfp-nodes">Most tracks <span className="gfp__value">{count(filteredNodeCount)}</span></label>
          <input id="gfp-nodes" type="range" min="10" max={totalNodes} value={maxNodes} onChange={(e) => setMaxNodes(parseInt(e.target.value))} />
          <span className="gfp__range"><span>10</span><span>{count(totalNodes)}</span></span>
        </div>

        <div className="sn-field">
          <label htmlFor="gfp-edges">Most links <span className="gfp__value">{count(filteredEdgeCount)}</span></label>
          <input id="gfp-edges" type="range" min="10" max={totalEdges} value={maxEdges} onChange={(e) => setMaxEdges(parseInt(e.target.value))} />
          <span className="gfp__range"><span>10</span><span>{count(totalEdges)}</span></span>
        </div>

        <div className="sn-field">
          <label htmlFor="gfp-strength">Fewest DJ plays per link <span className="gfp__value">{minConnectionStrength}+</span></label>
          <input id="gfp-strength" type="range" min="1" max={maxStrength} value={minConnectionStrength} onChange={(e) => setMinConnectionStrength(parseInt(e.target.value))} />
          <span className="gfp__range"><span>1</span><span>{maxStrength}</span></span>
        </div>

        {years.length > 0 && (
          <fieldset className="sn-field gfp__years">
            <legend className="sn-field__label">Release years <span className="gfp__value">{yearRange[0]}–{yearRange[1]}</span></legend>
            <div className="gfp__pair">
              <input type="range" aria-label="Earliest release year" min={years[0]} max={years[years.length - 1]} value={yearRange[0]} onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])} />
              <input type="range" aria-label="Latest release year" min={years[0]} max={years[years.length - 1]} value={yearRange[1]} onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])} />
            </div>
            <span className="gfp__range"><span>{years[0]}</span><span>{years[years.length - 1]}</span></span>
          </fieldset>
        )}

        <fieldset className="sn-checkbox-group gfp__genres">
          <legend className="sn-checkbox-group__legend">Genres {selectedGenres.length ? <span className="gfp__value">{selectedGenres.length} selected</span> : null}</legend>
          {genres.length === 0 ? (
            <p className="gfp__none">No genres in the loaded tracks.</p>
          ) : genres.map(({ genre, count: n }) => {
            const isSelected = selectedGenres.includes(genre);
            const filteredCount = filteredGenreCounts.get(genre) || 0;
            return (
              <label key={genre} className="sn-checkbox">
                <input type="checkbox" checked={isSelected} onChange={() => toggleGenre(genre)} />
                <span className="sn-checkbox__text">
                  <span>
                    {genre}
                    <span className="sn-checkbox__count">{isSelected && filteredCount !== n ? `${count(filteredCount)} of ${count(n)}` : count(n)}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </div>
    </Dialog>
  );
};

export default GraphFilterPanel;
