import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Stage, useApp } from '@pixi/react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setHoveredNode, setSelectedNodes, updateNodePositions } from '../../store/graphSlice';
import { updateViewport, setInteractionMode } from '../../store/uiSlice';
import { NodeVisual, EdgeVisual, RenderSettings } from '../../types/graph';
import { WebGLRenderer } from './WebGLRenderer';
import { InteractionLayer } from './InteractionLayer';
import { D3ForceSimulation } from './D3ForceSimulation';
import { useD3ForceLayout } from '../../hooks/useD3ForceLayout';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { useRAFThrottledCallback } from '../../hooks/useThrottledCallback';
import { GPUOptimizer } from '../../utils/gpuOptimizer';
import classNames from 'classnames';

interface GraphCanvasProps {
  width: number;
  height: number;
  className?: string;
  renderSettings?: Partial<RenderSettings>;
  onNodeClick?: (node: NodeVisual, event: React.MouseEvent) => void;
  onNodeDoubleClick?: (node: NodeVisual) => void;
  onNodeHover?: (node: NodeVisual | null) => void;
  onEdgeClick?: (edge: EdgeVisual) => void;
  onBackgroundClick?: (event: React.MouseEvent) => void;
  onViewportChange?: (viewport: { x: number; y: number; scale: number }) => void;
}

const defaultRenderSettings: RenderSettings = {
  maxNodes: 10000,
  maxEdges: 20000,
  nodeSize: {
    min: 4,
    max: 20,
    scale: 'sqrt',
    basedOn: 'degree',
  },
  edgeWidth: {
    min: 1,
    max: 8,
    scale: 'linear',
    basedOn: 'weight',
  },
  lodSystem: {
    enabled: true,
    levels: 4,
    thresholds: [0.1, 0.5, 1.0, 2.0],
    nodeSimplification: true,
    edgeCulling: true,
  },
  culling: {
    frustum: true,
    occlusion: false,
    distance: true,
    minPixelSize: 2,
  },
  antialiasing: true,
  transparency: true,
  shadows: false,
  bloom: false,
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  width,
  height,
  className,
  renderSettings: customRenderSettings,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  onEdgeClick,
  onBackgroundClick,
  onViewportChange,
}) => {
  const dispatch = useAppDispatch();
  const appRef = useRef<Application | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number>();
  const gpuOptimizerRef = useRef<GPUOptimizer | null>(null);
  
  // Redux state
  const {
    nodes,
    edges,
    selectedNodes,
    hoveredNode,
    highlightedPath,
    layoutInProgress,
    visibleNodes,
    visibleEdges,
    lodLevel,
  } = useAppSelector(state => state.graph);
  
  const {
    viewport,
    interactionMode,
    isDragging,
    isMultiSelecting,
  } = useAppSelector(state => state.ui);
  
  const { showFPS, enablePerformanceMonitoring } = useAppSelector(state => state.settings);
  
  // Merge render settings
  const renderSettings = useMemo(() => ({
    ...defaultRenderSettings,
    ...customRenderSettings,
  }), [customRenderSettings]);
  
  // Performance monitoring - Temporarily disabled for debugging
  const performanceMetrics = null; // usePerformanceMonitoring({
  //   enabled: enablePerformanceMonitoring,
  //   updateInterval: 1000,
  // });
  
  // Stable onTick callback to prevent infinite re-renders
  const handleTick = useCallback((nodes: NodeVisual[]) => {
    dispatch(updateNodePositions(
      nodes.map(node => ({ id: node.id, x: node.x, y: node.y }))
    ));
  }, [dispatch]);

  // Use RAF throttling for smoother visual updates
  const rafThrottledOnTick = useRAFThrottledCallback(handleTick);

  // D3 force simulation
  const {
    simulation,
    startSimulation,
    stopSimulation,
    updateSimulation,
  } = useD3ForceLayout({
    nodes,
    edges,
    width,
    height,
    onTick: rafThrottledOnTick,
  });
  
  // Initialize PIXI Application with GPU Optimization
  useEffect(() => {
    if (!containerRef.current) return;
    
    const initializeGPUOptimizedApp = async () => {
      try {
        // Create canvas for GPU optimization
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvasRef.current = canvas;
        
        // Initialize GPU optimizer first
        gpuOptimizerRef.current = GPUOptimizer.getInstance();
        const optimizedApp = await gpuOptimizerRef.current.initializeOptimization(canvas, {
          enableComputeShaders: true,
          preferWebGL2: true,
          powerPreference: 'high-performance',
          antialias: renderSettings.antialiasing,
          maxTextureSize: 4096,
        });
        
        // Configure optimized settings
        optimizedApp.renderer.backgroundColor = 0x0F172A;
        
        // Additional GPU optimizations for existing app
        gpuOptimizerRef.current.optimizeExistingApp(optimizedApp);
        
        appRef.current = optimizedApp;
        containerRef.current.appendChild(canvas);
        
        const metrics = gpuOptimizerRef.current.getPerformanceMetrics();
        console.log('🚀 GPU-optimized PIXI application initialized:', {
          webglVersion: metrics?.capabilities?.contextType || 'unknown',
          maxTextureSize: metrics?.capabilities?.maxTextureSize || 0,
        });
        
      } catch (error) {
        console.warn('GPU optimization failed, falling back to standard PIXI:', error);
        
        // Fallback to standard PIXI initialization
        const app = new Application({
          width,
          height,
          backgroundColor: 0x0F172A,
          antialias: renderSettings.antialiasing,
          resolution: Math.min(2, window.devicePixelRatio),
          autoDensity: true,
        });
        
        appRef.current = app;
        containerRef.current.appendChild(app.view as HTMLCanvasElement);
      }
    };
    
    initializeGPUOptimizedApp();
    
    return () => {
      if (gpuOptimizerRef.current) {
        gpuOptimizerRef.current.destroy();
        gpuOptimizerRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true);
      }
    };
  }, [width, height, renderSettings.antialiasing]);
  
  // Handle viewport changes
  const handleViewportChange = useCallback((newViewport: { x: number; y: number; scale: number }) => {
    dispatch(updateViewport(newViewport));
    onViewportChange?.(newViewport);
  }, [dispatch, onViewportChange]);
  
  // Handle node interactions
  const handleNodeClick = useCallback((node: NodeVisual, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      const newSelection = [...selectedNodes];
      const index = newSelection.indexOf(node.id);
      if (index > -1) {
        newSelection.splice(index, 1);
      } else {
        newSelection.push(node.id);
      }
      dispatch(setSelectedNodes(newSelection));
    } else {
      // Single select
      dispatch(setSelectedNodes([node.id]));
    }
    
    onNodeClick?.(node, event);
  }, [selectedNodes, dispatch, onNodeClick]);
  
  const handleNodeHover = useCallback((node: NodeVisual | null) => {
    dispatch(setHoveredNode(node?.id ?? null));
    onNodeHover?.(node);
  }, [dispatch, onNodeHover]);
  
  // Filter visible elements based on viewport and LOD
  const { visibleNodesList, visibleEdgesList } = useMemo(() => {
    const viewportBounds = {
      left: -viewport.x / viewport.scale,
      right: (-viewport.x + width) / viewport.scale,
      top: -viewport.y / viewport.scale,
      bottom: (-viewport.y + height) / viewport.scale,
    };
    
    // Filter nodes based on viewport and LOD settings
    const visibleNodesList = nodes.filter(node => {
      if (!node.visible || !visibleNodes.includes(node.id)) return false;
      
      // Frustum culling
      if (renderSettings.culling.frustum) {
        if (node.x < viewportBounds.left - node.radius ||
            node.x > viewportBounds.right + node.radius ||
            node.y < viewportBounds.top - node.radius ||
            node.y > viewportBounds.bottom + node.radius) {
          return false;
        }
      }
      
      // Distance culling
      if (renderSettings.culling.distance) {
        const screenRadius = node.radius * viewport.scale;
        if (screenRadius < renderSettings.culling.minPixelSize) {
          return false;
        }
      }
      
      return true;
    });
    
    // Filter edges based on visible nodes and LOD
    const visibleNodeIds = new Set(visibleNodesList.map(n => n.id));
    const visibleEdgesList = edges.filter(edge => {
      if (!edge.visible || !visibleEdges.includes(edge.id)) return false;
      
      // Only show edges between visible nodes
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
        return false;
      }
      
      // LOD-based edge culling
      if (renderSettings.lodSystem.enabled && renderSettings.lodSystem.edgeCulling) {
        const threshold = renderSettings.lodSystem.thresholds[lodLevel];
        if (edge.weight < threshold) {
          return false;
        }
      }
      
      return true;
    });
    
    return { visibleNodesList, visibleEdgesList };
  }, [
    nodes,
    edges,
    visibleNodes,
    visibleEdges,
    viewport,
    width,
    height,
    lodLevel,
    renderSettings,
  ]);
  
  // Animation loop with performance monitoring
  useEffect(() => {
    let lastFrameTime = 0;
    const TARGET_FPS = 60;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    
    const animate = (timestamp: number) => {
      // Throttle to target FPS to prevent performance violations
      if (timestamp - lastFrameTime < FRAME_INTERVAL) {
        animationFrameId.current = requestAnimationFrame(animate);
        return;
      }
      
      lastFrameTime = timestamp;
      
      if (appRef.current && performanceMetrics) {
        const startTime = performance.now();
        
        // Check if we have enough time budget for simulation update
        const timeBudget = FRAME_INTERVAL - 2; // Reserve 2ms for rendering
        
        // Update simulation if running and we have time budget
        if (simulation && layoutInProgress) {
          const simulationStart = performance.now();
          
          // Only tick if we haven't exceeded time budget
          if (simulationStart - startTime < timeBudget) {
            simulation.tick();
            
            // Check if simulation tick took too long
            const simulationTime = performance.now() - simulationStart;
            if (simulationTime > 8) { // More than 8ms is too long
              console.warn(`Simulation tick took ${simulationTime.toFixed(2)}ms - consider optimization`);
            }
          }
        }
        
        // Render frame
        appRef.current.render();
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        // Only record frame if it completed within budget
        if (totalTime < FRAME_INTERVAL) {
          performanceMetrics.recordFrame(totalTime);
        } else {
          console.warn(`Frame took ${totalTime.toFixed(2)}ms - exceeding target of ${FRAME_INTERVAL.toFixed(2)}ms`);
        }
      }
      
      animationFrameId.current = requestAnimationFrame(animate);
    };
    
    animationFrameId.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [simulation, layoutInProgress, performanceMetrics]);
  
  // Handle layout changes
  useEffect(() => {
    if (nodes.length > 0 && simulation) {
      updateSimulation(nodes, edges);
      if (layoutInProgress) {
        startSimulation();
      }
    }
  }, [nodes, edges, simulation, layoutInProgress, updateSimulation, startSimulation]);
  
  return (
    <div
      ref={containerRef}
      className={classNames(
        'relative overflow-hidden bg-gray-900',
        className
      )}
      style={{ width, height }}
    >
      {appRef.current && (
        <Stage app={appRef.current}>
          <WebGLRenderer
            nodes={visibleNodesList}
            edges={visibleEdgesList}
            viewport={viewport}
            renderSettings={renderSettings}
            selectedNodes={selectedNodes}
            hoveredNode={hoveredNode}
            highlightedPath={highlightedPath}
          />
          
          <InteractionLayer
            width={width}
            height={height}
            nodes={visibleNodesList}
            edges={visibleEdgesList}
            viewport={viewport}
            interactionMode={interactionMode}
            isDragging={isDragging}
            isMultiSelecting={isMultiSelecting}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeHover={handleNodeHover}
            onEdgeClick={onEdgeClick}
            onBackgroundClick={onBackgroundClick}
            onViewportChange={handleViewportChange}
          />
        </Stage>
      )}
      
      {/* Enhanced Performance overlay with GPU metrics - Temporarily disabled for debugging */}
      {false && showFPS && performanceMetrics && (
        <div className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded text-sm font-mono">
          <div>FPS: {performanceMetrics.fps?.toFixed(1) || 'N/A'}</div>
          <div>Nodes: {visibleNodesList.length} / {nodes.length}</div>
          <div>Edges: {visibleEdgesList.length} / {edges.length}</div>
          <div>Memory: {performanceMetrics.memoryUsage?.heap ? (performanceMetrics.memoryUsage.heap / 1024 / 1024).toFixed(1) : 'N/A'}MB</div>
          {gpuOptimizerRef.current && (() => {
            const gpuMetrics = gpuOptimizerRef.current?.getPerformanceMetrics();
            return gpuMetrics ? (
              <div className="border-t border-gray-600 my-1 pt-1">
                <div className="text-yellow-400">GPU Metrics:</div>
                <div>WebGL: {gpuMetrics.capabilities?.contextType || 'N/A'}</div>
                <div>Draw Calls: {gpuMetrics.drawCalls || 0}</div>
                <div>Textures: {gpuMetrics.resources?.texturePoolSize || 0}</div>
                <div>Shaders: {gpuMetrics.resources?.shaderCacheSize || 0}</div>
              </div>
            ) : null;
          })()}
        </div>
      )}
      
      {/* Loading overlay */}
      {layoutInProgress && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white/90 p-4 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
            <span className="text-gray-900 font-medium">Computing layout...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphCanvas;