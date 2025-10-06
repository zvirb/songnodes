import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { GraphData, GraphNode, GraphEdge, Track, PerformanceMetrics } from '../types';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Zap,
  Database
} from 'lucide-react';

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

interface LiveDataLoaderProps {
  autoStart?: boolean;
  updateInterval?: number;
  enableWebSocket?: boolean;
  enablePerformanceTracking?: boolean;
  onDataUpdate?: (type: string, data: any) => void;
  onError?: (error: string) => void;
  showStatus?: boolean;
  maxRetries?: number;
}

interface ConnectionStatus {
  connected: boolean;
  lastUpdate: number;
  retryCount: number;
  latency: number;
  error?: string;
}

interface DataUpdateEvent {
  type: 'graph' | 'nodes' | 'edges' | 'tracks' | 'performance' | 'scraper';
  data: any;
  timestamp: number;
  source: 'api' | 'websocket' | 'cache';
}

export const LiveDataLoader: React.FC<LiveDataLoaderProps> = ({
  autoStart = true,
  updateInterval = 30000, // 30 seconds
  enableWebSocket = true,
  enablePerformanceTracking = true,
  onDataUpdate,
  onError,
  showStatus = true,
  maxRetries = 3
}) => {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    lastUpdate: 0,
    retryCount: 0,
    latency: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<DataUpdateEvent[]>([]);

  // Store actions
  const setGraphData = useStore(state => state.graph.setGraphData);
  const updatePerformanceMetrics = useStore(state => state.updatePerformanceMetrics);
  const setError = useStore(state => state.setError);
  const setLoading = useStore(state => state.setLoading);

  // Refs for cleanup
  const intervalRef = useRef<NodeJS.Timeout>();
  const websocketRef = useRef<WebSocket>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // CRITICAL: Add ref to avoid closure issues with WebSocket retry logic
  const statusRef = useRef<ConnectionStatus>({
    connected: false,
    lastUpdate: 0,
    retryCount: 0,
    latency: 0
  });
  const performanceTrackerRef = useRef<number>();

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;

      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setStatus(prev => {
          const newStatus = {
            ...prev,
            connected: true,
            retryCount: 0,
            error: undefined
          };
          statusRef.current = newStatus; // Update ref to avoid closure issues
          return newStatus;
        });

        // Send subscription message
        ws.send(JSON.stringify({
          type: 'subscribe',
          topics: ['graph_updates', 'node_changes', 'scraper_status', 'performance']
        }));
      };

      ws.onmessage = (event) => {
        const startTime = performance.now();

        try {
          const message = JSON.parse(event.data);
          const latency = performance.now() - startTime;

          setStatus(prev => {
            const newStatus = {
              ...prev,
              lastUpdate: Date.now(),
              latency: Math.round(latency)
            };
            statusRef.current = newStatus; // Update ref to keep it in sync
            return newStatus;
          });

          handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setStatus(prev => {
          const newStatus = {
            ...prev,
            connected: false
          };
          statusRef.current = newStatus; // Update ref to avoid closure issues
          return newStatus;
        });

        // Attempt to reconnect if not intentional close
        // CRITICAL FIX: Use ref instead of state to avoid stale closure
        if (event.code !== 1000 && statusRef.current.retryCount < maxRetries) {
          const delay = Math.pow(2, statusRef.current.retryCount) * 1000; // Exponential backoff using ref
          retryTimeoutRef.current = setTimeout(() => {
            setStatus(prev => {
              const newStatus = {
                ...prev,
                retryCount: prev.retryCount + 1
              };
              statusRef.current = newStatus; // Update ref
              return newStatus;
            });
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        const errorMessage = 'WebSocket connection failed';
        setStatus(prev => {
          const newStatus = {
            ...prev,
            connected: false,
            error: errorMessage
          };
          statusRef.current = newStatus; // Update ref to avoid closure issues
          return newStatus;
        });

        if (onError) {
          onError(errorMessage);
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [enableWebSocket, status.retryCount, maxRetries, onError]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    const updateEvent: DataUpdateEvent = {
      type: message.type,
      data: message.data,
      timestamp: Date.now(),
      source: 'websocket'
    };

    addRecentUpdate(updateEvent);

    switch (message.type) {
      case 'graph_update':
        if (message.data.nodes && message.data.edges) {
          setGraphData(message.data);
          if (onDataUpdate) {
            onDataUpdate('graph', message.data);
          }
        }
        break;

      case 'node_update':
        // Update specific nodes
        console.log('Node update received:', message.data);
        break;

      case 'scraper_status':
        console.log('Scraper status:', message.data);
        break;

      case 'performance_update':
        if (enablePerformanceTracking) {
          updatePerformanceMetrics(message.data);
          if (onDataUpdate) {
            onDataUpdate('performance', message.data);
          }
        }
        break;

      case 'new_tracks':
        console.log('New tracks available:', message.data.count);
        // Could trigger a refresh or show notification
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, [setGraphData, updatePerformanceMetrics, enablePerformanceTracking, onDataUpdate]);

  // Add update to recent updates list
  const addRecentUpdate = useCallback((update: DataUpdateEvent) => {
    setRecentUpdates(prev => {
      const newUpdates = [update, ...prev.slice(0, 9)]; // Keep last 10 updates
      return newUpdates;
    });
  }, []);

  // Fetch data from API
  const fetchGraphData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoading(true);
      const startTime = performance.now();

      // Parallel fetch of nodes and edges
      const [nodesResponse, edgesResponse] = await Promise.all([
        fetch('/api/graph/nodes?limit=1000'),
        fetch('/api/graph/edges?limit=10000')
      ]);

      if (!nodesResponse.ok || !edgesResponse.ok) {
        throw new Error('Failed to fetch graph data');
      }

      const [nodesData, edgesData] = await Promise.all([
        nodesResponse.json(),
        edgesResponse.json()
      ]);

      // Transform and validate data
      // ✅ FILTER: Exclude tracks without valid artist attribution
      const validNodesData = (nodesData.nodes || []).filter((node: any) => {
        const isValid = hasValidArtist(node);
        if (!isValid) {
          console.debug(`[LiveDataLoader] Filtering out track without artist: ${node.title || node.id}`);
        }
        return isValid;
      });

      const nodes: GraphNode[] = validNodesData.map((node: any) => ({
        id: node.id,
        title: node.title || node.metadata?.title || 'Unknown',
        artist: node.artist || node.metadata?.artist || 'Unknown',
        label: node.metadata?.label || node.title || 'Unknown',
        bpm: node.metadata?.bpm,
        key: node.metadata?.key,
        genre: node.metadata?.genre || 'Electronic',
        energy: node.metadata?.energy,
        year: node.metadata?.release_year,
        connections: node.metadata?.appearance_count || 0,
        popularity: node.metadata?.popularity || 0,
        x: node.position?.x || Math.random() * 800 - 400,
        y: node.position?.y || Math.random() * 600 - 300,
        metadata: node.metadata
      }));

      const nodeIds = new Set(nodes.map(n => n.id));
      const edges: GraphEdge[] = (edgesData.edges || [])
        .filter((edge: any) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge: any, index: number) => ({
          id: edge.id || `edge-${index}`,
          source: edge.source,
          target: edge.target,
          weight: edge.weight || 1,
          distance: edge.distance || 1,
          type: edge.type || 'adjacency'
        }));

      const graphData: GraphData = { nodes, edges };
      const latency = performance.now() - startTime;

      // Update store
      setGraphData(graphData);

      // Update status
      setStatus(prev => ({
        ...prev,
        lastUpdate: Date.now(),
        latency: Math.round(latency),
        error: undefined
      }));

      // Add to recent updates
      const updateEvent: DataUpdateEvent = {
        type: 'graph',
        data: graphData,
        timestamp: Date.now(),
        source: 'api'
      };
      addRecentUpdate(updateEvent);

      if (onDataUpdate) {
        onDataUpdate('graph', graphData);
      }

      console.log(`📊 Loaded ${nodes.length} nodes, ${edges.length} edges (${Math.round(latency)}ms)`);

    } catch (error) {
      const errorMessage = `Failed to load data: ${error}`;
      console.error('❌', errorMessage);

      setStatus(prev => ({
        ...prev,
        error: errorMessage
      }));

      setError(errorMessage);

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  }, [setGraphData, setLoading, setError, addRecentUpdate, onDataUpdate, onError]);

  // Start performance tracking
  const startPerformanceTracking = useCallback(() => {
    if (!enablePerformanceTracking) return;

    const trackPerformance = () => {
      const now = performance.now();
      const memory = (performance as any).memory;

      const metrics: PerformanceMetrics = {
        frameRate: 60, // Will be updated by animation loop
        renderTime: 16.67, // 60fps target
        nodeCount: useStore.getState().graphData.nodes.length,
        edgeCount: useStore.getState().graphData.edges.length,
        visibleNodes: useStore.getState().graphData.nodes.filter(n => !n.hidden).length,
        visibleEdges: useStore.getState().graphData.edges.filter(e => !e.hidden).length,
        memoryUsage: memory ? memory.usedJSHeapSize : 0,
        lastUpdate: now
      };

      updatePerformanceMetrics(metrics);
    };

    trackPerformance();
    performanceTrackerRef.current = window.setInterval(trackPerformance, 1000);
  }, [enablePerformanceTracking, updatePerformanceMetrics]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Initialize
  useEffect(() => {
    if (autoStart) {
      fetchGraphData();
      connectWebSocket();
      startPerformanceTracking();

      // Set up periodic refresh
      intervalRef.current = setInterval(fetchGraphData, updateInterval);
    }

    return () => {
      // Cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (performanceTrackerRef.current) {
        clearInterval(performanceTrackerRef.current);
      }
      if (websocketRef.current) {
        websocketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [autoStart, fetchGraphData, connectWebSocket, startPerformanceTracking, updateInterval]);

  // Don't render status if disabled
  if (!showStatus) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: 'rgba(30, 30, 40, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '280px',
        backdropFilter: 'blur(20px)',
        color: 'white',
        fontSize: '13px'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          <Database size={16} />
          Live Data
        </div>

        <button
          onClick={refresh}
          disabled={isLoading}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: 'white',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: '6px',
            opacity: isLoading ? 0.5 : 1
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Connection Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '6px'
      }}>
        {status.connected ? (
          <>
            <Wifi size={16} color="#10b981" />
            <span style={{ color: '#10b981' }}>Connected</span>
            {status.latency > 0 && (
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                ({status.latency}ms)
              </span>
            )}
          </>
        ) : (
          <>
            <WifiOff size={16} color="#ef4444" />
            <span style={{ color: '#ef4444' }}>Disconnected</span>
            {status.retryCount > 0 && (
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                (Retry {status.retryCount}/{maxRetries})
              </span>
            )}
          </>
        )}
      </div>

      {/* Error Display */}
      {status.error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '6px',
          color: '#fecaca'
        }}>
          <AlertTriangle size={14} />
          <span style={{ fontSize: '12px' }}>{status.error}</span>
        </div>
      )}

      {/* Last Update */}
      {status.lastUpdate > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <Clock size={14} />
          <span>
            Last update: {new Date(status.lastUpdate).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Recent Updates */}
      {recentUpdates.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.8)',
            marginBottom: '8px'
          }}>
            Recent Updates
          </div>
          <div style={{
            maxHeight: '120px',
            overflowY: 'auto',
            display: 'grid',
            gap: '4px'
          }}>
            {recentUpdates.slice(0, 5).map((update, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              >
                <span style={{
                  color: update.source === 'websocket' ? '#3b82f6' : '#8b5cf6'
                }}>
                  {update.type}
                </span>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  {new Date(update.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for using LiveDataLoader functionality
export const useLiveDataLoader = (options?: Partial<LiveDataLoaderProps>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  const loaderRef = useRef<{
    refresh: () => void;
  }>();

  const refresh = useCallback(() => {
    if (loaderRef.current) {
      loaderRef.current.refresh();
    }
  }, []);

  return {
    isLoading,
    lastUpdate,
    refresh,
    LiveDataLoader: (props: Partial<LiveDataLoaderProps>) => (
      <LiveDataLoader
        {...options}
        {...props}
        onDataUpdate={(type, data) => {
          setLastUpdate(Date.now());
          if (options?.onDataUpdate) {
            options.onDataUpdate(type, data);
          }
          if (props.onDataUpdate) {
            props.onDataUpdate(type, data);
          }
        }}
      />
    )
  };
};