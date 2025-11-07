import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(5px)'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '85vh',
          overflow: 'hidden',
          color: '#FFFFFF'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={20} strokeWidth={2} aria-hidden="true" />
              Graph Filters
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#8E8E93' }}>
              Showing {filteredNodeCount} of {totalNodes} nodes, {filteredEdgeCount} of {totalEdges} edges
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close graph filters panel"
            style={{
              background: 'none',
              border: 'none',
              color: '#8E8E93',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>

          {/* Node Limit Slider */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                Maximum Nodes
              </label>
              <span style={{ fontSize: '14px', color: '#7ED321', fontWeight: 600 }}>
                {filteredNodeCount} nodes
              </span>
            </div>
            <input
              type="range"
              min="10"
              max={totalNodes}
              value={maxNodes}
              onChange={(e) => setMaxNodes(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #7ED321 0%, #7ED321 ${(maxNodes / totalNodes) * 100}%, #333 ${(maxNodes / totalNodes) * 100}%, #333 100%)`,
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8E8E93', marginTop: '4px' }}>
              <span>10</span>
              <span>{maxNodes}</span>
              <span>{totalNodes}</span>
            </div>
          </div>

          {/* Edge Limit Slider */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                Maximum Edges
              </label>
              <span style={{ fontSize: '14px', color: '#4A90E2', fontWeight: 600 }}>
                {filteredEdgeCount} edges
              </span>
            </div>
            <input
              type="range"
              min="10"
              max={totalEdges}
              value={maxEdges}
              onChange={(e) => setMaxEdges(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #4A90E2 0%, #4A90E2 ${(maxEdges / totalEdges) * 100}%, #333 ${(maxEdges / totalEdges) * 100}%, #333 100%)`,
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8E8E93', marginTop: '4px' }}>
              <span>10</span>
              <span>{maxEdges}</span>
              <span>{totalEdges}</span>
            </div>
          </div>

          {/* Connection Strength Filter */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                Minimum Connection Strength
              </label>
              <span style={{ fontSize: '14px', color: '#F39C12', fontWeight: 600 }}>
                {minConnectionStrength}+
              </span>
            </div>
            <input
              type="range"
              min="1"
              max={Math.max(...connectionStrengths, 10)}
              value={minConnectionStrength}
              onChange={(e) => setMinConnectionStrength(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #F39C12 0%, #F39C12 ${(minConnectionStrength / Math.max(...connectionStrengths, 10)) * 100}%, #333 ${(minConnectionStrength / Math.max(...connectionStrengths, 10)) * 100}%, #333 100%)`,
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8E8E93', marginTop: '4px' }}>
              <span>1 (weakest)</span>
              <span>{Math.max(...connectionStrengths, 10)} (strongest)</span>
            </div>
          </div>

          {/* Year Range Filter */}
          {years.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                  Release Year Range
                </label>
                <span style={{ fontSize: '14px', color: '#9B59B6', fontWeight: 600 }}>
                  {yearRange[0]} - {yearRange[1]}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <input
                  type="range"
                  min={years[0]}
                  max={years[years.length - 1]}
                  value={yearRange[0]}
                  onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                  style={{
                    flex: 1,
                    height: '6px',
                    borderRadius: '3px',
                    background: '#9B59B6',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                <input
                  type="range"
                  min={years[0]}
                  max={years[years.length - 1]}
                  value={yearRange[1]}
                  onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                  style={{
                    flex: 1,
                    height: '6px',
                    borderRadius: '3px',
                    background: '#9B59B6',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8E8E93', marginTop: '4px' }}>
                <span>{years[0]}</span>
                <span>{years[years.length - 1]}</span>
              </div>
            </div>
          )}

          {/* Genre Filter */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                Genres
              </label>
              <span style={{ fontSize: '12px', color: '#8E8E93' }}>
                {selectedGenres.length} selected
              </span>
            </div>
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '8px'
            }}>
              {genres.map(({ genre, count }) => {
                const isSelected = selectedGenres.includes(genre);
                const filteredCount = filteredGenreCounts.get(genre) || 0;

                return (
                  <label
                    key={genre}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? 'rgba(126, 211, 33, 0.1)' : 'transparent',
                      border: isSelected ? '1px solid rgba(126, 211, 33, 0.3)' : '1px solid transparent',
                      marginBottom: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGenre(genre)}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: '#7ED321',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontSize: '13px', color: '#FFFFFF' }}>{genre}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {isSelected && filteredCount !== count && (
                        <span style={{ fontSize: '12px', color: '#7ED321', fontWeight: 600 }}>
                          {filteredCount}
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: '#8E8E93' }}>
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.3)'
          }}
        >
          <button
            onClick={resetFilters}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid #F56565',
              borderRadius: '6px',
              color: '#F56565',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(245, 101, 101, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Reset All Filters
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={applyFilters}
              style={{
                padding: '10px 20px',
                backgroundColor: '#7ED321',
                border: 'none',
                borderRadius: '6px',
                color: '#000000',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#8FE831';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#7ED321';
                e.currentTarget.style.transform = 'scale(1)';
              }}
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
