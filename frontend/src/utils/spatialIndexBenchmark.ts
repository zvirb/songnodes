import { GraphNode, Point, Bounds } from '../types';
import { SpatialIndex, benchmarkSpatialVsLinear } from './spatialIndex';

/**
 * Performance Benchmarking Utilities for Spatial Index
 *
 * Provides comprehensive benchmarking tools to validate performance improvements
 * and guide optimization decisions for graph visualization.
 */

export interface BenchmarkResult {
  nodeCount: number;
  queryType: 'point' | 'radius' | 'rectangle';
  spatial: {
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    iterations: number;
  };
  linear: {
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    iterations: number;
  };
  speedup: number;
  timestamp: number;
}

export interface ComprehensiveBenchmarkResults {
  nodeCounts: number[];
  pointQuery: BenchmarkResult[];
  radiusQuery: BenchmarkResult[];
  rectangleQuery: BenchmarkResult[];
  buildIndexTimes: Array<{ nodeCount: number; duration: number }>;
  summary: {
    avgSpeedupPoint: number;
    avgSpeedupRadius: number;
    avgSpeedupRectangle: number;
    recommendedMinNodes: number;
  };
}

/**
 * Generate test nodes with random positions
 */
export function generateTestNodes(count: number, bounds: Bounds = { x: 0, y: 0, width: 1000, height: 1000 }): GraphNode[] {
  const nodes: GraphNode[] = [];

  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `node-${i}`,
      label: `Node ${i}`,
      x: bounds.x + Math.random() * bounds.width,
      y: bounds.y + Math.random() * bounds.height,
      radius: 5 + Math.random() * 10,
      type: 'track',
    });
  }

  return nodes;
}

/**
 * Benchmark point query performance
 */
export function benchmarkPointQuery(
  nodes: GraphNode[],
  iterations: number = 100,
  radius: number = 20
): BenchmarkResult {
  const spatialIndex = new SpatialIndex();
  spatialIndex.buildIndex(nodes);

  const bounds = calculateBounds(nodes);
  const spatialTimes: number[] = [];
  const linearTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Random test point
    const testPoint: Point = {
      x: bounds.x + Math.random() * bounds.width,
      y: bounds.y + Math.random() * bounds.height,
    };

    // Spatial query
    const spatialStart = performance.now();
    spatialIndex.findNodeAtPoint(testPoint, radius);
    spatialTimes.push(performance.now() - spatialStart);

    // Linear query
    const linearStart = performance.now();
    findNodeAtPointLinear(nodes, testPoint, radius);
    linearTimes.push(performance.now() - linearStart);
  }

  const spatialAvg = average(spatialTimes);
  const linearAvg = average(linearTimes);

  return {
    nodeCount: nodes.length,
    queryType: 'point',
    spatial: {
      avgDuration: spatialAvg,
      minDuration: Math.min(...spatialTimes),
      maxDuration: Math.max(...spatialTimes),
      iterations,
    },
    linear: {
      avgDuration: linearAvg,
      minDuration: Math.min(...linearTimes),
      maxDuration: Math.max(...linearTimes),
      iterations,
    },
    speedup: linearAvg / spatialAvg,
    timestamp: Date.now(),
  };
}

/**
 * Benchmark radius query performance
 */
export function benchmarkRadiusQuery(
  nodes: GraphNode[],
  iterations: number = 100,
  radius: number = 100
): BenchmarkResult {
  const spatialIndex = new SpatialIndex();
  spatialIndex.buildIndex(nodes);

  const bounds = calculateBounds(nodes);
  const spatialTimes: number[] = [];
  const linearTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Random center point
    const center: Point = {
      x: bounds.x + Math.random() * bounds.width,
      y: bounds.y + Math.random() * bounds.height,
    };

    // Spatial query
    const spatialStart = performance.now();
    spatialIndex.findNodesInRadius(center, radius);
    spatialTimes.push(performance.now() - spatialStart);

    // Linear query
    const linearStart = performance.now();
    findNodesInRadiusLinear(nodes, center, radius);
    linearTimes.push(performance.now() - linearStart);
  }

  const spatialAvg = average(spatialTimes);
  const linearAvg = average(linearTimes);

  return {
    nodeCount: nodes.length,
    queryType: 'radius',
    spatial: {
      avgDuration: spatialAvg,
      minDuration: Math.min(...spatialTimes),
      maxDuration: Math.max(...spatialTimes),
      iterations,
    },
    linear: {
      avgDuration: linearAvg,
      minDuration: Math.min(...linearTimes),
      maxDuration: Math.max(...linearTimes),
      iterations,
    },
    speedup: linearAvg / spatialAvg,
    timestamp: Date.now(),
  };
}

/**
 * Benchmark rectangle query performance
 */
export function benchmarkRectangleQuery(
  nodes: GraphNode[],
  iterations: number = 100,
  rectSize: { width: number; height: number } = { width: 200, height: 200 }
): BenchmarkResult {
  const spatialIndex = new SpatialIndex();
  spatialIndex.buildIndex(nodes);

  const bounds = calculateBounds(nodes);
  const spatialTimes: number[] = [];
  const linearTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Random rectangle
    const rect: Bounds = {
      x: bounds.x + Math.random() * (bounds.width - rectSize.width),
      y: bounds.y + Math.random() * (bounds.height - rectSize.height),
      width: rectSize.width,
      height: rectSize.height,
    };

    // Spatial query
    const spatialStart = performance.now();
    spatialIndex.findNodesInRectangle(rect);
    spatialTimes.push(performance.now() - spatialStart);

    // Linear query
    const linearStart = performance.now();
    findNodesInRectangleLinear(nodes, rect);
    linearTimes.push(performance.now() - linearStart);
  }

  const spatialAvg = average(spatialTimes);
  const linearAvg = average(linearTimes);

  return {
    nodeCount: nodes.length,
    queryType: 'rectangle',
    spatial: {
      avgDuration: spatialAvg,
      minDuration: Math.min(...spatialTimes),
      maxDuration: Math.max(...spatialTimes),
      iterations,
    },
    linear: {
      avgDuration: linearAvg,
      minDuration: Math.min(...linearTimes),
      maxDuration: Math.max(...linearTimes),
      iterations,
    },
    speedup: linearAvg / spatialAvg,
    timestamp: Date.now(),
  };
}

/**
 * Run comprehensive benchmark across multiple node counts
 */
export function runComprehensiveBenchmark(
  nodeCounts: number[] = [50, 100, 200, 500, 1000, 2000, 5000],
  iterations: number = 100
): ComprehensiveBenchmarkResults {
  const pointResults: BenchmarkResult[] = [];
  const radiusResults: BenchmarkResult[] = [];
  const rectangleResults: BenchmarkResult[] = [];
  const buildTimes: Array<{ nodeCount: number; duration: number }> = [];

  console.log('Starting comprehensive spatial index benchmark...');

  for (const nodeCount of nodeCounts) {
    console.log(`Benchmarking with ${nodeCount} nodes...`);

    // Generate test data
    const nodes = generateTestNodes(nodeCount);

    // Benchmark index build time
    const spatialIndex = new SpatialIndex();
    const buildStart = performance.now();
    spatialIndex.buildIndex(nodes);
    const buildDuration = performance.now() - buildStart;
    buildTimes.push({ nodeCount, duration: buildDuration });

    // Benchmark queries
    pointResults.push(benchmarkPointQuery(nodes, iterations));
    radiusResults.push(benchmarkRadiusQuery(nodes, iterations));
    rectangleResults.push(benchmarkRectangleQuery(nodes, iterations));
  }

  // Calculate summary statistics
  const avgSpeedupPoint = average(pointResults.map(r => r.speedup));
  const avgSpeedupRadius = average(radiusResults.map(r => r.speedup));
  const avgSpeedupRectangle = average(rectangleResults.map(r => r.speedup));

  // Find minimum node count where spatial index provides 2x speedup
  const recommendedMinNodes = findRecommendedMinNodes(pointResults, 2.0);

  console.log('Benchmark complete!');
  console.log(`Average speedups - Point: ${avgSpeedupPoint.toFixed(2)}x, Radius: ${avgSpeedupRadius.toFixed(2)}x, Rectangle: ${avgSpeedupRectangle.toFixed(2)}x`);
  console.log(`Recommended minimum nodes for spatial index: ${recommendedMinNodes}`);

  return {
    nodeCounts,
    pointQuery: pointResults,
    radiusQuery: radiusResults,
    rectangleQuery: rectangleResults,
    buildIndexTimes: buildTimes,
    summary: {
      avgSpeedupPoint,
      avgSpeedupRadius,
      avgSpeedupRectangle,
      recommendedMinNodes,
    },
  };
}

/**
 * Print benchmark results to console in a readable format
 */
export function printBenchmarkResults(results: ComprehensiveBenchmarkResults): void {
  console.log('\n=== Spatial Index Performance Benchmark Results ===\n');

  console.log('Node Count | Build (ms) | Point (ms) | Speedup | Radius (ms) | Speedup | Rect (ms) | Speedup');
  console.log('-'.repeat(100));

  for (let i = 0; i < results.nodeCounts.length; i++) {
    const nodeCount = results.nodeCounts[i];
    const buildTime = results.buildIndexTimes[i].duration.toFixed(2);
    const pointSpatial = results.pointQuery[i].spatial.avgDuration.toFixed(3);
    const pointSpeedup = results.pointQuery[i].speedup.toFixed(1);
    const radiusSpatial = results.radiusQuery[i].spatial.avgDuration.toFixed(3);
    const radiusSpeedup = results.radiusQuery[i].speedup.toFixed(1);
    const rectSpatial = results.rectangleQuery[i].spatial.avgDuration.toFixed(3);
    const rectSpeedup = results.rectangleQuery[i].speedup.toFixed(1);

    console.log(
      `${nodeCount.toString().padStart(10)} | ${buildTime.padStart(10)} | ${pointSpatial.padStart(10)} | ${pointSpeedup.padStart(7)}x | ${radiusSpatial.padStart(11)} | ${radiusSpeedup.padStart(7)}x | ${rectSpatial.padStart(9)} | ${rectSpeedup.padStart(7)}x`
    );
  }

  console.log('\n=== Summary ===');
  console.log(`Average Point Query Speedup: ${results.summary.avgSpeedupPoint.toFixed(2)}x`);
  console.log(`Average Radius Query Speedup: ${results.summary.avgSpeedupRadius.toFixed(2)}x`);
  console.log(`Average Rectangle Query Speedup: ${results.summary.avgSpeedupRectangle.toFixed(2)}x`);
  console.log(`Recommended Minimum Nodes: ${results.summary.recommendedMinNodes}`);
  console.log('\n');
}

/**
 * Export benchmark results as CSV
 */
export function exportBenchmarkAsCSV(results: ComprehensiveBenchmarkResults): string {
  const headers = [
    'NodeCount',
    'BuildTime_ms',
    'Point_Spatial_ms',
    'Point_Linear_ms',
    'Point_Speedup',
    'Radius_Spatial_ms',
    'Radius_Linear_ms',
    'Radius_Speedup',
    'Rectangle_Spatial_ms',
    'Rectangle_Linear_ms',
    'Rectangle_Speedup',
  ];

  const rows = results.nodeCounts.map((nodeCount, i) => [
    nodeCount,
    results.buildIndexTimes[i].duration.toFixed(2),
    results.pointQuery[i].spatial.avgDuration.toFixed(3),
    results.pointQuery[i].linear.avgDuration.toFixed(3),
    results.pointQuery[i].speedup.toFixed(2),
    results.radiusQuery[i].spatial.avgDuration.toFixed(3),
    results.radiusQuery[i].linear.avgDuration.toFixed(3),
    results.radiusQuery[i].speedup.toFixed(2),
    results.rectangleQuery[i].spatial.avgDuration.toFixed(3),
    results.rectangleQuery[i].linear.avgDuration.toFixed(3),
    results.rectangleQuery[i].speedup.toFixed(2),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// === Helper Functions ===

function calculateBounds(nodes: GraphNode[]): Bounds {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 1000, height: 1000 };
  }

  const positions = nodes
    .filter(node => typeof node.x === 'number' && typeof node.y === 'number')
    .map(node => ({ x: node.x!, y: node.y! }));

  if (positions.length === 0) {
    return { x: 0, y: 0, width: 1000, height: 1000 };
  }

  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function average(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function findRecommendedMinNodes(results: BenchmarkResult[], targetSpeedup: number): number {
  for (const result of results) {
    if (result.speedup >= targetSpeedup) {
      return result.nodeCount;
    }
  }
  return results[results.length - 1]?.nodeCount || 100;
}

// Linear search implementations for benchmarking

function findNodeAtPointLinear(nodes: GraphNode[], point: Point, maxRadius: number): GraphNode | null {
  let closestNode: GraphNode | null = null;
  let closestDistance = maxRadius;

  for (const node of nodes) {
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
}

function findNodesInRadiusLinear(nodes: GraphNode[], center: Point, radius: number): GraphNode[] {
  const results: GraphNode[] = [];
  const radiusSquared = radius * radius;

  for (const node of nodes) {
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      const dx = node.x - center.x;
      const dy = node.y - center.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= radiusSquared) {
        results.push(node);
      }
    }
  }

  return results;
}

function findNodesInRectangleLinear(nodes: GraphNode[], bounds: Bounds): GraphNode[] {
  const results: GraphNode[] = [];
  const x1 = bounds.x;
  const y1 = bounds.y;
  const x2 = bounds.x + bounds.width;
  const y2 = bounds.y + bounds.height;

  for (const node of nodes) {
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      if (node.x >= x1 && node.x <= x2 && node.y >= y1 && node.y <= y2) {
        results.push(node);
      }
    }
  }

  return results;
}
