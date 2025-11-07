/**
 * PathfinderPanel Types
 * TypeScript interfaces for the refactored wizard-based pathfinder
 */

import { Track } from '../../types';

export interface PathSegment {
  track: {
    id: string;
    name: string;
    artist: string;
    duration_ms: number;
    camelot_key?: string;
    bpm?: number;
    energy?: number;
  };
  connection_strength?: number;
  key_compatible: boolean;
  cumulative_duration_ms: number;
  is_synthetic_edge?: boolean;
}

export interface PathfinderResult {
  success: boolean;
  path: PathSegment[];
  total_duration_ms: number;
  target_duration_ms: number;
  duration_difference_ms: number;
  waypoints_visited: string[];
  waypoints_missed: string[];
  average_connection_strength: number;
  key_compatibility_score: number;
  message: string;
}

export interface PathConstraints {
  targetDuration: number; // minutes
  tolerance: number; // minutes
  preferKeyMatching: boolean;
  minBpm?: number;
  maxBpm?: number;
  allowedKeys?: string[];
  maxEnergyChange?: number;
}

export interface WaypointConfig {
  id: string;
  track: Track;
  locked: boolean; // If true, cannot be removed
  // NOTE: Waypoints are visited in optimal order determined by pathfinding algorithm
  // Order field removed as backend treats waypoints as unordered set
}

export type WizardStep =
  | 'selectStart'
  | 'selectEnd'
  | 'configureConstraints'
  | 'addWaypoints'
  | 'reviewPath';

export interface WizardStepConfig {
  id: WizardStep;
  title: string;
  description: string;
  optional: boolean;
  validation: (context: PathfinderContext) => boolean;
}

export interface PathfinderContext {
  startTrack: Track | null;
  endTrack: Track | null;
  waypoints: WaypointConfig[];
  constraints: PathConstraints;
  result: PathfinderResult | null;
  error: string | null;
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  announcement: string; // For screen reader announcements
}

export type PathfinderEvent =
  | { type: 'SET_START_TRACK'; track: Track }
  | { type: 'SET_END_TRACK'; track: Track | null }
  | { type: 'ADD_WAYPOINT'; track: Track }
  | { type: 'REMOVE_WAYPOINT'; waypointId: string }
  // REMOVED: REORDER_WAYPOINTS - waypoints are visited in optimal order, not user-specified order
  | { type: 'UPDATE_CONSTRAINTS'; constraints: Partial<PathConstraints> }
  | { type: 'NEXT_STEP' }
  | { type: 'PREVIOUS_STEP' }
  | { type: 'GO_TO_STEP'; step: WizardStep }
  | { type: 'CALCULATE_PATH' }
  | { type: 'PATH_SUCCESS'; result: PathfinderResult }
  | { type: 'PATH_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'EXPORT_PATH'; format: 'json' | 'm3u' | 'csv' }
  | { type: 'ANNOUNCE'; message: string };

export const DEFAULT_CONSTRAINTS: PathConstraints = {
  targetDuration: 120, // 2 hours
  tolerance: 5, // 5 minutes
  preferKeyMatching: true,
};

export const WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: 'selectStart',
    title: 'Select Start Track',
    description: 'Choose the track to begin your DJ set',
    optional: false,
    validation: (ctx) => ctx.startTrack !== null,
  },
  {
    id: 'selectEnd',
    title: 'Select End Track (Optional)',
    description: 'Optionally choose a track to end your set',
    optional: true,
    validation: () => true, // Always valid since it's optional
  },
  {
    id: 'configureConstraints',
    title: 'Configure Constraints',
    description: 'Set duration, BPM, and key preferences',
    optional: false,
    validation: (ctx) => ctx.constraints.targetDuration > 0,
  },
  {
    id: 'addWaypoints',
    title: 'Add Waypoints (Optional)',
    description: 'Select tracks that must be included in the path',
    optional: true,
    validation: () => true, // Always valid since waypoints are optional
  },
  {
    id: 'reviewPath',
    title: 'Review & Calculate',
    description: 'Review settings and calculate optimal path',
    optional: false,
    validation: (ctx) => ctx.startTrack !== null,
  },
];
