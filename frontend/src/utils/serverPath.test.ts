import { describe, expect, it } from 'vitest';
import type { ServerPathResult } from '../types/pathfinding';
import { adaptServerPath } from './serverPath';

const response: ServerPathResult = {
  success: true,
  path: [
    { track: { id: 'a', name: 'First', artist: 'Artist', duration_ms: 180000, camelot_key: '8A' },
      key_compatible: true, cumulative_duration_ms: 180000 },
    { track: { id: 'b', name: 'Second', artist: 'Artist', duration_ms: 240000 },
      connection_strength: 0.8, key_compatible: true, cumulative_duration_ms: 420000 },
  ],
  total_duration_ms: 420000, target_duration_ms: 420000, duration_difference_ms: 0,
  waypoints_visited: ['b'], waypoints_missed: ['missing'],
  average_connection_strength: 0.8, key_compatibility_score: 1, message: 'Found',
};

describe('REST path adapter', () => {
  it('preserves route order, units, identities and waypoint highlights', () => {
    const path = adaptServerPath(response);
    expect(path.path.map(node => node.track.id)).toEqual(['a', 'b']);
    expect(path.totalDuration).toBe(420);
    expect(path.path[0].track.duration).toBe(180);
    expect(path.path[0].track.camelotKey).toBe('8A');
    expect(path.path[0].parentId).toBeNull();
    expect(path.path[1]).toMatchObject({ parentId: 'a', isWaypoint: true, cumulativeWeight: 0.8 });
    expect(path.waypointsIncluded).toEqual(['b']);
    expect(path.waypointsSkipped).toEqual(['missing']);
    expect(path.metadata.searchTime).toBeUndefined();
    expect(response.path[0].track.duration_ms).toBe(180000);
  });

  it('retains unsuccessful results without manufacturing a route', () => {
    const result = adaptServerPath({ ...response, success: false, path: [], total_duration_ms: 0,
      waypoints_visited: [], waypoints_missed: ['b'], average_connection_strength: 0 });
    expect(result.success).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.totalWeight).toBe(0);
    expect(result.waypointsSkipped).toEqual(['b']);
  });
});
