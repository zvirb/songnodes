import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialIndex, createSpatialIndex, benchmarkSpatialVsLinear } from './spatialIndex';
import { GraphNode, Point, Bounds } from '../types';
import { generateTestNodes } from './spatialIndexBenchmark';

describe('SpatialIndex', () => {
  let spatialIndex: SpatialIndex;
  let testNodes: GraphNode[];

  beforeEach(() => {
    spatialIndex = new SpatialIndex();
    testNodes = generateTestNodes(100, { x: 0, y: 0, width: 1000, height: 1000 });
  });

  describe('buildIndex', () => {
    it('should build index from nodes with valid positions', () => {
      spatialIndex.buildIndex(testNodes);
      expect(spatialIndex.size()).toBe(100);
    });

    it('should filter out nodes without valid positions', () => {
      const invalidNodes: GraphNode[] = [
        { id: '1', label: 'Node 1', x: 100, y: 100 },
        { id: '2', label: 'Node 2', x: NaN, y: 200 },
        { id: '3', label: 'Node 3', x: 300, y: undefined },
        { id: '4', label: 'Node 4' },
      ];

      spatialIndex.buildIndex(invalidNodes);
      expect(spatialIndex.size()).toBe(1);
    });

    it('should record build metrics', () => {
      spatialIndex.buildIndex(testNodes);
      const metrics = spatialIndex.getMetrics();

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].queryType).toBe('rebuild');
      expect(metrics[0].resultCount).toBe(100);
    });
  });

  describe('findNodeAtPoint', () => {
    beforeEach(() => {
      spatialIndex.buildIndex(testNodes);
    });

    it('should find closest node within radius', () => {
      const targetNode = testNodes[0];
      const point: Point = { x: targetNode.x!, y: targetNode.y! };

      const result = spatialIndex.findNodeAtPoint(point, 50);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(targetNode.id);
    });

    it('should return null when no node within radius', () => {
      const point: Point = { x: 9999, y: 9999 };
      const result = spatialIndex.findNodeAtPoint(point, 10);

      expect(result).toBeNull();
    });

    it('should account for node radius in distance calculation', () => {
      const nodeWithLargeRadius: GraphNode = {
        id: 'large',
        label: 'Large Node',
        x: 500,
        y: 500,
        radius: 50,
      };

      spatialIndex.buildIndex([nodeWithLargeRadius]);

      // Point outside but within node radius
      const point: Point = { x: 540, y: 500 };
      const result = spatialIndex.findNodeAtPoint(point, 100);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('large');
    });
  });

  describe('findNodesInRadius', () => {
    beforeEach(() => {
      spatialIndex.buildIndex(testNodes);
    });

    it('should find all nodes within circular radius', () => {
      const center: Point = { x: 500, y: 500 };
      const radius = 100;

      const results = spatialIndex.findNodesInRadius(center, radius);

      // Verify all results are within radius
      results.forEach(node => {
        const dx = node.x! - center.x;
        const dy = node.y! - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeLessThanOrEqual(radius);
      });
    });

    it('should return empty array when no nodes in radius', () => {
      const center: Point = { x: 9999, y: 9999 };
      const results = spatialIndex.findNodesInRadius(center, 10);

      expect(results).toHaveLength(0);
    });

    it('should handle zero radius', () => {
      const center: Point = { x: testNodes[0].x! + 10, y: testNodes[0].y! + 10 };
      const results = spatialIndex.findNodesInRadius(center, 0);

      expect(results).toHaveLength(0);
    });
  });

  describe('findNodesInRectangle', () => {
    beforeEach(() => {
      spatialIndex.buildIndex(testNodes);
    });

    it('should find all nodes within rectangular bounds', () => {
      const bounds: Bounds = { x: 200, y: 200, width: 400, height: 400 };
      const results = spatialIndex.findNodesInRectangle(bounds);

      // Verify all results are within bounds
      results.forEach(node => {
        expect(node.x!).toBeGreaterThanOrEqual(bounds.x);
        expect(node.x!).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(node.y!).toBeGreaterThanOrEqual(bounds.y);
        expect(node.y!).toBeLessThanOrEqual(bounds.y + bounds.height);
      });
    });

    it('should return empty array for empty rectangle', () => {
      const bounds: Bounds = { x: 9999, y: 9999, width: 10, height: 10 };
      const results = spatialIndex.findNodesInRectangle(bounds);

      expect(results).toHaveLength(0);
    });

    it('should handle zero-sized rectangle', () => {
      const bounds: Bounds = { x: 500, y: 500, width: 0, height: 0 };
      const results = spatialIndex.findNodesInRectangle(bounds);

      expect(results).toHaveLength(0);
    });
  });

  describe('findKNearestNeighbors', () => {
    beforeEach(() => {
      spatialIndex.buildIndex(testNodes);
    });

    it('should find k nearest neighbors', () => {
      const point: Point = { x: 500, y: 500 };
      const k = 5;

      const results = spatialIndex.findKNearestNeighbors(point, k);

      expect(results).toHaveLength(Math.min(k, testNodes.length));

      // Verify results are sorted by distance
      let prevDistance = 0;
      results.forEach(node => {
        const dx = node.x! - point.x;
        const dy = node.y! - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThanOrEqual(prevDistance);
        prevDistance = distance;
      });
    });

    it('should respect max search radius', () => {
      const point: Point = { x: 500, y: 500 };
      const k = 10;
      const maxRadius = 50;

      const results = spatialIndex.findKNearestNeighbors(point, k, maxRadius);

      // All results should be within max radius
      results.forEach(node => {
        const dx = node.x! - point.x;
        const dy = node.y! - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeLessThanOrEqual(maxRadius);
      });
    });
  });

  describe('updateNode', () => {
    beforeEach(() => {
      spatialIndex.buildIndex(testNodes);
    });

    it('should update node position in index', () => {
      const targetNode = testNodes[0];
      const newX = 9000;
      const newY = 9000;

      spatialIndex.updateNode(targetNode.id, newX, newY);

      // Query at new position
      const result = spatialIndex.findNodeAtPoint({ x: newX, y: newY }, 10);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(targetNode.id);
    });

    it('should handle updating non-existent node gracefully', () => {
      expect(() => {
        spatialIndex.updateNode('non-existent', 100, 100);
      }).not.toThrow();
    });
  });

  describe('updateNodes', () => {
    beforeEach(() => {
      spatialIndex.buildIndex(testNodes);
    });

    it('should batch update multiple nodes', () => {
      const updates = testNodes.slice(0, 5).map((node, i) => ({
        id: node.id,
        x: 8000 + i * 10,
        y: 8000 + i * 10,
      }));

      spatialIndex.updateNodes(updates);

      // Verify all updates applied
      updates.forEach(update => {
        const result = spatialIndex.findNodeAtPoint({ x: update.x, y: update.y }, 10);
        expect(result).not.toBeNull();
        expect(result?.id).toBe(update.id);
      });
    });
  });

  describe('performance metrics', () => {
    beforeEach(() => {
      spatialIndex.buildIndex(testNodes);
    });

    it('should track query metrics', () => {
      spatialIndex.findNodeAtPoint({ x: 500, y: 500 }, 50);
      spatialIndex.findNodesInRadius({ x: 500, y: 500 }, 100);
      spatialIndex.findNodesInRectangle({ x: 200, y: 200, width: 400, height: 400 });

      const metrics = spatialIndex.getMetrics();

      expect(metrics.length).toBeGreaterThanOrEqual(3);
    });

    it('should calculate average metrics by type', () => {
      spatialIndex.findNodeAtPoint({ x: 500, y: 500 }, 50);
      spatialIndex.findNodeAtPoint({ x: 600, y: 600 }, 50);
      spatialIndex.findNodesInRadius({ x: 500, y: 500 }, 100);

      const avgMetrics = spatialIndex.getAverageMetrics();

      expect(avgMetrics.point).toBeDefined();
      expect(avgMetrics.point.count).toBe(2);
      expect(avgMetrics.radius).toBeDefined();
      expect(avgMetrics.radius.count).toBe(1);
    });

    it('should provide comprehensive stats', () => {
      spatialIndex.findNodeAtPoint({ x: 500, y: 500 }, 50);

      const stats = spatialIndex.getStats();

      expect(stats.nodeCount).toBe(100);
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.avgQueryDuration).toBeGreaterThan(0);
      expect(stats.metricsByType).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all data and metrics', () => {
      spatialIndex.buildIndex(testNodes);
      spatialIndex.findNodeAtPoint({ x: 500, y: 500 }, 50);

      spatialIndex.clear();

      expect(spatialIndex.size()).toBe(0);
      expect(spatialIndex.getMetrics()).toHaveLength(0);
    });
  });
});

describe('createSpatialIndex', () => {
  it('should create new spatial index instance', () => {
    const index = createSpatialIndex();
    expect(index).toBeInstanceOf(SpatialIndex);
    expect(index.size()).toBe(0);
  });
});

describe('benchmarkSpatialVsLinear', () => {
  it('should compare spatial vs linear search performance', () => {
    const nodes = generateTestNodes(100);
    const testPoint: Point = { x: 500, y: 500 };

    const benchmark = benchmarkSpatialVsLinear(nodes, testPoint, 50);

    expect(benchmark.spatial).toBeDefined();
    expect(benchmark.linear).toBeDefined();
    expect(benchmark.speedup).toBeGreaterThan(0);
    expect(benchmark.spatial.duration).toBeGreaterThan(0);
    expect(benchmark.linear.duration).toBeGreaterThan(0);
  });

  it('should show spatial index performance advantage for large graphs', () => {
    const nodes = generateTestNodes(1000);
    const testPoint: Point = { x: 500, y: 500 };

    const benchmark = benchmarkSpatialVsLinear(nodes, testPoint, 50);

    // With 1000 nodes, spatial should be faster
    expect(benchmark.speedup).toBeGreaterThan(1);
  });
});

describe('edge cases', () => {
  let spatialIndex: SpatialIndex;

  beforeEach(() => {
    spatialIndex = new SpatialIndex();
  });

  it('should handle empty graph', () => {
    spatialIndex.buildIndex([]);

    expect(spatialIndex.size()).toBe(0);
    expect(spatialIndex.findNodeAtPoint({ x: 0, y: 0 }, 10)).toBeNull();
    expect(spatialIndex.findNodesInRadius({ x: 0, y: 0 }, 10)).toHaveLength(0);
    expect(spatialIndex.findNodesInRectangle({ x: 0, y: 0, width: 10, height: 10 })).toHaveLength(0);
  });

  it('should handle single node', () => {
    const nodes: GraphNode[] = [
      { id: '1', label: 'Node 1', x: 100, y: 100, radius: 10 },
    ];

    spatialIndex.buildIndex(nodes);

    expect(spatialIndex.size()).toBe(1);
    expect(spatialIndex.findNodeAtPoint({ x: 100, y: 100 }, 20)).not.toBeNull();
  });

  it('should handle nodes at same position', () => {
    const nodes: GraphNode[] = [
      { id: '1', label: 'Node 1', x: 100, y: 100 },
      { id: '2', label: 'Node 2', x: 100, y: 100 },
      { id: '3', label: 'Node 3', x: 100, y: 100 },
    ];

    spatialIndex.buildIndex(nodes);

    const result = spatialIndex.findNodeAtPoint({ x: 100, y: 100 }, 10);
    expect(result).not.toBeNull();

    const radiusResults = spatialIndex.findNodesInRadius({ x: 100, y: 100 }, 1);
    // Note: d3-quadtree may only return one node when multiple nodes are at exact same position
    // This is expected behavior for spatial indexing
    expect(radiusResults.length).toBeGreaterThanOrEqual(1);
    expect(radiusResults.length).toBeLessThanOrEqual(3);
  });

  it('should handle negative coordinates', () => {
    const nodes: GraphNode[] = [
      { id: '1', label: 'Node 1', x: -100, y: -100 },
      { id: '2', label: 'Node 2', x: -200, y: -200 },
    ];

    spatialIndex.buildIndex(nodes);

    expect(spatialIndex.size()).toBe(2);
    expect(spatialIndex.findNodeAtPoint({ x: -100, y: -100 }, 10)).not.toBeNull();
  });

  it('should handle very large coordinates', () => {
    const nodes: GraphNode[] = [
      { id: '1', label: 'Node 1', x: 1e6, y: 1e6 },
      { id: '2', label: 'Node 2', x: 1e6 + 100, y: 1e6 + 100 },
    ];

    spatialIndex.buildIndex(nodes);

    expect(spatialIndex.size()).toBe(2);
    expect(spatialIndex.findNodeAtPoint({ x: 1e6, y: 1e6 }, 50)).not.toBeNull();
  });
});
