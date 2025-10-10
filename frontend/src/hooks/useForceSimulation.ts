import { useRef, useCallback, useEffect } from 'react';
import * as d3 from 'd3-force';
import { GraphNode, GraphEdge } from '../types';
import { useStore } from '../store/useStore';
import {
  calculateMusicBasedDistance,
  getLinkStrengthMultiplier,
  getNodeBPM,
  getNodeGenre,
  getNodeDegree,
  getBPMRadialPosition,
  isSameGenreCluster,
} from '../utils/harmonicCompatibility';

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

      // Calculate BPM range for radial force
      const bpms = nodes.map(n => getNodeBPM(n)).filter((bpm): bpm is number => bpm !== null);
      const minBPM = bpms.length > 0 ? Math.min(...bpms) : 60;
      const maxBPM = bpms.length > 0 ? Math.max(...bpms) : 180;

      // Create node lookup map for edge processing
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // Create new simulation with music-specific forces
      const simulation = d3.forceSimulation<GraphNode>(nodes)
        /**
         * MUSIC-AWARE LINK FORCE
         * - Distance based on harmonic compatibility (shorter for compatible keys)
         * - BPM similarity affects distance (closer BPM = closer nodes)
         * - Playlist edges (proven transitions) get stronger links than harmonic suggestions
         */
        .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
          .id(d => d.id)
          .distance(d => {
            const sourceNode = nodeMap.get(typeof d.source === 'object' ? (d.source as any).id : d.source);
            const targetNode = nodeMap.get(typeof d.target === 'object' ? (d.target as any).id : d.target);

            if (sourceNode && targetNode) {
              // Use music-based distance calculation (harmonic + BPM + edge type)
              return calculateMusicBasedDistance(sourceNode, targetNode, d, 120);
            }

            // Fallback to basic distance
            return 120 + (d.distance || 1) * 40;
          })
          .strength(d => {
            // Music-aware link strength (playlist edges stronger than suggestions)
            const baseStrength = getLinkStrengthMultiplier(d);
            const weightMultiplier = Math.min(1.0, (d.weight || 1) / 10);
            return baseStrength * weightMultiplier;
          })
        )
        /**
         * DEGREE-BASED REPULSION FORCE
         * Nodes with more connections (high degree centrality) repel more strongly.
         * This creates natural clustering and prevents overcrowding of popular tracks.
         */
        .force('charge', d3.forceManyBody()
          .strength((d: any) => {
            const degree = getNodeDegree(d);
            // Base repulsion + degree-based scaling (more connections = stronger repulsion)
            return -400 - degree * 30;
          })
          .distanceMax(600)
        )
        /**
         * BPM-BASED RADIAL FORCE
         * Higher BPM tracks are pushed to outer rings, lower BPM to inner rings.
         * Creates a natural energy gradient in the visualization.
         */
        .force('radial', d3.forceRadial<GraphNode>(
          (d: any) => {
            const bpm = getNodeBPM(d);
            const radialPosition = getBPMRadialPosition(bpm, minBPM, maxBPM);
            // Scale from 100px (center) to 500px (outer ring)
            return 100 + radialPosition * 400;
          },
          0, // Center X
          0  // Center Y
        ).strength(0.15)) // Moderate strength to create gradient without rigidity
        /**
         * GENRE-BASED CLUSTERING FORCE
         * Tracks in the same genre cluster attract each other.
         * Creates visual clusters of similar music styles.
         */
        .force('cluster', d3.forceManyBody<GraphNode>()
          .strength((d1: any, d2: any) => {
            const genre1 = getNodeGenre(d1);
            const genre2 = getNodeGenre(d2);

            if (isSameGenreCluster(genre1, genre2)) {
              // Attract nodes in the same genre cluster
              return 50; // Positive = attraction
            }

            // No effect on nodes from different clusters
            return 0;
          })
          .distanceMax(300) // Only affect nearby nodes
        )
        /**
         * CENTERING FORCE
         * Weak centering to keep the graph from drifting.
         */
        .force('center', d3.forceCenter(0, 0).strength(0.03))
        /**
         * COLLISION FORCE
         * Prevents node overlap, scaled by connection count.
         * More connected nodes get larger collision radii.
         */
        .force('collision', d3.forceCollide()
          .radius((d: any) => {
            const degree = getNodeDegree(d);
            return 25 + Math.sqrt(degree) * 5;
          })
          .strength(0.9)
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