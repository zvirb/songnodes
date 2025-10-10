/**
 * Spatial Index Usage Examples
 *
 * This file demonstrates practical usage patterns for the spatial index
 * in the SongNodes graph visualization.
 *
 * DO NOT IMPORT THIS FILE IN PRODUCTION CODE
 * This is for reference and documentation only.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { SpatialIndex } from '../utils/spatialIndex';
import { runComprehensiveBenchmark, printBenchmarkResults } from '../utils/spatialIndexBenchmark';
import { GraphNode, Point, Bounds } from '../types';

// ============================================================================
// Example 1: Basic Hover Detection with Spatial Index
// ============================================================================

export function BasicHoverExample() {
  const graphInteraction = useGraphInteraction({
    useSpatialIndex: true,  // Enable spatial indexing
    hoverRadius: 20,        // Detection radius in pixels
  });

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const point: Point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    // O(log n) hover detection instead of O(n)
    const hoveredNode = graphInteraction.findNodeAtPoint(point, 20);

    if (hoveredNode) {
      console.log('Hovering over:', hoveredNode.label);
      graphInteraction.handleNodeHover(hoveredNode, true);
    }
  }, [graphInteraction]);

  return (
    <canvas
      width={800}
      height={600}
      onMouseMove={handleMouseMove}
      style={{ cursor: 'pointer' }}
    />
  );
}

// ============================================================================
// Example 2: Box Selection with Spatial Index
// ============================================================================

export function BoxSelectionExample() {
  const graphInteraction = useGraphInteraction({
    useSpatialIndex: true,
    enableBoxSelect: true,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [selectionBox, setSelectionBox] = useState<Bounds | null>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const point: Point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    setIsDragging(true);
    setDragStart(point);
    setSelectionBox(null);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const currentPoint: Point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    const bounds: Bounds = {
      x: Math.min(dragStart.x, currentPoint.x),
      y: Math.min(dragStart.y, currentPoint.y),
      width: Math.abs(currentPoint.x - dragStart.x),
      height: Math.abs(currentPoint.y - dragStart.y),
    };

    setSelectionBox(bounds);

    // Preview nodes in selection (O(log n + k))
    const nodesInBox = graphInteraction.findNodesInRectangle(bounds);
    console.log(`Selecting ${nodesInBox.length} nodes`);
  }, [isDragging, dragStart, graphInteraction]);

  const handleMouseUp = useCallback(() => {
    if (selectionBox) {
      // O(log n + k) box selection
      graphInteraction.handleBoxSelect(selectionBox);
      console.log('Selection complete');
    }

    setIsDragging(false);
    setDragStart(null);
    setSelectionBox(null);
  }, [selectionBox, graphInteraction]);

  return (
    <div>
      <canvas
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: isDragging ? 'crosshair' : 'default' }}
      />
      {selectionBox && (
        <div
          style={{
            position: 'absolute',
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
            border: '2px dashed #007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Example 3: Radius-Based Node Discovery
// ============================================================================

export function RadiusDiscoveryExample() {
  const graphInteraction = useGraphInteraction({ useSpatialIndex: true });
  const [centerNode, setCenterNode] = useState<GraphNode | null>(null);
  const [nearbyNodes, setNearbyNodes] = useState<GraphNode[]>([]);

  const discoverNearbyNodes = useCallback((node: GraphNode, radius: number = 100) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

    // O(log n + k) radius query
    const nearby = graphInteraction.findNodesInRadius(
      { x: node.x, y: node.y },
      radius
    );

    // Filter out the center node itself
    const filtered = nearby.filter(n => n.id !== node.id);

    setCenterNode(node);
    setNearbyNodes(filtered);
    console.log(`Found ${filtered.length} nodes within ${radius}px of ${node.label}`);
  }, [graphInteraction]);

  return (
    <div>
      <h3>Nearby Nodes Discovery</h3>
      {centerNode && (
        <div>
          <p>Center: {centerNode.label}</p>
          <p>Nearby nodes ({nearbyNodes.length}):</p>
          <ul>
            {nearbyNodes.map(node => (
              <li key={node.id}>{node.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 4: Performance Monitoring Dashboard
// ============================================================================

export function PerformanceMonitorExample() {
  const graphInteraction = useGraphInteraction({ useSpatialIndex: true });
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // Update stats every second
    const interval = setInterval(() => {
      const currentStats = graphInteraction.getSpatialIndexStats();
      setStats(currentStats);
    }, 1000);

    return () => clearInterval(interval);
  }, [graphInteraction]);

  if (!stats) {
    return <div>Loading performance stats...</div>;
  }

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 5 }}>
      <h3>Spatial Index Performance</h3>

      <div style={{ marginBottom: 10 }}>
        <strong>Nodes in Index:</strong> {stats.nodeCount}
      </div>

      <div style={{ marginBottom: 10 }}>
        <strong>Total Queries:</strong> {stats.totalQueries}
      </div>

      <div style={{ marginBottom: 10 }}>
        <strong>Average Query Time:</strong> {stats.avgQueryDuration.toFixed(3)}ms
      </div>

      <h4>Query Breakdown:</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Type</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Avg Duration (ms)</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(stats.metricsByType).map(([type, metrics]: [string, any]) => (
            <tr key={type}>
              <td style={{ border: '1px solid #ccc', padding: 8 }}>{type}</td>
              <td style={{ border: '1px solid #ccc', padding: 8 }}>
                {metrics.avgDuration.toFixed(3)}
              </td>
              <td style={{ border: '1px solid #ccc', padding: 8 }}>{metrics.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Example 5: Manual Index Management
// ============================================================================

export function ManualIndexManagementExample() {
  const graphInteraction = useGraphInteraction({ useSpatialIndex: true });
  const spatialIndexRef = useRef(new SpatialIndex());

  // Build index from graph data
  const buildIndex = useCallback((nodes: GraphNode[]) => {
    const startTime = performance.now();
    spatialIndexRef.current.buildIndex(nodes);
    const duration = performance.now() - startTime;

    console.log(`Index built in ${duration.toFixed(2)}ms for ${nodes.length} nodes`);
  }, []);

  // Update node position after drag
  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    // Update position in graph state
    graphInteraction.handleDrag(nodeId, x, y);

    // Spatial index is automatically updated by useGraphInteraction
    // But if you're managing your own index:
    spatialIndexRef.current.updateNode(nodeId, x, y);
  }, [graphInteraction]);

  // Batch update multiple nodes (e.g., after layout animation)
  const handleLayoutComplete = useCallback((updates: Array<{id: string; x: number; y: number}>) => {
    spatialIndexRef.current.updateNodes(updates);
    console.log(`Updated ${updates.length} nodes in spatial index`);
  }, []);

  // Rebuild index when graph structure changes significantly
  const handleGraphReset = useCallback(() => {
    graphInteraction.rebuildSpatialIndex();
    console.log('Spatial index rebuilt');
  }, [graphInteraction]);

  return (
    <div>
      <h3>Manual Index Management</h3>
      <button onClick={() => buildIndex([])}>Build Index</button>
      <button onClick={handleGraphReset}>Rebuild Index</button>
    </div>
  );
}

// ============================================================================
// Example 6: Running Benchmarks
// ============================================================================

export function BenchmarkExample() {
  const [benchmarkResults, setBenchmarkResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runBenchmark = useCallback(async () => {
    setIsRunning(true);
    console.log('Starting comprehensive benchmark...');

    // Run benchmark on different graph sizes
    const results = runComprehensiveBenchmark(
      [50, 100, 200, 500, 1000, 2000],  // Node counts to test
      50                                 // Iterations per test
    );

    // Print results to console
    printBenchmarkResults(results);

    setBenchmarkResults(results);
    setIsRunning(false);
    console.log('Benchmark complete!');
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h3>Spatial Index Benchmark</h3>

      <button onClick={runBenchmark} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Run Benchmark'}
      </button>

      {benchmarkResults && (
        <div style={{ marginTop: 20 }}>
          <h4>Summary</h4>
          <p>Average Point Query Speedup: {benchmarkResults.summary.avgSpeedupPoint.toFixed(2)}x</p>
          <p>Average Radius Query Speedup: {benchmarkResults.summary.avgSpeedupRadius.toFixed(2)}x</p>
          <p>Average Rectangle Query Speedup: {benchmarkResults.summary.avgSpeedupRectangle.toFixed(2)}x</p>
          <p>Recommended Minimum Nodes: {benchmarkResults.summary.recommendedMinNodes}</p>

          <h4>Detailed Results</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Nodes</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Build (ms)</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Point Speedup</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Radius Speedup</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Rectangle Speedup</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkResults.nodeCounts.map((count: number, i: number) => (
                <tr key={count}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{count}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {benchmarkResults.buildIndexTimes[i].duration.toFixed(2)}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {benchmarkResults.pointQuery[i].speedup.toFixed(1)}x
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {benchmarkResults.radiusQuery[i].speedup.toFixed(1)}x
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {benchmarkResults.rectangleQuery[i].speedup.toFixed(1)}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 7: Adaptive Performance Mode
// ============================================================================

export function AdaptivePerformanceModeExample() {
  const [nodeCount, setNodeCount] = useState(100);

  // Automatically choose spatial index based on graph size
  const useSpatialIndex = nodeCount >= 100;

  const graphInteraction = useGraphInteraction({
    useSpatialIndex,
    hoverRadius: useSpatialIndex ? 15 : 25,  // Smaller radius for large graphs
  });

  return (
    <div>
      <h3>Adaptive Performance Mode</h3>
      <p>Node Count: {nodeCount}</p>
      <p>Using Spatial Index: {useSpatialIndex ? 'Yes' : 'No (linear search)'}</p>
      <p>Hover Radius: {useSpatialIndex ? 15 : 25}px</p>

      <input
        type="range"
        min={10}
        max={2000}
        value={nodeCount}
        onChange={(e) => setNodeCount(parseInt(e.target.value))}
      />

      <div style={{ marginTop: 10, color: useSpatialIndex ? 'green' : 'orange' }}>
        {useSpatialIndex
          ? '✅ Spatial indexing enabled for optimal performance'
          : '⚠️ Linear search (acceptable for small graphs)'}
      </div>
    </div>
  );
}

// ============================================================================
// Example 8: K-Nearest Neighbors
// ============================================================================

export function KNearestNeighborsExample() {
  const spatialIndex = useRef(new SpatialIndex());
  const [neighbors, setNeighbors] = useState<GraphNode[]>([]);

  const findNearestNeighbors = useCallback((point: Point, k: number = 5) => {
    const nearest = spatialIndex.current.findKNearestNeighbors(point, k);
    setNeighbors(nearest);
    console.log(`Found ${nearest.length} nearest neighbors`);
  }, []);

  return (
    <div>
      <h3>K-Nearest Neighbors</h3>
      <p>Click on the canvas to find the 5 nearest nodes</p>

      <canvas
        width={800}
        height={600}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          findNearestNeighbors({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          }, 5);
        }}
      />

      <div>
        <h4>Nearest Neighbors:</h4>
        <ul>
          {neighbors.map(node => (
            <li key={node.id}>{node.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
