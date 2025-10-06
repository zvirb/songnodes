import { useRef, useCallback, useEffect } from 'react';
import * as d3 from 'd3-force';
import { GraphNode, GraphEdge } from '../types';
import { useStore } from '../store/useStore';

export const useForceSimulation = () => {
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const updateNodePositions = useStore(state => state.graph.updateNodePositions);

  const startSimulation = useCallback(
    (nodes: GraphNode[], edges: GraphEdge[]) => {
      // Stop existing simulation and remove old tick listener
      if (simulationRef.current) {
        simulationRef.current.on('tick', null); // Remove old listener
        simulationRef.current.stop();
      }

      // Create new simulation
      const simulation = d3.forceSimulation<GraphNode>(nodes)
        .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
          .id(d => d.id)
          .distance(d => 120 + (d.distance || 1) * 40)  // INCREASED: Double the distances for better spacing
          .strength(d => Math.min(0.7, d.weight / 10))  // REDUCED: Slightly weaker links for flexibility
        )
        .force('charge', d3.forceManyBody()
          .strength((d: any) => -400 - (d.connections || 0) * 30)  // INCREASED: 4x stronger repulsion
          .distanceMax(600)  // INCREASED: Double the max distance for wider effect
        )
        .force('center', d3.forceCenter(0, 0).strength(0.03))  // REDUCED: Weaker centering allows spread
        .force('collision', d3.forceCollide()
          .radius((d: any) => 25 + Math.sqrt(d.connections || 1) * 5)  // INCREASED: Better collision detection
          .strength(0.9)  // INCREASED: Stronger collision prevention
        )
        .alphaDecay(0.0228)   // Standard D3 decay rate for quality layouts
        .velocityDecay(0.4);  // Moderate friction for stability (D3 best practice)

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
      simulationRef.current.on('tick', null); // Explicitly remove tick listener
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