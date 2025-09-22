import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@store/index';
import { ThemeProvider } from '@theme/ThemeProvider';
import { WorkingD3Canvas } from '@components/GraphCanvas/WorkingD3Canvas';
import { ThreeD3Canvas } from '@components/GraphCanvas/ThreeD3CanvasEnhanced'; // NO PLANE VERSION
import { TestThree3D } from '@components/GraphCanvas/TestThree3D';
import { TrackInfoPanel } from '@components/TrackInfoPanel/TrackInfoPanel';
// import { SearchPanel } from '@components/SearchPanel/SearchPanel';
// import { EnhancedMuiSearchPanel } from '@components/SearchPanel/EnhancedMuiSearchPanel';
// import { ConnectionStatus } from '@components/ConnectionStatus';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setNodes, setEdges, setSelectedNodes } from '@store/graphSlice';
import { updateDeviceInfo, setViewportSize } from '@store/uiSlice';
import { loadGraphData } from '@utils/dataLoader';
import { useResizeObserver } from '@hooks/useResizeObserver';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
import { useWebSocketIntegration } from '@hooks/useWebSocketIntegration';
import { computeRoute } from '@utils/path';
import { setPathResult, clearPath, setStartNode, setEndNode, clearWaypoints } from '@store/pathfindingSlice';
import { useAppSelector as useSelector } from '@store/index';
// import { Box, Fab, Tooltip } from '@mui/material';
// import { Palette as PaletteIcon } from '@mui/icons-material';
import classNames from 'classnames';
import './index.css';

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  // const [useMuiSearch, setUseMuiSearch] = useState(true); // Toggle between original and MUI search
  // Initialize mode from URL parameter or default to false
  const [is3DMode, setIs3DMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const is3D = mode === '3d' || mode === '3D';
    console.log('🚀 Initializing 3D mode from URL:', { mode, is3D });
    return is3D;
  });

  // Check for test mode - make it reactive
  const isTestMode = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const testMode = mode === 'test3d';
    console.log('🧪 Test mode detection:', { mode, testMode, url: window.location.search });
    return testMode;
  })();

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

  // Update URL when 3D mode changes (but preserve test mode)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const currentMode = urlParams.get('mode');

    // Don't modify URL if we're in test mode
    if (currentMode === 'test3d') {
      console.log('🔒 Preserving test mode URL parameter');
      return;
    }

    if (is3DMode) {
      urlParams.set('mode', '3d');
    } else {
      urlParams.delete('mode');
    }
    const newUrl = urlParams.toString() ? `${window.location.pathname}?${urlParams.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    console.log('🔗 Updated URL for 3D mode:', { is3DMode, url: newUrl });
  }, [is3DMode]);

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
    console.log('🚀 App useEffect: nodes.length =', nodes.length, 'loading =', loading, '3D mode =', is3DMode);
    if (nodes.length === 0 && !loading) {
      console.log('📥 Loading local graph data...');
      loadGraphData().then(data => {
        if (data) {
          console.log('✅ Setting nodes and edges:', {
            nodes: data.nodes.length,
            edges: data.edges.length,
            sample_node_types: data.nodes.slice(0, 3).map(n => ({ id: n.id, type: n.type })),
            is3DMode: is3DMode
          });

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
  }, [dispatch, nodes.length, loading, width, height, is3DMode]);

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
  const [showScrapingDropdown, setShowScrapingDropdown] = useState(false);
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [scrapeQuery, setScrapeQuery] = useState('');
  const [seeds, setSeeds] = useState<Array<{ title: string; artists: string }>>([]);
  // Separate settings for 2D and 3D modes
  const [settings2D, setSettings2D] = useState({
    distancePower: 0,
    relationshipPower: 0,
    nodeSize: 12,
    edgeLabelSize: 12
  });

  const [settings3D, setSettings3D] = useState({
    distancePower: 0,
    relationshipPower: 0,
    nodeSize: 12,
    edgeLabelSize: 12
  });

  // Current settings based on active mode
  const currentSettings = is3DMode ? settings3D : settings2D;
  const setCurrentSettings = is3DMode ? setSettings3D : setSettings2D;

  // Helper functions to update current mode settings
  const setDistancePower = (value: number) => {
    setCurrentSettings(prev => ({ ...prev, distancePower: value }));
  };
  const setRelationshipPower = (value: number) => {
    setCurrentSettings(prev => ({ ...prev, relationshipPower: value }));
  };
  const setNodeSize = (value: number) => {
    setCurrentSettings(prev => ({ ...prev, nodeSize: value }));
  };
  const setEdgeLabelSize = (value: number) => {
    setCurrentSettings(prev => ({ ...prev, edgeLabelSize: value }));
  };
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [variantQuery, setVariantQuery] = useState('');
  const [variantSelections, setVariantSelections] = useState<Record<string, boolean>>({});
  const [importStatus, setImportStatus] = useState<string>('');
  const [routeName, setRouteName] = useState('My New Setlist');
  const [orchestratorScraping, setOrchestratorScraping] = useState(false);
  const [orchestratorStatus, setOrchestratorStatus] = useState<string>('');
  const [showTrackInfoPanel, setShowTrackInfoPanel] = useState(false);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<any>(null);
  const [selectedEdgeInfo, setSelectedEdgeInfo] = useState<any>(null);
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

  const triggerOrchestratorScraping = async () => {
    try {
      setOrchestratorScraping(true);
      setOrchestratorStatus('Starting orchestrator-led scraping...');

      // Define all available scrapers and their direct URLs for comprehensive scraping
      const scrapingTasks = [
        {
          scraper: '1001tracklists',
          url: 'https://www.1001tracklists.com/tracklist/2dgqc1y1/tale-of-us-afterlife-presents-tale-of-us-iii-live-from-printworks-london-2024-12-28.html',
          priority: 'high',
          max_pages: 5
        },
        {
          scraper: 'mixesdb',
          url: 'https://www.mixesdb.com/db/index.php/Category:Tech_House',
          priority: 'high',
          max_pages: 3
        }
      ];

      setOrchestratorStatus(`Submitting ${scrapingTasks.length} comprehensive scraping tasks...`);

      // Submit all tasks to the orchestrator
      const endpoints = [
        '/api/v1/scrapers/tasks/submit',
        'http://localhost:8001/tasks/submit'
      ];

      const taskPromises = scrapingTasks.map(async (task) => {
        let lastErr: any = null;
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(task)
            });
            if (res.ok) {
              const result = await res.json();
              console.log(`✅ ${task.scraper} task submitted:`, result);
              return { scraper: task.scraper, success: true, result };
            }
          } catch (err) {
            lastErr = err;
          }
        }
        console.error(`❌ ${task.scraper} task failed:`, lastErr);
        return { scraper: task.scraper, success: false, error: lastErr };
      });

      const results = await Promise.allSettled(taskPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      setOrchestratorStatus(`Orchestrator scraping completed: ${successful}/${scrapingTasks.length} tasks started successfully`);

      // Refresh task list to show new tasks
      setTimeout(() => {
        fetchScraperTasks();
      }, 1000);

      console.log('🔄 Orchestrator scraping results:', results);

    } catch (err) {
      console.error('Orchestrator scraping error:', err);
      setOrchestratorStatus('❌ Orchestrator scraping failed. Check console for details.');
    } finally {
      setOrchestratorScraping(false);
      // Clear status after 10 seconds
      setTimeout(() => {
        setOrchestratorStatus('');
      }, 10000);
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

    // Extract comprehensive track information
    const enrichedTracks = path.map((trackId, index) => {
      const node = nodes.find(n => n.id === trackId);
      if (!node) {
        return {
          id: trackId,
          position: index + 1,
          title: 'Unknown Track',
          artist: 'Unknown Artist',
          error: 'Node data not found'
        };
      }

      // Extract all available metadata
      const trackInfo: any = {
        id: trackId,
        position: index + 1,
        title: node.title || node.metadata?.title || 'Unknown Track',
        artist: node.artist || node.metadata?.artist || 'Unknown Artist',
      };

      // Add optional fields if they exist
      if (node.album || node.metadata?.album) trackInfo.album = node.album || node.metadata?.album;
      if (node.bpm) trackInfo.bpm = node.bpm;
      if (node.key) trackInfo.key = node.key;
      if (node.duration) trackInfo.duration_seconds = node.duration;
      if (node.genres || node.metadata?.genres) {
        trackInfo.genres = node.genres || node.metadata?.genres;
      }
      if (node.releaseDate) trackInfo.release_date = node.releaseDate;
      if (node.popularity) trackInfo.popularity = node.popularity;
      if (node.energy) trackInfo.energy = node.energy;
      if (node.valence) trackInfo.valence = node.valence;

      // Add audio features if available
      if (node.audioFeatures) {
        trackInfo.audio_features = {
          danceability: node.audioFeatures.danceability,
          energy: node.audioFeatures.energy,
          acousticness: node.audioFeatures.acousticness,
          instrumentalness: node.audioFeatures.instrumentalness,
          liveness: node.audioFeatures.liveness,
          loudness: node.audioFeatures.loudness,
          speechiness: node.audioFeatures.speechiness,
          tempo: node.audioFeatures.tempo,
          valence: node.audioFeatures.valence,
          time_signature: node.audioFeatures.timeSignature
        };
      }

      // Add metadata status and any additional fields
      if (node.metadata?.status) trackInfo.status = node.metadata.status;
      if (node.metadata) {
        // Include any additional metadata fields
        Object.keys(node.metadata).forEach(key => {
          if (!['title', 'artist', 'album', 'genres', 'status'].includes(key)) {
            trackInfo[`metadata_${key}`] = node.metadata![key];
          }
        });
      }

      return trackInfo;
    });

    // Create comprehensive payload with human-readable information
    const comprehensivePayload = {
      name: routeName || 'New Setlist',
      track_ids: path, // Keep original format for API compatibility
      tracks: enrichedTracks,
      setlist_info: {
        total_tracks: path.length,
        created_at: new Date().toISOString(),
        total_duration_seconds: enrichedTracks.reduce((sum, track) => sum + (track.duration_seconds || 0), 0),
        average_bpm: enrichedTracks.filter(t => t.bpm).length > 0
          ? Math.round(enrichedTracks.filter(t => t.bpm).reduce((sum, t) => sum + (t.bpm || 0), 0) / enrichedTracks.filter(t => t.bpm).length)
          : null,
        genres_summary: [...new Set(enrichedTracks.flatMap(t => t.genres || []))].slice(0, 10)
      },
      human_readable_tracklist: enrichedTracks.map(track => {
        let displayText = `${track.position}. ${track.artist} - ${track.title}`;
        if (track.album) displayText += ` (${track.album})`;
        if (track.bpm) displayText += ` [${track.bpm} BPM]`;
        if (track.key) displayText += ` [${track.key}]`;
        return displayText;
      })
    };

    // Try API first with comprehensive data
    try {
      const endpoints = [
        '/api/user-setlists',
        'http://localhost:8084/api/user-setlists'
      ];
      let ok = false; let resp: any = null;
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comprehensivePayload)
          });
          if (r.ok) { resp = await r.json(); ok = true; break; }
        } catch (_) {}
      }
      if (ok) {
        alert(`Enhanced setlist saved with full track metadata (id: ${resp.id || 'n/a'})`);
        return;
      }
    } catch (_) { /* fall back to download */ }

    // Fallback: download comprehensive JSON
    const blob = new Blob([JSON.stringify(comprehensivePayload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(routeName || 'setlist').replace(/[^a-z0-9_-]+/gi,'_')}_comprehensive.json`;
    a.click();

    alert(`Comprehensive setlist downloaded with ${enrichedTracks.length} tracks and full metadata`);
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
    setShowScrapingDropdown(false);
    setShowRouteDropdown(false);
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

  // Auto-open track info panel when a track is selected
  useEffect(() => {
    if (selectedNodes.length > 0) {
      setShowTrackInfoPanel(true);
    }
  }, [selectedNodes]);

  return (
    <div
      className={classNames(
        'h-screen w-screen relative overflow-hidden',
        theme.isDark ? 'dark bg-gray-900' : 'bg-white'
      )}
      style={{ paddingTop: '64px' }}
    >
      {/* Full-screen Graph Visualization Container */}
      <div
        ref={setContainerRef}
        className={classNames(
          "fixed inset-0 h-full transition-all duration-300 ease-in-out",
          // Mobile: Full width always (panel covers entire screen)
          "w-full lg:w-auto",
          // Desktop: Adjust for track info panel
          showTrackInfoPanel && "lg:right-[30vw] lg:max-w-[calc(100vw-350px)]"
        )}
        data-testid="graph-container"
        style={{ height: '100vh' }}
      >
        {/* Canvas rendering with fallback dimensions */}
        {((width && height) || !containerRef) && (
          <>
            {/* Debug info overlay */}
            <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded z-50">
              {isTestMode ? '🧪 Test Mode' : (is3DMode ? '🌌 3D Mode' : '📊 2D Mode')} | {width}×{height} | Nodes: {nodes.length}
            </div>

{(() => {
              console.log('🎯 Canvas selection logic:', { isTestMode, is3DMode, nodes: nodes.length });
              if (isTestMode) {
                console.log('✅ Rendering TestThree3D component');
                return (
                  <TestThree3D
                    key="test-3d-canvas"
                    width={width || window.innerWidth}
                    height={height || window.innerHeight}
                    className="absolute inset-0"
                  />
                );
              } else if (is3DMode) {
                console.log('✅ Rendering ThreeD3Canvas component');
                return (
                  <ThreeD3Canvas
                    key="3d-canvas" // Force re-mount when switching modes
                    width={width || window.innerWidth}
                    height={height || window.innerHeight}
                    className="absolute inset-0"
                    distancePower={currentSettings.distancePower}
                    relationshipPower={currentSettings.relationshipPower}
                    nodeSize={currentSettings.nodeSize}
                    edgeLabelSize={currentSettings.edgeLabelSize}
                    onNodeClick={setSelectedNodeInfo}
                    onEdgeClick={setSelectedEdgeInfo}
                  />
                );
              } else {
                console.log('✅ Rendering WorkingD3Canvas component');
                return (
                  <WorkingD3Canvas
                    key="2d-canvas" // Force re-mount when switching modes
                    width={width || window.innerWidth}
                    height={height || window.innerHeight}
                    className="absolute inset-0"
                    distancePower={currentSettings.distancePower}
                    relationshipPower={currentSettings.relationshipPower}
                    nodeSize={currentSettings.nodeSize}
                    edgeLabelSize={currentSettings.edgeLabelSize}
                    onNodeClick={setSelectedNodeInfo}
                    onEdgeClick={setSelectedEdgeInfo}
                  />
                );
              }
            })()}
          </>
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

      {/* Fixed Horizontal Menu Bar - Top Center */}
      <nav
        className="fixed top-0 left-0 right-0 z-[9999] bg-gray-900 border-b border-gray-600 shadow-2xl backdrop-blur-sm dropdown-container"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: '64px',
          overflow: 'visible'
        }}
      >
        <div
          className="flex items-center justify-center h-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 'clamp(8px, 2vw, 24px)',
            minWidth: 'fit-content',
            whiteSpace: 'nowrap',
            overflow: 'visible',
            flexWrap: 'nowrap'
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
              gap: 'clamp(8px, 1.5vw, 16px)',
              overflow: 'visible',
              position: 'relative',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}
          >
              {/* Overview */}
              <div className="relative">
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setShowOverviewDropdown(!showOverviewDropdown);
                  }}
                  className="text-white hover:text-blue-400 transition-colors text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-700 whitespace-nowrap"
                >
                  Overview
                </button>
                {showOverviewDropdown && (
                  <div className="absolute top-16 left-0 bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl p-5 z-[10001] max-h-[85vh] overflow-y-auto dropdown-scrollbar" style={{ maxWidth: '50ch', minWidth: '30ch' }}>
                    <h3 className="text-white font-semibold mb-4">Graph Overview</h3>
                    <div className="space-y-3 text-sm">
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

                      {/* Visualization Mode Selection */}
                      <div className="mt-5 pt-4 border-t border-gray-700">
                        <div className="flex flex-col space-y-2">
                          <span className="text-gray-300 text-sm">View Type:</span>

                          {/* Dual Button Toggle Switch */}
                          <div className="flex bg-gray-800 rounded-lg p-1 relative">
                            {/* 2D Mode Button */}
                            <button
                              onClick={() => {
                                if (is3DMode) {
                                  console.log('🌌 Switching to 2D Mode:', {
                                    from: '3D',
                                    to: '2D',
                                    current_nodes_count: nodes.length,
                                    current_edges_count: edges.length
                                  });
                                  setIs3DMode(false);
                                }
                                closeAllDropdowns();
                              }}
                              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-1 ${
                                !is3DMode
                                  ? 'bg-blue-600 text-white shadow-md transform scale-105'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                              }`}
                            >
                              <span>📊</span>
                              <span>2D Graph</span>
                              {!is3DMode && <span className="text-green-400">●</span>}
                            </button>

                            {/* 3D Mode Button */}
                            <button
                              onClick={() => {
                                if (!is3DMode) {
                                  console.log('🌌 Switching to 3D Mode:', {
                                    from: '2D',
                                    to: '3D',
                                    current_nodes_count: nodes.length,
                                    current_edges_count: edges.length
                                  });
                                  setIs3DMode(true);
                                }
                                closeAllDropdowns();
                              }}
                              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-1 ${
                                is3DMode
                                  ? 'bg-purple-600 text-white shadow-md transform scale-105'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                              }`}
                            >
                              <span>🌌</span>
                              <span>3D Space</span>
                              {is3DMode && <span className="text-green-400">●</span>}
                            </button>
                          </div>

                          {/* Mode Description */}
                          <div className="text-xs text-gray-500 text-center break-words">
                            {is3DMode ? 'Immersive 3D space with Three.js & WebGL' : 'Standard 2D graph with D3.js force'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Relationship View */}
              <div className="relative">
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setShowLegendDropdown(!showLegendDropdown);
                  }}
                  className="text-white hover:text-green-400 transition-colors text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-700 whitespace-nowrap"
                >
                  Relationship View
                </button>
                {showLegendDropdown && (
                  <div className="absolute top-16 left-0 bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl p-5 z-[10001] max-h-[85vh] overflow-y-auto dropdown-scrollbar" style={{ maxWidth: '50ch', minWidth: '30ch' }}>
                    <h3 className="text-white font-semibold mb-4">Relationship View</h3>
                    <div className="space-y-4">

                      {/* Distance Power Slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-gray-300">
                          <span>Distance:</span>
                          <span className="text-white font-medium">10^{currentSettings.distancePower}</span>
                        </div>
                        <input
                          type="range"
                          min="-5"
                          max="5"
                          step="0.1"
                          value={currentSettings.distancePower}
                          onChange={(e) => setDistancePower(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #10b981 0%, #10b981 ${((currentSettings.distancePower + 5) / 10) * 100}%, #374151 ${((currentSettings.distancePower + 5) / 10) * 100}%, #374151 100%)`
                          }}
                        />
                      </div>

                      {/* Relationship Strength Slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-gray-300">
                          <span>Relationships:</span>
                          <span className="text-white font-medium">10^{currentSettings.relationshipPower}</span>
                        </div>
                        <input
                          type="range"
                          min="-5"
                          max="5"
                          step="0.1"
                          value={currentSettings.relationshipPower}
                          onChange={(e) => setRelationshipPower(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${((currentSettings.relationshipPower + 5) / 10) * 100}%, #374151 ${((currentSettings.relationshipPower + 5) / 10) * 100}%, #374151 100%)`
                          }}
                        />
                      </div>

                      {/* Node Size Slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-gray-300">
                          <span>Node Size:</span>
                          <span className="text-white font-medium">{currentSettings.nodeSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="24"
                          step="0.5"
                          value={currentSettings.nodeSize}
                          onChange={(e) => setNodeSize(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #F59E0B 0%, #F59E0B ${((currentSettings.nodeSize - 2) / 22) * 100}%, #374151 ${((currentSettings.nodeSize - 2) / 22) * 100}%, #374151 100%)`
                          }}
                        />
                      </div>

                      {/* Edge Label Size Slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-gray-300">
                          <span>Edge Labels:</span>
                          <span className="text-white font-medium">{currentSettings.edgeLabelSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="20"
                          step="0.5"
                          value={currentSettings.edgeLabelSize}
                          onChange={(e) => setEdgeLabelSize(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #EC4899 0%, #EC4899 ${((currentSettings.edgeLabelSize - 8) / 12) * 100}%, #374151 ${((currentSettings.edgeLabelSize - 8) / 12) * 100}%, #374151 100%)`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setShowSearchDropdown(!showSearchDropdown);
                  }}
                  className="text-white hover:text-yellow-400 transition-colors text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-700 whitespace-nowrap"
                >
                  Search
                </button>
                {showSearchDropdown && (
                  <div className="absolute top-16 left-0 bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl p-5 z-[10001] max-h-[85vh] overflow-y-auto dropdown-scrollbar" style={{ maxWidth: '50ch', minWidth: '30ch' }}>
                    <h3 className="text-white font-semibold mb-4">Search Graph</h3>
                    <input
                      type="text"
                      placeholder="Search artists, tracks, venues..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 break-words"
                    />
                  </div>
                )}
              </div>

              {/* Functions */}
              <div className="relative">
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setShowFunctionsDropdown(!showFunctionsDropdown);
                  }}
                  className="text-white hover:text-purple-400 transition-colors text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-700 whitespace-nowrap"
                >
                  Functions
                </button>
                {showFunctionsDropdown && (
                  <div className="absolute top-16 right-0 bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl p-5 z-[10001] max-h-[85vh] overflow-y-auto dropdown-scrollbar" style={{ maxWidth: '50ch', minWidth: '30ch' }}>
                    <h3 className="text-white font-semibold mb-4">Build Graph From Song</h3>
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
                      <div className="mt-5 p-4 border border-gray-800 rounded">
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
                              <div key={wp} className="flex items-start gap-2 mb-2">
                                <span className="text-gray-500 flex-shrink-0 mt-0.5">{idx+1}.</span>
                                <span className="break-words flex-1 leading-relaxed">{wp}</span>
                                <button onClick={() => import('@store/pathfindingSlice').then(m => dispatch(m.moveWaypoint({ index: idx, direction: 'up' })))} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded">↑</button>
                                <button onClick={() => import('@store/pathfindingSlice').then(m => dispatch(m.moveWaypoint({ index: idx, direction: 'down' })))} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded">↓</button>
                                <button onClick={() => import('@store/pathfindingSlice').then(m => dispatch(m.removeWaypoint(wp)))} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 p-5 border border-gray-700/60 rounded-lg bg-gray-800/30">
                        <div className="mb-3 text-white font-semibold text-sm">Import Collection</div>
                        <div className="space-y-3">
                          <input
                            type="file"
                            accept="application/json"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCollection(f); }}
                            className="text-xs text-gray-300 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-gray-300 file:text-xs"
                          />
                          <div className="text-gray-500 text-xs leading-relaxed break-words">
                            Upload my-collection.json (array of track titles)
                          </div>
                        </div>
                        {importStatus && <div className="text-xs text-gray-400 mb-2">{importStatus}</div>}
                      </div>

                      <div className="mt-5 p-5 border border-gray-700/60 rounded-lg bg-gray-800/30">
                        <div className="mb-3 text-white font-semibold text-sm">Variation Review</div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={variantQuery}
                            onChange={(e) => { setVariantQuery(e.target.value); setVariantSelections({}); }}
                            placeholder="Type base title (e.g., Titanium)"
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-xs"
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
                              <label key={v.id} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed py-1">
                                <input
                                  type="checkbox"
                                  checked={variantSelections[v.id] ?? true}
                                  onChange={(e) => setVariantSelections({ ...variantSelections, [v.id]: e.target.checked })}
                                  className="mt-0.5 flex-shrink-0"
                                />
                                <span className="break-words">{v.title}</span>
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
                        <div className="text-[10px] text-gray-500 mt-2 leading-relaxed break-words">Tracks not in your collection (my-collection.json) appear greyed out.</div>
                      </div>
                      <div className="mt-5 p-5 border border-gray-700/60 rounded-lg bg-gray-800/30">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-white font-semibold text-sm">Task Status</h4>
                          <button onClick={fetchScraperTasks} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300">Refresh</button>
                        </div>
                        {tasksLoading && <div className="text-gray-400 text-xs">Loading tasks…</div>}
                        {tasksError && <div className="text-red-400 text-xs">{tasksError}</div>}
                        <div className="max-h-56 overflow-auto border border-gray-800 rounded">
                          {(tasks || []).slice(0, 50).map((t: any) => (
                            <div key={t.id} className="px-3 py-3 text-xs text-gray-300 border-b border-gray-800 last:border-b-0">
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <span className="text-gray-400 font-medium break-words">{t.scraper}</span>
                                <span className="text-gray-500 flex-shrink-0 text-[10px]">{t.status}</span>
                              </div>
                              <div className="controlled-text-url text-gray-500 text-[10px] break-all leading-relaxed">{t.url}</div>
                            </div>
                          ))}
                          {(!tasks || tasks.length === 0) && !tasksLoading && <div className="px-3 py-3 text-xs text-gray-500">No tasks</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Route Selector */}
              <div className="relative">
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setShowRouteDropdown(!showRouteDropdown);
                  }}
                  className="text-white hover:text-purple-400 transition-colors text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-700 whitespace-nowrap"
                >
                  Current Route
                </button>
                {showRouteDropdown && (
                  <div className="absolute top-16 left-0 bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl p-5 z-[10001] max-h-[85vh] overflow-y-auto dropdown-scrollbar" style={{ maxWidth: '50ch', minWidth: '30ch' }}>
                    <h3 className="text-white font-semibold mb-4">Route Navigation</h3>

                    {/* Action buttons at the top */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => {
                          dispatch(clearPath());
                          dispatch(setStartNode(null));
                          dispatch(setEndNode(null));
                          dispatch(clearWaypoints());
                        }}
                        className="flex-1 px-3 py-2 bg-red-800 hover:bg-red-700 text-red-200 text-sm rounded transition-colors"
                      >
                        Clear Route
                      </button>
                      <button
                        onClick={() => {
                          calculateRoute();
                        }}
                        className="flex-1 px-3 py-2 bg-green-800 hover:bg-green-700 text-green-200 text-sm rounded transition-colors"
                        disabled={!pathfinding.startNode || !pathfinding.endNode}
                      >
                        Calculate Route
                      </button>
                    </div>

                    {pathfinding.currentPath?.nodes?.length ? (
                      <>
                        <div className="text-gray-400 text-xs mb-3">
                          {pathfinding.currentPath.nodes.length} tracks in current route
                        </div>
                        <div className="space-y-1 max-h-96 overflow-y-auto dropdown-scrollbar">
                          {pathfinding.currentPath.nodes.map((nodeId, index) => {
                            const node = nodes.find(n => n.id === nodeId);
                            const isFirst = pathfinding.startNode === nodeId;
                            const isLast = pathfinding.endNode === nodeId;
                            const isWaypoint = pathfinding.waypoints?.includes(nodeId);
                            const isPlayed = pathfinding.playedTracks?.includes(nodeId);

                            let bgColor = 'bg-gray-800 hover:bg-gray-700';
                            let textColor = 'text-gray-300';
                            let indicator = '';

                            if (isFirst) {
                              bgColor = 'bg-green-900/30 hover:bg-green-800/30 border border-green-700';
                              textColor = 'text-green-300';
                              indicator = '🟢 ';
                            } else if (isLast) {
                              bgColor = 'bg-red-900/30 hover:bg-red-800/30 border border-red-700';
                              textColor = 'text-red-300';
                              indicator = '🔴 ';
                            } else if (isPlayed) {
                              bgColor = 'bg-purple-900/30 hover:bg-purple-800/30 border border-purple-700';
                              textColor = 'text-purple-300';
                              indicator = '🟣 ';
                            } else if (isWaypoint) {
                              bgColor = 'bg-orange-900/30 hover:bg-orange-800/30 border border-orange-700';
                              textColor = 'text-orange-300';
                              indicator = '🟠 ';
                            } else {
                              bgColor = 'bg-orange-900/20 hover:bg-orange-800/20 border border-orange-800';
                              textColor = 'text-orange-300';
                              indicator = '🟡 ';
                            }

                            return (
                              <button
                                key={nodeId}
                                onClick={() => {
                                  // Select the node
                                  import('@store/graphSlice').then(m => {
                                    dispatch(m.setSelectedNodes([nodeId]));
                                  });
                                  // Keep dropdown open for further interaction
                                  // setShowRouteDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${bgColor} ${textColor}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-xs font-medium flex-shrink-0">
                                      {indicator}{index + 1}.
                                    </span>
                                    <span className="text-xs truncate">
                                      {node?.metadata?.artist || node?.artist || 'Unknown Artist'} - {node?.metadata?.title || node?.title || nodeId}
                                    </span>
                                  </div>
                                  <div className="text-xs opacity-60 flex-shrink-0">
                                    {isFirst && 'START'}
                                    {isLast && 'END'}
                                    {isWaypoint && !isFirst && !isLast && 'WP'}
                                    {isPlayed && 'PLAYED'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-700">
                          <div className="text-xs text-gray-400">
                            🟢 Start Track | 🔴 End Track | 🟠 Waypoint | 🟣 Played | 🟡 Route Track
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 text-sm text-center py-4">
                        No route calculated yet. Select start and end tracks to create a route.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Data Scraping */}
              <div className="relative">
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setShowScrapingDropdown(!showScrapingDropdown);
                  }}
                  className="text-white hover:text-orange-400 transition-colors text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-700 whitespace-nowrap"
                >
                  Data Scraping
                </button>
                {showScrapingDropdown && (
                  <div className="absolute top-16 left-0 bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl p-6 z-[10001] max-h-[85vh] overflow-y-auto dropdown-scrollbar" style={{ maxWidth: '50ch', minWidth: '30ch' }}>
                    <h3 className="text-white font-semibold mb-4 text-sm">Orchestrator-Led Scraping</h3>
                    <p className="text-gray-400 text-xs mb-4 leading-relaxed break-words">
                      Triggers comprehensive data collection from all configured scrapers (1001tracklists, MixesDB).
                      This runs automatically but can be paused to avoid robots.txt restrictions.
                    </p>

                    <div className="space-y-3">
                      <button
                        onClick={triggerOrchestratorScraping}
                        disabled={orchestratorScraping}
                        className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                          orchestratorScraping
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }`}
                      >
                        {orchestratorScraping ? '🔄 Scraping in Progress...' : '🚀 Start Comprehensive Scraping'}
                      </button>

                      {orchestratorStatus && (
                        <div className={`text-xs p-2 rounded ${
                          orchestratorStatus.includes('❌')
                            ? 'bg-red-900/30 text-red-300 border border-red-800'
                            : 'bg-blue-900/30 text-blue-300 border border-blue-800'
                        }`}>
                          {orchestratorStatus}
                        </div>
                      )}

                      <div className="mt-5 p-5 border border-gray-700/60 rounded-lg bg-gray-800/30">
                        <div className="mb-3 text-white font-semibold text-sm">Live Task Monitor</div>
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            onClick={fetchScraperTasks}
                            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
                          >
                            Refresh Tasks
                          </button>
                          <span className="text-xs text-gray-500">
                            ({tasks?.length || 0} tasks tracked)
                          </span>
                        </div>

                        {tasksLoading && <div className="text-gray-400 text-xs">Loading tasks...</div>}
                        {tasksError && <div className="text-red-400 text-xs">{tasksError}</div>}

                        <div className="max-h-32 overflow-auto border border-gray-800 rounded text-xs">
                          {(tasks || []).slice(0, 10).map((t: any) => (
                            <div key={t.id} className="px-2 py-1 text-gray-300 border-b border-gray-800 last:border-b-0">
                              <div className="flex justify-between items-center">
                                <span className="text-orange-400 font-medium">{t.scraper}</span>
                                <span className={`px-1 rounded text-[10px] ${
                                  t.status === 'completed' ? 'bg-green-800 text-green-200' :
                                  t.status === 'running' ? 'bg-blue-800 text-blue-200' :
                                  t.status === 'failed' ? 'bg-red-800 text-red-200' :
                                  'bg-gray-700 text-gray-300'
                                }`}>
                                  {t.status}
                                </span>
                              </div>
                              <div className="controlled-text-url text-gray-500 text-[10px]">{t.url}</div>
                            </div>
                          ))}
                          {(!tasks || tasks.length === 0) && !tasksLoading && (
                            <div className="px-2 py-2 text-gray-500 text-center">No tasks yet</div>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-500 leading-relaxed">
                        <strong>Note:</strong> Orchestrator-led scraping intelligently coordinates all scrapers,
                        respects rate limits, and automatically handles retries. Tasks are queued and processed
                        systematically to minimize detection risk.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      </nav>

      {/* Track Information Panel */}
      <TrackInfoPanel
        isOpen={showTrackInfoPanel}
        onClose={() => {
          setShowTrackInfoPanel(false);
          // Clear selection when closing panel
          dispatch(setSelectedNodes([]));
        }}
      />

      {/* Right-side Info Panel for Node/Edge Details */}
      {(selectedNodeInfo || selectedEdgeInfo) && (
        <div
          className="fixed top-24 right-4 bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl p-5 z-[10000] max-h-[70vh] overflow-y-auto dropdown-scrollbar"
          style={{ maxWidth: '50ch', minWidth: '30ch' }}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-white">
              {selectedNodeInfo ? '🎵 Node Details' : '🔗 Edge Details'}
            </h3>
            <button
              onClick={() => {
                setSelectedNodeInfo(null);
                setSelectedEdgeInfo(null);
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ×
            </button>
          </div>

          {selectedNodeInfo && (
            <div className="space-y-3">
              <div>
                <span className="text-gray-400 text-sm">ID:</span>
                <p className="text-white break-all">{selectedNodeInfo.id}</p>
              </div>
              {selectedNodeInfo.label && (
                <div>
                  <span className="text-gray-400 text-sm">Label:</span>
                  <p className="text-white break-words">{selectedNodeInfo.label}</p>
                </div>
              )}
              {selectedNodeInfo.artist && (
                <div>
                  <span className="text-gray-400 text-sm">Artist:</span>
                  <p className="text-white break-words">{selectedNodeInfo.artist}</p>
                </div>
              )}
              {selectedNodeInfo.title && (
                <div>
                  <span className="text-gray-400 text-sm">Title:</span>
                  <p className="text-white break-words">{selectedNodeInfo.title}</p>
                </div>
              )}
              {selectedNodeInfo.type && (
                <div>
                  <span className="text-gray-400 text-sm">Type:</span>
                  <p className="text-white capitalize">{selectedNodeInfo.type}</p>
                </div>
              )}
              {selectedNodeInfo.metrics && (
                <div>
                  <span className="text-gray-400 text-sm">Metrics:</span>
                  <div className="mt-1 space-y-1">
                    {selectedNodeInfo.metrics.degree && (
                      <p className="text-white text-sm">Degree: {selectedNodeInfo.metrics.degree}</p>
                    )}
                    {selectedNodeInfo.metrics.centrality && (
                      <p className="text-white text-sm">Centrality: {selectedNodeInfo.metrics.centrality.toFixed(3)}</p>
                    )}
                    {selectedNodeInfo.metrics.clustering && (
                      <p className="text-white text-sm">Clustering: {selectedNodeInfo.metrics.clustering.toFixed(3)}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedEdgeInfo && (
            <div className="space-y-3">
              <div>
                <span className="text-gray-400 text-sm">Source:</span>
                <p className="text-white break-words">{selectedEdgeInfo.source}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Target:</span>
                <p className="text-white break-words">{selectedEdgeInfo.target}</p>
              </div>
              {selectedEdgeInfo.weight && (
                <div>
                  <span className="text-gray-400 text-sm">Weight:</span>
                  <p className="text-white">{selectedEdgeInfo.weight}</p>
                </div>
              )}
              {selectedEdgeInfo.label && (
                <div>
                  <span className="text-gray-400 text-sm">Label:</span>
                  <p className="text-white break-words">{selectedEdgeInfo.label}</p>
                </div>
              )}
              {selectedEdgeInfo.type && (
                <div>
                  <span className="text-gray-400 text-sm">Type:</span>
                  <p className="text-white capitalize">{selectedEdgeInfo.type}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
