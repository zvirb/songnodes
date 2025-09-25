import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge } from '../types';

export const useDataLoader = () => {
  const setGraphData = useStore(state => state.graph.setGraphData);
  const applyFilters = useStore(state => state.search.applyFilters);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load nodes
        const nodesResponse = await fetch('/api/v1/graph/nodes?limit=1000');
        const nodesData = await nodesResponse.json();

        // Load edges
        const edgesResponse = await fetch('/api/v1/graph/edges?limit=5000');
        const edgesData = await edgesResponse.json();

        // Transform nodes
        const nodes: GraphNode[] = nodesData.nodes.map((node: any) => ({
          id: node.id,
          title: node.label || node.name || 'Unknown',
          artist: node.artist || 'Unknown',
          artistId: node.artist_id,
          bpm: node.bpm,
          key: node.key,
          genre: node.genre || node.type,
          energy: node.energy,
          year: node.year,
          label: node.label,
          connections: node.connection_count || 0,
          popularity: node.popularity || 0,
          // Random initial positions
          x: Math.random() * 800 - 400,
          y: Math.random() * 600 - 300,
        }));

        // Transform edges
        const edges: GraphEdge[] = edgesData.edges.map((edge: any, index: number) => ({
          id: edge.id || `edge-${index}`,
          source: edge.source_id || edge.source,
          target: edge.target_id || edge.target,
          weight: edge.weight || edge.occurrence_count || 1,
          distance: edge.avg_distance || 1,
          type: edge.edge_type || 'mix',
        }));

        setGraphData({ nodes, edges });
        applyFilters({});

        console.log(`Loaded ${nodes.length} nodes and ${edges.length} edges`);
      } catch (error) {
        console.error('Failed to load graph data:', error);

        // Fallback: try loading from legacy endpoints
        try {
          const response = await fetch('/api/graph');
          const data = await response.json();

          const nodes: GraphNode[] = (data.nodes || []).map((node: any) => ({
            id: node.id,
            title: node.label || node.name || 'Unknown',
            artist: node.artist || 'Unknown',
            genre: node.type,
            x: node.x || Math.random() * 800 - 400,
            y: node.y || Math.random() * 600 - 300,
          }));

          const edges: GraphEdge[] = (data.edges || []).map((edge: any, index: number) => ({
            id: `edge-${index}`,
            source: edge.source,
            target: edge.target,
            weight: edge.weight || 1,
            distance: 1,
            type: 'mix',
          }));

          setGraphData({ nodes, edges });
          applyFilters({});
        } catch (fallbackError) {
          console.error('Failed to load from fallback:', fallbackError);
        }
      }
    };

    loadData();
  }, [setGraphData, applyFilters]);
};