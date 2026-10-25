import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { GraphData, GraphNode, GraphEdge, PerformanceMetrics } from '../types';
import { hasValidArtist } from '../utils/dataLoaderUtils';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Clock,
  Database
} from 'lucide-react';

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
  type: 'graph' | 'nodes' | 'edges' | 'tracks' | 'performance' | 'scraper' | 'telemetry' | 'pipeline_update';
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
  const updatePerformanceMetrics = useStore(state => state.performance.updatePerformanceMetrics);
  const setError = useStore(state => state.general.setError);
  const setLoading = useStore(state => state.general.setLoading);

  // Watch for authentication changes
  const musicCredentials = useStore(state => state.musicCredentials);

  // Refs for cleanup
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const websocketRef = useRef<WebSocket | undefined>(undefined);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const statusRef = useRef<ConnectionStatus>({
    connected: false,
    lastUpdate: 0,
    retryCount: 0,
    latency: 0
  });
  const performanceTrackerRef = useRef<number | undefined>(undefined);

  // Add update to recent updates list
  const addRecentUpdate = useCallback((update: DataUpdateEvent) => {
    setRecentUpdates(prev => {
      const newUpdates = [update, ...prev.slice(0, 9)];
      return newUpdates;
    });
  }, []);

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
        if (message.data?.nodes && message.data?.edges) {
          setGraphData(message.data);
          if (onDataUpdate) {
            onDataUpdate('graph', message.data);
          }
        }
        break;

      case 'scraper_status':
      case 'telemetry':
      case 'pipeline_update':
        if (onDataUpdate) {
          onDataUpdate(message.type, message.data);
        }
        break;

      case 'performance_update':
        if (enablePerformanceTracking) {
          updatePerformanceMetrics(message.data);
          if (onDataUpdate) {
            onDataUpdate('performance', message.data);
          }
        }
        break;

      default:
        break;
    }
  }, [setGraphData, updatePerformanceMetrics, enablePerformanceTracking, onDataUpdate, addRecentUpdate]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;

      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        setStatus(prev => {
          const newStatus = {
            ...prev,
            connected: true,
            retryCount: 0,
            error: undefined
          };
          statusRef.current = newStatus;
          return newStatus;
        });

        // Send subscription message
        ws.send(JSON.stringify({
          type: 'subscribe',
          topics: ['graph_updates', 'node_changes', 'scraper_status', 'telemetry', 'pipeline_update', 'performance']
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
            statusRef.current = newStatus;
            return newStatus;
          });

          handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      ws.onclose = (event) => {
        setStatus(prev => {
          const newStatus = {
            ...prev,
            connected: false
          };
          statusRef.current = newStatus;
          return newStatus;
        });

        if (event.code !== 1000 && statusRef.current.retryCount < maxRetries) {
          const delay = Math.pow(2, statusRef.current.retryCount) * 1000;
          retryTimeoutRef.current = setTimeout(() => {
            setStatus(prev => {
              const newStatus = {
                ...prev,
                retryCount: prev.retryCount + 1
              };
              statusRef.current = newStatus;
              return newStatus;
            });
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        const errorMessage = 'WebSocket connection failed';
        setStatus(prev => {
          const newStatus = {
            ...prev,
            connected: false,
            error: errorMessage
          };
          statusRef.current = newStatus;
          return newStatus;
        });

        if (onError) {
          onError(errorMessage);
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [enableWebSocket, maxRetries, onError, handleWebSocketMessage]);

  // Fetch data from API
  const fetchGraphData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoading(true);
      const startTime = performance.now();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (musicCredentials.tidal?.accessToken && musicCredentials.tidal?.isConnected) {
        headers['X-Tidal-Access-Token'] = musicCredentials.tidal.accessToken;
      }

      if (musicCredentials.spotify?.accessToken && musicCredentials.spotify?.isConnected) {
        headers['X-Spotify-Access-Token'] = musicCredentials.spotify.accessToken;
      }

      const [nodesResponse, edgesResponse] = await Promise.all([
        fetch('/api/graph/nodes?limit=1000', { headers }),
        fetch('/api/graph/edges?limit=10000', { headers })
      ]);

      if (!nodesResponse.ok || !edgesResponse.ok) {
        throw new Error('Failed to fetch graph data');
      }

      const [nodesData, edgesData] = await Promise.all([
        nodesResponse.json(),
        edgesResponse.json()
      ]);

      const validNodesData = (nodesData.nodes || []).filter((node: any) => hasValidArtist(node));

      const nodes: GraphNode[] = validNodesData.map((node: any) => ({
        id: node.id,
        title: node.title || node.metadata?.title || 'Unknown Title',
        artist: node.artist || node.metadata?.artist || 'Unknown Artist',
        label: node.metadata?.label || node.title || 'Unknown Label',
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

      setGraphData(graphData);

      setStatus(prev => ({
        ...prev,
        lastUpdate: Date.now(),
        latency: Math.round(latency),
        error: undefined
      }));

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

    } catch (error) {
      const errorMessage = `Failed to load data: ${error}`;
      console.error(errorMessage);

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
  }, [musicCredentials, setGraphData, setLoading, setError, addRecentUpdate, onDataUpdate, onError]);

  // Start performance tracking
  const startPerformanceTracking = useCallback(() => {
    if (!enablePerformanceTracking) return;

    const trackPerformance = () => {
      const now = performance.now();
      const memory = (performance as any).memory;

      const metrics: PerformanceMetrics = {
        frameRate: 60,
        renderTime: 16.67,
        nodeCount: useStore.getState().graphData.nodes.length,
        edgeCount: useStore.getState().graphData.edges.length,
        visibleNodes: useStore.getState().graphData.nodes.length,
        visibleEdges: useStore.getState().graphData.edges.length,
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

      intervalRef.current = setInterval(fetchGraphData, updateInterval);
    }

    return () => {
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

  if (!showStatus) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--space-4)',
        right: 'var(--space-4)',
        zIndex: 'var(--z-drawer)',
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-4)',
        minWidth: '280px',
        backdropFilter: 'blur(20px)',
        color: 'var(--fg)',
        fontSize: 'var(--body-s)',
        boxShadow: 'var(--shadow-2)'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-3)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          <Database size={16} />
          <span>Live Data Loader</span>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--fg)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: 'var(--space-1)',
            opacity: isLoading ? 0.5 : 1
          }}
          aria-label="Refresh live data"
        >
          <RefreshCw size={14} className={isLoading ? 'sn-spinner' : ''} />
        </button>
      </div>

      {/* Connection Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-3)',
        padding: 'var(--space-2)',
        backgroundColor: 'var(--surface-2)',
        borderRadius: 'var(--radius-control)'
      }}>
        {status.connected ? (
          <>
            <Wifi size={16} color="var(--status-ok)" />
            <span style={{ color: 'var(--status-ok)', fontWeight: 600 }}>Connected</span>
            {status.latency > 0 && (
              <span className="sn-mono" style={{ color: 'var(--fg-2)', fontSize: '0.75rem', fontFamily: 'var(--font-data)' }}>
                ({status.latency}ms)
              </span>
            )}
          </>
        ) : (
          <>
            <WifiOff size={16} color="var(--status-bad)" />
            <span style={{ color: 'var(--status-bad)', fontWeight: 600 }}>Disconnected</span>
            {status.retryCount > 0 && (
              <span className="sn-mono" style={{ color: 'var(--fg-2)', fontSize: '0.75rem', fontFamily: 'var(--font-data)' }}>
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
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          padding: 'var(--space-2)',
          backgroundColor: 'var(--status-bad-bg)',
          border: '1px solid var(--status-bad)',
          borderRadius: 'var(--radius-control)',
          color: 'var(--status-bad)'
        }}>
          <AlertTriangle size={14} />
          <span style={{ fontSize: '0.75rem' }}>{status.error}</span>
        </div>
      )}

      {/* Last Update */}
      {status.lastUpdate > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          color: 'var(--fg-2)',
          fontSize: '0.75rem'
        }}>
          <Clock size={14} />
          <span>
            Last sync:{' '}
            <time className="sn-mono" style={{ fontFamily: 'var(--font-data)' }}>
              {new Date(status.lastUpdate).toLocaleTimeString()}
            </time>
          </span>
        </div>
      )}

      {/* Recent Updates */}
      {recentUpdates.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'var(--fg-3)',
            marginBottom: 'var(--space-1)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Recent Streams
          </div>
          <div style={{
            maxHeight: '110px',
            overflowY: 'auto',
            display: 'grid',
            gap: 'var(--space-1)'
          }}>
            {recentUpdates.slice(0, 4).map((update, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-1) var(--space-2)',
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: 'var(--radius-chip)',
                  fontSize: '0.6875rem'
                }}
              >
                <span style={{ color: 'var(--fg)', fontWeight: 500 }}>
                  {update.type}
                </span>
                <span className="sn-mono" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-data)' }}>
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
