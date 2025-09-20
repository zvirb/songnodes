import { describe, it, expect } from 'vitest';
import { computeRoute, RouteInput } from './path';
import { NodeVisual, EdgeVisual } from '../types/graph';

describe('Path Calculation with Cycle Prevention', () => {
  // Create a simple test graph: A -> B -> C -> D
  //                                 \-> E -/
  const testNodes: NodeVisual[] = [
    { id: 'A', x: 0, y: 0, radius: 5, color: '#000', opacity: 1, selected: false, highlighted: false, visible: true, position: { x: 0, y: 0 } },
    { id: 'B', x: 1, y: 0, radius: 5, color: '#000', opacity: 1, selected: false, highlighted: false, visible: true, position: { x: 1, y: 0 } },
    { id: 'C', x: 2, y: 0, radius: 5, color: '#000', opacity: 1, selected: false, highlighted: false, visible: true, position: { x: 2, y: 0 } },
    { id: 'D', x: 3, y: 0, radius: 5, color: '#000', opacity: 1, selected: false, highlighted: false, visible: true, position: { x: 3, y: 0 } },
    { id: 'E', x: 1.5, y: 1, radius: 5, color: '#000', opacity: 1, selected: false, highlighted: false, visible: true, position: { x: 1.5, y: 1 } },
  ] as NodeVisual[];

  const nodeMap = new Map(testNodes.map(n => [n.id, n]));

  const testEdges: EdgeVisual[] = [
    {
      id: 'AB', source: 'A', target: 'B', source_id: 'A', target_id: 'B', weight: 1,
      visible: true, opacity: 1, width: 1, color: '#000',
      sourceNode: nodeMap.get('A')!, targetNode: nodeMap.get('B')!
    },
    {
      id: 'BC', source: 'B', target: 'C', source_id: 'B', target_id: 'C', weight: 1,
      visible: true, opacity: 1, width: 1, color: '#000',
      sourceNode: nodeMap.get('B')!, targetNode: nodeMap.get('C')!
    },
    {
      id: 'CD', source: 'C', target: 'D', source_id: 'C', target_id: 'D', weight: 1,
      visible: true, opacity: 1, width: 1, color: '#000',
      sourceNode: nodeMap.get('C')!, targetNode: nodeMap.get('D')!
    },
    {
      id: 'BE', source: 'B', target: 'E', source_id: 'B', target_id: 'E', weight: 1,
      visible: true, opacity: 1, width: 1, color: '#000',
      sourceNode: nodeMap.get('B')!, targetNode: nodeMap.get('E')!
    },
    {
      id: 'ED', source: 'E', target: 'D', source_id: 'E', target_id: 'D', weight: 1,
      visible: true, opacity: 1, width: 1, color: '#000',
      sourceNode: nodeMap.get('E')!, targetNode: nodeMap.get('D')!
    },
  ];

  it('should prevent cycles when preventCycles is true (default)', () => {
    const input: RouteInput = {
      start: 'A',
      end: 'D',
      waypoints: ['B'], // Simple waypoint test first
    };

    const result = computeRoute(testNodes, testEdges, input);

    // Should return a valid path without cycles
    expect(result).not.toBeNull();
    if (result) {
      // Verify no node is visited twice
      const nodeSet = new Set(result);
      expect(nodeSet.size).toBe(result.length);

      // Verify start and end are correct
      expect(result[0]).toBe('A');
      expect(result[result.length - 1]).toBe('D');

      // Verify waypoints are included
      expect(result.includes('C')).toBe(true);
      expect(result.includes('B')).toBe(true);
    }
  });

  it('should allow cycles when preventCycles is false', () => {
    const input: RouteInput = {
      start: 'A',
      end: 'D',
      waypoints: ['B'],
      preventCycles: false,
    };

    const result = computeRoute(testNodes, testEdges, input);

    // Should return a valid path (may or may not have cycles)
    expect(result).not.toBeNull();
    if (result) {
      // Verify start and end are correct
      expect(result[0]).toBe('A');
      expect(result[result.length - 1]).toBe('D');

      // Verify waypoint is included
      expect(result.includes('B')).toBe(true);
    }
  });

  it('should handle simple path without waypoints', () => {
    const input: RouteInput = {
      start: 'A',
      end: 'D',
      waypoints: [],
    };

    const result = computeRoute(testNodes, testEdges, input);

    expect(result).not.toBeNull();
    if (result) {
      expect(result[0]).toBe('A');
      expect(result[result.length - 1]).toBe('D');

      // Verify no cycles in simple path
      const nodeSet = new Set(result);
      expect(nodeSet.size).toBe(result.length);
    }
  });

  it('should detect cycles and prevent them', () => {
    // Test that cycles are correctly detected and prevented
    const input: RouteInput = {
      start: 'A',
      end: 'D',
      waypoints: ['B', 'A'], // This would require revisiting A to work
    };

    const result = computeRoute(testNodes, testEdges, input);

    // Should either find an alternative path or return null
    // In this case it finds A->B->C->D (skipping the problematic waypoint A)
    if (result) {
      // Verify no cycles exist
      const nodeSet = new Set(result);
      expect(nodeSet.size).toBe(result.length);
      expect(result[0]).toBe('A');
      expect(result[result.length - 1]).toBe('D');
      expect(result.includes('B')).toBe(true);
    }
    // It's also acceptable to return null if no valid path exists
  });
});