import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@store/index';
import { ThemeProvider } from '@theme/ThemeProvider';
import { WorkingD3Canvas } from '@components/GraphCanvas/WorkingD3Canvas';
import { SearchPanel } from '@components/SearchPanel/SearchPanel';
import { EnhancedMuiSearchPanel } from '@components/SearchPanel/EnhancedMuiSearchPanel';
import { ConnectionStatus } from '@components/ConnectionStatus';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setNodes, setEdges } from '@store/graphSlice';
import { updateDeviceInfo, setViewportSize } from '@store/uiSlice';
import { loadGraphData } from '@utils/dataLoader';
import { useResizeObserver } from '@hooks/useResizeObserver';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
import { useWebSocketIntegration } from '@hooks/useWebSocketIntegration';
import { Box, Fab, Tooltip } from '@mui/material';
import { Palette as PaletteIcon } from '@mui/icons-material';
import classNames from 'classnames';
import './index.css';

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [useMuiSearch, setUseMuiSearch] = useState(true); // Toggle between original and MUI search
  
  // Redux state
  const { nodes, edges, loading, selectedNodes } = useAppSelector(state => state.graph);
  
  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 Redux State Update - nodes:', nodes.length, 'edges:', edges.length, 'loading:', loading);
  }, [nodes.length, edges.length, loading]);
  const { 
    viewport, 
    layout, 
    theme,
    showPerformanceOverlay,
    showDebugInfo 
  } = useAppSelector(state => state.ui);
  // const { performanceUI } = useAppSelector(state => state.ui); // Unused for now
  
  // Container dimensions
  const { width, height } = useResizeObserver(containerRef);

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
        {width && height && (
          <WorkingD3Canvas
            width={width}
            height={height}
            className="absolute inset-0"
          />
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
                  <div className="absolute top-12 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-56 p-4 z-[10000]">
                    <h3 className="text-white font-semibold mb-3">Controls</h3>
                    <div className="space-y-2">
                      <button className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
                        🔄 Reset Layout
                      </button>
                      <button className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
                        🎯 Center View
                      </button>
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