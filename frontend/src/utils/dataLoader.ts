/**
 * Data loader utility for loading local JSON files
 */

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    x?: number;
    y?: number;
    size?: number;
    color?: string;
    metadata?: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    weight?: number;
    metadata?: Record<string, any>;
  }>;
}

const isSongNode = (n: { type?: string }) => {
  const t = (n?.type || '').toLowerCase();
  return t === 'track' || t === 'song';
};

const isSequentialEdge = (e: { type?: string }) => {
  const t = (e?.type || '').toLowerCase();
  return [
    'playlist_sequence',
    'dj_mix_transition',
    'song_transition',
    'played_next',
    'next',
    'previous',
    'followed_by',
    'preceded_by',
    'adjacent',
    'setlist_adjacent',  // Added for electronic music setlist adjacencies
    'track_adjacency',
    'adjacency'
  ].includes(t);
};

const filterToSongsOnly = (data: GraphData): GraphData => {
  if (!data) return { nodes: [], edges: [] } as any;
  const nodeSet = new Set(
    data.nodes.filter(isSongNode).map(n => n.id)
  );
  const edges = (data.edges || []).filter(e =>
    nodeSet.has(e.source) && nodeSet.has(e.target) && isSequentialEdge(e)
  );
  const nodes = data.nodes.filter(n => nodeSet.has(n.id));
  return { nodes, edges } as GraphData;
};

export const loadGraphData = async (): Promise<GraphData | null> => {
  try {
    // Load real scraped data from our visualization API instead of static JSON
    console.log('🎵 Loading real scraped data from API...');

    try {
      // Call the enhanced visualization service through environment-aware URL
      const apiUrl = import.meta.env.VITE_VISUALIZATION_API_URL
        ? `${import.meta.env.VITE_VISUALIZATION_API_URL}/api/v1/graph`
        : '/api/v1/graph';

      const apiResponse = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        console.log('✅ Loaded real scraped data:', {
          nodes: apiData.nodes?.length || 0,
          edges: apiData.edges?.length || 0
        });

        if (apiData.nodes && apiData.nodes.length > 0) {
          // Convert API format to expected GraphData format
          const graphData: GraphData = {
            nodes: apiData.nodes.map((node: any) => ({
              ...node,
              label: `${node.title} - ${node.artist}`, // Show both title and artist
              size: 12,
              x: node.position?.x || Math.random() * 1000,
              y: node.position?.y || Math.random() * 600
            })),
            edges: apiData.edges || []
          };

          return graphData;
        }
      }
    } catch (apiError) {
      console.warn('❌ Failed to load from API, falling back:', apiError);
    }

    // Fallback: Try to load static data only if API fails
    console.log('🎵 Falling back to static data...');
    const liveResponse = await fetch('/live-performance-data.json');

    if (liveResponse.ok) {
      const liveData: GraphData = await liveResponse.json();
      console.log('✅ Loaded fallback data:', {
        nodes: liveData.nodes.length,
        edges: liveData.edges.length
      });

      // Filter to songs-only dataset; if empty, fall back to sample
      const songsOnly = filterToSongsOnly(liveData);
      console.log('🎚️ Songs-only (fallback):', { nodes: songsOnly.nodes.length, edges: songsOnly.edges.length });

      if (songsOnly.nodes.length > 0 && songsOnly.edges.length > 0) {
        // Add visual properties and annotate ownership if available
        const processedData = {
          nodes: songsOnly.nodes.map((node, i) => ({
            ...node,
            x: node.x ?? (Math.random() - 0.5) * 800,
            y: node.y ?? (Math.random() - 0.5) * 600,
            size: node.size ?? 12,
            color: node.color ?? getNodeColor(node.type)
          })),
          edges: songsOnly.edges.map(edge => ({
            ...edge,
            weight: edge.weight ?? 1.0
          }))
        };
        await annotateOwnership(processedData);
        return processedData;
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to load live performance data:', error);
  }

  console.error('❌ No data could be loaded');
  return null;
};

// Optional: annotate nodes with ownership info based on /my-collection.json
async function annotateOwnership(data: GraphData): Promise<void> {
  try {
    let ownedSet = new Set<string>();
    // Try remote file first
    try {
      const res = await fetch('/my-collection.json');
      if (res.ok) {
        const collection = await res.json();
        ownedSet = new Set(
          Array.isArray(collection)
            ? collection.map((t: any) => String(t).toLowerCase())
            : []
        );
      }
    } catch (_) { /* ignore */ }

    // Merge in localStorage if present
    try {
      const local = (typeof window !== 'undefined') ? window.localStorage.getItem('myCollectionTitles') : null;
      if (local) {
        const list = JSON.parse(local);
        if (Array.isArray(list)) {
          list.map((t: any) => String(t).toLowerCase()).forEach((s: string) => ownedSet.add(s));
        }
      }
    } catch (_) { /* ignore */ }
    data.nodes.forEach((n: any) => {
      const title = (n.title || n.label || '').toLowerCase();
      n.metadata = n.metadata || {};
      n.metadata.owned = ownedSet.has(title);
    });
  } catch (_) {
    // silently ignore
  }
}

const getNodeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    artist: '#FF6B6B',      // Red
    venue: '#4ECDC4',       // Teal
    location: '#45B7D1',    // Blue
    city: '#45B7D1',        // Blue
    track: '#96CEB4',       // Green
    mix: '#FFEAA7',         // Yellow
    event: '#DDA0DD',       // Plum
    default: '#95A5A6'      // Gray
  };

  return colorMap[type] || colorMap.default;
};
