import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setNodes, setEdges } from '../store/graphSlice';

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    metadata?: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    metadata?: Record<string, any>;
  }>;
}

export const LiveDataLoader: React.FC = () => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadLiveData = async () => {
    setLoading(true);
    try {
      // Try to load live performance data first
      const liveResponse = await fetch('/live-performance-data.json');
      if (liveResponse.ok) {
        const liveData: GraphData = await liveResponse.json();

        // Add positions for force layout
        const nodesWithPositions = liveData.nodes.map((node, i) => ({
          ...node,
          x: Math.random() * 800 - 400,
          y: Math.random() * 600 - 300,
          size: node.type === 'artist' ? 20 : node.type === 'venue' ? 15 : 10,
          color: node.type === 'artist' ? '#FF6B6B' :
                 node.type === 'venue' ? '#4ECDC4' :
                 node.type === 'location' ? '#45B7D1' : '#96CEB4'
        }));

        dispatch(setNodes(nodesWithPositions));
        dispatch(setEdges(liveData.edges));
        setDataLoaded(true);
        console.log(`Loaded ${nodesWithPositions.length} nodes and ${liveData.edges.length} edges`);
      } else {
        // Fall back to sample data
        const sampleResponse = await fetch('/sample-data.json');
        if (sampleResponse.ok) {
          const sampleData: GraphData = await sampleResponse.json();
          dispatch(setNodes(sampleData.nodes));
          dispatch(setEdges(sampleData.edges));
          console.log('Loaded sample data');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      padding: '10px',
      background: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      borderRadius: '5px',
      zIndex: 1000
    }}>
      {loading && <div>Loading live data...</div>}
      {dataLoaded && (
        <div>
          <div style={{ color: '#4ECDC4', fontWeight: 'bold' }}>
            🎵 Live Performance Data
          </div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            Real concerts from Setlist.fm
          </div>
        </div>
      )}
      <button
        onClick={loadLiveData}
        style={{
          marginTop: '10px',
          padding: '5px 10px',
          background: '#4ECDC4',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Refresh Data
      </button>
    </div>
  );
};