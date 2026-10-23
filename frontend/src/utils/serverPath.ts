import type { PathResult, ServerPathResult } from '../types/pathfinding';

/** Convert the REST representation to the shared path used by graph highlighting. */
export function adaptServerPath(result: ServerPathResult): PathResult {
  let cumulativeWeight = 0;
  return {
    success: result.success,
    path: result.path.map((segment, index) => {
      cumulativeWeight += segment.connection_strength ?? 0;
      return {
        id: segment.track.id,
        track: {
          ...segment.track,
          duration: segment.track.duration_ms / 1000,
          camelotKey: segment.track.camelot_key,
        },
        position: index,
        isWaypoint: result.waypoints_visited.includes(segment.track.id),
        transitionScore: segment.connection_strength ?? 0,
        cumulativeWeight,
        parentId: index ? result.path[index - 1].track.id : null,
        distanceFromStart: cumulativeWeight,
      };
    }),
    totalWeight: result.path.reduce((sum, segment) => sum + (segment.connection_strength ?? 0), 0),
    totalDuration: result.total_duration_ms / 1000,
    averageTransitionScore: result.average_connection_strength,
    // The server does not report these detailed analytics or search timings.
    keyTransitions: [],
    bpmTransitions: [],
    energyProfile: [],
    genreTransitions: [],
    waypointsIncluded: result.waypoints_visited,
    waypointsSkipped: result.waypoints_missed,
    metadata: { algorithmsUsed: ['server'], optimizationPasses: 0 },
  };
}
