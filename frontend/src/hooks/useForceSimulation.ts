import { useRef, useCallback, useEffect } from 'react';
import * as d3 from 'd3-force';
import { GraphNode, GraphEdge } from '../types';
import { useStore } from '../store/useStore';

export const useForceSimulation = () => {
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const updateNodePositions = useStore(state => state.graph.updateNodePositions);

  const startSimulation = useCallback(
    (nodes: GraphNode[], edges: GraphEdge[]) => {
      // Stop existing simulation
      if (simulationRef.current) {
        simulationRef.current.stop();
      }

      // Create new simulation
      const simulation = d3.forceSimulation<GraphNode>(nodes)
        .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
          .id(d => d.id)
          .distance(d => 50 + (d.distance || 1) * 20)
          .strength(d => Math.min(1, d.weight / 10))
        )
        .force('charge', d3.forceManyBody()
          .strength((d: any) => -100 - (d.connections || 0) * 10)
          .distanceMax(300)
        )
        .force('center', d3.forceCenter(0, 0).strength(0.05))
        .force('collision', d3.forceCollide()
          .radius((d: any) => 10 + Math.sqrt(d.connections || 1) * 2)
          .strength(0.7)
        )
        .alphaDecay(0.01)
        .velocityDecay(0.4);

      // Update positions on tick
      simulation.on('tick', () => {
        const positions: Array<{ id: string; x: number; y: number }> = [];

        nodes.forEach(node => {
          // Keep nodes within bounds
          const maxX = 1000;
          const maxY = 1000;
          node.x = Math.max(-maxX, Math.min(maxX, node.x || 0));
          node.y = Math.max(-maxY, Math.min(maxY, node.y || 0));

          positions.push({ id: node.id, x: node.x, y: node.y });
        });

        // Batch update positions
        updateNodePositions(positions);
      });

      simulationRef.current = simulation;
    },
    [updateNodePositions]
  );

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, [stopSimulation]);

  return { startSimulation, stopSimulation };
};