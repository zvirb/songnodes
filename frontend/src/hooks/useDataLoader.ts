import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge, Track } from '../types';

/**
 * Helper function to transform node data into a Track object
 * This ensures that each node has the track property populated
 * for the track modal to display correctly
 *
 * ✅ FIX: Provides safe defaults for all required Track fields
 */
const nodeToTrack = (node: any): Track => {
  const metadata = node.metadata || {};
  const title = node.title || metadata.title || metadata.label || 'Unknown Track';
  const artist = node.artist || metadata.artist || 'Unknown Artist';

  // ✅ Ensure energy is a valid number between 1-10
  const rawEnergy = metadata.energy || 5;
  const energy = Math.min(10, Math.max(1, Math.round(rawEnergy))) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  // ✅ Ensure BPM is a valid number (default 128 for house music)
  const bpm = metadata.bpm || 128;

  // ✅ Ensure key is a valid CamelotKey (default 8A)
  const rawKey = metadata.key || metadata.camelotKey || '8A';
  const key = rawKey as '1A' | '2A' | '3A' | '4A' | '5A' | '6A' | '7A' | '8A' | '9A' | '10A' | '11A' | '12A' | '1B' | '2B' | '3B' | '4B' | '5B' | '6B' | '7B' | '8B' | '9B' | '10B' | '11B' | '12B';

  // ✅ Ensure duration is a valid number (default 240 seconds = 4 minutes)
  const duration = metadata.duration || 240;

  return {
    id: node.id,
    name: title,
    artist: artist,
    album: metadata.album,
    genre: metadata.genre || metadata.category || 'Electronic',

    // ✅ Required DJ-critical metadata with safe defaults
    bpm: bpm,
    key: key,
    energy: energy,

    // ✅ Required timing
    duration: duration,
    intro: metadata.intro,
    outro: metadata.outro,

    // ✅ Required status field (default to unplayed)
    status: 'unplayed' as 'unplayed' | 'playing' | 'played' | 'queued',

    // Optional fields
    waveform: metadata.waveform,
    beatgrid: metadata.beatgrid,
    lastPlayed: metadata.lastPlayed,
    playCount: metadata.playCount || 0,
    tags: metadata.tags || [],
    mood: metadata.mood,
    notes: metadata.notes,
    cuePoints: metadata.cuePoints || [],
  };
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
        // Load nodes
        const nodesResponse = await fetch('/api/graph/nodes?limit=500');

        // Check if nodes request was successful
        if (!nodesResponse.ok) {
          throw new Error(`Nodes API returned ${nodesResponse.status}`);
        }

        const nodesData = await nodesResponse.json();

        // Load edges
        const edgesResponse = await fetch('/api/graph/edges?limit=5000');

        // Check if edges request was successful (but don't throw - edges are optional)
        let edgesData = { edges: [] };
        if (edgesResponse.ok) {
          edgesData = await edgesResponse.json();
        } else {
          console.warn(`⚠️  Edges API returned ${edgesResponse.status}, continuing with nodes only`);
        }

        // Transform nodes with safety check
        const nodes: GraphNode[] = (nodesData.nodes || []).map((node: any) => ({
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
          // ✅ FIX: Create Track object for modal display
          track: nodeToTrack(node),
        }));

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

        console.log(`Filtered ${edges.length} edges from ${rawEdges.length} total edges`);

        setGraphData({ nodes, edges });
        applyFilters({});
        setLoading(false);

        console.log(`✅ Loaded ${nodes.length} nodes and ${edges.length} edges`);
      } catch (error) {
        console.error('❌ Failed to load graph data:', error);
        setError('Failed to load graph data. Please try again.');

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
            // ✅ FIX: Create Track object for fallback data too
            track: nodeToTrack(node),
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
          setLoading(false);
          console.log(`✅ Loaded ${nodes.length} nodes and ${edges.length} edges from fallback`);
        } catch (fallbackError) {
          console.error('❌ Failed to load from fallback:', fallbackError);
          setLoading(false);
        }
      }
    };

    loadData();
  }, [setGraphData, applyFilters, setLoading, setError]);
};