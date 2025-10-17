import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge, Track } from '../types';

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

/**
 * Helper function to transform node data into a Track object
 * This ensures that each node has the track property populated
 * for the track modal to display correctly
 *
 * ✅ FIX: Provides safe defaults for all required Track fields
 * ⚠️  ASSUMES: Node has already been validated with hasValidArtist()
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

    // ✅ Year/Release info
    year: metadata.release_year || metadata.year,

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
        // Load nodes - PERFORMANCE: Reduced from 20k to 5k to prevent render loop bottleneck
        // 5k nodes = 150k iterations/sec vs 20k nodes = 600k iterations/sec (4x faster)
        // After recovery: ~5,500+ nodes with valid artists available from 31k+ tracks in edges
        const nodesResponse = await fetch('/api/graph/nodes?limit=5000');

        // Check if nodes request was successful
        if (!nodesResponse.ok) {
          throw new Error(`Nodes API returned ${nodesResponse.status}`);
        }

        const nodesData = await nodesResponse.json();

        // Load edges - PERFORMANCE: Reduced from 50k to 15k to prevent render loop bottleneck
        // With 5k nodes, we don't need 50k edges (most would be filtered out anyway)
        // The edge density between nodes with artists is low (~1%), so we need the full dataset
        const edgesResponse = await fetch('/api/graph/edges?limit=15000');

        // Check if edges request was successful (but don't throw - edges are optional)
        let edgesData = { edges: [] };
        if (edgesResponse.ok) {
          edgesData = await edgesResponse.json();
        } else {
          console.warn(`⚠️  Edges API returned ${edgesResponse.status}, continuing with nodes only`);
        }

        // Transform nodes with safety check
        // ✅ FILTER: Exclude tracks without valid artist attribution
        const allNodes = (nodesData.nodes || [])
          .filter((node: any) => hasValidArtist(node));

        const nodes: GraphNode[] = allNodes.map((node: any) => {
          // ✅ CRITICAL FIX: Generate stable random positions based on node ID hash
          // This prevents LOD flickering caused by Math.random() returning different values on each render
          const hash = node.id.split('').reduce((acc: number, char: string) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
          }, 0);
          const stableRandomX = ((hash & 0xFFFF) / 0xFFFF) * 1600 - 800;
          const stableRandomY = (((hash >> 16) & 0xFFFF) / 0xFFFF) * 1200 - 600;

          return {
            id: node.id,
            title: node.title || node.metadata?.title || node.metadata?.label || 'ERROR: No Track Title',
            artist: node.artist || node.metadata?.artist || 'ERROR: No Artist (Filter Bypass)',
            artistId: node.artist_id,
            bpm: node.metadata?.bpm,
            key: node.metadata?.key,
            genre: node.metadata?.genre || node.metadata?.category || 'Electronic',
            energy: node.metadata?.energy,
            year: node.metadata?.release_year,
            label: node.metadata?.label || node.metadata?.title || node.title || 'ERROR: No Label',
            connections: node.metadata?.appearance_count || 0,
            popularity: node.metadata?.popularity || 0,
            // ✅ FIX: Use stable hash-based positions instead of Math.random() to prevent LOD instability
            x: (node.position?.x !== undefined && node.position?.x !== null) ? node.position.x : stableRandomX,
            y: (node.position?.y !== undefined && node.position?.y !== null) ? node.position.y : stableRandomY,
            // Include metadata for DJInterface access
            metadata: node.metadata,
            // ✅ FIX: Create Track object for modal display
            track: nodeToTrack(node),
          };
        });

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

        // ✅ CRITICAL: Filter out isolated nodes (nodes with no edges)
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
        //   console.log(`✅ Graph ready: ${connectedNodes.length} nodes, ${edges.length} edges (filtered ${filteredOutCount} nodes)`);
        // }

        setGraphData({ nodes: connectedNodes, edges });
        applyFilters({});
        setLoading(false);
      } catch (error) {
        console.error('❌ Failed to load graph data:', error);
        setError('Failed to load graph data. Please try again.');

        // Fallback: try loading from legacy endpoints
        try {
          const response = await fetch('/api/graph');
          const data = await response.json();

          // ✅ FILTER: Exclude tracks without valid artist attribution (fallback endpoint too)
          const validNodes = (data.nodes || []).filter((node: any) => hasValidArtist(node));

          const nodes: GraphNode[] = validNodes.map((node: any) => {
            // Stable hash-based positions for fallback too
            const hash = node.id.split('').reduce((acc: number, char: string) => {
              return ((acc << 5) - acc) + char.charCodeAt(0);
            }, 0);
            const stableRandomX = ((hash & 0xFFFF) / 0xFFFF) * 1600 - 800;
            const stableRandomY = (((hash >> 16) & 0xFFFF) / 0xFFFF) * 1200 - 600;

            return {
              id: node.id,
              title: node.label || node.name || 'ERROR: No Track Title (Fallback)',
              artist: node.artist || 'ERROR: No Artist (Fallback)',
              genre: node.type,
              x: (node.x !== undefined && node.x !== null && node.x !== 0) ? node.x : stableRandomX,
              y: (node.y !== undefined && node.y !== null && node.y !== 0) ? node.y : stableRandomY,
              // ✅ FIX: Create Track object for fallback data too
              track: nodeToTrack(node),
            };
          });

          const edges: GraphEdge[] = (data.edges || []).map((edge: any, index: number) => ({
            id: `edge-${index}`,
            source: edge.source,
            target: edge.target,
            weight: edge.weight || 1,
            distance: 1,
            type: 'mix',
          }));

          // ✅ CRITICAL: Filter out isolated nodes (fallback path too)
          const connectedNodeIds = new Set<string>();
          edges.forEach(edge => {
            connectedNodeIds.add(edge.source);
            connectedNodeIds.add(edge.target);
          });
          const connectedNodes = nodes.filter(node => connectedNodeIds.has(node.id));

          setGraphData({ nodes: connectedNodes, edges });
          applyFilters({});
          setLoading(false);
          // DEBUG: Fallback loaded logging disabled (too noisy)
          // console.log(`✅ Fallback loaded: ${connectedNodes.length} connected nodes, ${edges.length} edges (${nodes.length - connectedNodes.length} isolated filtered)`);
        } catch (fallbackError) {
          console.error('❌ Failed to load from fallback:', fallbackError);
          setLoading(false);
        }
      }
    };

    loadData();
  }, [setGraphData, applyFilters, setLoading, setError]);
};