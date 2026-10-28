/**
 * PathfinderPanel Types
 * TypeScript interfaces for the refactored wizard-based pathfinder
 */

import { Track } from '../../types';

import type { ServerPathResult } from '../../types/pathfinding';
export type PathSegment = ServerPathResult['path'][number];
export type PathfinderResult = ServerPathResult;

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
  order: number;
  locked: boolean; // If true, cannot be removed or reordered
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
  tracks: any[];
  edges: any[];
}

export type PathfinderEvent =
  | { type: 'SET_START_TRACK'; track: Track }
  | { type: 'SET_END_TRACK'; track: Track | null }
  | { type: 'ADD_WAYPOINT'; track: Track }
  | { type: 'REMOVE_WAYPOINT'; waypointId: string }
  | { type: 'REORDER_WAYPOINTS'; fromIndex: number; toIndex: number }
  | { type: 'UPDATE_CONSTRAINTS'; constraints: Partial<PathConstraints> }
  | { type: 'NEXT_STEP' }
  | { type: 'PREVIOUS_STEP' }
  | { type: 'GO_TO_STEP'; step: WizardStep }
  | { type: 'CALCULATE_PATH'; tracks: any[]; edges: any[] }
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
    title: 'Select start track',
    description: 'Choose the track to begin your set',
    optional: false,
    validation: (ctx) => ctx.startTrack !== null,
  },
  {
    id: 'selectEnd',
    title: 'Select end track (optional)',
    description: 'Optionally choose a track to end your set',
    optional: true,
    validation: () => true, // Always valid since it's optional
  },
  {
    id: 'configureConstraints',
    title: 'Configure constraints',
    description: 'Set duration, BPM, and key preferences',
    optional: false,
    validation: (ctx) => ctx.constraints.targetDuration > 0,
  },
  {
    id: 'addWaypoints',
    title: 'Add waypoints (optional)',
    description: 'Select tracks that must be included in the path',
    optional: true,
    validation: () => true, // Always valid since waypoints are optional
  },
  {
    id: 'reviewPath',
    title: 'Review & calculate',
    description: 'Review settings and calculate optimal path',
    optional: false,
    validation: (ctx) => ctx.startTrack !== null,
  },
];
