/**
 * Optimized Graph Canvas Hook - Integration Point for All Performance Features
 * Combines Barnes-Hut simulation, virtual rendering, memory management, and monitoring
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@store/index';
import { NodeVisual, EdgeVisual, LayoutOptions } from '@types/graph';
import { useOptimizedForceLayout } from './useOptimizedForceLayout';
import { VirtualRenderer, ViewportBounds, createVirtualRenderer } from '@utils/virtualRenderer';
import { globalMemoryManager, PooledNode, PooledEdge } from '@utils/memoryManagement';
import { 
  globalPerformanceMonitor, 
  recordFramePerformance, 
  startPerformanceMonitoring,
  stopPerformanceMonitoring 
} from '@utils/performanceMonitor';
import { OptimizedWebSocket, createOptimizedWebSocket } from '@utils/optimizedWebSocket';

export interface OptimizedGraphCanvasConfig {
  width: number;
  height: number;
  layoutOptions: LayoutOptions;
  performanceMode: 'high' | 'balanced' | 'battery' | 'auto';
  enableVirtualRendering: boolean;
  enablePerformanceMonitoring: boolean;
  enableMemoryOptimization: boolean;
  enableNetworkOptimization: boolean;
  maxNodes: number;
  maxEdges: number;
  targetFPS: number;
}

export interface GraphCanvasMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  simulationTime: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
  visibleNodes: number;
  visibleEdges: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  optimizations: {
    barnesHutEnabled: boolean;
    virtualRenderingEnabled: boolean;
    memoryPoolingEnabled: boolean;
    lodEnabled: boolean;
  };
}

export const useOptimizedGraphCanvas = (
  config: OptimizedGraphCanvasConfig,
  canvasRef: React.RefObject<HTMLCanvasElement>
) => {
  const dispatch = useAppDispatch();
  
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [metrics, setMetrics] = useState<GraphCanvasMetrics>({
    fps: 0,
    frameTime: 0,
    renderTime: 0,
    simulationTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    edgeCount: 0,
    visibleNodes: 0,
    visibleEdges: 0,
    performanceGrade: 'A',
    optimizations: {
      barnesHutEnabled: true,
      virtualRenderingEnabled: config.enableVirtualRendering,
      memoryPoolingEnabled: config.enableMemoryOptimization,
      lodEnabled: config.enableVirtualRendering
    }
  });

  // Refs for components
  const virtualRendererRef = useRef<VirtualRenderer | null>(null);
  const websocketRef = useRef<OptimizedWebSocket | null>(null);
  const frameTimerRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const pooledNodesRef = useRef<Map<string, PooledNode>>(new Map());
  const pooledEdgesRef = useRef<Map<string, PooledEdge>>(new Map());

  // Current viewport state
  const [viewport, setViewport] = useState<ViewportBounds>({
    x: 0,
    y: 0,
    width: config.width,
    height: config.height,
    scale: 1.0
  });

  // Optimized force layout hook
  const forceLayout = useOptimizedForceLayout({
    width: config.width,
    height: config.height,
    layoutOptions: config.layoutOptions,
    onTick: handleSimulationTick,
    onEnd: handleSimulationEnd,
    enabled: true
  });

  /**
   * Initialize all performance systems
   */
  const initialize = useCallback(async () => {
    if (!canvasRef.current || isInitialized) return;

    try {
      // Initialize virtual renderer
      if (config.enableVirtualRendering) {
        virtualRendererRef.current = createVirtualRenderer(canvasRef.current, viewport);
      }

      // Start performance monitoring
      if (config.enablePerformanceMonitoring) {
        startPerformanceMonitoring(1000); // Update every second
        
        globalPerformanceMonitor.onAlert((alert) => {
          console.warn('Performance Alert:', alert.message, alert.suggestions);
          
          // Auto-adjust performance mode based on alerts
          if (alert.type === 'critical' && config.performanceMode === 'auto') {
            adjustPerformanceMode('battery');
          }
        });
      }

      // Initialize WebSocket if needed
      if (config.enableNetworkOptimization) {
        // This would be configured based on actual WebSocket endpoints
        // websocketRef.current = createOptimizedWebSocket({
        //   url: 'ws://localhost:8080/graph-updates',
        //   compression: true,
        //   batchSize: 10,
        //   maxRetries: 3
        // });
      }

      setIsInitialized(true);
      console.log('Optimized graph canvas initialized');

    } catch (error) {
      console.error('Failed to initialize optimized graph canvas:', error);
    }
  }, [canvasRef, config, viewport, isInitialized]);

  /**
   * Handle simulation tick with performance tracking
   */
  const handleSimulationTick = useCallback((nodes: NodeVisual[]) => {
    const tickStart = performance.now();
    
    try {
      // Update pooled objects if memory optimization is enabled
      if (config.enableMemoryOptimization) {
        updatePooledObjects(nodes);
      }

      // Render with virtual renderer or fallback to canvas
      let renderTime = 0;
      if (virtualRendererRef.current && config.enableVirtualRendering) {
        const renderStart = performance.now();
        const renderStats = virtualRendererRef.current.render(nodes, [], viewport);
        renderTime = performance.now() - renderStart;
        
        // Update metrics from virtual renderer
        setMetrics(prev => ({
          ...prev,
          visibleNodes: renderStats.visibleNodes,
          visibleEdges: renderStats.visibleEdges,
          renderTime: renderStats.renderTime
        }));
      }

      // Record performance metrics
      const tickEnd = performance.now();
      const frameTime = tickEnd - lastFrameTimeRef.current;
      const simulationTime = tickEnd - tickStart - renderTime;
      
      if (config.enablePerformanceMonitoring) {
        recordFramePerformance({
          frameTime,
          renderTime,
          simulationTime,
          nodeCount: nodes.length,
          edgeCount: 0, // Would need edge count from props
          networkLatency: websocketRef.current?.getMetrics().averageLatency || 0
        });
      }

      // Update local metrics
      updateMetrics(frameTime, renderTime, simulationTime, nodes.length);
      
      lastFrameTimeRef.current = tickEnd;

    } catch (error) {
      console.error('Error in simulation tick:', error);
    }
  }, [config, viewport]);

  /**
   * Handle simulation end
   */
  const handleSimulationEnd = useCallback(() => {
    console.log('Force simulation completed');
  }, []);

  /**
   * Update pooled objects for memory optimization
   */
  const updatePooledObjects = useCallback((nodes: NodeVisual[]) => {
    // Release unused pooled nodes
    const currentNodeIds = new Set(nodes.map(n => n.id));
    for (const [id, pooledNode] of pooledNodesRef.current) {
      if (!currentNodeIds.has(id)) {
        globalMemoryManager.releaseNode(pooledNode);
        pooledNodesRef.current.delete(id);
      }
    }

    // Acquire new pooled nodes as needed
    for (const node of nodes) {
      if (!pooledNodesRef.current.has(node.id)) {
        const pooledNode = globalMemoryManager.acquireNode();
        pooledNode.initialize({
          id: node.id,
          x: node.x,
          y: node.y,
          radius: node.radius,
          color: node.color
        });
        pooledNodesRef.current.set(node.id, pooledNode);
      }
    }
  }, []);

  /**
   * Update performance metrics
   */
  const updateMetrics = useCallback((
    frameTime: number,
    renderTime: number,
    simulationTime: number,
    nodeCount: number
  ) => {
    const fps = frameTime > 0 ? 1000 / frameTime : 0;
    const memoryMetrics = globalMemoryManager.getMetrics();
    
    // Calculate performance grade
    let performanceGrade: GraphCanvasMetrics['performanceGrade'] = 'A';
    if (fps < 15) performanceGrade = 'F';
    else if (fps < 25) performanceGrade = 'D';
    else if (fps < 35) performanceGrade = 'C';
    else if (fps < 50) performanceGrade = 'B';

    setMetrics(prev => ({
      ...prev,
      fps,
      frameTime,
      renderTime,
      simulationTime,
      memoryUsage: memoryMetrics.overall.memoryUsage,
      nodeCount,
      performanceGrade
    }));
  }, []);

  /**
   * Adjust performance mode dynamically
   */
  const adjustPerformanceMode = useCallback((mode: 'high' | 'balanced' | 'battery') => {
    console.log(`Adjusting performance mode to: ${mode}`);
    
    switch (mode) {
      case 'high':
        // Enable all optimizations, prioritize quality
        forceLayout.updateParameters({
          theta: 0.3, // More accurate Barnes-Hut
          alphaDecay: 0.02 // Slower cooling for better convergence
        });
        break;
        
      case 'balanced':
        // Default optimizations
        forceLayout.updateParameters({
          theta: 0.5,
          alphaDecay: 0.0228
        });
        break;
        
      case 'battery':
        // Aggressive optimizations, prioritize performance
        forceLayout.updateParameters({
          theta: 0.8, // Less accurate but faster Barnes-Hut
          alphaDecay: 0.05 // Faster cooling
        });
        
        // Force memory optimization
        if (config.enableMemoryOptimization) {
          globalMemoryManager.optimize();
          globalMemoryManager.forceGC();
        }
        break;
    }
  }, [forceLayout, config.enableMemoryOptimization]);

  /**
   * Start simulation with nodes and edges
   */
  const startSimulation = useCallback((nodes: NodeVisual[], edges: EdgeVisual[]) => {
    if (!isInitialized) {
      console.warn('Canvas not initialized, starting simulation anyway');
    }

    // Pre-allocate memory for large graphs
    if (config.enableMemoryOptimization && nodes.length > 1000) {
      globalMemoryManager.acquireNodes(Math.min(nodes.length, config.maxNodes));
    }

    // Start the optimized force layout
    forceLayout.start(nodes, edges);

    console.log(`Started optimized simulation with ${nodes.length} nodes and ${edges.length} edges`);
  }, [isInitialized, config, forceLayout]);

  /**
   * Stop simulation
   */
  const stopSimulation = useCallback(() => {
    forceLayout.stop();
    
    // Clean up pooled objects
    if (config.enableMemoryOptimization) {
      pooledNodesRef.current.forEach(pooledNode => {
        globalMemoryManager.releaseNode(pooledNode);
      });
      pooledNodesRef.current.clear();
      
      pooledEdgesRef.current.forEach(pooledEdge => {
        globalMemoryManager.releaseEdge(pooledEdge);
      });
      pooledEdgesRef.current.clear();
    }

    console.log('Simulation stopped and cleaned up');
  }, [forceLayout, config.enableMemoryOptimization]);

  /**
   * Update viewport for virtual rendering
   */
  const updateViewport = useCallback((newViewport: Partial<ViewportBounds>) => {
    const updatedViewport = { ...viewport, ...newViewport };
    setViewport(updatedViewport);
    
    if (virtualRendererRef.current) {
      virtualRendererRef.current.updateViewport(updatedViewport);
    }
  }, [viewport]);

  /**
   * Get spatial queries using optimized quadtree
   */
  const findNodesInRadius = useCallback((center: { x: number; y: number }, radius: number): NodeVisual[] => {
    return forceLayout.findNodesInRadius(center, radius);
  }, [forceLayout]);

  const findClosestNode = useCallback((x: number, y: number): NodeVisual | null => {
    return forceLayout.findClosestNode(x, y);
  }, [forceLayout]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initialize();
    
    return () => {
      stopSimulation();
      
      if (config.enablePerformanceMonitoring) {
        stopPerformanceMonitoring();
      }
      
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [initialize, stopSimulation, config.enablePerformanceMonitoring]);

  /**
   * Auto-adjust performance mode based on metrics
   */
  useEffect(() => {
    if (config.performanceMode === 'auto') {
      if (metrics.fps < 20) {
        adjustPerformanceMode('battery');
      } else if (metrics.fps > 50 && metrics.memoryUsage < 70) {
        adjustPerformanceMode('high');
      } else {
        adjustPerformanceMode('balanced');
      }
    }
  }, [metrics.fps, metrics.memoryUsage, config.performanceMode, adjustPerformanceMode]);

  /**
   * Update viewport when canvas size changes
   */
  useEffect(() => {
    updateViewport({ width: config.width, height: config.height });
  }, [config.width, config.height, updateViewport]);

  return {
    // Core functions
    startSimulation,
    stopSimulation,
    updateViewport,
    adjustPerformanceMode,
    
    // Spatial queries
    findNodesInRadius,
    findClosestNode,
    
    // State
    isInitialized,
    metrics,
    viewport,
    
    // Performance utilities
    forceGC: () => config.enableMemoryOptimization && globalMemoryManager.forceGC(),
    optimizeMemory: () => config.enableMemoryOptimization && globalMemoryManager.optimize(),
    getDetailedMetrics: () => ({
      forceLayout: forceLayout.getMetrics(),
      memory: globalMemoryManager.getMetrics(),
      performance: globalPerformanceMonitor.getCurrentMetrics(),
      virtualRenderer: virtualRendererRef.current?.getStats()
    }),
    
    // Component refs for advanced usage
    virtualRenderer: virtualRendererRef.current,
    websocket: websocketRef.current
  };
};