import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSelectedNodes } from '../../store/graphSlice';
import { OptimizedPixiCanvas } from './OptimizedPixiCanvas';
import { useMemoryEfficientForceLayout } from '../../hooks/useMemoryEfficientForceLayout';
import { loadGraphData, loadMoreGraphData, getMemoryUsage, shouldReduceMemory } from '../../utils/optimizedDataLoader';

interface HighPerformanceCanvasProps {
  width: number;
  height: number;
  className?: string;
  onNodeClick?: (node: any) => void;
  onNodeRightClick?: (node: any, event: React.MouseEvent) => void;
  onEdgeClick?: (edge: any) => void;
}

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
  lodLevel: string;
}

export const HighPerformanceCanvas: React.FC<HighPerformanceCanvasProps> = ({
  width,
  height,
  className = '',
  onNodeClick,
  onNodeRightClick,
  onEdgeClick
}) => {
  const dispatch = useAppDispatch();

  // State management
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memoryUsage: 0,
    nodeCount: 0,
    edgeCount: 0,
    lodLevel: 'high'
  });

  // Performance settings based on device capabilities
  const performanceSettings = useMemo(() => {
    const memory = getMemoryUsage();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isLowEnd = memory && memory.limit < 2048; // Less than 2GB heap

    if (isMobile || isLowEnd) {
      return {
        enableClustering: true,
        lodThresholds: { high: 1.5, medium: 0.8, low: 0.4 },
        maxNodes: 200,
        maxEdges: 500,
        forceIterations: 150,
        adaptivePerformance: true
      };
    }

    return {
      enableClustering: true,
      lodThresholds: { high: 2, medium: 1, low: 0.5 },
      maxNodes: 500,
      maxEdges: 2000,
      forceIterations: 300,
      adaptivePerformance: true
    };
  }, []);

  // Force layout configuration
  const forceLayout = useMemoryEfficientForceLayout(
    {
      width,
      height,
      chargeStrength: -300,
      linkDistance: 100,
      linkStrength: 0.1,
      collisionRadius: 15,
      centerStrength: 0.05,
      alphaDecay: 0.01,
      velocityDecay: 0.4,
      maxIterations: performanceSettings.forceIterations,
      adaptivePerformance: performanceSettings.adaptivePerformance
    },
    useCallback((updatedNodes) => {
      setNodes(updatedNodes);
    }, []),
    useCallback(() => {
      console.log('✅ Force layout completed');
    }, [])
  );

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const data = await loadGraphData({
          limit: performanceSettings.maxNodes,
          progressCallback: (progress) => setLoadProgress(progress)
        });

        if (data && data.nodes.length > 0) {
          // Apply initial random positions if not set
          const nodesWithPositions = data.nodes.map(node => ({
            ...node,
            x: node.x ?? Math.random() * width,
            y: node.y ?? Math.random() * height
          }));

          setNodes(nodesWithPositions);
          setEdges(data.edges);
          setHasMore(data.hasMore ?? false);

          // Start force layout
          forceLayout.start(nodesWithPositions, data.edges);
        }
      } catch (error) {
        console.error('Failed to load graph data:', error);
      } finally {
        setLoading(false);
        setLoadProgress(100);
      }
    };

    loadData();
  }, [width, height, performanceSettings.maxNodes]);

  // Memory monitoring and cleanup
  useEffect(() => {
    const memoryMonitor = setInterval(() => {
      const memory = getMemoryUsage();
      if (memory) {
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.percentage,
          nodeCount: nodes.length,
          edgeCount: edges.length
        }));

        // Trigger memory reduction if needed
        if (shouldReduceMemory() && nodes.length > 100) {
          console.warn('⚠️ Memory pressure detected, reducing graph complexity');
          // Could implement node clustering or filtering here
        }
      }
    }, 5000);

    return () => clearInterval(memoryMonitor);
  }, [nodes.length, edges.length]);

  // Handle progressive loading
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    try {
      const moreData = await loadMoreGraphData({
        limit: 50,
        progressCallback: (progress) => setLoadProgress(progress)
      });

      if (moreData && moreData.nodes.length > 0) {
        const newNodes = moreData.nodes.map(node => ({
          ...node,
          x: node.x ?? Math.random() * width,
          y: node.y ?? Math.random() * height
        }));

        setNodes(prev => [...prev, ...newNodes]);
        setEdges(prev => [...prev, ...moreData.edges]);
        setHasMore(moreData.hasMore ?? false);

        // Restart layout with new data
        forceLayout.start([...nodes, ...newNodes], [...edges, ...moreData.edges]);
      }
    } catch (error) {
      console.error('Failed to load more data:', error);
    }
  }, [hasMore, loading, nodes, edges, width, height, forceLayout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      forceLayout.stop();
    };
  }, [forceLayout]);

  if (loading && nodes.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center`} style={{ width, height, backgroundColor: '#0F172A' }}>
        <div className="text-center text-white">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <div className="text-xl font-bold mb-2">Loading High-Performance Graph</div>
          <div className="text-sm text-gray-400">Optimizing for your device...</div>
          <div className="mt-4 w-64 mx-auto bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative`} style={{ width, height }}>
      <OptimizedPixiCanvas
        width={width}
        height={height}
        nodes={nodes}
        edges={edges}
        onNodeRightClick={onNodeRightClick}
        enableClustering={performanceSettings.enableClustering}
        lodThresholds={performanceSettings.lodThresholds}
      />

      {/* Performance Monitor Overlay */}
      <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 text-white text-xs p-3 rounded-lg shadow-lg">
        <div className="font-bold mb-1">Performance</div>
        <div>Nodes: {metrics.nodeCount}</div>
        <div>Edges: {metrics.edgeCount}</div>
        <div>Memory: {metrics.memoryUsage}%</div>
        {forceLayout.isRunning && (
          <div className="mt-2">
            <div className="text-yellow-400">Layout: {Math.round(forceLayout.progress)}%</div>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {hasMore && !loading && (
        <button
          onClick={handleLoadMore}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          Load More Nodes
        </button>
      )}

      {/* Memory Warning */}
      {metrics.memoryUsage > 80 && (
        <div className="absolute top-4 left-4 bg-yellow-600 text-white text-sm p-2 rounded-lg shadow-lg">
          ⚠️ High memory usage detected
        </div>
      )}
    </div>
  );
};