import { describe, expect, it } from 'vitest';
import type { GraphData, GraphEdge, GraphNode } from '../types';
import { DEFAULT_CONSTRAINTS } from '../types/pathfinding';
import { findDJPath, PriorityQueue } from './pathfinding';

const node = (id: string, artist?: string): GraphNode =>
  ({ id, title: `Track ${id}`, label: `Track ${id}`, artist, bpm: 128, x: 0, y: 0 } as unknown as GraphNode);
const edge = (source: string, target: string): GraphEdge =>
  ({ id: `${source}-${target}`, source, target, weight: 1, type: 'adjacency' });
const options = (startTrackId: string, endTrackId: string) =>
  ({ startTrackId, endTrackId, waypoints: new Set<string>() });

const ids = (result: { path: Array<{ id: string }> }) => result.path.map((step) => step.id);

describe('findDJPath routes', () => {
  it('finds a direct route between two linked tracks', async () => {
    const graph: GraphData = { nodes: [node('a', 'Deadmau5'), node('b', 'Eric Prydz')], edges: [edge('a', 'b')] };
    const result = await findDJPath(graph, options('a', 'b'), DEFAULT_CONSTRAINTS.flexible);
    expect(result.success).toBe(true);
    expect(ids(result)).toEqual(['a', 'b']);
    expect(result.path[0].distanceFromStart).toBe(0);
    expect(Number.isFinite(result.totalWeight)).toBe(true);
  });

  it('finds a three-track chain A to B to C', async () => {
    const graph: GraphData = {
      nodes: [node('a', 'Deadmau5'), node('b', 'Eric Prydz'), node('c', 'Lane 8')],
      edges: [edge('a', 'b'), edge('b', 'c')],
    };
    const result = await findDJPath(graph, options('a', 'c'), DEFAULT_CONSTRAINTS.flexible);
    expect(result.success).toBe(true);
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });

  it('routes through the middle track when start and end are not linked', async () => {
    const graph: GraphData = {
      nodes: [node('a', 'Deadmau5'), node('m', 'Eric Prydz'), node('z', 'Lane 8'), node('x', 'Kaskade')],
      edges: [edge('a', 'm'), edge('m', 'z'), edge('a', 'x')],
    };
    const result = await findDJPath(graph, options('a', 'z'), DEFAULT_CONSTRAINTS.flexible);
    expect(result.success).toBe(true);
    expect(ids(result)).toEqual(['a', 'm', 'z']);
    expect(result.metadata.nodesExplored).toBeGreaterThan(1);
  });

  it('reports no route when the end track cannot be reached', async () => {
    const graph: GraphData = { nodes: [node('a', 'Deadmau5'), node('b', 'Eric Prydz')], edges: [] };
    const result = await findDJPath(graph, options('a', 'b'), DEFAULT_CONSTRAINTS.flexible);
    expect(result.success).toBe(false);
    expect(result.totalWeight).toBe(Infinity);
  });
});

// Path reconstruction always starts from the end track, so these tests read
// the end of result.path to see whether a track was kept or left out.
describe('findDJPath artist attribution', () => {
  it('keeps a track with a valid artist', async () => {
    const graph: GraphData = { nodes: [node('a', 'Deadmau5'), node('b', 'Eric Prydz')], edges: [edge('a', 'b')] };
    const result = await findDJPath(graph, options('a', 'b'), DEFAULT_CONSTRAINTS.flexible);
    expect(result.path.at(-1)?.track.artist).toBe('Eric Prydz');
  });

  it.each([undefined, '', 'Unknown Artist', 'Various Artists'])(
    'leaves out a track whose artist is %j instead of inventing one',
    async (artist) => {
      const graph: GraphData = { nodes: [node('a', 'Deadmau5'), node('b', artist)], edges: [edge('a', 'b')] };
      const result = await findDJPath(graph, options('a', 'b'), DEFAULT_CONSTRAINTS.flexible);
      expect(result.success).toBe(false);
      expect(result.path).toEqual([]);
    },
  );

  it('never routes through a track without a valid artist', async () => {
    const graph: GraphData = {
      nodes: [node('a', 'Deadmau5'), node('x', 'Unknown Artist'), node('c', 'Lane 8')],
      edges: [edge('a', 'x'), edge('x', 'c')],
    };
    const result = await findDJPath(graph, options('a', 'c'), DEFAULT_CONSTRAINTS.flexible);
    expect(result.success).toBe(false);
    expect(ids(result)).not.toContain('x');
  });

  it('takes the attributed detour instead of an artist-less shortcut', async () => {
    const graph: GraphData = {
      nodes: [node('a', 'Deadmau5'), node('x'), node('b', 'Eric Prydz'), node('c', 'Lane 8')],
      edges: [edge('a', 'x'), edge('x', 'c'), edge('a', 'b'), edge('b', 'c')],
    };
    const result = await findDJPath(graph, options('a', 'c'), DEFAULT_CONSTRAINTS.flexible);
    expect(result.success).toBe(true);
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });
});

describe('PriorityQueue min-heap', () => {
  it('dequeues elements in ascending priority order', () => {
    const pq = new PriorityQueue<string>();
    expect(pq.isEmpty()).toBe(true);
    expect(pq.size()).toBe(0);
    expect(pq.dequeue()).toBeNull();

    pq.enqueue('c', 30);
    pq.enqueue('a', 10);
    pq.enqueue('b', 20);
    pq.enqueue('z', 5);

    expect(pq.size()).toBe(4);
    expect(pq.isEmpty()).toBe(false);

    expect(pq.dequeue()).toBe('z');
    expect(pq.dequeue()).toBe('a');
    expect(pq.dequeue()).toBe('b');
    expect(pq.dequeue()).toBe('c');
    expect(pq.dequeue()).toBeNull();
    expect(pq.isEmpty()).toBe(true);
  });

  it('correctly handles duplicate priorities', () => {
    const pq = new PriorityQueue<string>();
    pq.enqueue('first_equal', 5);
    pq.enqueue('second_equal', 5);
    pq.enqueue('lower', 2);
    pq.enqueue('higher', 10);

    expect(pq.dequeue()).toBe('lower');
    const equal1 = pq.dequeue();
    const equal2 = pq.dequeue();
    expect([equal1, equal2].sort()).toEqual(['first_equal', 'second_equal']);
    expect(pq.dequeue()).toBe('higher');
    expect(pq.dequeue()).toBeNull();
  });
});
