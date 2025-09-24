import { useEffect, useRef, useCallback } from 'react';
import { NodeVisual, EdgeVisual, LayoutOptions } from '@types/graph';
import * as d3 from 'd3';

interface UseOptimizedForceLayoutOptions {
  width: number;
  height: number;
  layoutOptions: LayoutOptions;
  onTick?: (nodes: NodeVisual[]) => void;
  onEnd?: () => void;
  enabled: boolean;
}

interface SimulationNode extends NodeVisual {
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export const useOptimizedForceLayout = ({
  width,
  height,
  layoutOptions,
  onTick,
  onEnd,
  enabled
}: UseOptimizedForceLayoutOptions) => {
  const workerRef = useRef<Worker | null>(null);
  const simulationRef = useRef<d3.Simulation<SimulationNode, EdgeVisual> | null>(null);
  const nodesRef = useRef<NodeVisual[]>([]);
  const edgesRef = useRef<EdgeVisual[]>([]);
  const isRunningRef = useRef<boolean>(false);
  // Disable worker by default - just use fallback
  const useWorkerRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  // Fallback in-thread simulation
  const createFallbackSimulation = useCallback((nodes: SimulationNode[], edges: EdgeVisual[]) => {
    console.log('🔄 Using fallback in-thread force simulation');

    // Create mutable copies of nodes to avoid Redux immutability errors
    const mutableNodes = nodes.map(node => ({ ...node }));
    const mutableEdges = edges.map(edge => ({ ...edge }));

    // Create D3 force simulation
    const simulation = d3.forceSimulation(mutableNodes)
      .force('charge', d3.forceManyBody()
        .strength(layoutOptions?.forceDirected?.charge || -300)
        .distanceMax(300))
      .force('link', d3.forceLink(mutableEdges)
        .id((d: any) => d.id)
        .distance(layoutOptions?.forceDirected?.linkDistance || 100)
        .strength(layoutOptions?.forceDirected?.linkStrength || 0.1))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius(20)
        .strength(0.5))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .alpha(1)
      .alphaDecay(layoutOptions?.forceDirected?.alphaDecay || 0.01)
      .velocityDecay(layoutOptions?.forceDirected?.velocityDecay || 0.4);

    simulationRef.current = simulation;

    // Manual tick handling for better control
    let tickCount = 0;
    const maxTicks = 300;

    const tick = () => {
      if (!simulationRef.current || tickCount >= maxTicks || simulation.alpha() < 0.005) {
        isRunningRef.current = false;
        if (onEnd) onEnd();
        return;
      }

      simulation.tick();
      tickCount++;

      // Update node positions (use mutableNodes which have been updated by D3)
      const updatedNodes = mutableNodes.map(node => ({
        ...node,
        x: Math.max(10, Math.min(width - 10, node.x || width / 2)),
        y: Math.max(10, Math.min(height - 10, node.y || height / 2))
      }));

      nodesRef.current = updatedNodes;
      if (onTick) onTick(updatedNodes);

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [width, height]); // Simplified dependencies to avoid loops

  useEffect(() => {
    // Try to create Worker, fall back if it fails
    let testTimeout: NodeJS.Timeout | null = null;

    if (useWorkerRef.current) {
      try {
        console.log('🔧 Attempting to create physics worker...');
        const worker = new Worker(new URL('../../workers/physics.worker.ts', import.meta.url), {
          type: 'module'
        });

        // Test the worker with a timeout
        testTimeout = setTimeout(() => {
          console.warn('⚠️ Worker initialization timeout, switching to fallback');
          try {
            worker.terminate();
          } catch (e) {
            // Ignore termination errors
          }
          workerRef.current = null;
          useWorkerRef.current = false;
        }, 2000);

        worker.onmessage = (event) => {
          if (testTimeout) {
            clearTimeout(testTimeout);
            testTimeout = null;
          }
          const { type, nodes } = event.data;
          console.log('📨 Worker message:', type, nodes?.length || 0);
          if (type === 'tick') {
            nodesRef.current = nodes;
            if (onTick) {
              onTick(nodes);
            }
          } else if (type === 'end') {
            isRunningRef.current = false;
            if (onEnd) {
              onEnd();
            }
          }
        };

        worker.onerror = (error) => {
          console.warn('⚠️ Worker error (switching to fallback):', error);
          if (testTimeout) {
            clearTimeout(testTimeout);
            testTimeout = null;
          }
          try {
            worker.terminate();
          } catch (e) {
            // Ignore termination errors
          }
          workerRef.current = null;
          useWorkerRef.current = false;

          // If simulation is running, switch to fallback immediately
          if (isRunningRef.current && nodesRef.current.length > 0) {
            console.log('🔄 Switching running simulation to fallback');
            const currentNodes = nodesRef.current;
            const currentEdges = edgesRef.current;
            createFallbackSimulation(currentNodes, currentEdges);
          }
        };

        workerRef.current = worker;
      } catch (error) {
        console.warn('⚠️ Failed to create worker (using fallback):', error);
        useWorkerRef.current = false;
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // Only run once on mount

  const start = useCallback((nodes: NodeVisual[], edges: EdgeVisual[]) => {
    console.log('🏁 Force layout start called:', {
      enabled,
      isRunning: isRunningRef.current,
      hasWorker: !!workerRef.current,
      useWorker: useWorkerRef.current,
      nodeCount: nodes.length
    });

    if (!enabled || isRunningRef.current || nodes.length === 0) return;

    // Initialize node positions if not set - create mutable copies
    const simulationNodes: SimulationNode[] = nodes.map(node => ({
      ...JSON.parse(JSON.stringify(node)), // Deep clone to ensure mutability
      x: node.x || Math.random() * width,
      y: node.y || Math.random() * height,
      vx: 0,
      vy: 0
    }));

    // Create mutable copies of edges as well
    const simulationEdges = edges.map(edge => ({
      ...JSON.parse(JSON.stringify(edge))
    }));

    nodesRef.current = [...simulationNodes];
    edgesRef.current = [...simulationEdges]; // Store edges for potential fallback
    isRunningRef.current = true;

    if (workerRef.current && useWorkerRef.current) {
      // Use worker if available
      console.log('✅ Using Web Worker for force layout');
      workerRef.current.postMessage({ type: 'start', nodes: simulationNodes, edges: simulationEdges, width, height, layoutOptions });
    } else {
      // Use fallback
      console.log('⚡ Using fallback force layout (no worker)');
      createFallbackSimulation(simulationNodes, simulationEdges);
    }
  }, [enabled, width, height]); // Remove createFallbackSimulation from dependencies

  const stop = useCallback(() => {
    if (!isRunningRef.current) return;

    if (workerRef.current && useWorkerRef.current) {
      workerRef.current.postMessage({ type: 'stop' });
    } else if (simulationRef.current) {
      simulationRef.current.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    isRunningRef.current = false;
  }, []);

  const restart = useCallback((alpha: number = 1.0) => {
    if (workerRef.current && useWorkerRef.current) {
      workerRef.current.postMessage({ type: 'restart', alpha });
    } else if (simulationRef.current) {
      simulationRef.current.alpha(alpha);
      simulationRef.current.restart();
    }
    isRunningRef.current = true;
  }, []);

  return {
    start,
    stop,
    restart,
    isRunning: isRunningRef.current,
    isOptimized: useWorkerRef.current
  };
};