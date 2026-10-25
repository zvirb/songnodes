import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { pie, arc, PieArcDatum } from 'd3-shape';
import { max } from 'd3-array';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge } from '../types';
import {
  calculateGraphStats,
  calculateNodeDegrees,
  findShortestPath
} from '../utils/graphHelpers';
import {
  CamelotKey,
  keyToCamelot,
  formatCamelotKey,
  parseKeyToCamelot
} from '../utils/harmonic';

interface StatsPanelProps {
  className?: string;
}

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

interface BridgeTrack {
  id: string;
  name: string;
  artist: string;
  bridgeScore: number;
  connections: number;
  pathsThroughNode: number;
}

interface GraphStatistics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  maxDegree: number;
  minDegree: number;
  componentCount: number;
  largestComponentSize: number;
  averagePathLength: number;
  clustering: number;
  bridgeTracks: BridgeTrack[];
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ className = '' }) => {
  const { nodes, edges, performanceMetrics } = useStore((state) => ({
    nodes: state.graphData.nodes,
    edges: state.graphData.edges,
    performanceMetrics: state.performanceMetrics
  }));
  const [selectedChart, setSelectedChart] = useState<string>('overview');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  // Chart refs
  const bpmChartRef = useRef<SVGSVGElement>(null);
  const keyChartRef = useRef<SVGSVGElement>(null);
  const genreChartRef = useRef<SVGSVGElement>(null);
  const camelotWheelRef = useRef<SVGSVGElement>(null);

  // Calculate comprehensive graph statistics
  const graphStats = useMemo((): GraphStatistics => {
    if (nodes.length === 0) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        density: 0,
        averageDegree: 0,
        maxDegree: 0,
        minDegree: 0,
        componentCount: 0,
        largestComponentSize: 0,
        averagePathLength: 0,
        clustering: 0,
        bridgeTracks: [],
      };
    }

    const basicStats = calculateGraphStats({ nodes, edges });
    const degrees = calculateNodeDegrees({ nodes, edges });

    // Calculate average path length (sample-based for performance)
    let totalPathLength = 0;
    let pathCount = 0;
    const sampleSize = Math.min(50, nodes.length);

    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        const path = findShortestPath({ nodes, edges }, nodes[i].id, nodes[j].id);
        if (path && path.length > 1) {
          totalPathLength += path.length - 1;
          pathCount++;
        }
      }
    }

    const averagePathLength = pathCount > 0 ? totalPathLength / pathCount : 0;

    // Calculate clustering coefficient (simplified)
    let totalClustering = 0;
    let nodeCount = 0;

    nodes.forEach(node => {
      const nodeDegree = degrees.get(node.id) || 0;
      if (nodeDegree < 2) return;

      const neighbors = new Set<string>();
      edges.forEach(edge => {
        if (edge.source === node.id) neighbors.add(edge.target);
        if (edge.target === node.id) neighbors.add(edge.source);
      });

      let triangles = 0;
      const neighborArray = Array.from(neighbors);

      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          const hasEdge = edges.some(edge =>
            (edge.source === neighborArray[i] && edge.target === neighborArray[j]) ||
            (edge.source === neighborArray[j] && edge.target === neighborArray[i])
          );
          if (hasEdge) triangles++;
        }
      }

      const possibleTriangles = (nodeDegree * (nodeDegree - 1)) / 2;
      const clustering = possibleTriangles > 0 ? triangles / possibleTriangles : 0;
      totalClustering += clustering;
      nodeCount++;
    });

    const clustering = nodeCount > 0 ? totalClustering / nodeCount : 0;

    // Calculate bridge tracks (nodes with high betweenness centrality)
    const bridgeTracks = calculateBridgeTracks(nodes, edges, degrees);

    return {
      ...basicStats,
      averagePathLength,
      clustering,
      bridgeTracks,
    };
  }, [nodes, edges]);

  // Calculate BPM distribution
  const bpmDistribution = useMemo((): ChartData[] => {
    const bpmBuckets = new Map<string, number>();
    const bucketSize = 10;

    nodes.forEach(node => {
      if (node.track?.bpm && typeof node.track.bpm === 'number') {
        const bucket = Math.floor(node.track.bpm / bucketSize) * bucketSize;
        const label = `${bucket}-${bucket + bucketSize - 1}`;
        bpmBuckets.set(label, (bpmBuckets.get(label) || 0) + 1);
      }
    });

    return Array.from(bpmBuckets.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label));
  }, [nodes]);

  // Calculate key distribution
  const keyDistribution = useMemo((): ChartData[] => {
    const keyCount = new Map<string, number>();

    nodes.forEach(node => {
      if (node.track?.camelotKey) {
        const camelotKey = parseKeyToCamelot(node.track.camelotKey);
        if (camelotKey) {
          const displayKey = formatCamelotKey(camelotKey);
          keyCount.set(displayKey, (keyCount.get(displayKey) || 0) + 1);
        }
      } else if (node.track?.key) {
        const camelotKey = keyToCamelot(node.track.key);
        if (camelotKey) {
          const displayKey = formatCamelotKey(camelotKey);
          keyCount.set(displayKey, (keyCount.get(displayKey) || 0) + 1);
        }
      }
    });

    return Array.from(keyCount.entries())
      .map(([label, value]) => ({
        label,
        value,
        color: keyColour(parseKeyToCamelot(label.replace('m', 'A').replace('M', 'B')))
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes]);

  // Calculate genre distribution
  const genreDistribution = useMemo((): ChartData[] => {
    const genreCount = new Map<string, number>();

    nodes.forEach(node => {
      if (node.track?.genre) {
        const genre = node.track.genre.toLowerCase();
        genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
      }
    });

    return Array.from(genreCount.entries())
      .map(([label, value]) => ({ label: capitalizeFirst(label), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 genres
  }, [nodes]);

  // Most connected tracks
  const mostConnectedTracks = useMemo(() => {
    const degrees = calculateNodeDegrees({ nodes, edges });

    return nodes
      .filter(node => node.track && degrees.get(node.id)! > 0)
      .map(node => ({
        id: node.id,
        name: node.track!.name,
        artist: node.track!.artist,
        connections: degrees.get(node.id) || 0,
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);
  }, [nodes, edges]);

  // Chart rendering functions
  useEffect(() => {
    if (selectedChart === 'bpm' && bpmChartRef.current && bpmDistribution.length > 0) {
      renderBarChart(bpmChartRef.current, bpmDistribution, 'BPM Distribution');
    }
  }, [selectedChart, bpmDistribution]);

  useEffect(() => {
    if (selectedChart === 'genre' && genreChartRef.current && genreDistribution.length > 0) {
      renderPieChart(genreChartRef.current, genreDistribution, 'Genre Distribution');
    }
  }, [selectedChart, genreDistribution]);

  useEffect(() => {
    if (selectedChart === 'key' && keyChartRef.current && keyDistribution.length > 0) {
      renderBarChart(keyChartRef.current, keyDistribution, 'Key Distribution');
    }
  }, [selectedChart, keyDistribution]);

  useEffect(() => {
    if (selectedChart === 'camelot' && camelotWheelRef.current) {
      renderCamelotWheel(camelotWheelRef.current, keyDistribution);
    }
  }, [selectedChart, keyDistribution]);

  // Export functions
  const exportData = useCallback((format: 'json' | 'csv') => {
    const data = {
      timestamp: new Date().toISOString(),
      graphStats,
      bpmDistribution,
      keyDistribution,
      genreDistribution,
      mostConnectedTracks,
      bridgeTracks: graphStats.bridgeTracks,
      performanceMetrics,
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `songnodes-stats-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `songnodes-stats-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [graphStats, bpmDistribution, keyDistribution, genreDistribution, mostConnectedTracks, performanceMetrics]);

  return (
    <div className={`stats-panel ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', backgroundColor: 'var(--bg)', color: 'var(--fg)', padding: 'var(--space-4)' }}>
      <div className="stats-header">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--fg)', marginBottom: 'var(--space-4)', marginTop: 0 }}>Graph Statistics</h2>

        {/* Export Controls */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
            aria-label="Export format"
            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--fg)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', padding: 'var(--space-1) var(--space-2)', fontSize: '0.8125rem' }}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            type="button"
            onClick={() => exportData(exportFormat)}
            className="sn-btn sn-btn--sm"
          >
            Export
          </button>
        </div>

        {/* Chart Selection */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'bpm', label: 'BPM' },
              { key: 'key', label: 'Keys' },
              { key: 'camelot', label: 'Camelot Wheel' },
              { key: 'genre', label: 'Genres' },
              { key: 'connections', label: 'Connections' },
              { key: 'bridges', label: 'Bridge Tracks' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedChart(key)}
                style={{
                  fontSize: '0.75rem',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-chip)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  backgroundColor: selectedChart === key ? 'var(--brand)' : 'var(--surface-2)',
                  color: selectedChart === key ? 'var(--on-brand)' : 'var(--fg-2)',
                  fontWeight: selectedChart === key ? 700 : 400
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-content" style={{ flex: 1, overflowY: 'auto' }}>
        {selectedChart === 'overview' && (
          <div className="overview-stats">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Nodes</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{graphStats.nodeCount.toLocaleString()}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Edges</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{graphStats.edgeCount.toLocaleString()}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Density</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{(graphStats.density * 100).toFixed(2)}%</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Avg Degree</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{graphStats.averageDegree.toFixed(1)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Connected Components</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontWeight: 600, fontFamily: 'var(--font-data)' }}>{graphStats.componentCount}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Largest Component</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontWeight: 600, fontFamily: 'var(--font-data)' }}>{graphStats.largestComponentSize} nodes</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Avg Path Length</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontWeight: 600, fontFamily: 'var(--font-data)' }}>{graphStats.averagePathLength.toFixed(2)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Clustering</div>
                <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontWeight: 600, fontFamily: 'var(--font-data)' }}>{(graphStats.clustering * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="performance-section">
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg-2)', marginBottom: 'var(--space-2)' }}>Performance</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
                <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-control)' }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>FPS</div>
                  <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontFamily: 'var(--font-data)' }}>{performanceMetrics.frameRate.toFixed(0)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-control)' }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Render (ms)</div>
                  <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontFamily: 'var(--font-data)' }}>{performanceMetrics.renderTime.toFixed(1)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-control)' }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Visible Nodes</div>
                  <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontFamily: 'var(--font-data)' }}>{performanceMetrics.visibleNodes}</div>
                </div>
                <div style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-control)' }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>Memory (MB)</div>
                  <div style={{ color: 'var(--fg)', fontSize: '1.125rem', fontFamily: 'var(--font-data)' }}>{performanceMetrics.memoryUsage.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedChart === 'bpm' && (
          <div className="chart-container">
            <svg ref={bpmChartRef} width="100%" height="300"></svg>
          </div>
        )}

        {selectedChart === 'key' && (
          <div className="chart-container">
            <svg ref={keyChartRef} width="100%" height="300"></svg>
          </div>
        )}

        {selectedChart === 'camelot' && (
          <div className="chart-container">
            <svg ref={camelotWheelRef} width="100%" height="300"></svg>
          </div>
        )}

        {selectedChart === 'genre' && (
          <div className="chart-container">
            <svg ref={genreChartRef} width="100%" height="300"></svg>
          </div>
        )}

        {selectedChart === 'connections' && (
          <div className="connections-list">
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg-2)', marginBottom: 'var(--space-3)' }}>Most Connected Tracks</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {mostConnectedTracks.map((track) => (
                <div key={track.id} style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--fg)', fontSize: '0.875rem', fontWeight: 500 }}>{track.name}</div>
                    <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>{track.artist}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--brand-strong)', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{track.connections}</div>
                    <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>connections</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedChart === 'bridges' && (
          <div className="bridges-list">
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg-2)', marginBottom: 'var(--space-1)' }}>Bridge Tracks</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-3)', marginBottom: 'var(--space-3)' }}>
              Tracks that connect different parts of the graph
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {graphStats.bridgeTracks.map((track) => (
                <div key={track.id} style={{ backgroundColor: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-1)' }}>
                    <div>
                      <div style={{ color: 'var(--fg)', fontSize: '0.875rem', fontWeight: 500 }}>{track.name}</div>
                      <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>{track.artist}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--status-warn)', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{track.bridgeScore.toFixed(2)}</div>
                      <div style={{ color: 'var(--fg-3)', fontSize: '0.75rem' }}>bridge score</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)', fontSize: '0.75rem' }}>
                    <div>
                      <span style={{ color: 'var(--fg-3)' }}>Connections:</span>
                      <span style={{ color: 'var(--fg)', marginLeft: 'var(--space-1)', fontFamily: 'var(--font-data)' }}>{track.connections}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--fg-3)' }}>Paths:</span>
                      <span style={{ color: 'var(--fg)', marginLeft: 'var(--space-1)', fontFamily: 'var(--font-data)' }}>{track.pathsThroughNode}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper functions

function calculateBridgeTracks(nodes: GraphNode[], edges: GraphEdge[], degrees: Map<string, number>): BridgeTrack[] {
  // Simple betweenness centrality approximation
  const bridgeScores = new Map<string, number>();
  const pathCounts = new Map<string, number>();

  // Sample a subset of node pairs for performance
  const sampleSize = Math.min(20, nodes.length);

  for (let i = 0; i < sampleSize; i++) {
    for (let j = i + 1; j < sampleSize; j++) {
      const path = findShortestPath({ nodes, edges }, nodes[i].id, nodes[j].id);
      if (path && path.length > 2) {
        // Count intermediate nodes in the path
        for (let k = 1; k < path.length - 1; k++) {
          const nodeId = path[k];
          bridgeScores.set(nodeId, (bridgeScores.get(nodeId) || 0) + 1);
          pathCounts.set(nodeId, (pathCounts.get(nodeId) || 0) + 1);
        }
      }
    }
  }

  return nodes
    .filter(node => node.track && bridgeScores.has(node.id))
    .map(node => ({
      id: node.id,
      name: node.track!.name,
      artist: node.track!.artist,
      bridgeScore: bridgeScores.get(node.id) || 0,
      connections: degrees.get(node.id) || 0,
      pathsThroughNode: pathCounts.get(node.id) || 0,
    }))
    .sort((a, b) => b.bridgeScore - a.bridgeScore)
    .slice(0, 10);
}

/** Categorical chart colour from the design system's eight chart slots. */
function chartColour(i: number): string {
  return `var(--chart-${(i % 8) + 1})`;
}

/** Camelot key colour from the design system's key tokens; unknown keys stay neutral. */
function keyColour(key: CamelotKey | null | undefined): string {
  return key ? `var(--key-${key.toLowerCase()})` : 'var(--fg-3)';
}

function renderBarChart(svg: SVGSVGElement, data: ChartData[], title: string) {
  const container = d3.select(svg);
  container.selectAll("*").remove();

  const margin = { top: 20, right: 20, bottom: 40, left: 40 };
  const width = svg.clientWidth - margin.left - margin.right;
  const height = svg.clientHeight - margin.top - margin.bottom;

  if (width <= 0 || height <= 0) return;

  const g = container
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = scaleBand()
    .domain(data.map(d => d.label))
    .range([0, width])
    .padding(0.1);

  const y = scaleLinear()
    .domain([0, max(data, d => d.value) || 0])
    .range([height, 0]);

  // Bars
  g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.label) || 0)
    .attr("width", x.bandwidth())
    .attr("y", d => y(d.value))
    .attr("height", d => height - y(d.value))
    .style("fill", d => d.color || chartColour(0));

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(axisBottom(x))
    .selectAll("text")
    .attr("class", "data-s")
    .style("fill", "var(--fg-3)");

  // Y axis
  g.append("g")
    .call(axisLeft(y))
    .selectAll("text")
    .attr("class", "data-s")
    .style("fill", "var(--fg-3)");

  // Title
  g.append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .attr("class", "body-strong")
    .style("fill", "var(--fg)")
    .text(title);
}

function renderPieChart(svg: SVGSVGElement, data: ChartData[], title: string) {
  const container = d3.select(svg);
  container.selectAll("*").remove();

  const width = svg.clientWidth;
  const height = svg.clientHeight;
  const radius = Math.min(width, height) / 2 - 40;

  if (radius <= 0) return;

  const g = container
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const pieGenerator = pie<ChartData>()
    .value(d => d.value)
    .sort(null);

  const arcGenerator = arc<PieArcDatum<ChartData>>()
    .innerRadius(0)
    .outerRadius(radius);

  const arcs = g.selectAll(".arc")
    .data(pieGenerator(data))
    .enter()
    .append("g")
    .attr("class", "arc");

  arcs.append("path")
    .attr("d", arcGenerator)
    .style("fill", (d: any, i: number) => d.data.color || chartColour(i));

  arcs.append("text")
    .attr("transform", d => `translate(${arcGenerator.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("class", "data-s")
    .style("fill", "var(--fg)")
    .text(d => d.data.value > 2 ? d.data.label : '');

  // Title
  container
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("class", "body-strong")
    .style("fill", "var(--fg)")
    .text(title);
}

function renderCamelotWheel(svg: SVGSVGElement, keyData: ChartData[]) {
  const container = d3.select(svg);
  container.selectAll("*").remove();

  const width = svg.clientWidth;
  const height = svg.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 20;
  const innerRadius = outerRadius * 0.6;

  if (outerRadius <= 0) return;

  const g = container
    .append("g")
    .attr("transform", `translate(${centerX},${centerY})`);

  // Create data for each Camelot position
  const wheelData: Array<{
    position: number;
    majorKey: CamelotKey;
    minorKey: CamelotKey;
    majorCount: number;
    minorCount: number;
  }> = [];

  for (let pos = 0; pos < 12; pos++) {
    const majorKey = `${pos + 1}B` as CamelotKey;
    const minorKey = `${pos + 1}A` as CamelotKey;

    const majorCount = keyData.find(d => d.label === formatCamelotKey(majorKey))?.value || 0;
    const minorCount = keyData.find(d => d.label === formatCamelotKey(minorKey))?.value || 0;

    wheelData.push({
      position: pos,
      majorKey,
      minorKey,
      majorCount,
      minorCount,
    });
  }

  const maxCount = Math.max(
    ...wheelData.map(d => Math.max(d.majorCount, d.minorCount)),
    1
  );

  // Draw wheel segments
  wheelData.forEach(d => {
    const angle = (d.position * 30 - 90) * Math.PI / 180; // Start from top
    const nextAngle = ((d.position + 1) * 30 - 90) * Math.PI / 180;

    // Major key (outer ring)
    const majorArc = arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(angle)
      .endAngle(nextAngle);

    g.append("path")
      .attr("d", majorArc as any)
      .style("fill", keyColour(d.majorKey))
      .attr("opacity", 0.3 + (d.majorCount / maxCount) * 0.7)
      .style("stroke", "var(--line)")
      .attr("stroke-width", 1);

    // Minor key (inner ring)
    const minorArc = arc()
      .innerRadius(innerRadius * 0.5)
      .outerRadius(innerRadius)
      .startAngle(angle)
      .endAngle(nextAngle);

    g.append("path")
      .attr("d", minorArc as any)
      .style("fill", keyColour(d.minorKey))
      .attr("opacity", 0.3 + (d.minorCount / maxCount) * 0.7)
      .style("stroke", "var(--line)")
      .attr("stroke-width", 1);

    // Labels
    const labelAngle = angle + (nextAngle - angle) / 2;
    const majorLabelRadius = (innerRadius + outerRadius) / 2;
    const minorLabelRadius = (innerRadius * 0.5 + innerRadius) / 2;

    // Major key label
    g.append("text")
      .attr("x", Math.cos(labelAngle) * majorLabelRadius)
      .attr("y", Math.sin(labelAngle) * majorLabelRadius)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("class", "data-strong")
      .style("fill", "var(--fg)")
      .text(formatCamelotKey(d.majorKey));

    // Minor key label
    g.append("text")
      .attr("x", Math.cos(labelAngle) * minorLabelRadius)
      .attr("y", Math.sin(labelAngle) * minorLabelRadius)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("class", "data-s")
      .style("fill", "var(--fg)")
      .text(formatCamelotKey(d.minorKey));
  });

  // Title
  container
    .append("text")
    .attr("x", centerX)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("class", "body-strong")
    .style("fill", "var(--fg)")
    .text("Camelot wheel");

  // Legend
  container
    .append("text")
    .attr("x", centerX)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("class", "caption")
    .style("fill", "var(--fg-3)")
    .text("Outer ring: major keys · inner ring: minor keys · opacity: track count");
}

function convertToCSV(data: any): string {
  const lines: string[] = [];

  // Graph Stats
  lines.push('Graph Statistics');
  lines.push('Metric,Value');
  Object.entries(data.graphStats).forEach(([key, value]) => {
    if (typeof value === 'number') {
      lines.push(`${key},${value}`);
    }
  });

  lines.push('');

  // BPM Distribution
  lines.push('BPM Distribution');
  lines.push('Range,Count');
  data.bpmDistribution.forEach((item: ChartData) => {
    lines.push(`${item.label},${item.value}`);
  });

  lines.push('');

  // Key Distribution
  lines.push('Key Distribution');
  lines.push('Key,Count');
  data.keyDistribution.forEach((item: ChartData) => {
    lines.push(`${item.label},${item.value}`);
  });

  lines.push('');

  // Most Connected Tracks
  lines.push('Most Connected Tracks');
  lines.push('Name,Artist,Connections');
  data.mostConnectedTracks.forEach((track: any) => {
    lines.push(`"${track.name}","${track.artist}",${track.connections}`);
  });

  return lines.join('\n');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default StatsPanel;