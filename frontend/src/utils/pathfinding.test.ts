import { describe, expect, it } from 'vitest';
import type { GraphData, GraphEdge, GraphNode } from '../types';
import { DEFAULT_CONSTRAINTS } from '../types/pathfinding';
import { findDJPath } from './pathfinding';

const node = (id: string, artist?: string): GraphNode =>
  ({ id, title: `Track ${id}`, label: `Track ${id}`, artist, bpm: 128, x: 0, y: 0 } as unknown as GraphNode);
const edge = (source: string, target: string): GraphEdge =>
  ({ id: `${source}-${target}`, source, target, weight: 1, type: 'adjacency' });
const options = (startTrackId: string, endTrackId: string) =>
  ({ startTrackId, endTrackId, waypoints: new Set<string>() });

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
});
