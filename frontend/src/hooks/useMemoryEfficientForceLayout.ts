import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: any;
}

interface Edge {
  source: string | Node;
  target: string | Node;
  [key: string]: any;
}

interface ForceLayoutOptions {
  width: number;
  height: number;
  chargeStrength?: number;
  linkDistance?: number;
  linkStrength?: number;
  collisionRadius?: number;
  centerStrength?: number;
  alphaDecay?: number;
  velocityDecay?: number;
  maxIterations?: number;
  adaptivePerformance?: boolean;
}

interface UseMemoryEfficientForceLayoutResult {
  start: (nodes: Node[], edges: Edge[]) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isRunning: boolean;
  progress: number;
}

/**
 * Memory-efficient force layout implementation with adaptive performance
 */
export const useMemoryEfficientForceLayout = (
  options: ForceLayoutOptions,
  onTick?: (nodes: Node[]) => void,
  onEnd?: () => void
): UseMemoryEfficientForceLayoutResult => {
  const {
    width,
    height,
    chargeStrength = -300,
    linkDistance = 100,
    linkStrength = 0.1,
    collisionRadius = 10,
    centerStrength = 0.05,
    alphaDecay = 0.01,
    velocityDecay = 0.4,
    maxIterations = 300,
    adaptivePerformance = true
  } = options;

  const simulationRef = useRef<d3.Simulation<Node, Edge> | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const progressRef = useRef(0);
  const iterationCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const targetFPSRef = useRef(30); // Adaptive target FPS

  // Memory pool for reusing node objects
  const nodePoolRef = useRef<Node[]>([]);
  const activeNodesRef = useRef<Node[]>([]);

  /**
   * Adaptive performance adjustment based on frame time
   */
  const adjustPerformance = useCallback((frameTime: number) => {
    if (!adaptivePerformance) return;

    const targetFrameTime = 1000 / targetFPSRef.current;

    if (frameTime > targetFrameTime * 1.5) {
      // Performance is poor, reduce quality
      targetFPSRef.current = Math.max(15, targetFPSRef.current - 5);
      if (simulationRef.current) {
        simulationRef.current.alphaDecay(alphaDecay * 2); // Speed up convergence
      }
    } else if (frameTime < targetFrameTime * 0.7 && targetFPSRef.current < 30) {
      // Performance is good, increase quality
      targetFPSRef.current = Math.min(30, targetFPSRef.current + 2);
      if (simulationRef.current) {
        simulationRef.current.alphaDecay(alphaDecay); // Normal convergence
      }
    }
  }, [alphaDecay, adaptivePerformance]);

  /**
   * Optimize simulation forces based on node count
   */
  const optimizeForces = useCallback((nodeCount: number) => {
    if (!simulationRef.current) return;

    const simulation = simulationRef.current;

    // Adjust force parameters based on graph size
    if (nodeCount > 500) {
      // Large graph optimizations
      simulation
        .force('charge', d3.forceManyBody()
          .strength(chargeStrength * 0.7)
          .theta(0.9) // More approximate but faster
          .distanceMax(Math.min(300, width / 4)))
        .alphaDecay(alphaDecay * 1.5); // Converge faster
    } else if (nodeCount > 200) {
      // Medium graph
      simulation
        .force('charge', d3.forceManyBody()
          .strength(chargeStrength * 0.85)
          .theta(0.8)
          .distanceMax(Math.min(400, width / 3)))
        .alphaDecay(alphaDecay * 1.2);
    } else {
      // Small graph - full quality
      simulation
        .force('charge', d3.forceManyBody()
          .strength(chargeStrength)
          .theta(0.8)
          .distanceMax(Math.min(500, width / 2)))
        .alphaDecay(alphaDecay);
    }
  }, [chargeStrength, alphaDecay, width]);

  /**
   * Create optimized force simulation
   */
  const createSimulation = useCallback((nodes: Node[], edges: Edge[]) => {
    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Use node pool for memory efficiency
    const simulationNodes = nodes.map((node, i) => {
      const poolNode = nodePoolRef.current[i] || {} as Node;
      Object.assign(poolNode, {
        ...node,
        x: node.x ?? Math.random() * width,
        y: node.y ?? Math.random() * height,
        vx: 0,
        vy: 0
      });
      return poolNode;
    });
    activeNodesRef.current = simulationNodes;

    // Create simulation
    const simulation = d3.forceSimulation(simulationNodes)
      .force('charge', d3.forceManyBody()
        .strength(chargeStrength)
        .theta(0.8)
        .distanceMax(Math.min(500, width / 2)))
      .force('link', d3.forceLink<Node, Edge>(edges)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(linkStrength))
      .force('center', d3.forceCenter(width / 2, height / 2)
        .strength(centerStrength))
      .force('collision', d3.forceCollide()
        .radius(collisionRadius)
        .strength(0.7))
      .force('x', d3.forceX(width / 2).strength(centerStrength))
      .force('y', d3.forceY(height / 2).strength(centerStrength))
      .alpha(1)
      .alphaDecay(alphaDecay)
      .velocityDecay(velocityDecay)
      .stop(); // We'll manually control the simulation

    simulationRef.current = simulation;
    optimizeForces(nodes.length);

    return simulation;
  }, [width, height, chargeStrength, linkDistance, linkStrength, collisionRadius, centerStrength, alphaDecay, velocityDecay, optimizeForces]);

  /**
   * Animation loop with adaptive performance
   */
  const tick = useCallback(() => {
    if (!simulationRef.current || !isRunningRef.current || isPausedRef.current) {
      return;
    }

    const now = performance.now();
    const frameTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    // Adaptive performance adjustment
    if (iterationCountRef.current % 10 === 0) {
      adjustPerformance(frameTime);
    }

    const simulation = simulationRef.current;
    const targetFrameTime = 1000 / targetFPSRef.current;

    // Calculate how many iterations to run this frame
    const iterationsPerFrame = Math.max(1, Math.floor(targetFrameTime / 10));

    for (let i = 0; i < iterationsPerFrame; i++) {
      if (simulation.alpha() < 0.001 || iterationCountRef.current >= maxIterations) {
        // Simulation has converged or reached max iterations
        isRunningRef.current = false;
        progressRef.current = 100;
        onEnd?.();
        return;
      }

      simulation.tick();
      iterationCountRef.current++;
    }

    // Update progress
    progressRef.current = Math.min(100, (iterationCountRef.current / maxIterations) * 100);

    // Constrain positions to viewport
    const nodes = activeNodesRef.current.map(node => ({
      ...node,
      x: Math.max(20, Math.min(width - 20, node.x)),
      y: Math.max(20, Math.min(height - 20, node.y))
    }));

    // Notify tick callback
    onTick?.(nodes);

    // Schedule next frame
    rafIdRef.current = requestAnimationFrame(tick);
  }, [width, height, maxIterations, adjustPerformance, onEnd, onTick]);

  /**
   * Start the force layout
   */
  const start = useCallback((nodes: Node[], edges: Edge[]) => {
    if (isRunningRef.current) return;

    console.log(`🚀 Starting memory-efficient force layout: ${nodes.length} nodes, ${edges.length} edges`);

    // Reset state
    isRunningRef.current = true;
    isPausedRef.current = false;
    iterationCountRef.current = 0;
    progressRef.current = 0;
    lastFrameTimeRef.current = performance.now();
    targetFPSRef.current = 30;

    // Ensure node pool is large enough
    while (nodePoolRef.current.length < nodes.length) {
      nodePoolRef.current.push({} as Node);
    }

    // Create and start simulation
    createSimulation(nodes, edges);
    tick();
  }, [createSimulation, tick]);

  /**
   * Stop the force layout
   */
  const stop = useCallback(() => {
    isRunningRef.current = false;
    isPausedRef.current = false;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Clear active nodes but keep pool for reuse
    activeNodesRef.current = [];
  }, []);

  /**
   * Pause the force layout
   */
  const pause = useCallback(() => {
    isPausedRef.current = true;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  /**
   * Resume the force layout
   */
  const resume = useCallback(() => {
    if (!isRunningRef.current || !isPausedRef.current) return;
    isPausedRef.current = false;
    lastFrameTimeRef.current = performance.now();
    tick();
  }, [tick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      // Clear node pool on unmount
      nodePoolRef.current = [];
    };
  }, [stop]);

  return {
    start,
    stop,
    pause,
    resume,
    isRunning: isRunningRef.current,
    progress: progressRef.current
  };
};