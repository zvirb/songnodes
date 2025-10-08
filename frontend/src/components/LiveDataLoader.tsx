import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { GraphData, GraphNode, GraphEdge, PerformanceMetrics } from '../types';
import { hasValidArtist } from '../utils/dataLoaderUtils';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Clock, Database } from 'lucide-react';

interface LiveDataLoaderProps {
  /** If true, starts fetching data and connecting to WebSocket on mount. */
  autoStart?: boolean;
  /** The interval in milliseconds for polling the REST API. */
  updateInterval?: number;
  /** If true, enables WebSocket connection for real-time updates. */
  enableWebSocket?: boolean;
  /** If true, enables performance metric tracking. */
  enablePerformanceTracking?: boolean;
  /** Callback for when new data is received. */
  onDataUpdate?: (type: string, data: any) => void;
  /** Callback for when an error occurs. */
  onError?: (error: string) => void;
  /** If true, displays the status indicator UI. */
  showStatus?: boolean;
  /** The maximum number of times to retry WebSocket connection. */
  maxRetries?: number;
}

interface ConnectionStatus {
  connected: boolean;
  lastUpdate: number;
  retryCount: number;
  latency: number;
  error?: string;
}

type DataUpdateEventSource = 'api' | 'websocket' | 'cache';
interface DataUpdateEvent {
  type: 'graph' | 'nodes' | 'edges' | 'tracks' | 'performance' | 'scraper';
  data: any;
  timestamp: number;
  source: DataUpdateEventSource;
}

/**
 * A non-visual component that handles live data fetching from both a REST API and a WebSocket server.
 * It manages connection status, data updates, and performance tracking, feeding the data into the global Zustand store.
 * It can optionally display a status indicator.
 */
export const LiveDataLoader: React.FC<LiveDataLoaderProps> = ({
  autoStart = true,
  updateInterval = 30000,
  enableWebSocket = true,
  showStatus = true,
  maxRetries = 3,
  onDataUpdate,
  onError,
}) => {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false, lastUpdate: 0, retryCount: 0, latency: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<DataUpdateEvent[]>([]);

  const { setGraphData, setError, setLoading } = useStore(state => ({
    setGraphData: state.graph.setGraphData,
    setError: state.general.setError,
    setLoading: state.general.setLoading,
  }));

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const addRecentUpdate = useCallback((update: DataUpdateEvent) => {
    setRecentUpdates(prev => [update, ...prev.slice(0, 9)]);
  }, []);

  const handleWebSocketMessage = useCallback((message: any) => {
    addRecentUpdate({ type: message.type, data: message.data, timestamp: Date.now(), source: 'websocket' });
    if (message.type === 'graph_update') {
      setGraphData(message.data);
      onDataUpdate?.('graph', message.data);
    }
  }, [setGraphData, onDataUpdate, addRecentUpdate]);

  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket || wsRef.current) return;

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setStatus(prev => ({ ...prev, connected: true, retryCount: 0, error: undefined }));
      ws.onmessage = (event) => handleWebSocketMessage(JSON.parse(event.data));
      ws.onerror = () => onError?.('WebSocket connection failed.');
      ws.onclose = () => {
        setStatus(prev => ({ ...prev, connected: false }));
        if (statusRef.current.retryCount < maxRetries) {
          setTimeout(() => {
            setStatus(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
            connectWebSocket();
          }, Math.pow(2, statusRef.current.retryCount) * 1000);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [enableWebSocket, maxRetries, onError, handleWebSocketMessage]);

  const fetchGraphData = useCallback(async () => {
    setIsLoading(true);
    setLoading(true);
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        fetch('/api/graph/nodes?limit=1000'),
        fetch('/api/graph/edges?limit=10000'),
      ]);
      if (!nodesRes.ok || !edgesRes.ok) throw new Error('Failed to fetch graph data');

      const nodesData = await nodesRes.json();
      const edgesData = await edgesRes.json();

      const validNodes = (nodesData.nodes || []).filter(hasValidArtist);
      const nodeIds = new Set(validNodes.map((n: GraphNode) => n.id));
      const validEdges = (edgesData.edges || []).filter((e: GraphEdge) => nodeIds.has(e.source) && nodeIds.has(e.target));

      const graphData: GraphData = { nodes: validNodes, edges: validEdges };
      setGraphData(graphData);
      addRecentUpdate({ type: 'graph', data: graphData, timestamp: Date.now(), source: 'api' });
      onDataUpdate?.('graph', graphData);
      setStatus(prev => ({ ...prev, lastUpdate: Date.now(), error: undefined }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown data loading error';
      setError(errorMsg);
      onError?.(errorMsg);
      setStatus(prev => ({ ...prev, error: errorMsg }));
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  }, [setGraphData, setLoading, setError, onDataUpdate, onError, addRecentUpdate]);

  useEffect(() => {
    if (autoStart) {
      fetchGraphData();
      connectWebSocket();
      intervalRef.current = setInterval(fetchGraphData, updateInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      wsRef.current?.close(1000, 'Component unmounting');
    };
  }, [autoStart, fetchGraphData, connectWebSocket, updateInterval]);

  if (!showStatus) return null;

  return (
    <div className="fixed top-5 right-5 z-[1000] bg-gray-900/90 border border-white/10 rounded-xl p-4 w-72 backdrop-blur-xl text-white text-sm">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-semibold"><Database size={16} /> Live Data</div>
        <button onClick={fetchGraphData} disabled={isLoading} className="p-1.5 bg-white/10 rounded-md hover:bg-white/20 disabled:opacity-50"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /></button>
      </header>

      <div className={`flex items-center gap-2 mb-3 p-2 rounded-md ${status.connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
        {status.connected ? <Wifi size={16} /> : <WifiOff size={16} />}
        <span>{status.connected ? 'Connected' : 'Disconnected'}</span>
        {status.connected && status.latency > 0 && <span className="text-gray-400 text-xs">({status.latency}ms)</span>}
      </div>

      {status.error && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
          <AlertTriangle size={14} />
          <span>{status.error}</span>
        </div>
      )}

      {status.lastUpdate > 0 && (
        <div className="flex items-center gap-2 mb-3 text-gray-400"><Clock size={14} /><span>Last update: {new Date(status.lastUpdate).toLocaleTimeString()}</span></div>
      )}

      {recentUpdates.length > 0 && (
        <div className="pt-2 border-t border-white/10">
          <h4 className="text-xs font-semibold text-gray-300 mb-2">Recent Updates</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {recentUpdates.map((update, i) => (
              <div key={i} className="flex justify-between items-center text-xs p-1.5 bg-white/5 rounded">
                <span className={`font-medium ${update.source === 'websocket' ? 'text-blue-400' : 'text-purple-400'}`}>{update.type}</span>
                <span className="text-gray-500">{new Date(update.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveDataLoader;