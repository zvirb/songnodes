import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge } from '../types';
import { graphNodeFromApi } from '../utils/trackMetadata';

/**
 * Helper function to check if a node has valid artist attribution
 * Tracks without proper artists should not be displayed
 */
const hasValidArtist = (node: any): boolean => {
  const metadata = node.metadata || {};
  const artist = node.artist || metadata.artist;

  if (!artist) return false;

  const normalizedArtist = artist.toString().toLowerCase().trim();

  // Exact matches - invalid artist values
  const invalidArtists = ['unknown', 'unknown artist', 'various artists', 'various', 'va', ''];
  if (invalidArtists.includes(normalizedArtist)) return false;

  // Prefix matches - catch "VA @...", "Unknown Artist, ...", etc.
  const invalidPrefixes = ['va @', 'various artists @', 'unknown artist,', 'unknown artist @'];
  if (invalidPrefixes.some(prefix => normalizedArtist.startsWith(prefix))) return false;

  return true;
};

export const useDataLoader = () => {
  const setGraphData = useStore(state => state.graph.setGraphData);
  const applyFilters = useStore(state => state.search.applyFilters);
  const setLoading = useStore(state => state.general.setLoading);
  const setError = useStore(state => state.general.setError);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // FIX: Use API Gateway proxy for proper CORS handling and service discovery
        // The API Gateway (port 3006) proxies requests to graph-visualization-api (port 8084)
        const response = await fetch('/api/graph/data?limit=10000&offset=0');

        // Check if request was successful
        if (!response.ok) {
          throw new Error(`The graph API answered ${response.status}`);
        }

        const data = await response.json();
        const nodesData = { nodes: data.nodes || [] };
        const edgesData = { edges: data.edges || [] };

        // Transform nodes with safety check
        // FILTER: Exclude tracks without valid artist attribution
        const allNodes = (nodesData.nodes || [])
          .filter((node: any) => hasValidArtist(node));

        const nodes: GraphNode[] = allNodes.map(graphNodeFromApi);

        // Create a set of loaded node IDs for quick lookup
        const nodeIds = new Set(nodes.map(n => n.id));

        // Transform edges - only include edges where both nodes are in our loaded set
        // Safety check: ensure edgesData.edges is an array
        const rawEdges = Array.isArray(edgesData.edges) ? edgesData.edges : [];
        const edges: GraphEdge[] = rawEdges
          .filter((edge: any) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
          .map((edge: any, index: number) => ({
            id: edge.id || `edge-${index}`,
            source: edge.source,
            target: edge.target,
            weight: edge.weight || 1,
            distance: edge.distance || 1,
            type: edge.type || edge.edge_type || 'adjacency',
          }));

        // CRITICAL: Filter out isolated nodes (nodes with no edges)
        // A node should only be displayed if it has at least one connection
        const connectedNodeIds = new Set<string>();
        edges.forEach(edge => {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        });

        const nodesBeforeConnectivityFilter = nodes.length;
        const connectedNodes = nodes.filter(node => connectedNodeIds.has(node.id));
        const isolatedNodeCount = nodesBeforeConnectivityFilter - connectedNodes.length;

        const totalNodesReceived = (nodesData.nodes || []).length;
        const filteredOutCount = totalNodesReceived - connectedNodes.length;

        // DEBUG: Graph ready logging disabled (too noisy)
        // if (process.env.NODE_ENV === 'development') {
        //   console.log(`Graph ready: ${connectedNodes.length} nodes, ${edges.length} edges (filtered ${filteredOutCount} nodes)`);
        // }

        setGraphData({ nodes: connectedNodes, edges });
        applyFilters({});
        setLoading(false);
      } catch (error) {
        console.error('Failed to load graph data:', error);
        setError(`${error instanceof Error ? error.message : 'The graph API did not answer'}.`);

        // Fallback: try loading from legacy endpoints
        try {
          const response = await fetch('/api/graph');
          if (!response.ok) throw new Error(`Graph fallback failed: ${response.status}`);
          const data = await response.json();

          // FILTER: Exclude tracks without valid artist attribution (fallback endpoint too)
          const validNodes = (data.nodes || []).filter((node: any) => hasValidArtist(node));

          const nodes: GraphNode[] = validNodes.map(graphNodeFromApi);

          const edges: GraphEdge[] = (data.edges || []).map((edge: any, index: number) => ({
            id: `edge-${index}`,
            source: edge.source,
            target: edge.target,
            weight: edge.weight || 1,
            distance: 1,
            type: 'mix',
          }));

          // CRITICAL: Filter out isolated nodes (fallback path too)
          const connectedNodeIds = new Set<string>();
          edges.forEach(edge => {
            connectedNodeIds.add(edge.source);
            connectedNodeIds.add(edge.target);
          });
          const connectedNodes = nodes.filter(node => connectedNodeIds.has(node.id));

          setError(null);
          setGraphData({ nodes: connectedNodes, edges });
          applyFilters({});
          setLoading(false);
          // DEBUG: Fallback loaded logging disabled (too noisy)
          // console.log(`Fallback loaded: ${connectedNodes.length} connected nodes, ${edges.length} edges (${nodes.length - connectedNodes.length} isolated filtered)`);
        } catch (fallbackError) {
          console.error('Failed to load from fallback:', fallbackError);
          setLoading(false);
        }
      }
    };

    loadData();
  }, [setGraphData, applyFilters, setLoading, setError]);
};