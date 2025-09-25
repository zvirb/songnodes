import { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  forceSimulation,
  forceLink,
  forceCenter,
  forceManyBody,
  forceCollide,
  forceRadial,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { GraphData, GraphNode, GraphEdge, DEFAULT_CONFIG } from '../types';
import { debounce } from '../utils/graphHelpers';

// Extended node type for D3 simulation
export interface SimulationNode extends GraphNode, SimulationNodeDatum {
  // D3 adds x, y, vx, vy properties
}

// Extended edge type for D3 simulation
export interface SimulationLink extends Omit<GraphEdge, 'source' | 'target'>, SimulationLinkDatum<SimulationNode> {
  source: SimulationNode;
  target: SimulationNode;
}

export interface GraphLayoutOptions {
  width: number;
  height: number;
  centerForce?: number;
  chargeForce?: number;
  linkDistance?: number;
  linkStrength?: number;
  collisionRadius?: number;
  alphaTarget?: number;
  alphaDecay?: number;
  velocityDecay?: number;
  enableCollision?: boolean;
  enableCentering?: boolean;
  enableRadial?: boolean;
  radialRadius?: number;
  animate?: boolean;
}

export interface GraphLayoutState {
  isRunning: boolean;
  alpha: number;
  iterations: number;
  temperature: number;
}

export interface UseGraphLayoutReturn {
  nodes: SimulationNode[];
  links: SimulationLink[];
  simulation: Simulation<SimulationNode, SimulationLink> | null;
  state: GraphLayoutState;
  start: () => void;
  stop: () => void;
  restart: () => void;
  reheat: () => void;
  updateOptions: (options: Partial<GraphLayoutOptions>) => void;
  setNodePositions: (positions: Array<{ id: string; x: number; y: number }>) => void;
  pinNode: (nodeId: string, x?: number, y?: number) => void;
  unpinNode: (nodeId: string) => void;
  centerGraph: () => void;
}

const DEFAULT_OPTIONS: GraphLayoutOptions = {
  width: 800,
  height: 600,
  centerForce: 1,
  chargeForce: -300,
  linkDistance: 50,
  linkStrength: 1,
  collisionRadius: 10,
  alphaTarget: 0,
  alphaDecay: 0.0228,
  velocityDecay: 0.4,
  enableCollision: true,
  enableCentering: true,
  enableRadial: false,
  radialRadius: 200,
  animate: true,
};

export function useGraphLayout(
  graphData: GraphData,
  options: Partial<GraphLayoutOptions> = {},
  onTick?: (nodes: SimulationNode[], links: SimulationLink[]) => void,
  onEnd?: (nodes: SimulationNode[], links: SimulationLink[]) => void
): UseGraphLayoutReturn {
  const mergedOptions = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);

  // Refs for simulation and data
  const simulationRef = useRef<Simulation<SimulationNode, SimulationLink> | null>(null);
  const nodesRef = useRef<SimulationNode[]>([]);
  const linksRef = useRef<SimulationLink[]>([]);
  const stateRef = useRef<GraphLayoutState>({
    isRunning: false,
    alpha: 0,
    iterations: 0,
    temperature: 0,
  });

  // Convert graph data to simulation format
  const convertGraphData = useCallback((data: GraphData): { nodes: SimulationNode[]; links: SimulationLink[] } => {
    // Convert nodes
    const simulationNodes: SimulationNode[] = data.nodes.map(node => ({
      ...node,
      // Preserve existing positions if available
      x: node.x ?? undefined,
      y: node.y ?? undefined,
      vx: node.vx ?? 0,
      vy: node.vy ?? 0,
      fx: node.fx ?? null,
      fy: node.fy ?? null,
    }));

    // Create node lookup map
    const nodeMap = new Map<string, SimulationNode>();
    simulationNodes.forEach(node => {
      nodeMap.set(node.id, node);
    });

    // Convert edges to links
    const simulationLinks: SimulationLink[] = data.edges
      .map(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);

        if (!source || !target) {
          console.warn(`Invalid edge: ${edge.source} -> ${edge.target}`);
          return null;
        }

        return {
          ...edge,
          source,
          target,
        };
      })
      .filter((link): link is SimulationLink => link !== null);

    return { nodes: simulationNodes, links: simulationLinks };
  }, []);

  // Debounced tick callback to improve performance
  const debouncedTick = useMemo(
    () => debounce((nodes: SimulationNode[], links: SimulationLink[]) => {
      onTick?.(nodes, links);
    }, 16), // ~60fps
    [onTick]
  );

  // Initialize or update simulation
  const updateSimulation = useCallback(() => {
    const { nodes, links } = convertGraphData(graphData);

    // Update refs
    nodesRef.current = nodes;
    linksRef.current = links;

    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create new simulation
    const simulation = forceSimulation<SimulationNode>(nodes)
      .alphaTarget(mergedOptions.alphaTarget || 0)
      .alphaDecay(mergedOptions.alphaDecay || 0.0228)
      .velocityDecay(mergedOptions.velocityDecay || 0.4);

    // Add forces
    if (mergedOptions.enableCentering) {
      simulation.force('center', forceCenter(mergedOptions.width / 2, mergedOptions.height / 2)
        .strength(mergedOptions.centerForce || 1));
    }

    simulation.force('charge', forceManyBody()
      .strength(mergedOptions.chargeForce || -300));

    if (links.length > 0) {
      simulation.force('link', forceLink<SimulationNode, SimulationLink>(links)
        .id(d => d.id)
        .distance(mergedOptions.linkDistance || 50)
        .strength(mergedOptions.linkStrength || 1));
    }

    if (mergedOptions.enableCollision) {
      simulation.force('collision', forceCollide<SimulationNode>()
        .radius(d => (d.radius || DEFAULT_CONFIG.graph.defaultRadius) + (mergedOptions.collisionRadius || 10))
        .strength(0.7));
    }

    if (mergedOptions.enableRadial) {
      simulation.force('radial', forceRadial<SimulationNode>(mergedOptions.radialRadius || 200, mergedOptions.width / 2, mergedOptions.height / 2)
        .strength(0.1));
    }

    // Set up event handlers
    simulation.on('tick', () => {
      stateRef.current = {
        isRunning: simulation.alpha() > simulation.alphaMin(),
        alpha: simulation.alpha(),
        iterations: stateRef.current.iterations + 1,
        temperature: simulation.alpha(),
      };

      if (mergedOptions.animate) {
        debouncedTick(nodes, links);
      }
    });

    simulation.on('end', () => {
      stateRef.current = {
        ...stateRef.current,
        isRunning: false,
        alpha: 0,
      };

      onEnd?.(nodes, links);
    });

    simulationRef.current = simulation;

    // Start simulation if animate is enabled
    if (mergedOptions.animate) {
      simulation.restart();
    } else {
      // Run simulation to completion without animation
      for (let i = 0; i < 300 && simulation.alpha() > simulation.alphaMin(); i++) {
        simulation.tick();
      }
      simulation.stop();
      onEnd?.(nodes, links);
    }
  }, [graphData, mergedOptions, debouncedTick, onEnd, convertGraphData]);

  // Initialize simulation on mount and when dependencies change
  useEffect(() => {
    updateSimulation();

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [updateSimulation]);

  // Control functions
  const start = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.restart();
    }
  }, []);

  const stop = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
    }
  }, []);

  const restart = useCallback(() => {
    if (simulationRef.current) {
      stateRef.current.iterations = 0;
      simulationRef.current.alpha(1).restart();
    }
  }, []);

  const reheat = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.3).restart();
    }
  }, []);

  const updateOptions = useCallback((newOptions: Partial<GraphLayoutOptions>) => {
    // This will trigger updateSimulation through the options dependency
    Object.assign(mergedOptions, newOptions);
    updateSimulation();
  }, [updateSimulation, mergedOptions]);

  const setNodePositions = useCallback((positions: Array<{ id: string; x: number; y: number }>) => {
    const nodeMap = new Map(nodesRef.current.map(node => [node.id, node]));

    positions.forEach(({ id, x, y }) => {
      const node = nodeMap.get(id);
      if (node) {
        node.x = x;
        node.y = y;
        node.fx = x;
        node.fy = y;
      }
    });

    if (simulationRef.current) {
      simulationRef.current.alpha(0.1).restart();
    }
  }, []);

  const pinNode = useCallback((nodeId: string, x?: number, y?: number) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = x ?? node.x;
      node.fy = y ?? node.y;

      if (simulationRef.current) {
        simulationRef.current.alpha(0.1).restart();
      }
    }
  }, []);

  const unpinNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;

      if (simulationRef.current) {
        simulationRef.current.alpha(0.1).restart();
      }
    }
  }, []);

  const centerGraph = useCallback(() => {
    if (nodesRef.current.length === 0) return;

    // Calculate current bounds
    const positions = nodesRef.current
      .filter(node => typeof node.x === 'number' && typeof node.y === 'number')
      .map(node => ({ x: node.x!, y: node.y! }));

    if (positions.length === 0) return;

    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));

    const currentCenterX = (minX + maxX) / 2;
    const currentCenterY = (minY + maxY) / 2;

    const targetCenterX = mergedOptions.width / 2;
    const targetCenterY = mergedOptions.height / 2;

    const offsetX = targetCenterX - currentCenterX;
    const offsetY = targetCenterY - currentCenterY;

    // Apply offset to all nodes
    nodesRef.current.forEach(node => {
      if (typeof node.x === 'number') node.x += offsetX;
      if (typeof node.y === 'number') node.y += offsetY;
    });

    if (simulationRef.current) {
      simulationRef.current.alpha(0.1).restart();
    }
  }, [mergedOptions.width, mergedOptions.height]);

  return {
    nodes: nodesRef.current,
    links: linksRef.current,
    simulation: simulationRef.current,
    state: stateRef.current,
    start,
    stop,
    restart,
    reheat,
    updateOptions,
    setNodePositions,
    pinNode,
    unpinNode,
    centerGraph,
  };
}