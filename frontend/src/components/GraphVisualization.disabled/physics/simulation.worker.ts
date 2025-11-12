/**
 * D3-Force Physics Simulation Web Worker
 * Runs force-directed layout in a separate thread to avoid blocking the UI
 *
 * Benefits:
 * - Non-blocking UI during simulation
 * - Better performance on multi-core systems
 * - Adaptive simulation (pause when stable)
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';

/**
 * Worker node datum (minimal data for simulation)
 */
interface WorkerNode extends SimulationNodeDatum {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * Worker edge datum
 */
interface WorkerEdge extends SimulationLinkDatum<WorkerNode> {
  source: string | WorkerNode;
  target: string | WorkerNode;
  weight?: number;
}

/**
 * Simulation configuration
 */
interface SimulationConfig {
  charge?: number;
  linkDistance?: number;
  linkStrength?: number;
  centerStrength?: number;
  collideRadius?: number;
  alphaDecay?: number;
  velocityDecay?: number;
  alphaMin?: number;
}

/**
 * Message types
 */
type MessageType =
  | 'init'
  | 'update'
  | 'tick'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'configure'
  | 'reheat'
  | 'end';

/**
 * Message structure from main thread
 */
interface IncomingMessage {
  type: MessageType;
  nodes?: WorkerNode[];
  edges?: WorkerEdge[];
  config?: SimulationConfig;
  alpha?: number;
}

/**
 * Message structure to main thread
 */
interface OutgoingMessage {
  type: MessageType;
  nodes?: Array<{ id: string; x: number; y: number; vx: number; vy: number }>;
  state?: {
    alpha: number;
    isRunning: boolean;
    iterations: number;
  };
  error?: string;
}

// Global simulation instance
let simulation: Simulation<WorkerNode, WorkerEdge> | null = null;
let isRunning = false;
let iterationCount = 0;

// Default configuration
const DEFAULT_CONFIG: Required<SimulationConfig> = {
  charge: -300,
  linkDistance: 100,
  linkStrength: 0.5,
  centerStrength: 0.1,
  collideRadius: 30,
  alphaDecay: 0.0228, // D3 default
  velocityDecay: 0.4, // D3 default
  alphaMin: 0.001,
};

let currentConfig: Required<SimulationConfig> = { ...DEFAULT_CONFIG };

/**
 * Send message to main thread
 */
function postMessage(message: OutgoingMessage): void {
  self.postMessage(message);
}

/**
 * Initialize simulation with nodes and edges
 */
function initSimulation(nodes: WorkerNode[], edges: WorkerEdge[], config?: SimulationConfig): void {
  try {
    // Merge config with defaults
    currentConfig = { ...DEFAULT_CONFIG, ...config };

    // Create simulation
    simulation = forceSimulation<WorkerNode, WorkerEdge>(nodes)
      .force(
        'charge',
        forceManyBody<WorkerNode>().strength(currentConfig.charge)
      )
      .force(
        'link',
        forceLink<WorkerNode, WorkerEdge>(edges)
          .id((d) => d.id)
          .distance(currentConfig.linkDistance)
          .strength(currentConfig.linkStrength)
      )
      .force(
        'center',
        forceCenter<WorkerNode>(0, 0).strength(currentConfig.centerStrength)
      )
      .force(
        'collide',
        forceCollide<WorkerNode>(currentConfig.collideRadius)
      )
      .alphaDecay(currentConfig.alphaDecay)
      .velocityDecay(currentConfig.velocityDecay)
      .alphaMin(currentConfig.alphaMin)
      .on('tick', handleTick)
      .on('end', handleEnd);

    isRunning = true;
    iterationCount = 0;

    postMessage({
      type: 'init',
      state: {
        alpha: simulation.alpha(),
        isRunning,
        iterations: iterationCount,
      },
    });
  } catch (error) {
    postMessage({
      type: 'init',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle simulation tick
 */
function handleTick(): void {
  if (!simulation) return;

  iterationCount++;

  // Send positions to main thread (throttled - every 3 ticks for performance)
  if (iterationCount % 3 === 0) {
    const nodes = simulation.nodes().map((node) => ({
      id: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      vx: node.vx ?? 0,
      vy: node.vy ?? 0,
    }));

    postMessage({
      type: 'tick',
      nodes,
      state: {
        alpha: simulation.alpha(),
        isRunning,
        iterations: iterationCount,
      },
    });
  }
}

/**
 * Handle simulation end
 */
function handleEnd(): void {
  if (!simulation) return;

  isRunning = false;

  // Send final positions
  const nodes = simulation.nodes().map((node) => ({
    id: node.id,
    x: node.x ?? 0,
    y: node.y ?? 0,
    vx: node.vx ?? 0,
    vy: node.vy ?? 0,
  }));

  postMessage({
    type: 'end',
    nodes,
    state: {
      alpha: simulation.alpha(),
      isRunning,
      iterations: iterationCount,
    },
  });
}

/**
 * Update simulation with new nodes/edges
 */
function updateSimulation(nodes?: WorkerNode[], edges?: WorkerEdge[]): void {
  if (!simulation) {
    postMessage({
      type: 'update',
      error: 'Simulation not initialized',
    });
    return;
  }

  try {
    if (nodes) {
      simulation.nodes(nodes);
    }

    if (edges) {
      const linkForce = simulation.force('link') as ReturnType<typeof forceLink<WorkerNode, WorkerEdge>>;
      if (linkForce) {
        linkForce.links(edges);
      }
    }

    // Reheat simulation
    simulation.alpha(1).restart();
    isRunning = true;
    iterationCount = 0;

    postMessage({
      type: 'update',
      state: {
        alpha: simulation.alpha(),
        isRunning,
        iterations: iterationCount,
      },
    });
  } catch (error) {
    postMessage({
      type: 'update',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Pause simulation
 */
function pauseSimulation(): void {
  if (simulation) {
    simulation.stop();
    isRunning = false;

    postMessage({
      type: 'pause',
      state: {
        alpha: simulation.alpha(),
        isRunning,
        iterations: iterationCount,
      },
    });
  }
}

/**
 * Resume simulation
 */
function resumeSimulation(): void {
  if (simulation) {
    simulation.restart();
    isRunning = true;

    postMessage({
      type: 'resume',
      state: {
        alpha: simulation.alpha(),
        isRunning,
        iterations: iterationCount,
      },
    });
  }
}

/**
 * Stop and destroy simulation
 */
function stopSimulation(): void {
  if (simulation) {
    simulation.stop();
    simulation = null;
    isRunning = false;
    iterationCount = 0;

    postMessage({
      type: 'stop',
      state: {
        alpha: 0,
        isRunning,
        iterations: iterationCount,
      },
    });
  }
}

/**
 * Configure simulation forces
 */
function configureSimulation(config: SimulationConfig): void {
  if (!simulation) {
    postMessage({
      type: 'configure',
      error: 'Simulation not initialized',
    });
    return;
  }

  try {
    // Update current config
    currentConfig = { ...currentConfig, ...config };

    // Update forces
    if (config.charge !== undefined) {
      simulation.force(
        'charge',
        forceManyBody<WorkerNode>().strength(config.charge)
      );
    }

    if (config.linkDistance !== undefined || config.linkStrength !== undefined) {
      const linkForce = simulation.force('link') as ReturnType<typeof forceLink<WorkerNode, WorkerEdge>>;
      if (linkForce) {
        if (config.linkDistance !== undefined) {
          linkForce.distance(config.linkDistance);
        }
        if (config.linkStrength !== undefined) {
          linkForce.strength(config.linkStrength);
        }
      }
    }

    if (config.centerStrength !== undefined) {
      simulation.force(
        'center',
        forceCenter<WorkerNode>(0, 0).strength(config.centerStrength)
      );
    }

    if (config.collideRadius !== undefined) {
      simulation.force(
        'collide',
        forceCollide<WorkerNode>(config.collideRadius)
      );
    }

    if (config.alphaDecay !== undefined) {
      simulation.alphaDecay(config.alphaDecay);
    }

    if (config.velocityDecay !== undefined) {
      simulation.velocityDecay(config.velocityDecay);
    }

    if (config.alphaMin !== undefined) {
      simulation.alphaMin(config.alphaMin);
    }

    postMessage({
      type: 'configure',
      state: {
        alpha: simulation.alpha(),
        isRunning,
        iterations: iterationCount,
      },
    });
  } catch (error) {
    postMessage({
      type: 'configure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Reheat simulation (restart with new alpha)
 */
function reheatSimulation(alpha?: number): void {
  if (!simulation) {
    postMessage({
      type: 'reheat',
      error: 'Simulation not initialized',
    });
    return;
  }

  try {
    simulation.alpha(alpha ?? 1).restart();
    isRunning = true;
    iterationCount = 0;

    postMessage({
      type: 'reheat',
      state: {
        alpha: simulation.alpha(),
        isRunning,
        iterations: iterationCount,
      },
    });
  } catch (error) {
    postMessage({
      type: 'reheat',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const { type, nodes, edges, config, alpha } = event.data;

  switch (type) {
    case 'init':
      if (nodes && edges) {
        initSimulation(nodes, edges, config);
      }
      break;

    case 'update':
      updateSimulation(nodes, edges);
      break;

    case 'pause':
      pauseSimulation();
      break;

    case 'resume':
      resumeSimulation();
      break;

    case 'stop':
      stopSimulation();
      break;

    case 'configure':
      if (config) {
        configureSimulation(config);
      }
      break;

    case 'reheat':
      reheatSimulation(alpha);
      break;

    default:
      postMessage({
        type: 'tick',
        error: `Unknown message type: ${type}`,
      });
  }
};

// Export type for TypeScript
export type { IncomingMessage, OutgoingMessage, SimulationConfig, WorkerNode, WorkerEdge };
