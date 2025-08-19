import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Stage, useApp } from '@pixi/react';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setHoveredNode, setSelectedNodes, updateNodePositions } from '@store/graphSlice';
import { updateViewport, setInteractionMode } from '@store/uiSlice';
import { NodeVisual, EdgeVisual, RenderSettings } from '@types/graph';
import { WebGLRenderer } from './WebGLRenderer';
import { InteractionLayer } from './InteractionLayer';
import { D3ForceSimulation } from './D3ForceSimulation';
import { useD3ForceLayout } from '@hooks/useD3ForceLayout';
import { usePerformanceMonitoring } from '@hooks/usePerformanceMonitoring';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
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
  const animationFrameId = useRef<number>();
  
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
  
  // Performance monitoring
  const performanceMetrics = usePerformanceMonitoring({
    enabled: enablePerformanceMonitoring,
    updateInterval: 1000,
  });
  
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
    onTick: useDebouncedCallback((nodes: NodeVisual[]) => {
      dispatch(updateNodePositions(
        nodes.map(node => ({ id: node.id, x: node.x, y: node.y }))
      ));
    }, 16), // ~60fps
  });
  
  // Initialize PIXI Application
  useEffect(() => {
    if (!containerRef.current) return;
    
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
    
    return () => {
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
      const newSelection = new Set(selectedNodes);
      if (newSelection.has(node.id)) {
        newSelection.delete(node.id);
      } else {
        newSelection.add(node.id);
      }
      dispatch(setSelectedNodes([...newSelection]));
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
      if (!node.visible || !visibleNodes.has(node.id)) return false;
      
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
      if (!edge.visible || !visibleEdges.has(edge.id)) return false;
      
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
  
  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (appRef.current && performanceMetrics) {
        const startTime = performance.now();
        
        // Update simulation if running
        if (simulation && layoutInProgress) {
          simulation.tick();
        }
        
        // Render frame
        appRef.current.render();
        
        const endTime = performance.now();
        performanceMetrics.recordFrame(endTime - startTime);
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
      
      {/* Performance overlay */}
      {showFPS && performanceMetrics && (
        <div className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded text-sm font-mono">
          <div>FPS: {performanceMetrics.fps.toFixed(1)}</div>
          <div>Nodes: {visibleNodesList.length} / {nodes.length}</div>
          <div>Edges: {visibleEdgesList.length} / {edges.length}</div>
          <div>Memory: {(performanceMetrics.memoryUsage.heap / 1024 / 1024).toFixed(1)}MB</div>
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