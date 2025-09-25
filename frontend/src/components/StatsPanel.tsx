import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3-selection';
import { scaleBand, scaleLinear, scaleOrdinal } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { pie, arc, PieArcDatum } from 'd3-shape';
import { max } from 'd3-array';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge } from '../types';
import {
  calculateGraphStats,
  calculateNodeDegrees,
  findShortestPath
} from '../utils/graphHelpers';
import {
  CamelotKey,
  getKeyColor,
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
        color: getKeyColor(parseKeyToCamelot(label.replace('m', 'A').replace('M', 'B')) || '1A')
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
    <div className={`stats-panel ${className}`}>
      <div className="stats-header">
        <h2 className="text-lg font-semibold text-white mb-4">Graph Statistics</h2>

        {/* Export Controls */}
        <div className="export-controls mb-4 flex gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
            className="bg-gray-700 text-white text-sm px-2 py-1 rounded"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            onClick={() => exportData(exportFormat)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition-colors"
          >
            Export
          </button>
        </div>

        {/* Chart Selection */}
        <div className="chart-selector mb-4">
          <div className="flex flex-wrap gap-1">
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
                onClick={() => setSelectedChart(key)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  selectedChart === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-content flex-1 overflow-y-auto">
        {selectedChart === 'overview' && (
          <div className="overview-stats">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Nodes</div>
                <div className="stat-value text-white text-xl font-bold">{graphStats.nodeCount.toLocaleString()}</div>
              </div>
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Edges</div>
                <div className="stat-value text-white text-xl font-bold">{graphStats.edgeCount.toLocaleString()}</div>
              </div>
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Density</div>
                <div className="stat-value text-white text-xl font-bold">{(graphStats.density * 100).toFixed(2)}%</div>
              </div>
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Avg Degree</div>
                <div className="stat-value text-white text-xl font-bold">{graphStats.averageDegree.toFixed(1)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Connected Components</div>
                <div className="stat-value text-white text-lg font-semibold">{graphStats.componentCount}</div>
              </div>
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Largest Component</div>
                <div className="stat-value text-white text-lg font-semibold">{graphStats.largestComponentSize} nodes</div>
              </div>
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Avg Path Length</div>
                <div className="stat-value text-white text-lg font-semibold">{graphStats.averagePathLength.toFixed(2)}</div>
              </div>
              <div className="stat-card bg-gray-800 p-3 rounded">
                <div className="stat-label text-gray-400 text-xs">Clustering</div>
                <div className="stat-value text-white text-lg font-semibold">{(graphStats.clustering * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="performance-section">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Performance</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="stat-card bg-gray-800 p-2 rounded">
                  <div className="stat-label text-gray-400 text-xs">FPS</div>
                  <div className="stat-value text-white text-lg">{performanceMetrics.frameRate.toFixed(0)}</div>
                </div>
                <div className="stat-card bg-gray-800 p-2 rounded">
                  <div className="stat-label text-gray-400 text-xs">Render (ms)</div>
                  <div className="stat-value text-white text-lg">{performanceMetrics.renderTime.toFixed(1)}</div>
                </div>
                <div className="stat-card bg-gray-800 p-2 rounded">
                  <div className="stat-label text-gray-400 text-xs">Visible Nodes</div>
                  <div className="stat-value text-white text-lg">{performanceMetrics.visibleNodes}</div>
                </div>
                <div className="stat-card bg-gray-800 p-2 rounded">
                  <div className="stat-label text-gray-400 text-xs">Memory (MB)</div>
                  <div className="stat-value text-white text-lg">{performanceMetrics.memoryUsage.toFixed(1)}</div>
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
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Most Connected Tracks</h3>
            <div className="space-y-2">
              {mostConnectedTracks.map((track) => (
                <div key={track.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
                  <div>
                    <div className="text-white text-sm font-medium">{track.name}</div>
                    <div className="text-gray-400 text-xs">{track.artist}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-blue-400 text-sm font-bold">{track.connections}</div>
                    <div className="text-gray-500 text-xs">connections</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedChart === 'bridges' && (
          <div className="bridges-list">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Bridge Tracks</h3>
            <div className="text-xs text-gray-400 mb-3">
              Tracks that connect different parts of the graph
            </div>
            <div className="space-y-2">
              {graphStats.bridgeTracks.map((track) => (
                <div key={track.id} className="bg-gray-800 p-3 rounded">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="text-white text-sm font-medium">{track.name}</div>
                      <div className="text-gray-400 text-xs">{track.artist}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-orange-400 text-sm font-bold">{track.bridgeScore.toFixed(2)}</div>
                      <div className="text-gray-500 text-xs">bridge score</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Connections:</span>
                      <span className="text-white ml-1">{track.connections}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Paths:</span>
                      <span className="text-white ml-1">{track.pathsThroughNode}</span>
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
    .attr("fill", d => d.color || "#4F46E5");

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(axisBottom(x))
    .selectAll("text")
    .style("fill", "#9CA3AF")
    .style("font-size", "10px");

  // Y axis
  g.append("g")
    .call(axisLeft(y))
    .selectAll("text")
    .style("fill", "#9CA3AF")
    .style("font-size", "10px");

  // Title
  g.append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("fill", "#F3F4F6")
    .style("font-size", "14px")
    .style("font-weight", "bold")
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

  const color = scaleOrdinal(schemeCategory10);

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
    .attr("fill", (d: any, i: number) => d.data.color || color(i.toString()));

  arcs.append("text")
    .attr("transform", d => `translate(${arcGenerator.centroid(d)})`)
    .attr("text-anchor", "middle")
    .style("fill", "#F3F4F6")
    .style("font-size", "10px")
    .text(d => d.data.value > 2 ? d.data.label : '');

  // Title
  container
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("fill", "#F3F4F6")
    .style("font-size", "14px")
    .style("font-weight", "bold")
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
      .attr("fill", getKeyColor(d.majorKey))
      .attr("opacity", 0.3 + (d.majorCount / maxCount) * 0.7)
      .attr("stroke", "#374151")
      .attr("stroke-width", 1);

    // Minor key (inner ring)
    const minorArc = arc()
      .innerRadius(innerRadius * 0.5)
      .outerRadius(innerRadius)
      .startAngle(angle)
      .endAngle(nextAngle);

    g.append("path")
      .attr("d", minorArc as any)
      .attr("fill", getKeyColor(d.minorKey))
      .attr("opacity", 0.3 + (d.minorCount / maxCount) * 0.7)
      .attr("stroke", "#374151")
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
      .style("fill", "#F3F4F6")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text(formatCamelotKey(d.majorKey));

    // Minor key label
    g.append("text")
      .attr("x", Math.cos(labelAngle) * minorLabelRadius)
      .attr("y", Math.sin(labelAngle) * minorLabelRadius)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("fill", "#F3F4F6")
      .style("font-size", "9px")
      .text(formatCamelotKey(d.minorKey));
  });

  // Title
  container
    .append("text")
    .attr("x", centerX)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("fill", "#F3F4F6")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text("Camelot Wheel");

  // Legend
  container
    .append("text")
    .attr("x", centerX)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .style("fill", "#9CA3AF")
    .style("font-size", "10px")
    .text("Outer: Major Keys | Inner: Minor Keys | Opacity: Track Count");
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