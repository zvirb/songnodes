/**
 * useGraphSimulation Hook
 * Integrates D3-force physics worker with React state
 *
 * Features:
 * - Initialize simulation worker with graph data
 * - Manage worker lifecycle (create, terminate)
 * - Handle worker messages (tick, end events)
 * - Update node positions from simulation
 * - Support simulation controls (pause, resume, restart)
 * - Adaptive simulation (stop when stable, resume on interaction)
 * - Configuration hot-reload
 *
 * Architecture:
 * - Physics simulation runs in Web Worker (simulation.worker.ts)
 * - Main thread receives position updates via postMessage
 * - Non-blocking UI during heavy simulation
 * - Automatic cleanup on unmount
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { GraphNode, GraphEdge, SimulationConfig } from '../types';

/* ============================================
   TYPES
   ============================================ */

/**
 * Simulation state
 */
export interface SimulationState {
  /** Is simulation currently running */
  isRunning: boolean;

  /** Is simulation paused */
  isPaused: boolean;

  /** Current alpha (simulation energy, 0-1) */
  alpha: number;

  /** Number of iterations completed */
  iterations: number;

  /** Temperature (for adaptive cooling) */
  temperature: number;
}

/**
 * Simulation controls API
 */
export interface SimulationControls {
  /** Start/initialize simulation */
  start: () => void;

  /** Stop and destroy simulation */
  stop: () => void;

  /** Restart simulation (stop + start) */
  restart: () => void;

  /** Pause simulation (keep state) */
  pause: () => void;

  /** Resume paused simulation */
  resume: () => void;

  /** Reheat simulation (add energy for re-layout) */
  reheat: (alpha?: number) => void;

  /** Update simulation configuration */
  configure: (config: Partial<SimulationConfig>) => void;

  /** Update nodes (for dynamic graphs) */
  updateNodes: (nodes: GraphNode[]) => void;

  /** Update edges (for dynamic graphs) */
  updateEdges: (edges: GraphEdge[]) => void;

  /** Pin a node to fixed position */
  pinNode: (nodeId: string, x: number, y: number) => void;

  /** Unpin a node */
  unpinNode: (nodeId: string) => void;
}

/**
 * Hook options
 */
export interface UseGraphSimulationOptions {
  /** Graph nodes */
  nodes: GraphNode[];

  /** Graph edges */
  edges: GraphEdge[];

  /** Simulation configuration */
  config?: Partial<SimulationConfig>;

  /** Auto-start simulation on mount */
  autoStart?: boolean;

  /** Callback when positions update */
  onTick?: (positions: Map<string, { x: number; y: number }>) => void;

  /** Callback when simulation ends */
  onEnd?: () => void;

  /** Callback when simulation state changes */
  onStateChange?: (state: SimulationState) => void;

  /** Adaptive simulation (auto-pause when stable) */
  adaptive?: boolean;

  /** Alpha threshold for auto-pause (default: 0.01) */
  adaptiveThreshold?: number;
}

/**
 * Hook return value
 */
export interface UseGraphSimulationReturn {
  /** Map of node ID to position */
  positions: Map<string, { x: number; y: number }>;

  /** Simulation controls */
  controls: SimulationControls;

  /** Current simulation state */
  state: SimulationState;

  /** Is worker ready */
  isReady: boolean;

  /** Worker error (if any) */
  error: Error | null;
}

/* ============================================
   CONSTANTS
   ============================================ */

const DEFAULT_CONFIG: Required<SimulationConfig> = {
  charge: -300,
  linkDistance: 100,
  linkStrength: 0.5,
  centerStrength: 0.1,
  collideRadius: 30,
  alphaDecay: 0.0228,
  velocityDecay: 0.4,
  alphaMin: 0.001,
};

const DEFAULT_OPTIONS = {
  autoStart: true,
  adaptive: true,
  adaptiveThreshold: 0.01,
};

/* ============================================
   MAIN HOOK
   ============================================ */

/**
 * Custom hook for integrating physics simulation worker
 * @param options - Hook options
 * @returns Positions, controls, and state
 */
export function useGraphSimulation(
  options: UseGraphSimulationOptions
): UseGraphSimulationReturn {
  const {
    nodes,
    edges,
    config = {},
    autoStart = true,
    onTick,
    onEnd,
    onStateChange,
    adaptive = true,
    adaptiveThreshold = 0.01,
  } = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const [state, setState] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    alpha: 1,
    iterations: 0,
    temperature: 1,
  });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const workerRef = useRef<Worker | null>(null);
  const pinnedNodesRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const configRef = useRef<Required<SimulationConfig>>({ ...DEFAULT_CONFIG, ...config });

  /**
   * Initialize Web Worker
   */
  useEffect(() => {
    console.log('[useGraphSimulation] Initializing worker...');

    try {
      // Create worker
      workerRef.current = new Worker(
        new URL('../physics/simulation.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Handle messages from worker
      workerRef.current.onmessage = handleWorkerMessage;

      // Handle errors
      workerRef.current.onerror = (e) => {
        console.error('[useGraphSimulation] Worker error:', e);
        setError(new Error(`Worker error: ${e.message}`));
      };

      setIsReady(true);
      console.log('[useGraphSimulation] Worker initialized');
    } catch (err) {
      console.error('[useGraphSimulation] Failed to initialize worker:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize worker'));
    }

    // Cleanup
    return () => {
      console.log('[useGraphSimulation] Cleaning up worker...');
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsReady(false);
    };
  }, []);

  /**
   * Handle worker messages
   */
  const handleWorkerMessage = useCallback(
    (e: MessageEvent) => {
      const { type, nodes: updatedNodes, state: workerState, error: workerError } = e.data;

      if (workerError) {
        console.error('[useGraphSimulation] Worker error:', workerError);
        setError(new Error(workerError));
        return;
      }

      if (type === 'tick' && updatedNodes) {
        // Update positions
        const newPositions = new Map<string, { x: number; y: number }>();

        for (const node of updatedNodes) {
          // Apply pinned positions if node is pinned
          const pinnedPos = pinnedNodesRef.current.get(node.id);
          if (pinnedPos) {
            newPositions.set(node.id, pinnedPos);
          } else {
            newPositions.set(node.id, { x: node.x, y: node.y });
          }
        }

        setPositions(newPositions);

        // Update state
        if (workerState) {
          setState((prev) => ({
            ...prev,
            alpha: workerState.alpha || 0,
            iterations: workerState.iterations || 0,
            temperature: workerState.alpha || 0,
          }));

          // Adaptive simulation: pause when stable
          if (
            adaptive &&
            workerState.alpha < adaptiveThreshold &&
            !state.isPaused
          ) {
            console.log('[useGraphSimulation] Simulation stable, auto-pausing');
            pause();
          }

          // Notify state change
          if (onStateChange) {
            onStateChange({
              isRunning: workerState.isRunning,
              isPaused: state.isPaused,
              alpha: workerState.alpha,
              iterations: workerState.iterations,
              temperature: workerState.alpha,
            });
          }
        }

        // Notify tick
        if (onTick) {
          onTick(newPositions);
        }
      } else if (type === 'end') {
        console.log('[useGraphSimulation] Simulation ended');

        setState((prev) => ({
          ...prev,
          isRunning: false,
          alpha: 0,
        }));

        // Notify end
        if (onEnd) {
          onEnd();
        }
      } else if (type === 'init' || type === 'update' || type === 'configure' || type === 'reheat') {
        // Update state
        if (workerState) {
          setState((prev) => ({
            ...prev,
            isRunning: workerState.isRunning,
            alpha: workerState.alpha || 0,
            iterations: workerState.iterations || 0,
          }));
        }
      } else if (type === 'pause') {
        setState((prev) => ({ ...prev, isPaused: true, isRunning: false }));
      } else if (type === 'resume') {
        setState((prev) => ({ ...prev, isPaused: false, isRunning: true }));
      } else if (type === 'stop') {
        setState({
          isRunning: false,
          isPaused: false,
          alpha: 0,
          iterations: 0,
          temperature: 0,
        });
      }
    },
    [onTick, onEnd, onStateChange, adaptive, adaptiveThreshold, state.isPaused]
  );

  /* ============================================
     CONTROL FUNCTIONS
     ============================================ */

  /**
   * Start simulation
   */
  const start = useCallback(() => {
    if (!workerRef.current) {
      console.warn('[useGraphSimulation] Worker not initialized');
      return;
    }

    console.log(`[useGraphSimulation] Starting simulation with ${nodes.length} nodes, ${edges.length} edges`);

    // Prepare node data
    const nodeData = nodes.map((node) => {
      const pinned = pinnedNodesRef.current.get(node.id);

      return {
        id: node.id,
        x: node.x ?? Math.random() * 1000 - 500,
        y: node.y ?? Math.random() * 1000 - 500,
        fx: pinned?.x ?? null,
        fy: pinned?.y ?? null,
      };
    });

    // Prepare edge data
    const edgeData = edges.map((edge) => ({
      source: typeof edge.source === 'string' ? edge.source : edge.source.id,
      target: typeof edge.target === 'string' ? edge.target : edge.target.id,
      weight: edge.weight || 1,
    }));

    // Send init message to worker
    workerRef.current.postMessage({
      type: 'init',
      nodes: nodeData,
      edges: edgeData,
      config: configRef.current,
    });

    setState((prev) => ({ ...prev, isRunning: true, isPaused: false }));
  }, [nodes, edges]);

  /**
   * Stop simulation
   */
  const stop = useCallback(() => {
    if (!workerRef.current) return;

    console.log('[useGraphSimulation] Stopping simulation');

    workerRef.current.postMessage({ type: 'stop' });
  }, []);

  /**
   * Restart simulation
   */
  const restart = useCallback(() => {
    stop();
    setTimeout(start, 100); // Small delay to ensure worker processes stop
  }, [start, stop]);

  /**
   * Pause simulation
   */
  const pause = useCallback(() => {
    if (!workerRef.current) return;

    console.log('[useGraphSimulation] Pausing simulation');

    workerRef.current.postMessage({ type: 'pause' });
  }, []);

  /**
   * Resume simulation
   */
  const resume = useCallback(() => {
    if (!workerRef.current) return;

    console.log('[useGraphSimulation] Resuming simulation');

    workerRef.current.postMessage({ type: 'resume' });
  }, []);

  /**
   * Reheat simulation
   */
  const reheat = useCallback((alpha: number = 1) => {
    if (!workerRef.current) return;

    console.log(`[useGraphSimulation] Reheating simulation (alpha: ${alpha})`);

    workerRef.current.postMessage({ type: 'reheat', alpha });
  }, []);

  /**
   * Configure simulation
   */
  const configure = useCallback((newConfig: Partial<SimulationConfig>) => {
    if (!workerRef.current) return;

    console.log('[useGraphSimulation] Updating configuration:', newConfig);

    configRef.current = { ...configRef.current, ...newConfig };

    workerRef.current.postMessage({
      type: 'configure',
      config: newConfig,
    });
  }, []);

  /**
   * Update nodes
   */
  const updateNodes = useCallback(
    (newNodes: GraphNode[]) => {
      if (!workerRef.current) return;

      console.log(`[useGraphSimulation] Updating nodes (${newNodes.length})`);

      const nodeData = newNodes.map((node) => {
        const pinned = pinnedNodesRef.current.get(node.id);

        return {
          id: node.id,
          x: node.x ?? Math.random() * 1000 - 500,
          y: node.y ?? Math.random() * 1000 - 500,
          fx: pinned?.x ?? null,
          fy: pinned?.y ?? null,
        };
      });

      workerRef.current.postMessage({
        type: 'update',
        nodes: nodeData,
      });
    },
    []
  );

  /**
   * Update edges
   */
  const updateEdges = useCallback((newEdges: GraphEdge[]) => {
    if (!workerRef.current) return;

    console.log(`[useGraphSimulation] Updating edges (${newEdges.length})`);

    const edgeData = newEdges.map((edge) => ({
      source: typeof edge.source === 'string' ? edge.source : edge.source.id,
      target: typeof edge.target === 'string' ? edge.target : edge.target.id,
      weight: edge.weight || 1,
    }));

    workerRef.current.postMessage({
      type: 'update',
      edges: edgeData,
    });
  }, []);

  /**
   * Pin a node to fixed position
   */
  const pinNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      console.log(`[useGraphSimulation] Pinning node ${nodeId} to (${x}, ${y})`);

      pinnedNodesRef.current.set(nodeId, { x, y });

      // Update positions immediately
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(nodeId, { x, y });
        return next;
      });

      // Reheat to adjust layout
      reheat(0.3);
    },
    [reheat]
  );

  /**
   * Unpin a node
   */
  const unpinNode = useCallback(
    (nodeId: string) => {
      console.log(`[useGraphSimulation] Unpinning node ${nodeId}`);

      pinnedNodesRef.current.delete(nodeId);

      // Reheat to adjust layout
      reheat(0.3);
    },
    [reheat]
  );

  /**
   * Auto-start simulation if enabled
   */
  useEffect(() => {
    if (autoStart && isReady && nodes.length > 0) {
      start();
    }
  }, [autoStart, isReady, nodes.length, start]);

  /**
   * Simulation controls API
   */
  const controls: SimulationControls = useMemo(
    () => ({
      start,
      stop,
      restart,
      pause,
      resume,
      reheat,
      configure,
      updateNodes,
      updateEdges,
      pinNode,
      unpinNode,
    }),
    [start, stop, restart, pause, resume, reheat, configure, updateNodes, updateEdges, pinNode, unpinNode]
  );

  return {
    positions,
    controls,
    state,
    isReady,
    error,
  };
}
