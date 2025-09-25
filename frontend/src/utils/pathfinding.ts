import { GraphData, GraphNode, Track } from '../types';
import {
  PathOptions,
  PathResult,
  PathNode,
  PathEdgeWeight,
  PathConstraints,
  PathfindingAlgorithm,
} from '../types/pathfinding';
import { getHarmonicCompatibility, keyToCamelot } from './harmonic';

/**
 * Priority queue implementation for Dijkstra's algorithm
 */
class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    const element = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (element.priority < this.items[i].priority) {
        this.items.splice(i, 0, element);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(element);
    }
  }

  dequeue(): T | null {
    return this.items.shift()?.item || null;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}

/**
 * Calculate edge weight with DJ-specific constraints
 */
function calculateDJEdgeWeight(
  sourceTrack: Track,
  targetTrack: Track,
  baseWeight: number,
  constraints: PathConstraints
): PathEdgeWeight {
  const edgeWeight: PathEdgeWeight = {
    edgeId: `${sourceTrack.id}-${targetTrack.id}`,
    sourceId: sourceTrack.id,
    targetId: targetTrack.id,
    baseWeight,
    harmonic: 0,
    bpmCompatibility: 0,
    energyFlow: 0,
    genreCompatibility: 0,
    timeCompatibility: 0,
    totalWeight: baseWeight,
    factors: {
      harmonicWeight: constraints.harmonicCompatibility.weight,
      bpmWeight: constraints.bpmCompatibility.weight,
      energyWeight: constraints.energyFlow.weight,
      genreWeight: constraints.genreCompatibility.weight,
      timeWeight: constraints.timing.weight,
    },
  };

  // Harmonic compatibility
  if (constraints.harmonicCompatibility.enabled && sourceTrack.camelotKey && targetTrack.camelotKey) {
    const sourceCamelot = keyToCamelot(sourceTrack.camelotKey);
    const targetCamelot = keyToCamelot(targetTrack.camelotKey);

    if (sourceCamelot && targetCamelot) {
      edgeWeight.harmonic = getHarmonicCompatibility(sourceCamelot, targetCamelot);

      if (constraints.harmonicCompatibility.strictMode && edgeWeight.harmonic < 0.5) {
        // Penalize non-compatible keys heavily in strict mode
        edgeWeight.totalWeight *= 10;
      }
    }
  }

  // BPM compatibility
  if (constraints.bpmCompatibility.enabled && sourceTrack.bpm && targetTrack.bpm) {
    const bpmDiff = Math.abs(sourceTrack.bpm - targetTrack.bpm);

    if (bpmDiff <= constraints.bpmCompatibility.preferredChange) {
      edgeWeight.bpmCompatibility = 1.0;
    } else if (bpmDiff <= constraints.bpmCompatibility.maxChange) {
      edgeWeight.bpmCompatibility = 1.0 - (bpmDiff - constraints.bpmCompatibility.preferredChange) /
        (constraints.bpmCompatibility.maxChange - constraints.bpmCompatibility.preferredChange);
    } else {
      edgeWeight.bpmCompatibility = 0;
      edgeWeight.totalWeight *= 5; // Heavy penalty for exceeding max BPM change
    }

    // Consider acceleration/deceleration preferences
    const isAcceleration = targetTrack.bpm > sourceTrack.bpm;
    if (isAcceleration && !constraints.bpmCompatibility.allowAcceleration) {
      edgeWeight.bpmCompatibility *= 0.5;
    } else if (!isAcceleration && !constraints.bpmCompatibility.allowDeceleration) {
      edgeWeight.bpmCompatibility *= 0.5;
    }
  }

  // Energy flow compatibility
  if (constraints.energyFlow.enabled && sourceTrack.energy && targetTrack.energy) {
    const energyDiff = targetTrack.energy - sourceTrack.energy;
    const absEnergyDiff = Math.abs(energyDiff);

    if (absEnergyDiff <= constraints.energyFlow.preferredEnergyJump) {
      edgeWeight.energyFlow = 1.0;
    } else if (absEnergyDiff <= constraints.energyFlow.maxEnergyJump) {
      edgeWeight.energyFlow = 1.0 - (absEnergyDiff - constraints.energyFlow.preferredEnergyJump) /
        (constraints.energyFlow.maxEnergyJump - constraints.energyFlow.preferredEnergyJump);
    } else {
      edgeWeight.energyFlow = 0.1;
    }

    // Apply energy flow type preferences
    switch (constraints.energyFlow.flowType) {
      case 'ascending':
        if (energyDiff < 0) edgeWeight.energyFlow *= 0.3; // Penalize energy drops
        break;
      case 'descending':
        if (energyDiff > 0) edgeWeight.energyFlow *= 0.3; // Penalize energy increases
        break;
      case 'plateau':
        if (Math.abs(energyDiff) > 0.1) edgeWeight.energyFlow *= 0.5; // Prefer stable energy
        break;
      case 'wave':
        // Allow both increases and decreases, no penalty
        break;
      case 'any':
      default:
        // No specific energy flow preference
        break;
    }
  }

  // Genre compatibility
  if (constraints.genreCompatibility.enabled && sourceTrack.genre && targetTrack.genre) {
    if (sourceTrack.genre === targetTrack.genre) {
      edgeWeight.genreCompatibility = 1.0;
    } else if (constraints.genreCompatibility.genreTransitionMatrix) {
      const compatibility = constraints.genreCompatibility.genreTransitionMatrix[sourceTrack.genre]?.[targetTrack.genre];
      edgeWeight.genreCompatibility = compatibility || 0.5;
    } else {
      edgeWeight.genreCompatibility = 0.7; // Default moderate compatibility
    }

    if (constraints.genreCompatibility.strictMode && edgeWeight.genreCompatibility < 0.7) {
      edgeWeight.totalWeight *= 3; // Penalty for genre switches in strict mode
    }
  }

  // Time compatibility (track duration considerations)
  if (constraints.timing.enabled && sourceTrack.duration && targetTrack.duration) {
    const durationDiff = Math.abs(sourceTrack.duration - targetTrack.duration);
    const avgDuration = (sourceTrack.duration + targetTrack.duration) / 2;
    const durationDiffPercent = durationDiff / avgDuration;

    // Prefer tracks with similar durations for mixing
    if (durationDiffPercent <= 0.3) {
      edgeWeight.timeCompatibility = 1.0;
    } else if (durationDiffPercent <= 0.6) {
      edgeWeight.timeCompatibility = 0.7;
    } else {
      edgeWeight.timeCompatibility = 0.4;
    }

    // Apply duration constraints
    if (constraints.timing.minTrackDuration && targetTrack.duration < constraints.timing.minTrackDuration) {
      edgeWeight.timeCompatibility *= 0.5;
    }
    if (constraints.timing.maxTrackDuration && targetTrack.duration > constraints.timing.maxTrackDuration) {
      edgeWeight.timeCompatibility *= 0.5;
    }
  }

  // Calculate weighted total
  const weightedScore =
    (edgeWeight.harmonic * edgeWeight.factors.harmonicWeight) +
    (edgeWeight.bpmCompatibility * edgeWeight.factors.bpmWeight) +
    (edgeWeight.energyFlow * edgeWeight.factors.energyWeight) +
    (edgeWeight.genreCompatibility * edgeWeight.factors.genreWeight) +
    (edgeWeight.timeCompatibility * edgeWeight.factors.timeWeight);

  const totalFactorWeight = Object.values(edgeWeight.factors).reduce((sum, w) => sum + w, 0);
  const normalizedScore = totalFactorWeight > 0 ? weightedScore / totalFactorWeight : 0.5;

  // Apply score to edge weight (lower weight = better path)
  edgeWeight.totalWeight = baseWeight * (2.0 - normalizedScore);

  return edgeWeight;
}

/**
 * Dijkstra's algorithm implementation for DJ pathfinding
 */
export async function findDJPath(
  graphData: GraphData,
  options: PathOptions,
  constraints: PathConstraints,
  algorithm: PathfindingAlgorithm = { name: 'dijkstra', description: '', bestFor: [] }
): Promise<PathResult> {
  const startTime = Date.now();

  try {
    // Validate inputs
    const startNode = graphData.nodes.find(n => n.id === options.startTrackId);
    const endNode = graphData.nodes.find(n => n.id === options.endTrackId);

    if (!startNode || !endNode) {
      return {
        success: false,
        path: [],
        totalWeight: Infinity,
        totalDuration: 0,
        averageTransitionScore: 0,
        keyTransitions: [],
        bpmTransitions: [],
        energyProfile: [],
        genreTransitions: [],
        waypointsIncluded: [],
        waypointsSkipped: Array.from(options.waypoints),
        metadata: {
          searchTime: Date.now() - startTime,
          nodesExplored: 0,
          algorithmsUsed: [algorithm.name],
          optimizationPasses: 0,
        },
      };
    }

    // Create adjacency list with weighted edges
    const adjacencyList = new Map<string, Array<{ node: GraphNode; weight: PathEdgeWeight }>>();
    const trackMap = new Map<string, Track>();

    // Build track map
    graphData.nodes.forEach(node => {
      if (node.track) {
        trackMap.set(node.id, node.track);
        adjacencyList.set(node.id, []);
      }
    });

    // Build weighted adjacency list
    graphData.edges.forEach(edge => {
      const sourceTrack = trackMap.get(edge.source);
      const targetTrack = trackMap.get(edge.target);

      if (sourceTrack && targetTrack) {
        const weightData = calculateDJEdgeWeight(sourceTrack, targetTrack, edge.weight, constraints);

        adjacencyList.get(edge.source)?.push({
          node: graphData.nodes.find(n => n.id === edge.target)!,
          weight: weightData,
        });

        // Add reverse edge for undirected graph
        const reverseWeightData = calculateDJEdgeWeight(targetTrack, sourceTrack, edge.weight, constraints);
        adjacencyList.get(edge.target)?.push({
          node: graphData.nodes.find(n => n.id === edge.source)!,
          weight: reverseWeightData,
        });
      }
    });

    // Dijkstra's algorithm with waypoint support
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const visited = new Set<string>();
    const queue = new PriorityQueue<string>();

    // Initialize distances
    graphData.nodes.forEach(node => {
      distances.set(node.id, node.id === options.startTrackId ? 0 : Infinity);
      previous.set(node.id, null);
    });

    queue.enqueue(options.startTrackId, 0);
    let nodesExplored = 0;

    while (!queue.isEmpty()) {
      const currentId = queue.dequeue();
      if (!currentId || visited.has(currentId)) continue;

      visited.add(currentId);
      nodesExplored++;

      const currentDistance = distances.get(currentId) || Infinity;

      // Explore neighbors
      const neighbors = adjacencyList.get(currentId) || [];
      for (const neighbor of neighbors) {
        const neighborId = neighbor.node.id;
        if (visited.has(neighborId)) continue;

        const newDistance = currentDistance + neighbor.weight.totalWeight;
        const existingDistance = distances.get(neighborId) || Infinity;

        if (newDistance < existingDistance) {
          distances.set(neighborId, newDistance);
          previous.set(neighborId, currentId);
          queue.enqueue(neighborId, newDistance);
        }
      }

      // Early termination if we reached the end
      if (currentId === options.endTrackId) break;
    }

    // Reconstruct path
    const path: PathNode[] = [];
    let currentId: string | null = options.endTrackId;
    let position = 0;

    while (currentId) {
      const node = graphData.nodes.find(n => n.id === currentId);
      const track = trackMap.get(currentId);

      if (node && track) {
        const isWaypoint = options.waypoints.has(currentId);
        const distanceFromStart = distances.get(currentId) || 0;

        path.unshift({
          id: currentId,
          track,
          position,
          isWaypoint,
          transitionScore: 1.0, // Will be calculated based on transitions
          cumulativeWeight: distanceFromStart,
          parentId: previous.get(currentId) || null,
          distanceFromStart,
        });

        position++;
      }

      currentId = previous.get(currentId) || null;
    }

    // Calculate metrics
    const totalWeight = distances.get(options.endTrackId) || Infinity;
    const totalDuration = path.reduce((sum, node) => sum + (node.track.duration || 0), 0);

    // Analyze transitions
    const keyTransitions: PathResult['keyTransitions'] = [];
    const bpmTransitions: PathResult['bpmTransitions'] = [];
    const energyProfile: PathResult['energyProfile'] = [];
    const genreTransitions: PathResult['genreTransitions'] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const fromTrack = path[i].track;
      const toTrack = path[i + 1].track;

      // Key transitions
      if (fromTrack.camelotKey && toTrack.camelotKey) {
        const compatibility = getHarmonicCompatibility(
          keyToCamelot(fromTrack.camelotKey) || '1A',
          keyToCamelot(toTrack.camelotKey) || '1A'
        );

        keyTransitions.push({
          fromKey: fromTrack.camelotKey,
          toKey: toTrack.camelotKey,
          compatibility,
        });
      }

      // BPM transitions
      if (fromTrack.bpm && toTrack.bpm) {
        const change = toTrack.bpm - fromTrack.bpm;
        const changePercent = (change / fromTrack.bpm) * 100;

        bpmTransitions.push({
          fromBpm: fromTrack.bpm,
          toBpm: toTrack.bpm,
          change,
          changePercent,
        });
      }

      // Energy profile
      if (toTrack.energy !== undefined) {
        const energyChange = i > 0 && path[i - 1].track.energy !== undefined
          ? toTrack.energy - (path[i - 1].track.energy || 0)
          : 0;

        energyProfile.push({
          position: i + 1,
          energy: toTrack.energy,
          change: energyChange,
        });
      }

      // Genre transitions
      if (fromTrack.genre && toTrack.genre) {
        genreTransitions.push({
          fromGenre: fromTrack.genre,
          toGenre: toTrack.genre,
          compatibility: fromTrack.genre === toTrack.genre ? 1.0 : 0.7,
        });
      }
    }

    // Check waypoints
    const waypointsIncluded: string[] = [];
    const waypointsSkipped: string[] = [];

    options.waypoints.forEach(waypointId => {
      if (path.some(node => node.id === waypointId)) {
        waypointsIncluded.push(waypointId);
      } else {
        waypointsSkipped.push(waypointId);
      }
    });

    const averageTransitionScore = keyTransitions.length > 0
      ? keyTransitions.reduce((sum, t) => sum + t.compatibility, 0) / keyTransitions.length
      : 1.0;

    const success = path.length >= 2 && path[0].id === options.startTrackId && path[path.length - 1].id === options.endTrackId;

    return {
      success,
      path,
      totalWeight,
      totalDuration,
      averageTransitionScore,
      keyTransitions,
      bpmTransitions,
      energyProfile,
      genreTransitions,
      waypointsIncluded,
      waypointsSkipped,
      metadata: {
        searchTime: Date.now() - startTime,
        nodesExplored,
        algorithmsUsed: [algorithm.name],
        optimizationPasses: 1,
      },
    };

  } catch (error) {
    console.error('Pathfinding error:', error);

    return {
      success: false,
      path: [],
      totalWeight: Infinity,
      totalDuration: 0,
      averageTransitionScore: 0,
      keyTransitions: [],
      bpmTransitions: [],
      energyProfile: [],
      genreTransitions: [],
      waypointsIncluded: [],
      waypointsSkipped: Array.from(options.waypoints),
      metadata: {
        searchTime: Date.now() - startTime,
        nodesExplored: 0,
        algorithmsUsed: [algorithm.name],
        optimizationPasses: 0,
      },
    };
  }
}

/**
 * A* algorithm implementation for faster pathfinding with heuristic
 */
export async function findDJPathAStar(
  graphData: GraphData,
  options: PathOptions,
  constraints: PathConstraints
): Promise<PathResult> {
  // For now, use Dijkstra as base implementation
  // In a full implementation, this would use A* with a harmonic distance heuristic
  return findDJPath(graphData, options, constraints, {
    name: 'astar',
    description: 'A* with harmonic heuristic',
    bestFor: ['medium graphs', 'harmonic-focused paths'],
  });
}

/**
 * Validate that waypoints are reachable in the graph
 */
export function validateWaypoints(
  graphData: GraphData,
  startTrackId: string,
  endTrackId: string,
  waypoints: string[]
): Array<{
  waypointId: string;
  isReachable: boolean;
  reachabilityScore: number;
  alternativeSuggestions?: string[];
  reason?: string;
}> {
  const results: Array<{
    waypointId: string;
    isReachable: boolean;
    reachabilityScore: number;
    alternativeSuggestions?: string[];
    reason?: string;
  }> = [];

  // Build adjacency list for reachability analysis
  const adjacencyList = new Map<string, string[]>();
  graphData.nodes.forEach(node => {
    adjacencyList.set(node.id, []);
  });

  graphData.edges.forEach(edge => {
    adjacencyList.get(edge.source)?.push(edge.target);
    adjacencyList.get(edge.target)?.push(edge.source); // Undirected
  });

  // Check reachability using BFS
  const isReachable = (from: string, to: string): boolean => {
    if (from === to) return true;

    const queue = [from];
    const visited = new Set([from]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacencyList.get(current) || [];

      for (const neighbor of neighbors) {
        if (neighbor === to) return true;

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return false;
  };

  waypoints.forEach(waypointId => {
    const canReachFromStart = isReachable(startTrackId, waypointId);
    const canReachEnd = isReachable(waypointId, endTrackId);
    const waypointReachable = canReachFromStart && canReachEnd;

    // Calculate reachability score based on node degree
    const degree = adjacencyList.get(waypointId)?.length || 0;
    const maxDegree = Math.max(...Array.from(adjacencyList.values()).map(neighbors => neighbors.length));
    const reachabilityScore = maxDegree > 0 ? degree / maxDegree : 0;

    let reason: string | undefined;
    if (!canReachFromStart) reason = 'Cannot reach from start track';
    else if (!canReachEnd) reason = 'Cannot reach end track from waypoint';

    results.push({
      waypointId,
      isReachable: waypointReachable,
      reachabilityScore,
      reason,
    });
  });

  return results;
}