import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch } from '@store/index';
import { updateMetrics } from '@store/performanceSlice';
import { PerformanceMetrics } from '@types/graph';

interface UsePerformanceMonitoringOptions {
  enabled: boolean;
  updateInterval: number; // in milliseconds
  fpsThreshold?: number; // FPS threshold for warnings
  memoryThreshold?: number; // Memory threshold in MB for warnings
}

interface PerformanceState {
  fps: number;
  frameTime: number;
  renderTime: number;
  updateTime: number;
  memoryUsage: {
    heap: number;
    total: number;
    external: number;
  };
  nodeCount: {
    total: number;
    visible: number;
    rendered: number;
  };
  edgeCount: {
    total: number;
    visible: number;
    rendered: number;
  };
  isWarning: boolean;
  warnings: string[];
}

export const usePerformanceMonitoring = ({
  enabled,
  updateInterval,
  fpsThreshold = 30,
  memoryThreshold = 500,
}: UsePerformanceMonitoringOptions) => {
  const dispatch = useAppDispatch();
  const [metrics, setMetrics] = useState<PerformanceState | null>(null);
  
  // Performance tracking state
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const renderTimesRef = useRef<number[]>([]);
  const updateTimesRef = useRef<number[]>([]);
  const frameCountRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  
  // Memory monitoring
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        heap: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        external: memory.usedJSHeapSize,
      };
    }
    return {
      heap: 0,
      total: 0,
      external: 0,
    };
  }, []);
  
  // Calculate FPS and frame times
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    const frameTimes = frameTimesRef.current;
    
    if (lastFrameTimeRef.current > 0) {
      const frameTime = now - lastFrameTimeRef.current;
      frameTimes.push(frameTime);
      
      // Keep only the last 60 frame times (1 second at 60fps)
      if (frameTimes.length > 60) {
        frameTimes.shift();
      }
    }
    
    lastFrameTimeRef.current = now;
    frameCountRef.current++;
    
    if (frameTimes.length > 0) {
      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = 1000 / averageFrameTime;
      return { fps, frameTime: averageFrameTime };
    }
    
    return { fps: 0, frameTime: 0 };
  }, []);
  
  // Record render time
  const recordRenderTime = useCallback((time: number) => {
    const renderTimes = renderTimesRef.current;
    renderTimes.push(time);
    
    if (renderTimes.length > 30) {
      renderTimes.shift();
    }
  }, []);
  
  // Record update time
  const recordUpdateTime = useCallback((time: number) => {
    const updateTimes = updateTimesRef.current;
    updateTimes.push(time);
    
    if (updateTimes.length > 30) {
      updateTimes.shift();
    }
  }, []);
  
  // Record frame for FPS calculation
  const recordFrame = useCallback((renderTime?: number) => {
    if (!enabled) return;
    
    if (renderTime !== undefined) {
      recordRenderTime(renderTime);
    }
    
    calculateFPS();
  }, [enabled, recordRenderTime, calculateFPS]);
  
  // Update metrics periodically
  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(() => {
      const now = performance.now();
      
      // Skip update if not enough time has passed
      if (now - lastUpdateTimeRef.current < updateInterval) {
        return;
      }
      
      lastUpdateTimeRef.current = now;
      
      const { fps, frameTime } = calculateFPS();
      const memoryUsage = getMemoryUsage();
      
      // Calculate average render and update times
      const renderTimes = renderTimesRef.current;
      const updateTimes = updateTimesRef.current;
      
      const avgRenderTime = renderTimes.length > 0 
        ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
        : 0;
      
      const avgUpdateTime = updateTimes.length > 0
        ? updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length
        : 0;
      
      // Check for performance warnings
      const warnings: string[] = [];
      let isWarning = false;
      
      if (fps < fpsThreshold && fps > 0) {
        warnings.push(`Low FPS: ${fps.toFixed(1)}`);
        isWarning = true;
      }
      
      const memoryMB = memoryUsage.heap / (1024 * 1024);
      if (memoryMB > memoryThreshold) {
        warnings.push(`High memory usage: ${memoryMB.toFixed(1)}MB`);
        isWarning = true;
      }
      
      if (avgRenderTime > 16) { // More than 16ms per frame
        warnings.push(`Slow rendering: ${avgRenderTime.toFixed(1)}ms`);
        isWarning = true;
      }
      
      const newMetrics: PerformanceState = {
        fps: Math.max(0, fps),
        frameTime: Math.max(0, frameTime),
        renderTime: Math.max(0, avgRenderTime),
        updateTime: Math.max(0, avgUpdateTime),
        memoryUsage,
        nodeCount: {
          total: 0, // These would be updated from the graph state
          visible: 0,
          rendered: 0,
        },
        edgeCount: {
          total: 0,
          visible: 0,
          rendered: 0,
        },
        isWarning,
        warnings,
      };
      
      setMetrics(newMetrics);
      
      // Dispatch to Redux store
      const reduxMetrics: PerformanceMetrics = {
        fps: newMetrics.fps,
        frameTime: newMetrics.frameTime,
        renderTime: newMetrics.renderTime,
        updateTime: newMetrics.updateTime,
        memoryUsage: newMetrics.memoryUsage,
        nodeCount: newMetrics.nodeCount,
        edgeCount: newMetrics.edgeCount,
      };
      
      dispatch(updateMetrics(reduxMetrics));
    }, Math.min(updateInterval, 1000)); // Update at most once per second
    
    return () => clearInterval(interval);
  }, [
    enabled,
    updateInterval,
    fpsThreshold,
    memoryThreshold,
    calculateFPS,
    getMemoryUsage,
    dispatch,
  ]);
  
  // Reset metrics when disabled
  useEffect(() => {
    if (!enabled) {
      setMetrics(null);
      frameTimesRef.current = [];
      renderTimesRef.current = [];
      updateTimesRef.current = [];
      frameCountRef.current = 0;
      lastFrameTimeRef.current = 0;
      lastUpdateTimeRef.current = 0;
    }
  }, [enabled]);
  
  // Update node and edge counts
  const updateCounts = useCallback((
    totalNodes: number,
    visibleNodes: number,
    renderedNodes: number,
    totalEdges: number,
    visibleEdges: number,
    renderedEdges: number
  ) => {
    setMetrics(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        nodeCount: {
          total: totalNodes,
          visible: visibleNodes,
          rendered: renderedNodes,
        },
        edgeCount: {
          total: totalEdges,
          visible: visibleEdges,
          rendered: renderedEdges,
        },
      };
    });
  }, []);
  
  // Get current performance status
  const getPerformanceStatus = useCallback(() => {
    if (!metrics) return 'unknown';
    
    if (metrics.isWarning) return 'warning';
    if (metrics.fps >= 55) return 'excellent';
    if (metrics.fps >= 45) return 'good';
    if (metrics.fps >= 30) return 'fair';
    return 'poor';
  }, [metrics]);
  
  // Get optimization suggestions
  const getOptimizationSuggestions = useCallback(() => {
    if (!metrics) return [];
    
    const suggestions: string[] = [];
    
    if (metrics.fps < 30) {
      suggestions.push('Reduce the number of visible nodes and edges');
      suggestions.push('Enable Level-of-Detail (LOD) rendering');
      suggestions.push('Increase culling distance');
    }
    
    if (metrics.memoryUsage.heap > 300 * 1024 * 1024) { // > 300MB
      suggestions.push('Enable aggressive memory management');
      suggestions.push('Reduce node detail levels');
      suggestions.push('Clear unused graph data');
    }
    
    if (metrics.renderTime > 16) {
      suggestions.push('Disable shadows and bloom effects');
      suggestions.push('Reduce antialiasing quality');
      suggestions.push('Use simplified node rendering');
    }
    
    return suggestions;
  }, [metrics]);
  
  return {
    metrics,
    recordFrame,
    recordRenderTime,
    recordUpdateTime,
    updateCounts,
    getPerformanceStatus,
    getOptimizationSuggestions,
    isEnabled: enabled,
  };
};