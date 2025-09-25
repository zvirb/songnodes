import { Track } from './index';

// Path building and DJ mixing types
export interface PathOptions {
  startTrackId: string;
  endTrackId: string;
  waypoints: Set<string>; // UNORDERED - tracks that MUST be included
  avoidNodes?: Set<string>; // Nodes to avoid in path
  preferredKeys?: string[]; // Harmonic compatibility preferences
  maxBpmChange?: number; // Maximum BPM difference between adjacent tracks
  maxPathLength?: number; // Maximum number of tracks in path
  energyFlow?: 'ascending' | 'descending' | 'plateau' | 'wave' | 'any';
  genreConstraints?: string[]; // Allowed genres
  timeConstraints?: {
    minDuration?: number; // Minimum total path duration
    maxDuration?: number; // Maximum total path duration
  };
}

export interface PathNode {
  id: string;
  track: Track;
  position: number; // Position in the final path (0-based)
  isWaypoint: boolean; // True if this was a required waypoint
  transitionScore: number; // How well this fits in the path
  cumulativeWeight: number; // Total path weight up to this point
  parentId: string | null; // Previous node in path (for reconstruction)
  distanceFromStart: number; // Dijkstra distance from start
}

export interface PathEdgeWeight {
  edgeId: string;
  sourceId: string;
  targetId: string;
  baseWeight: number; // Original edge weight
  harmonic: number; // Key compatibility score (0-1)
  bpmCompatibility: number; // BPM transition score (0-1)
  energyFlow: number; // Energy transition score (0-1)
  genreCompatibility: number; // Genre transition score (0-1)
  timeCompatibility: number; // Timing/duration score (0-1)
  totalWeight: number; // Final weighted score for pathfinding
  factors: {
    harmonicWeight: number;
    bpmWeight: number;
    energyWeight: number;
    genreWeight: number;
    timeWeight: number;
  };
}

export interface PathResult {
  success: boolean;
  path: PathNode[];
  totalWeight: number;
  totalDuration: number; // Total duration in seconds
  averageTransitionScore: number;
  keyTransitions: Array<{
    fromKey: string;
    toKey: string;
    compatibility: number;
  }>;
  bpmTransitions: Array<{
    fromBpm: number;
    toBpm: number;
    change: number;
    changePercent: number;
  }>;
  energyProfile: Array<{
    position: number;
    energy: number;
    change: number;
  }>;
  genreTransitions: Array<{
    fromGenre: string;
    toGenre: string;
    compatibility: number;
  }>;
  waypointsIncluded: string[]; // IDs of waypoints that were successfully included
  waypointsSkipped: string[]; // IDs of waypoints that couldn't be included
  alternativePaths?: PathResult[]; // Alternative paths if requested
  metadata: {
    searchTime: number; // Time taken to find path (ms)
    nodesExplored: number; // Nodes explored during search
    algorithmsUsed: string[]; // Algorithms used (Dijkstra, A*, etc.)
    optimizationPasses: number; // Number of optimization iterations
  };
}

export interface PathConstraints {
  harmonicCompatibility: {
    enabled: boolean;
    weight: number; // 0-1, importance in pathfinding
    strictMode: boolean; // Require compatible keys
    allowedKeyJumps?: number; // Max semitone jumps allowed
  };
  bpmCompatibility: {
    enabled: boolean;
    weight: number;
    maxChange: number; // Maximum BPM change allowed
    preferredChange: number; // Preferred maximum change
    allowAcceleration: boolean; // Allow tempo increases
    allowDeceleration: boolean; // Allow tempo decreases
  };
  energyFlow: {
    enabled: boolean;
    weight: number;
    flowType: 'ascending' | 'descending' | 'plateau' | 'wave' | 'any';
    maxEnergyJump: number; // Maximum energy level jump
    preferredEnergyJump: number; // Preferred energy change
  };
  genreCompatibility: {
    enabled: boolean;
    weight: number;
    allowedGenres?: string[];
    genreTransitionMatrix?: Record<string, Record<string, number>>;
    strictMode: boolean; // Only allow compatible genres
  };
  timing: {
    enabled: boolean;
    weight: number;
    targetDuration?: number; // Target total duration
    minTrackDuration?: number; // Minimum track duration
    maxTrackDuration?: number; // Maximum track duration
    considerMixPoints: boolean; // Factor in cue points for mixing
  };
}

export interface PathfindingAlgorithm {
  name: 'dijkstra' | 'astar' | 'bidirectional' | 'genetic' | 'hybrid';
  description: string;
  bestFor: string[]; // What scenarios this works best for
  config?: Record<string, any>; // Algorithm-specific configuration
}

export interface PathfindingState {
  isCalculating: boolean;
  currentPath: PathResult | null;
  alternatives: PathResult[];
  constraints: PathConstraints;
  selectedWaypoints: Set<string>;
  startTrackId: string | null;
  endTrackId: string | null;
  previewPath: PathNode[]; // Real-time preview during selection
  algorithm: PathfindingAlgorithm;
  optimizationLevel: 'fast' | 'balanced' | 'thorough';
  error: string | null;
}

export interface WaypointValidation {
  waypointId: string;
  isReachable: boolean;
  reachabilityScore: number; // 0-1, how well connected this waypoint is
  alternativeSuggestions?: string[]; // Alternative tracks if unreachable
  conflictsWith?: string[]; // Other waypoints this conflicts with
  reason?: string; // Why it might be unreachable
}

export interface PathOptimization {
  type: 'reorder_waypoints' | 'substitute_tracks' | 'adjust_constraints' | 'split_path';
  description: string;
  improvement: number; // Expected improvement in path quality (0-1)
  tradeoffs: string[]; // What might be sacrificed for this optimization
  apply: () => PathResult; // Function to apply this optimization
}

export interface PathAnalysis {
  harmonicAnalysis: {
    totalCompatibleTransitions: number;
    averageCompatibility: number;
    problematicTransitions: Array<{
      fromTrack: string;
      toTrack: string;
      fromKey: string;
      toKey: string;
      compatibilityScore: number;
    }>;
    keyDistribution: Record<string, number>;
  };
  bpmAnalysis: {
    averageBpm: number;
    bpmRange: [number, number];
    largestBpmJump: number;
    bpmProgression: 'ascending' | 'descending' | 'mixed' | 'stable';
    problematicTransitions: Array<{
      fromTrack: string;
      toTrack: string;
      fromBpm: number;
      toBpm: number;
      change: number;
    }>;
  };
  energyAnalysis: {
    energyProfile: 'ascending' | 'descending' | 'plateau' | 'wave' | 'chaotic';
    averageEnergy: number;
    energyRange: [number, number];
    energyConsistency: number; // 0-1, how smooth the energy flow is
    peakEnergy: { position: number; energy: number };
    lowEnergy: { position: number; energy: number };
  };
  genreAnalysis: {
    genreDistribution: Record<string, number>;
    genreDiversity: number; // 0-1, how diverse the genres are
    genreTransitionQuality: number; // 0-1, how well genres flow
    dominantGenre: string;
  };
  overallQuality: {
    score: number; // 0-1, overall path quality
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

// Export default constraints for different DJ styles
export const DEFAULT_CONSTRAINTS: Record<string, PathConstraints> = {
  strict_harmonic: {
    harmonicCompatibility: {
      enabled: true,
      weight: 0.9,
      strictMode: true,
      allowedKeyJumps: 1,
    },
    bpmCompatibility: {
      enabled: true,
      weight: 0.7,
      maxChange: 10,
      preferredChange: 5,
      allowAcceleration: true,
      allowDeceleration: true,
    },
    energyFlow: {
      enabled: true,
      weight: 0.6,
      flowType: 'any',
      maxEnergyJump: 0.3,
      preferredEnergyJump: 0.2,
    },
    genreCompatibility: {
      enabled: false,
      weight: 0.3,
      strictMode: false,
    },
    timing: {
      enabled: false,
      weight: 0.2,
      considerMixPoints: true,
    },
  },
  flexible: {
    harmonicCompatibility: {
      enabled: true,
      weight: 0.5,
      strictMode: false,
      allowedKeyJumps: 3,
    },
    bpmCompatibility: {
      enabled: true,
      weight: 0.6,
      maxChange: 20,
      preferredChange: 10,
      allowAcceleration: true,
      allowDeceleration: true,
    },
    energyFlow: {
      enabled: true,
      weight: 0.4,
      flowType: 'any',
      maxEnergyJump: 0.5,
      preferredEnergyJump: 0.3,
    },
    genreCompatibility: {
      enabled: true,
      weight: 0.4,
      strictMode: false,
    },
    timing: {
      enabled: false,
      weight: 0.2,
      considerMixPoints: false,
    },
  },
  energy_focused: {
    harmonicCompatibility: {
      enabled: true,
      weight: 0.3,
      strictMode: false,
      allowedKeyJumps: 5,
    },
    bpmCompatibility: {
      enabled: true,
      weight: 0.4,
      maxChange: 30,
      preferredChange: 15,
      allowAcceleration: true,
      allowDeceleration: true,
    },
    energyFlow: {
      enabled: true,
      weight: 0.9,
      flowType: 'ascending',
      maxEnergyJump: 0.2,
      preferredEnergyJump: 0.1,
    },
    genreCompatibility: {
      enabled: true,
      weight: 0.5,
      strictMode: false,
    },
    timing: {
      enabled: false,
      weight: 0.1,
      considerMixPoints: false,
    },
  },
};

export const AVAILABLE_ALGORITHMS: PathfindingAlgorithm[] = [
  {
    name: 'dijkstra',
    description: 'Classic shortest path algorithm, guaranteed optimal',
    bestFor: ['small graphs', 'guaranteed optimal paths', 'few waypoints'],
  },
  {
    name: 'astar',
    description: 'A* with harmonic heuristic, faster than Dijkstra',
    bestFor: ['medium graphs', 'harmonic-focused paths', 'balanced performance'],
  },
  {
    name: 'bidirectional',
    description: 'Search from both ends, good for long paths',
    bestFor: ['large graphs', 'long paths', 'distant start/end points'],
  },
  {
    name: 'genetic',
    description: 'Evolutionary algorithm, good for complex waypoint sets',
    bestFor: ['many waypoints', 'complex constraints', 'creative solutions'],
  },
  {
    name: 'hybrid',
    description: 'Combines multiple algorithms based on problem characteristics',
    bestFor: ['all scenarios', 'automatic optimization', 'best results'],
  },
];