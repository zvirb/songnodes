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
        const nodesResponse = await fetch('/api/graph/nodes?limit=500');
        const nodesData = await nodesResponse.json();

        // Load edges
        const edgesResponse = await fetch('/api/graph/edges?limit=5000');
        const edgesData = await edgesResponse.json();

        // Transform nodes
        const nodes: GraphNode[] = nodesData.nodes.map((node: any) => ({
          id: node.id,
          title: node.title || node.metadata?.title || node.metadata?.label || 'Unknown',
          artist: node.artist || node.metadata?.artist || 'Unknown',
          artistId: node.artist_id,
          bpm: node.metadata?.bpm,
          key: node.metadata?.key,
          genre: node.metadata?.genre || node.metadata?.category || 'Electronic',
          energy: node.metadata?.energy,
          year: node.metadata?.release_year,
          label: node.metadata?.label || node.metadata?.title || node.title || 'Unknown',
          connections: node.metadata?.appearance_count || 0,
          popularity: node.metadata?.popularity || 0,
          // Use provided positions or random
          x: node.position?.x || Math.random() * 800 - 400,
          y: node.position?.y || Math.random() * 600 - 300,
          // Include metadata for DJInterface access
          metadata: node.metadata,
        }));

        // Create a set of loaded node IDs for quick lookup
        const nodeIds = new Set(nodes.map(n => n.id));

        // Transform edges - only include edges where both nodes are in our loaded set
        const edges: GraphEdge[] = edgesData.edges
          .filter((edge: any) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
          .map((edge: any, index: number) => ({
            id: edge.id || `edge-${index}`,
            source: edge.source,
            target: edge.target,
            weight: edge.weight || 1,
            distance: edge.distance || 1,
            type: edge.type || edge.edge_type || 'adjacency',
          }));

        console.log(`Filtered ${edges.length} edges from ${edgesData.edges.length} total edges`);

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