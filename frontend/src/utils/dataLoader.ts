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
    // Try to load live performance data first
    console.log('🎵 Attempting to load live performance data...');
    const liveResponse = await fetch('/live-performance-data.json');

    if (liveResponse.ok) {
      const liveData: GraphData = await liveResponse.json();
      console.log('✅ Loaded live performance data:', {
        nodes: liveData.nodes.length,
        edges: liveData.edges.length
      });

      // Filter to songs-only dataset; if empty, fall back to sample
      const songsOnly = filterToSongsOnly(liveData);
      console.log('🎚️ Songs-only (live):', { nodes: songsOnly.nodes.length, edges: songsOnly.edges.length });

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

  try {
    // Fall back to sample data
    console.log('🔄 Loading sample data as fallback...');
    const sampleResponse = await fetch('/sample-data.json');

    if (sampleResponse.ok) {
      const sampleData: GraphData = await sampleResponse.json();
      console.log('✅ Loaded sample data:', {
        nodes: sampleData.nodes.length,
        edges: sampleData.edges.length
      });

      const songsOnly = filterToSongsOnly(sampleData);
      console.log('🎚️ Songs-only (sample):', { nodes: songsOnly.nodes.length, edges: songsOnly.edges.length });

      // Add visual properties
      const processedData = {
        nodes: songsOnly.nodes.map((node, i) => ({
          ...node,
          x: node.x ?? (Math.random() - 0.5) * 400,
          y: node.y ?? (Math.random() - 0.5) * 300,
          size: node.size ?? 12,
          color: node.color ?? getNodeColor(node.type || 'default')
        })),
        edges: songsOnly.edges.map(edge => ({
          ...edge,
          weight: edge.weight ?? 1.0
        }))
      };
      await annotateOwnership(processedData);
      return processedData;
    }
  } catch (error) {
    console.warn('⚠️ Failed to load sample data:', error);
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
