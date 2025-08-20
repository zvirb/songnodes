import { useEffect, useRef, useCallback } from 'react';
import { NodeVisual, EdgeVisual, LayoutOptions } from '@types/graph';
import { D3ForceSimulation } from '@components/GraphCanvas/D3ForceSimulation';

interface UseD3ForceLayoutProps {
  nodes: NodeVisual[];
  edges: EdgeVisual[];
  width: number;
  height: number;
  layoutOptions?: LayoutOptions;
  onTick: (nodes: NodeVisual[]) => void;
  onEnd?: () => void;
}

export const useD3ForceLayout = ({
  nodes,
  edges,
  width,
  height,
  layoutOptions,
  onTick,
  onEnd,
}: UseD3ForceLayoutProps) => {
  const simulationRef = useRef<D3ForceSimulation | null>(null);
  const isInitializedRef = useRef(false);
  
  const defaultLayoutOptions: LayoutOptions = {
    algorithm: 'force_directed' as any,
    forceDirected: {
      linkDistance: 100,
      linkStrength: 0.1,
      chargeStrength: -300,
      chargeTheta: 0.8,
      alpha: 1,
      alphaDecay: 0.0228,
      velocityDecay: 0.4,
      iterations: 300,
      centering: true,
      collisionRadius: 10,
    },
  };
  
  const finalLayoutOptions = layoutOptions || defaultLayoutOptions;
  
  // Initialize simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    
    simulationRef.current = new D3ForceSimulation(
      width,
      height,
      finalLayoutOptions
    );
    
    simulationRef.current.initialize(nodes, edges, onTick, onEnd);
    isInitializedRef.current = true;
    
    return () => {
      if (simulationRef.current) {
        simulationRef.current.destroy();
        simulationRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [width, height]); // Only re-initialize on size changes
  
  // Update nodes and edges when they change
  useEffect(() => {
    if (simulationRef.current && isInitializedRef.current) {
      simulationRef.current.updateNodes(nodes);
      simulationRef.current.updateEdges(edges);
    }
  }, [nodes, edges]);
  
  // Update layout options when they change
  useEffect(() => {
    if (simulationRef.current && isInitializedRef.current) {
      simulationRef.current.updateLayoutOptions(finalLayoutOptions);
    }
  }, [finalLayoutOptions]);
  
  const startSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.start();
    }
  }, []);
  
  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
    }
  }, []);
  
  const tickSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.tick();
    }
  }, []);
  
  const reheatSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.reheat();
    }
  }, []);
  
  const updateSimulation = useCallback((newNodes: NodeVisual[], newEdges: EdgeVisual[]) => {
    if (simulationRef.current) {
      simulationRef.current.updateNodes(newNodes);
      simulationRef.current.updateEdges(newEdges);
    }
  }, []);
  
  const findNodesInRadius = useCallback((x: number, y: number, radius: number): NodeVisual[] => {
    if (simulationRef.current) {
      return simulationRef.current.findNodesInRadius(x, y, radius);
    }
    return [];
  }, []);
  
  const findClosestNode = useCallback((x: number, y: number): NodeVisual | null => {
    if (simulationRef.current) {
      return simulationRef.current.findClosestNode(x, y);
    }
    return null;
  }, []);
  
  return {
    simulation: simulationRef.current,
    startSimulation,
    stopSimulation,
    tickSimulation,
    reheatSimulation,
    updateSimulation,
    findNodesInRadius,
    findClosestNode,
    isInitialized: isInitializedRef.current,
  };
};