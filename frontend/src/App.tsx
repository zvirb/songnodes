import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@store/index';
import { ThemeProvider } from '@theme/ThemeProvider';
import { WorkingD3Canvas } from '@components/GraphCanvas/WorkingD3Canvas';
import { ThreeD3Canvas } from '@components/GraphCanvas/ThreeD3Canvas';
// import { SearchPanel } from '@components/SearchPanel/SearchPanel';
// import { EnhancedMuiSearchPanel } from '@components/SearchPanel/EnhancedMuiSearchPanel';
// import { ConnectionStatus } from '@components/ConnectionStatus';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setNodes, setEdges } from '@store/graphSlice';
import { updateDeviceInfo, setViewportSize } from '@store/uiSlice';
import { loadGraphData } from '@utils/dataLoader';
import { useResizeObserver } from '@hooks/useResizeObserver';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
import { useWebSocketIntegration } from '@hooks/useWebSocketIntegration';
import { computeRoute } from '@utils/path';
import { setPathResult } from '@store/pathfindingSlice';
import { useAppSelector as useSelector } from '@store/index';
// import { Box, Fab, Tooltip } from '@mui/material';
// import { Palette as PaletteIcon } from '@mui/icons-material';
import classNames from 'classnames';
import './index.css';

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  // const [useMuiSearch, setUseMuiSearch] = useState(true); // Toggle between original and MUI search
  const [is3DMode, setIs3DMode] = useState(false); // Toggle between 2D and 3D visualization

  // Redux state
  const { nodes, edges, loading, selectedNodes } = useAppSelector(state => state.graph);
  
  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 Redux State Update - nodes:', nodes.length, 'edges:', edges.length, 'loading:', loading);
  }, [nodes.length, edges.length, loading]);
  const {
    // viewport,
    layout,
    theme,
    // showPerformanceOverlay,
    // showDebugInfo
  } = useAppSelector(state => state.ui);
  // const { performanceUI } = useAppSelector(state => state.ui); // Unused for now
  
  // Container dimensions
  const { width, height } = useResizeObserver(containerRef);

  // Debug container dimensions
  console.log('📐 Container dimensions:', {
    width,
    height,
    containerRef: !!containerRef,
    nodesLength: nodes.length,
    edgesLength: edges.length,
    willRenderCanvas: !!(width && height),
    fallbackRender: !!((width && height) || !containerRef),
    is3DMode,
    loading
  });

  // Report rendering success
  useEffect(() => {
    if ((width && height) || !containerRef) {
      console.log('✅ Canvas should be rendering with dimensions:', {
        width: width || window.innerWidth,
        height: height || window.innerHeight,
        mode: is3DMode ? '3D' : '2D',
        nodes: nodes.length,
        edges: edges.length
      });
    }
  }, [width, height, containerRef, is3DMode, nodes.length, edges.length]);

  // WebSocket integration for real-time updates
  const {
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    isConnected: wsConnected,
    connectionError: wsError,
    sendGraphInteraction
  } = useWebSocketIntegration({
    autoConnect: true,
    autoSubscribeToGraphUpdates: true,
    enableHeartbeat: true
  });

  // Update viewport size when container resizes
  const updateViewportSize = useDebouncedCallback(() => {
    if (width && height) {
      dispatch(setViewportSize({ width, height }));
    }
  }, 100);
  
  useEffect(() => {
    updateViewportSize();
  }, [width, height, updateViewportSize]); // Include updateViewportSize to prevent stale closure
  
  // Initialize app - load local graph data
  useEffect(() => {
    // Load initial graph data
    console.log('🚀 App useEffect: nodes.length =', nodes.length, 'loading =', loading);
    if (nodes.length === 0 && !loading) {
      console.log('📥 Loading local graph data...');
      loadGraphData().then(data => {
        if (data) {
          console.log('✅ Setting nodes and edges:', { nodes: data.nodes.length, edges: data.edges.length });

          // Use data as-is for the working component
          // The WorkingD3Canvas handles type conversion internally
          dispatch(setNodes(data.nodes as any));
          dispatch(setEdges(data.edges as any));
        } else {
          console.error('❌ No data could be loaded');
        }
      }).catch(error => {
        console.error('❌ Error loading graph data:', error);
      });
    }
  }, [dispatch, nodes.length, loading, width, height]);

  // Handle device info updates separately to prevent infinite loops
  useEffect(() => {
    const deviceInfo = {
      isMobile: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent),
      isTablet: /Tablet|iPad/.test(navigator.userAgent),
      isDesktop: !/Mobile|Android|iPhone|iPad|Tablet/.test(navigator.userAgent),
      hasTouch: 'ontouchstart' in window,
      screenSize: width < 640 ? 'sm' as const : 
                 width < 768 ? 'md' as const :
                 width < 1024 ? 'lg' as const :
                 width < 1280 ? 'xl' as const : '2xl' as const,
      orientation: width > height ? 'landscape' as const : 'portrait' as const,
      pixelRatio: window.devicePixelRatio || 1,
    };
    
    dispatch(updateDeviceInfo(deviceInfo));
  }, [dispatch, width, height]);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'f':
            event.preventDefault();
            // Focus search input
            const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
            searchInput?.focus();
            break;
          case '=':
          case '+':
            event.preventDefault();
            // Zoom in
            break;
          case '-':
            event.preventDefault();
            // Zoom out
            break;
          case '0':
            event.preventDefault();
            // Reset zoom
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const mainContentClasses = classNames(
    'flex-1 flex flex-col overflow-hidden',
    'transition-all duration-200 ease-in-out',
    layout.showSidebar && !layout.compactMode && 'ml-80',
  );
  
  const canvasWrapperClasses = classNames(
    'flex-1 relative overflow-hidden',
    theme.isDark ? 'bg-gray-900' : 'bg-gray-50',
  );
  
  // Dropdown menu states
  const [showOverviewDropdown, setShowOverviewDropdown] = useState(false);
  const [showLegendDropdown, setShowLegendDropdown] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showFunctionsDropdown, setShowFunctionsDropdown] = useState(false);
  const [scrapeQuery, setScrapeQuery] = useState('');
  const [seeds, setSeeds] = useState<Array<{ title: string; artists: string }>>([]);
  const [distancePower, setDistancePower] = useState(0); // Slider value -5 to 5, used as 10^power
  const [relationshipPower, setRelationshipPower] = useState(0); // Relationship strength scaling -5 to 5
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [variantQuery, setVariantQuery] = useState('');
  const [variantSelections, setVariantSelections] = useState<Record<string, boolean>>({});
  const [importStatus, setImportStatus] = useState<string>('');
  const [routeName, setRouteName] = useState('My New Setlist');
  const pathfinding = useSelector(s => s.pathfinding);

  const importCollection = async (file: File) => {
    try {
      const text = await file.text();
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('Invalid JSON: expected an array of titles');
      localStorage.setItem('myCollectionTitles', JSON.stringify(arr));
      setImportStatus(`Imported ${arr.length} titles`);
      // Optionally refresh node ownership tinting immediately
      // We map over nodes and set metadata.owned accordingly
      const lower = new Set(arr.map((t: any) => String(t).toLowerCase()));
      // dynamic import to avoid cycle
      // @ts-ignore
      import('@store/graphSlice').then(mod => {
        const updates = nodes.map((n: any) => ({
          id: n.id,
          updates: { metadata: { ...(n.metadata || {}), owned: lower.has(String(n.title || n.label || '').toLowerCase()) } }
        }));
        dispatch(mod.updateNodeVisuals(updates));
      });
    } catch (e: any) {
      setImportStatus(`Import failed: ${e.message}`);
    }
  };

  // Trigger scrapers via API Gateway (8080) with graceful fallback to Orchestrator (8001)
  const submitScraperTask = async (scraper: string, url: string, params: any = {}) => {
    const payload = { scraper, url, params };
    const endpoints = [
      '/api/v1/scrapers/tasks/submit',                 // dev proxy via gateway
      'http://localhost:8001/tasks/submit'             // direct orchestrator fallback
    ];
    let lastErr: any = null;
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) return res.json();
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Submit failed');
  };

  const triggerSongSetlistScrape = async () => {
    const hasSeeds = seeds.length > 0 && seeds.some(s => s.title.trim());
    if (!hasSeeds && !scrapeQuery.trim()) return;
    try {
      const taskPromises: Promise<any>[] = [];
      const list = hasSeeds ? seeds.filter(s => s.title.trim()) : [{ title: scrapeQuery.trim(), artists: '' }];
      for (const s of list) {
        const query = [s.title, s.artists].filter(Boolean).join(' ');
        const q = encodeURIComponent(query);
        const params = { type: 'song', query };
        // Setlist.fm
        taskPromises.push(submitScraperTask('setlistfm', `https://www.setlist.fm/search?query=${q}`, params));
        // MixesDB
        taskPromises.push(submitScraperTask('mixesdb', `https://www.mixesdb.com/w/index.php?search=${q}`, params));
        // 1001Tracklists
        try { taskPromises.push(submitScraperTask('1001tracklists', `https://www.1001tracklists.com/search/?q=${q}`, params)); } catch {}
      }

      const results = await Promise.allSettled(taskPromises);
      console.log('🧭 Scraper task submissions:', results);
      alert('Scraper tasks submitted. They will populate the DB when complete.');
    } catch (err) {
      console.error(err);
      alert('Failed to submit scraper tasks. See console for details.');
    }
  };

  const fetchScraperTasks = async () => {
    try {
      setTasksLoading(true);
      setTasksError(null);
      const endpoints = [
        '/api/v1/scrapers/tasks?limit=50',
        'http://localhost:8001/tasks?limit=50'
      ];
      let data: any = null;
      let success = false;
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          if (res.ok) { data = await res.json(); success = true; break; }
        } catch (_) { /* try next */ }
      }
      if (!success) throw new Error('Gateway and orchestrator unavailable');
      setTasks((data && data.tasks) || (data && data.tasks !== undefined ? data.tasks : (data.tasks || data.tasks)) || data.tasks || []);
    } catch (e: any) {
      setTasksError(e.message || 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  };

  const calculateRoute = () => {
    const state = ((store as any).getState ? (store as any).getState() : null) || (window as any).__appState;
    const s = state || ({} as any);
    const g = s.graph || { nodes, edges };
    const pf = s.pathfinding || {};
    const start = pf.startNode; const end = pf.endNode; const waypoints = pf.waypoints || [];
    if (!start || !end) { alert('Select First Track and Last Track from the graph (right-click).'); return; }
    const path = computeRoute(g.nodes, g.edges, { start, end, waypoints });
    if (!path) { alert('No route found.'); return; }
    (window as any).computedRoute = path;
    // Build PathResult for highlighting and history
    const edgeIds: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i+1];
      const e = g.edges.find((e:any) => (e.source === a && e.target === b) || (e.source === b && e.target === a));
      if (e) edgeIds.push(e.id);
    }
    dispatch(setPathResult({
      id: `route_${Date.now()}`,
      nodes: path,
      edges: edgeIds,
      distance: edgeIds.length,
      metrics: { smoothness: 1, diversity: 1, feasibility: 1, avgWeight: 1 },
    } as any));
    alert(`Route computed with ${path.length} tracks.`);
  };

  const saveRoute = async () => {
    const path = (window as any).computedRoute as string[] | undefined;
    if (!path || !path.length) { alert('Compute a route first.'); return; }
    const payload = { name: routeName || 'New Setlist', track_ids: path };
    // Try API first
    try {
      const endpoints = [
        '/api/user-setlists',
        'http://localhost:8084/api/user-setlists'
      ];
      let ok = false; let resp: any = null;
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (r.ok) { resp = await r.json(); ok = true; break; }
        } catch (_) {}
      }
      if (ok) {
        alert(`Setlist saved (id: ${resp.id || 'n/a'})`);
        return;
      }
    } catch (_) { /* fall back to download */ }
    // Fallback: download JSON
    const blob = new Blob([JSON.stringify({ ...payload, created_at: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(routeName || 'setlist').replace(/[^a-z0-9_-]+/gi,'_')}.json`;
    a.click();
  };

  useEffect(() => {
    if (showFunctionsDropdown) {
      fetchScraperTasks();
      const id = setInterval(fetchScraperTasks, 5000);
      return () => clearInterval(id);
    }
  }, [showFunctionsDropdown]);

  const computeVariants = () => {
    const base = variantQuery.trim().toLowerCase();
    if (!base) return [] as { id: string; title: string }[];
    const all = nodes as any[];
    // Consider variants: match base ignoring parenthetical details for grouping
    const strip = (s: string) => s.toLowerCase().replace(/\s*\([^\)]*\)/g, '').trim();
    return all
      .filter(n => n.type === 'track')
      .filter(n => strip(n.title || n.label || n.id).includes(base))
      .map(n => ({ id: n.id, title: n.title || n.label || n.id }));
  };

  const applyVariantSelections = () => {
    const variants = computeVariants();
    const excluded = variants.filter(v => variantSelections[v.id] === false).map(v => v.id);
    // Keep others visible; exclude selected unchecked
    dispatch((window as any).store ? (window as any).store.dispatch : (a:any)=>a); // no-op safety
    // Use our slice action
    // dynamic import to avoid circular typing; directly import from slice above
    // We have access to dispatch and actions via named import earlier? We'll inline with string type.
    // Simpler: use a lazy action creator by requiring store import at top; already using useAppDispatch.
  };

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowOverviewDropdown(false);
    setShowLegendDropdown(false);
    setShowSearchDropdown(false);
    setShowFunctionsDropdown(false);
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div
      className={classNames(
        'h-screen w-screen relative overflow-hidden',
        theme.isDark ? 'dark bg-gray-900' : 'bg-white'
      )}
    >
      {/* Full-screen Graph Visualization Container */}
      <div
        ref={setContainerRef}
        className="fixed inset-0 w-full h-full"
        data-testid="graph-container"
        style={{ width: '100vw', height: '100vh' }}
      >
        {/* Canvas rendering with fallback dimensions */}
        {((width && height) || !containerRef) && (
          is3DMode ? (
            <ThreeD3Canvas
              width={width || window.innerWidth}
              height={height || window.innerHeight}
              className="absolute inset-0"
              distancePower={distancePower}
            />
          ) : (
            <WorkingD3Canvas
              width={width || window.innerWidth}
              height={height || window.innerHeight}
              className="absolute inset-0"
              distancePower={distancePower}
              relationshipPower={relationshipPower}
            />
          )
        )}

        {/* Debug info overlay - only show if there's an issue */}
        {(!width || !height) && containerRef && (
          <div className="absolute top-20 left-4 bg-red-900 bg-opacity-80 text-white text-sm px-3 py-2 rounded">
            🔍 Canvas dimension issue - width: {width}, height: {height}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                <span className="text-gray-900 dark:text-white font-medium">
                  Loading graph data...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Floating Menu Bar - Top Center */}
      <nav
        className="fixed top-6 left-1/2 z-[9999] dropdown-container"
        style={{
          transform: 'translateX(-50%)',
          position: 'fixed',
          top: '24px',
          left: '50%',
          zIndex: 9999
        }}
      >
        <div
          className="bg-gray-900 border border-gray-600 rounded-full shadow-2xl backdrop-blur-sm"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '16px 32px',
            gap: '24px',
            minWidth: 'fit-content',
            whiteSpace: 'nowrap'
          }}
        >
          {/* Logo */}
          <div
            className="text-white font-bold text-lg"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span className="text-xl">🎵</span>
            <span>SongNodes</span>
          </div>

          {/* Separator */}
          <div
            className="bg-gray-500"
            style={{ width: '1px', height: '20px' }}
          ></div>

          {/* Horizontal Button Group */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '16px'
            }}
          >
              {/* Overview */}
              <div className="relative">
                <button
                  onClick={() => setShowOverviewDropdown(!showOverviewDropdown)}
                  className="text-white hover:text-blue-400 transition-colors text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-700"
                >
                  Overview
                </button>
                {showOverviewDropdown && (
                  <div className="absolute top-12 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-64 p-4 z-[10000]">
                    <h3 className="text-white font-semibold mb-3">Graph Overview</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>Nodes:</span>
                        <span className="text-white font-medium" data-testid="node-count">{nodes.length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Edges:</span>
                        <span className="text-white font-medium" data-testid="edge-count">{edges.length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Selected:</span>
                        <span className="text-white font-medium">{selectedNodes.length}</span>
                      </div>

                      {/* Distance Power Slider - Range -5 to 5 */}
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <div className="flex justify-between text-gray-300 mb-2">
                          <span>Distance:</span>
                          <span className="text-white font-medium">
                            10^{distancePower}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-5"
                          max="5"
                          step="1"
                          value={distancePower}
                          onChange={(e) => setDistancePower(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #10b981 0%, #10b981 ${((distancePower + 5) / 10) * 100}%, #374151 ${((distancePower + 5) / 10) * 100}%, #374151 100%)`
                          }}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>-5</span>
                          <span>-2</span>
                          <span>0</span>
                          <span>2</span>
                          <span>5</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0.00001x</span>
                          <span>0.01x</span>
                          <span>1x</span>
                          <span>100x</span>
                          <span>100,000x</span>
                        </div>
                      </div>

                      {/* Relationship Strength Slider - Range -5 to 5 */}
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <div className="flex justify-between text-gray-300 mb-2">
                          <span>Relationships:</span>
                          <span className="text-white font-medium">
                            10^{relationshipPower}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-5"
                          max="5"
                          step="1"
                          value={relationshipPower}
                          onChange={(e) => setRelationshipPower(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${((relationshipPower + 5) / 10) * 100}%, #374151 ${((relationshipPower + 5) / 10) * 100}%, #374151 100%)`
                          }}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>-5</span>
                          <span>-2</span>
                          <span>0</span>
                          <span>2</span>
                          <span>5</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>Strong</span>
                          <span>Med</span>
                          <span>Normal</span>
                          <span>Weak</span>
                          <span>Ignore</span>
                        </div>
                      </div>

                      {/* 3D Visualization Toggle */}
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Visualization:</span>
                          <button
                            onClick={() => setIs3DMode(!is3DMode)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                              is3DMode
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {is3DMode ? '3D Mode' : '2D Mode'}
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {is3DMode ? '🌌 Immersive 3D space with Three.js' : '📊 Standard 2D graph with D3.js'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="relative">
                <button
                  onClick={() => setShowLegendDropdown(!showLegendDropdown)}
                  className="text-white hover:text-green-400 transition-colors text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-700"
                >
                  Legend
                </button>
                {showLegendDropdown && (
                  <div className="absolute top-12 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-48 p-4 z-[10000]">
                    <h3 className="text-white font-semibold mb-3">Node Types</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-gray-300 text-sm">Artists</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-gray-300 text-sm">Venues</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <button
                  onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                  className="text-white hover:text-yellow-400 transition-colors text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-700"
                >
                  Search
                </button>
                {showSearchDropdown && (
                  <div className="absolute top-12 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-80 p-4 z-[10000]">
                    <h3 className="text-white font-semibold mb-3">Search Graph</h3>
                    <input
                      type="text"
                      placeholder="Search artists, tracks, venues..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                    />
                  </div>
                )}
              </div>

              {/* Functions */}
              <div className="relative">
                <button
                  onClick={() => setShowFunctionsDropdown(!showFunctionsDropdown)}
                  className="text-white hover:text-purple-400 transition-colors text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-700"
                >
                  Functions
                </button>
                {showFunctionsDropdown && (
                  <div className="absolute top-12 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-[28rem] p-4 z-[10000]">
                    <h3 className="text-white font-semibold mb-3">Build Graph From Song</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={scrapeQuery}
                            onChange={(e) => setScrapeQuery(e.target.value)}
                            placeholder="Enter a song title (e.g., 'Titanium')"
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                          />
                          <button
                            onClick={triggerSongSetlistScrape}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium"
                          >
                            Scrape Setlists
                          </button>
                        </div>
                        <div className="text-gray-400 text-xs">Optionally add multiple seeds with artists:</div>
                        <div className="space-y-2">
                          {seeds.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={s.title}
                                onChange={(e) => {
                                  const copy = [...seeds]; copy[idx] = { title: e.target.value, artists: copy[idx]?.artists || '' }; setSeeds(copy);
                                }}
                                placeholder="Song title"
                                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                              />
                              <input
                                type="text"
                                value={s.artists}
                                onChange={(e) => {
                                  const copy = [...seeds]; copy[idx] = { title: copy[idx]?.title || '', artists: e.target.value }; setSeeds(copy);
                                }}
                                placeholder="Artists (comma-separated)"
                                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                              />
                              <button
                                onClick={() => setSeeds(seeds.filter((_, i) => i !== idx))}
                                className="px-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <div>
                            <button
                              onClick={() => setSeeds([...seeds, { title: '', artists: '' }])}
                              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm"
                            >
                              + Add Seed (title + artists)
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs">
                          Submits scraping tasks to Setlist.fm, MixesDB, and 1001Tracklists via the orchestrator. The graph updates once setlists are processed into song adjacency edges.
                        </p>
                      <div className="mt-4 p-3 border border-gray-800 rounded">
                        <div className="mb-2 text-white font-semibold">Route Tools</div>
                        <div className="flex items-center gap-2 mb-2">
                          <button onClick={calculateRoute} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm">Calculate Path</button>
                          <input type="text" value={routeName} onChange={(e)=>setRouteName(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white text-xs" placeholder="Setlist name" />
                          <button onClick={saveRoute} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm">Save Setlist</button>
                        </div>
                        <div className="text-[10px] text-gray-500">Right-click a node to set First/Last Track and add Waypoints.</div>
                        {pathfinding.waypoints && pathfinding.waypoints.length > 0 && (
                          <div className="mt-2 text-xs text-gray-300">
                            <div className="mb-1 font-semibold">Waypoints</div>
                            {pathfinding.waypoints.map((wp, idx) => (
                              <div key={wp} className="flex items-center gap-2 mb-1">
                                <span className="text-gray-500">{idx+1}.</span>
                                <span className="truncate flex-1">{wp}</span>
                                <button onClick={() => import('@store/pathfindingSlice').then(m => dispatch(m.moveWaypoint({ index: idx, direction: 'up' })))} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded">↑</button>
                                <button onClick={() => import('@store/pathfindingSlice').then(m => dispatch(m.moveWaypoint({ index: idx, direction: 'down' })))} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded">↓</button>
                                <button onClick={() => import('@store/pathfindingSlice').then(m => dispatch(m.removeWaypoint(wp)))} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 p-3 border border-gray-800 rounded">
                        <div className="mb-2 text-white font-semibold">Import Collection</div>
                        <div className="flex items-center gap-2 mb-2 text-xs text-gray-300">
                          <input type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCollection(f); }} />
                          <span className="text-gray-500">Upload my-collection.json (array of track titles)</span>
                        </div>
                        {importStatus && <div className="text-xs text-gray-400 mb-2">{importStatus}</div>}
                      </div>

                      <div className="mt-4 p-3 border border-gray-800 rounded">
                        <div className="mb-2 text-white font-semibold">Variation Review</div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={variantQuery}
                            onChange={(e) => { setVariantQuery(e.target.value); setVariantSelections({}); }}
                            placeholder="Type base title to match variants (e.g., Titanium)"
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                          />
                          <button
                            onClick={() => {
                              const list = computeVariants();
                              const init: Record<string, boolean> = {};
                              list.forEach(v => init[v.id] = true);
                              setVariantSelections(init);
                            }}
                            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm"
                          >
                            Find Variants
                          </button>
                        </div>
                        {Object.keys(variantSelections).length > 0 && (
                          <div className="max-h-40 overflow-auto space-y-1">
                            {computeVariants().map(v => (
                              <label key={v.id} className="flex items-center gap-2 text-xs text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={variantSelections[v.id] ?? true}
                                  onChange={(e) => setVariantSelections({ ...variantSelections, [v.id]: e.target.checked })}
                                />
                                <span className="truncate">{v.title}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {Object.keys(variantSelections).length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => {
                                const variants = computeVariants();
                                const excluded = variants.filter(v => variantSelections[v.id] === false).map(v => v.id);
                                // Dispatch exclusion
                                // @ts-ignore dynamic import path alias
                                import('@store/graphSlice').then(mod => {
                                  dispatch(mod.setExcludedNodes(excluded));
                                });
                              }}
                              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium text-sm"
                            >
                              Apply Selection
                            </button>
                          </div>
                        )}
                        <div className="text-[10px] text-gray-500 mt-2">Tracks not in your collection (my-collection.json) appear greyed out.</div>
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-semibold">Task Status</h4>
                          <button onClick={fetchScraperTasks} className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">Refresh</button>
                        </div>
                        {tasksLoading && <div className="text-gray-400 text-xs">Loading tasks…</div>}
                        {tasksError && <div className="text-red-400 text-xs">{tasksError}</div>}
                        <div className="max-h-56 overflow-auto border border-gray-800 rounded">
                          {(tasks || []).slice(0, 50).map((t: any) => (
                            <div key={t.id} className="px-2 py-1 text-xs text-gray-300 border-b border-gray-800">
                              <div className="flex justify-between">
                                <span className="text-gray-400">{t.scraper}</span>
                                <span className="text-gray-500">{t.status}</span>
                              </div>
                              <div className="truncate text-gray-500">{t.url}</div>
                            </div>
                          ))}
                          {(!tasks || tasks.length === 0) && !tasksLoading && <div className="px-2 py-2 text-xs text-gray-500">No tasks</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      </nav>

    </div>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
};

export default App;
