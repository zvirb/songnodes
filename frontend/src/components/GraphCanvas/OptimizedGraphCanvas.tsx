/**
 * Optimized Graph Canvas Component
 * Integrates all performance optimizations: Barnes-Hut, virtual rendering, memory management, monitoring
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setHoveredNode, setSelectedNodes, updateNodePositions } from '@store/graphSlice';
import { updateViewport, setInteractionMode } from '@store/uiSlice';
import { updateMetrics } from '@store/performanceSlice';
import { NodeVisual, EdgeVisual, RenderSettings } from '@types/graph';
import { useOptimizedGraphCanvas, OptimizedGraphCanvasConfig } from '@hooks/useOptimizedGraphCanvas';
import { InteractionLayer } from './InteractionLayer';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
import { generatePerformanceReport } from '@utils/performanceMonitor';
import { globalRegressionTester } from '@utils/performanceRegression';
import classNames from 'classnames';

interface OptimizedGraphCanvasProps {
  width: number;
  height: number;
  className?: string;
  renderSettings?: Partial<RenderSettings>;
  performanceMode?: 'high' | 'balanced' | 'battery' | 'auto';
  enableOptimizations?: {
    barnesHut?: boolean;
    virtualRendering?: boolean;
    memoryManagement?: boolean;
    performanceMonitoring?: boolean;
    networkOptimization?: boolean;
  };
  onNodeClick?: (node: NodeVisual, event: React.MouseEvent) => void;
  onNodeDoubleClick?: (node: NodeVisual) => void;
  onNodeHover?: (node: NodeVisual | null) => void;
  onEdgeClick?: (edge: EdgeVisual) => void;
  onBackgroundClick?: (event: React.MouseEvent) => void;
  onViewportChange?: (viewport: { x: number; y: number; scale: number }) => void;
  onPerformanceAlert?: (alert: any) => void;
}

const defaultOptimizations = {
  barnesHut: true,
  virtualRendering: true,
  memoryManagement: true,
  performanceMonitoring: true,
  networkOptimization: false
};

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
  cullingSystem: {
    enabled: true,
    frustumCulling: true,
    occlusionCulling: false,
    distanceCulling: true,
    bufferZone: 100,
  },
  renderingEngine: 'webgl',
  antialiasing: true,
  transparency: true,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
};

export const OptimizedGraphCanvas: React.FC<OptimizedGraphCanvasProps> = ({
  width,
  height,
  className,
  renderSettings = {},
  performanceMode = 'auto',
  enableOptimizations = {},
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  onEdgeClick,
  onBackgroundClick,
  onViewportChange,
  onPerformanceAlert,
}) => {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Redux state
  const { nodes, edges, selectedNodes, hoveredNode } = useAppSelector(state => state.graph);
  const { viewport, interactionMode } = useAppSelector(state => state.ui);
  const { layoutOptions } = useAppSelector(state => state.settings);
  const performanceMetrics = useAppSelector(state => state.performance);

  // Local state
  const [isInitialized, setIsInitialized] = useState(false);
  const [renderStats, setRenderStats] = useState({
    totalNodes: 0,
    visibleNodes: 0,
    renderedNodes: 0,
    fps: 0,
    frameTime: 0
  });

  // Merge settings
  const finalRenderSettings = useMemo(() => ({
    ...defaultRenderSettings,
    ...renderSettings
  }), [renderSettings]);

  const finalOptimizations = useMemo(() => ({
    ...defaultOptimizations,
    ...enableOptimizations
  }), [enableOptimizations]);

  // Optimized canvas configuration
  const canvasConfig: OptimizedGraphCanvasConfig = useMemo(() => ({
    width,
    height,
    layoutOptions,
    performanceMode,
    enableVirtualRendering: finalOptimizations.virtualRendering,
    enablePerformanceMonitoring: finalOptimizations.performanceMonitoring,
    enableMemoryOptimization: finalOptimizations.memoryManagement,
    enableNetworkOptimization: finalOptimizations.networkOptimization,
    maxNodes: finalRenderSettings.maxNodes,
    maxEdges: finalRenderSettings.maxEdges,
    targetFPS: 60
  }), [
    width, 
    height, 
    layoutOptions, 
    performanceMode, 
    finalOptimizations, 
    finalRenderSettings
  ]);

  // Initialize optimized canvas
  const {
    startSimulation,
    stopSimulation,
    updateViewport: updateCanvasViewport,
    adjustPerformanceMode,
    findNodesInRadius,
    findClosestNode,
    isInitialized: canvasInitialized,
    metrics,
    viewport: canvasViewport,
    forceGC,
    optimizeMemory,
    getDetailedMetrics
  } = useOptimizedGraphCanvas(canvasConfig, canvasRef);

  // Performance monitoring and alerts
  useEffect(() => {
    if (finalOptimizations.performanceMonitoring && onPerformanceAlert) {
      const report = generatePerformanceReport();
      
      // Check for critical issues
      if (report.summary.criticalIssues > 0) {
        onPerformanceAlert({
          type: 'critical',
          message: `${report.summary.criticalIssues} critical performance issues detected`,
          grade: report.summary.overallGrade,
          suggestions: report.summary.suggestions
        });
      }
    }
  }, [metrics.fps, metrics.performanceGrade, finalOptimizations.performanceMonitoring, onPerformanceAlert]);

  // Update Redux performance metrics
  useEffect(() => {
    dispatch(updateMetrics({
      fps: metrics.fps,
      frameTime: metrics.frameTime,
      renderTime: metrics.renderTime,
      updateTime: metrics.simulationTime,
      memoryUsage: {
        heap: metrics.memoryUsage,
        total: metrics.memoryUsage,
        external: metrics.memoryUsage
      },
      nodeCount: {
        total: metrics.nodeCount,
        visible: metrics.visibleNodes,
        rendered: metrics.visibleNodes
      },
      edgeCount: {
        total: metrics.edgeCount,
        visible: metrics.visibleEdges,
        rendered: metrics.visibleEdges
      }
    }));
  }, [metrics, dispatch]);

  // Start simulation when data changes
  useEffect(() => {
    if (canvasInitialized && nodes.length > 0) {
      console.log(`Starting optimized simulation with ${nodes.length} nodes, ${edges.length} edges`);
      startSimulation(nodes, edges);
    }
  }, [canvasInitialized, nodes, edges, startSimulation]);

  // Handle viewport changes
  const handleViewportChange = useDebouncedCallback((newViewport: typeof viewport) => {
    updateCanvasViewport(newViewport);
    dispatch(updateViewport(newViewport));
    onViewportChange?.(newViewport);
  }, 16); // ~60 FPS debouncing

  // Mouse event handlers with spatial optimization
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - canvasViewport.x) / canvasViewport.scale;
    const y = (event.clientY - rect.top - canvasViewport.y) / canvasViewport.scale;

    // Use optimized spatial query to find clicked node
    const clickedNode = findClosestNode(x, y);
    
    if (clickedNode) {
      const nodeDistance = Math.sqrt(
        Math.pow(clickedNode.x - x, 2) + Math.pow(clickedNode.y - y, 2)
      );
      
      // Check if click is within node radius
      if (nodeDistance <= clickedNode.radius) {
        onNodeClick?.(clickedNode, event);
        
        // Update selection
        if (event.ctrlKey || event.metaKey) {
          const newSelection = selectedNodes.includes(clickedNode.id)
            ? selectedNodes.filter(id => id !== clickedNode.id)
            : [...selectedNodes, clickedNode.id];
          dispatch(setSelectedNodes(newSelection));
        } else {
          dispatch(setSelectedNodes([clickedNode.id]));
        }
      } else {
        onBackgroundClick?.(event);
        dispatch(setSelectedNodes([]));
      }
    } else {
      onBackgroundClick?.(event);
      dispatch(setSelectedNodes([]));
    }
  }, [
    canvasViewport, 
    findClosestNode, 
    onNodeClick, 
    onBackgroundClick, 
    selectedNodes, 
    dispatch
  ]);

  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - canvasViewport.x) / canvasViewport.scale;
    const y = (event.clientY - rect.top - canvasViewport.y) / canvasViewport.scale;

    const clickedNode = findClosestNode(x, y);
    if (clickedNode) {
      onNodeDoubleClick?.(clickedNode);
    }
  }, [canvasViewport, findClosestNode, onNodeDoubleClick]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - canvasViewport.x) / canvasViewport.scale;
    const y = (event.clientY - rect.top - canvasViewport.y) / canvasViewport.scale;

    // Use spatial query to find hovered node
    const hoveredNodeCandidate = findClosestNode(x, y);
    let newHoveredNode: NodeVisual | null = null;

    if (hoveredNodeCandidate) {
      const distance = Math.sqrt(
        Math.pow(hoveredNodeCandidate.x - x, 2) + Math.pow(hoveredNodeCandidate.y - y, 2)
      );
      
      if (distance <= hoveredNodeCandidate.radius + 5) { // 5px tolerance
        newHoveredNode = hoveredNodeCandidate;
      }
    }

    if (newHoveredNode?.id !== hoveredNode?.id) {
      dispatch(setHoveredNode(newHoveredNode));
      onNodeHover?.(newHoveredNode);
    }
  }, [canvasViewport, findClosestNode, hoveredNode, dispatch, onNodeHover]);

  // Wheel event for zooming
  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    const scaleFactor = 1.1;
    const newScale = event.deltaY > 0 
      ? canvasViewport.scale / scaleFactor 
      : canvasViewport.scale * scaleFactor;
    
    // Clamp scale
    const clampedScale = Math.max(0.1, Math.min(5.0, newScale));
    
    if (clampedScale !== canvasViewport.scale) {
      handleViewportChange({
        ...canvasViewport,
        scale: clampedScale
      });
    }
  }, [canvasViewport, handleViewportChange]);

  // Performance optimization controls
  const handlePerformanceModeChange = useCallback((mode: 'high' | 'balanced' | 'battery') => {
    adjustPerformanceMode(mode);
  }, [adjustPerformanceMode]);

  // Memory optimization controls
  const handleMemoryOptimization = useCallback(() => {
    if (finalOptimizations.memoryManagement) {
      optimizeMemory();
      forceGC();
    }
  }, [finalOptimizations.memoryManagement, optimizeMemory, forceGC]);

  // Regression testing trigger
  const handleRegressionTest = useCallback(async () => {
    try {
      const result = await globalRegressionTester.runRegressionTests({
        name: 'Real-time Performance Test',
        description: 'Performance regression test during live usage',
        scenarios: [{
          name: 'current-graph',
          nodeCount: nodes.length,
          edgeCount: edges.length,
          duration: 10000,
          graphType: 'musical',
          renderingEnabled: true
        }],
        tolerances: {
          fps: { degradation: 10, improvement: 5 },
          memory: { degradation: 15, improvement: 10 },
          frameTime: { degradation: 15, improvement: 10 },
          renderTime: { degradation: 20, improvement: 15 }
        },
        baselineStrategy: 'latest',
        enabled: true
      });
      
      console.log('Regression test completed:', result);
    } catch (error) {
      console.error('Regression test failed:', error);
    }
  }, [nodes.length, edges.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, [stopSimulation]);

  return (
    <div 
      ref={containerRef}
      className={classNames('optimized-graph-canvas', className)}
      style={{ width, height, position: 'relative' }}
    >
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ 
          width: '100%', 
          height: '100%',
          cursor: interactionMode === 'pan' ? 'grab' : 'pointer'
        }}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseMove={handleCanvasMouseMove}
        onWheel={handleWheel}
      />

      {/* Interaction layer for advanced interactions */}
      <InteractionLayer
        width={width}
        height={height}
        viewport={canvasViewport}
        nodes={nodes}
        edges={edges}
        selectedNodes={selectedNodes}
        hoveredNode={hoveredNode}
        onViewportChange={handleViewportChange}
      />

      {/* Performance HUD (optional, can be toggled) */}
      {finalOptimizations.performanceMonitoring && (
        <div className="performance-hud" style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 1000
        }}>
          <div>FPS: {metrics.fps.toFixed(1)}</div>
          <div>Nodes: {metrics.visibleNodes}/{metrics.nodeCount}</div>
          <div>Memory: {(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
          <div>Grade: {metrics.performanceGrade}</div>
          <div style={{ marginTop: '4px', fontSize: '10px' }}>
            <span style={{ color: metrics.optimizations.barnesHutEnabled ? '#0f0' : '#f00' }}>
              ● Barnes-Hut
            </span>
            {' '}
            <span style={{ color: metrics.optimizations.virtualRenderingEnabled ? '#0f0' : '#f00' }}>
              ● Virtual
            </span>
            {' '}
            <span style={{ color: metrics.optimizations.memoryPoolingEnabled ? '#0f0' : '#f00' }}>
              ● Memory
            </span>
          </div>
        </div>
      )}

      {/* Performance controls (development mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="performance-controls" style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '11px',
          zIndex: 1000
        }}>
          <button onClick={() => handlePerformanceModeChange('high')}>High</button>
          <button onClick={() => handlePerformanceModeChange('balanced')}>Balanced</button>
          <button onClick={() => handlePerformanceModeChange('battery')}>Battery</button>
          <button onClick={handleMemoryOptimization}>Optimize Memory</button>
          <button onClick={handleRegressionTest}>Run Regression Test</button>
        </div>
      )}
    </div>
  );
};