/**
 * Custom Hooks for PathfinderPanel
 * Provides stateful logic for wizard flow and pathfinding algorithm
 */

import { useMachine } from '@xstate/react';
import { useStore } from '../../store/useStore';
import { useEffect, useRef, useCallback } from 'react';
import { pathfinderMachine, pathfinderMachineOptions } from './pathfinder.machine';
import { PathfinderContext, WizardStep } from './types';
import { Track } from '../../types';

/**
 * Main pathfinder hook - integrates XState machine with Zustand store
 */
export function usePathfinder() {
  const [state, send] = useMachine(pathfinderMachine, {
    ...pathfinderMachineOptions,
  });

  const { graphData, viewState, pathfinding } = useStore();
  const prevStateRef = useRef(state.context);

  // Sync XState context with Zustand store when relevant changes occur
  useEffect(() => {
    const prev = prevStateRef.current;
    const curr = state.context;

    // Update Zustand store when start track changes
    if (curr.startTrack?.id !== prev.startTrack?.id) {
      if (curr.startTrack) {
        pathfinding.setStartTrack(curr.startTrack.id);
      }
    }

    // Update Zustand store when end track changes
    if (curr.endTrack?.id !== prev.endTrack?.id) {
      if (curr.endTrack) {
        pathfinding.setEndTrack(curr.endTrack.id);
      } else {
        pathfinding.setEndTrack(null as any);
      }
    }

    // Update Zustand store when waypoints change
    if (curr.waypoints.length !== prev.waypoints.length) {
      pathfinding.clearWaypoints();
      curr.waypoints.forEach((w) => {
        pathfinding.addWaypoint(w.track.id);
      });
    }

    // Update Zustand store when constraints change
    if (JSON.stringify(curr.constraints) !== JSON.stringify(prev.constraints)) {
      pathfinding.setPathConstraints({
        ...curr.constraints,
        targetDuration: curr.constraints.targetDuration * 60 * 1000, // Convert to ms
        tolerance: curr.constraints.tolerance * 60 * 1000, // Convert to ms
      });
    }

    // Update Zustand store when result changes
    if (curr.result !== prev.result) {
      pathfinding.setCurrentPath(curr.result);
    }

    prevStateRef.current = curr;
  }, [state.context, pathfinding]);

  // Get currently selected track from graph
  const selectedNodeIds = Array.from(viewState.selectedNodes);
  const currentlySelectedTrack =
    selectedNodeIds.length > 0 ? graphData.nodes.find((t) => t.id === selectedNodeIds[0]) || null : null;

  // Announce changes to screen readers
  useEffect(() => {
    if (state.context.announcement) {
      // Use ARIA live region for announcements
      const announcement = state.context.announcement;
      // Clear announcement after it's been read
      setTimeout(() => {
        send({ type: 'ANNOUNCE', message: '' });
      }, 100);
    }
  }, [state.context.announcement, send]);

  return {
    state: state.context,
    machineState: state.value,
    send,
    currentlySelectedTrack,
    availableTracks: graphData.nodes,
    isCalculating: state.matches('calculating'),
    hasResult: state.matches('success'),
    hasError: state.matches('error'),
  };
}

/**
 * Hook for managing wizard step navigation with keyboard support
 */
export function useWizardNavigation(
  currentStep: WizardStep,
  send: (event: any) => void,
  canGoNext: boolean,
  canGoPrevious: boolean
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard navigation when not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          if (canGoNext && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send({ type: 'NEXT_STEP' });
          }
          break;
        case 'ArrowLeft':
          if (canGoPrevious && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send({ type: 'PREVIOUS_STEP' });
          }
          break;
        case 'Escape':
          e.preventDefault();
          // Close panel or go back
          send({ type: 'PREVIOUS_STEP' });
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, send, canGoNext, canGoPrevious]);
}

/**
 * Hook for pathfinding algorithm selection and configuration
 */
export function usePathfindingAlgorithm() {
  const { pathfindingState } = useStore();

  const getAlgorithmDescription = useCallback((algorithmId: string): string => {
    const descriptions: Record<string, string> = {
      dijkstra: 'Finds the shortest path based on edge weights. Guaranteed optimal.',
      'a-star': 'Heuristic-based search. Fast and efficient for large graphs.',
      'bidirectional-search': 'Searches from both start and end. Good for specific endpoints.',
      'constrained-shortest-path': 'Considers constraints like BPM and key. Most realistic for DJing.',
    };
    return descriptions[algorithmId] || 'Unknown algorithm';
  }, []);

  const getOptimizationLevelDescription = useCallback((level: string): string => {
    const descriptions: Record<string, string> = {
      speed: 'Prioritize calculation speed. May sacrifice path quality.',
      balanced: 'Balance between speed and quality. Recommended for most use cases.',
      quality: 'Prioritize path quality. May take longer to calculate.',
    };
    return descriptions[level] || 'Unknown optimization level';
  }, []);

  return {
    currentAlgorithm: pathfindingState.algorithm,
    optimizationLevel: pathfindingState.optimizationLevel,
    getAlgorithmDescription,
    getOptimizationLevelDescription,
  };
}

/**
 * Hook for focus management in wizard
 */
export function useFocusManagement(currentStep: WizardStep) {
  const stepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the step container when step changes
    if (stepRef.current) {
      stepRef.current.focus();
    }
  }, [currentStep]);

  return stepRef;
}

/**
 * Hook for announcing messages to screen readers
 */
export function useScreenReaderAnnouncement() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return announce;
}

/**
 * Hook for debouncing constraint updates
 */
export function useDebouncedConstraintUpdate(send: (event: any) => void, delay: number = 500) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedUpdate = useCallback(
    (constraints: any) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        send({ type: 'UPDATE_CONSTRAINTS', constraints });
      }, delay);
    },
    [send, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedUpdate;
}

/**
 * Hook for formatting duration values
 */
export function useFormatDuration() {
  const formatDuration = useCallback((ms: number): string => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }, []);

  const formatDurationVerbose = useCallback((ms: number): string => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }, []);

  return { formatDuration, formatDurationVerbose };
}
