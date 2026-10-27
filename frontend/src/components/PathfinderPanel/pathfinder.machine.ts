/**
 * XState State Machine for PathfinderPanel Wizard
 * Manages wizard flow, validation, and side effects
 */

import { setup, assign, fromPromise } from 'xstate';
import {
  PathfinderContext,
  PathfinderEvent,
  PathfinderResult,
  WizardStep,
  DEFAULT_CONSTRAINTS,
  WIZARD_STEPS,
} from './types';
import { Track } from '../../types';
import { API_BASE_URL } from '../../lib/apiBase';

const initialContext: PathfinderContext = {
  startTrack: null,
  endTrack: null,
  waypoints: [],
  constraints: DEFAULT_CONSTRAINTS,
  result: null,
  error: null,
  currentStep: 'selectStart',
  completedSteps: new Set(),
  announcement: '',
};

async function calculatePath(context: PathfinderContext): Promise<PathfinderResult> {
  const REST_API_BASE = API_BASE_URL;

  // Prepare request body
  const requestBody = {
    start_track_id: context.startTrack!.id,
    end_track_id: context.endTrack?.id || null,
    target_duration_ms: context.constraints.targetDuration * 60 * 1000,
    tolerance_ms: context.constraints.tolerance * 60 * 1000,
    waypoint_track_ids: context.waypoints.map((w) => w.track.id),
    prefer_key_matching: context.constraints.preferKeyMatching,
    // Additional constraints if needed
    min_bpm: context.constraints.minBpm,
    max_bpm: context.constraints.maxBpm,
    allowed_keys: context.constraints.allowedKeys,
    max_energy_change: context.constraints.maxEnergyChange,
  };

  const response = await fetch(`${REST_API_BASE}/api/v1/pathfinder/find-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Pathfinding failed' }));
    throw new Error(errorData.detail || 'Pathfinding failed');
  }

  return await response.json();
}

function exportPath(context: PathfinderContext, event: Extract<PathfinderEvent, { type: 'EXPORT_PATH' }>) {
  if (!context.result || !context.result.success) {
    return;
  }

  const { format } = event;
  let content = '';
  let filename = '';
  let mimeType = '';

  switch (format) {
    case 'json':
      content = JSON.stringify(context.result, null, 2);
      filename = 'pathfinder-result.json';
      mimeType = 'application/json';
      break;
    case 'm3u':
      content = '#EXTM3U\n';
      context.result.path.forEach((segment) => {
        content += `#EXTINF:${Math.floor(segment.track.duration_ms / 1000)},${segment.track.artist} - ${segment.track.name}\n`;
        content += `# Track ID: ${segment.track.id}\n`;
      });
      filename = 'pathfinder-playlist.m3u';
      mimeType = 'audio/x-mpegurl';
      break;
    case 'csv':
      content = 'Position,Track Name,Artist,BPM,Key,Duration (s),Cumulative Duration (min)\n';
      context.result.path.forEach((segment, index) => {
        content += `${index + 1},"${segment.track.name}","${segment.track.artist}",${segment.track.bpm || 'N/A'},${segment.track.camelot_key || 'N/A'},${Math.floor(segment.track.duration_ms / 1000)},${Math.floor(segment.cumulative_duration_ms / 60000)}\n`;
      });
      filename = 'pathfinder-result.csv';
      mimeType = 'text/csv';
      break;
  }

  // Trigger download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown): string {
  return (error instanceof Error && error.message) || 'Failed to calculate path';
}

export const pathfinderMachine = setup({
  types: {
    context: {} as PathfinderContext,
    events: {} as PathfinderEvent,
  },
  actors: {
    calculatePath: fromPromise<PathfinderResult, PathfinderContext>(({ input }) => calculatePath(input)),
  },
  actions: {
    exportPath: ({ context, event }) => {
      if (event.type === 'EXPORT_PATH') exportPath(context, event);
    },
  },
}).createMachine({
  id: 'pathfinder',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        SET_START_TRACK: {
          actions: assign({
            startTrack: ({ event }) => event.track,
            announcement: ({ event }) => `Start track set to ${event.track.name} by ${event.track.artist}`,
          }),
        },
        SET_END_TRACK: {
          actions: assign({
            endTrack: ({ event }) => event.track,
            announcement: ({ event }) =>
              event.track
                ? `End track set to ${event.track.name} by ${event.track.artist}`
                : 'End track cleared',
          }),
        },
        ADD_WAYPOINT: {
          actions: assign({
            waypoints: ({ context, event }) => [
              ...context.waypoints,
              {
                id: crypto.randomUUID(),
                track: event.track,
                order: context.waypoints.length,
                locked: false,
              },
            ],
            announcement: ({ event }) => `Added ${event.track.name} as waypoint`,
          }),
        },
        REMOVE_WAYPOINT: {
          actions: assign({
            waypoints: ({ context, event }) => {
              const removed = context.waypoints.find((w) => w.id === event.waypointId);
              return context.waypoints
                .filter((w) => w.id !== event.waypointId)
                .map((w, index) => ({ ...w, order: index }));
            },
            announcement: ({ context, event }) => {
              const waypoint = context.waypoints.find((w) => w.id === event.waypointId);
              return waypoint ? `Removed ${waypoint.track.name} from waypoints` : 'Waypoint removed';
            },
          }),
        },
        REORDER_WAYPOINTS: {
          actions: assign({
            waypoints: ({ context, event }) => {
              const waypoints = [...context.waypoints];
              const [moved] = waypoints.splice(event.fromIndex, 1);
              waypoints.splice(event.toIndex, 0, moved);
              return waypoints.map((w, index) => ({ ...w, order: index }));
            },
            announcement: ({ event }) =>
              `Moved waypoint from position ${event.fromIndex + 1} to ${event.toIndex + 1}`,
          }),
        },
        UPDATE_CONSTRAINTS: {
          actions: assign({
            constraints: ({ context, event }) => ({
              ...context.constraints,
              ...event.constraints,
            }),
            announcement: () => 'Constraints updated',
          }),
        },
        NEXT_STEP: [
          {
            target: 'validating',
            guard: ({ context }) => {
              const currentStepConfig = WIZARD_STEPS.find((s) => s.id === context.currentStep);
              return currentStepConfig ? currentStepConfig.validation(context) : false;
            },
          },
          {
            actions: assign({
              error: ({ context }) => `Please complete ${context.currentStep} before continuing`,
              announcement: ({ context }) => `Cannot proceed: ${context.currentStep} is incomplete`,
            }),
          },
        ],
        PREVIOUS_STEP: {
          actions: assign({
            currentStep: ({ context }) => {
              const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === context.currentStep);
              return currentIndex > 0 ? WIZARD_STEPS[currentIndex - 1].id : context.currentStep;
            },
            error: null,
            announcement: ({ context }) => {
              const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === context.currentStep);
              if (currentIndex > 0) {
                const prevStep = WIZARD_STEPS[currentIndex - 1];
                return `Moved to step: ${prevStep.title}`;
              }
              return 'Already at first step';
            },
          }),
        },
        GO_TO_STEP: {
          actions: assign({
            currentStep: ({ event }) => event.step,
            announcement: ({ event }) => {
              const step = WIZARD_STEPS.find((s) => s.id === event.step);
              return step ? `Navigated to: ${step.title}` : 'Step changed';
            },
          }),
        },
        CALCULATE_PATH: {
          target: 'calculating',
          guard: ({ context }) => context.startTrack !== null,
          actions: assign({
            error: null,
            announcement: () => 'Calculating optimal path…',
          }),
        },
        RESET: {
          actions: assign(() => initialContext),
        },
        ANNOUNCE: {
          actions: assign({
            announcement: ({ event }) => event.message,
          }),
        },
      },
    },
    validating: {
      always: [
        {
          target: 'idle',
          actions: assign(({ context }) => {
            const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === context.currentStep);
            const nextStep = currentIndex < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[currentIndex + 1] : null;

            const newCompletedSteps = new Set(context.completedSteps);
            newCompletedSteps.add(context.currentStep);

            return {
              currentStep: nextStep ? nextStep.id : context.currentStep,
              completedSteps: newCompletedSteps,
              error: null,
              announcement: nextStep ? `Moved to step: ${nextStep.title}` : 'Validation complete',
            };
          }),
        },
      ],
    },
    calculating: {
      invoke: {
        src: 'calculatePath',
        input: ({ context }) => context,
        onDone: {
          target: 'success',
          actions: assign({
            result: ({ event }) => event.output,
            error: null,
            currentStep: () => 'reviewPath' as WizardStep,
            announcement: ({ event }) =>
              `Path found with ${event.output.path.length} tracks. Total duration: ${Math.floor(event.output.total_duration_ms / 60000)} minutes`,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => errorMessage(event.error),
            result: null,
            announcement: ({ event }) => `Error: ${errorMessage(event.error)}`,
          }),
        },
      },
    },
    success: {
      on: {
        CALCULATE_PATH: 'calculating',
        RESET: 'idle',
        EXPORT_PATH: {
          actions: 'exportPath',
        },
        SET_START_TRACK: {
          target: 'idle',
          actions: assign({
            startTrack: ({ event }) => event.track,
            result: null,
            announcement: ({ event }) => `Start track changed to ${event.track.name}. Path cleared.`,
          }),
        },
        UPDATE_CONSTRAINTS: {
          target: 'idle',
          actions: assign({
            constraints: ({ context, event }) => ({
              ...context.constraints,
              ...event.constraints,
            }),
            result: null,
            announcement: () => 'Constraints updated. Path cleared.',
          }),
        },
      },
    },
    error: {
      on: {
        CALCULATE_PATH: 'calculating',
        RESET: 'idle',
        PREVIOUS_STEP: {
          target: 'idle',
          actions: assign({
            currentStep: ({ context }) => {
              const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === context.currentStep);
              return currentIndex > 0 ? WIZARD_STEPS[currentIndex - 1].id : context.currentStep;
            },
            error: null,
          }),
        },
      },
    },
  },
});
