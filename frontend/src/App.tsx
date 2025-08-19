import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@store/index';
import { GraphCanvas } from '@components/GraphCanvas/GraphCanvas';
import { SearchPanel } from '@components/SearchPanel/SearchPanel';
import { useAppSelector, useAppDispatch } from '@store/index';
import { fetchGraph } from '@store/graphSlice';
import { updateDeviceInfo, setViewportSize } from '@store/uiSlice';
import { useResizeObserver } from '@hooks/useResizeObserver';
import { useDebouncedCallback } from '@hooks/useDebouncedCallback';
import classNames from 'classnames';
import './index.css';

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  
  // Redux state
  const { nodes, edges, loading } = useAppSelector(state => state.graph);
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
  
  // Update viewport size when container resizes
  const updateViewportSize = useDebouncedCallback(() => {
    if (width && height) {
      dispatch(setViewportSize({ width, height }));
    }
  }, 100);
  
  useEffect(() => {
    updateViewportSize();
  }, [width, height, updateViewportSize]); // Include updateViewportSize to prevent stale closure
  
  // Initialize app - separate device info from graph loading to prevent loops
  useEffect(() => {
    // Load initial graph data
    if (nodes.length === 0) {
      dispatch(fetchGraph({
        limit: 1000,
        include: {
          relationships: true,
          audioFeatures: false,
          metadata: false,
        },
      }));
    }
  }, [dispatch, nodes.length]);

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
  
  return (
    <div 
      className={classNames(
        'h-screen w-screen flex overflow-hidden',
        theme.isDark ? 'dark bg-gray-900' : 'bg-white'
      )}
    >
      {/* Sidebar - Search and Filters */}
      {layout.showSidebar && (
        <div 
          className={classNames(
            'fixed left-0 top-0 h-full z-30 border-r',
            'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
            'transition-all duration-200 ease-in-out',
            layout.compactMode ? 'w-12' : 'w-80',
            'shadow-lg'
          )}
        >
          {!layout.compactMode && (
            <div className="h-full flex flex-col">
              {/* Search Panel */}
              {layout.showSearchPanel && (
                <SearchPanel 
                  className="flex-shrink-0"
                  isCompact={layout.compactMode}
                />
              )}
              
              {/* Additional sidebar content would go here */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* Quick stats */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Graph Overview
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Nodes:</span>
                        <span className="font-medium">{nodes.length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Edges:</span>
                        <span className="font-medium">{edges.length.toLocaleString()}</span>
                      </div>
                      {showPerformanceOverlay && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">FPS:</span>
                          <span className="font-medium">60</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Legend
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">Songs</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-1 bg-gray-400"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">Relationships</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-pink-500 ring-2 ring-pink-300"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">Selected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Main Content Area */}
      <div className={mainContentClasses}>
        {/* Top Control Panel */}
        {layout.showControlPanel && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  SongNodes
                </h1>
                {loading && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                    <span>Loading graph...</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Layout controls */}
                <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button className="px-3 py-1 text-xs font-medium bg-primary-500 text-white rounded">
                    Force
                  </button>
                  <button className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    Hierarchical
                  </button>
                  <button className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    Circular
                  </button>
                </div>
                
                {/* View controls */}
                <div className="flex items-center space-x-1">
                  <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Graph Visualization */}
        <div 
          ref={setContainerRef}
          className={canvasWrapperClasses}
        >
          {width && height && (
            <GraphCanvas
              width={width}
              height={height}
              className="absolute inset-0"
              onNodeClick={(node, event) => {
                console.log('Node clicked:', node.title, event);
              }}
              onNodeDoubleClick={(node) => {
                console.log('Node double-clicked:', node.title);
              }}
              onNodeHover={(_node) => {
                // Handle node hover - node parameter prefixed with _ to indicate intentionally unused
              }}
              onBackgroundClick={() => {
                // Clear selection
              }}
              onViewportChange={(_viewport) => {
                // Handle viewport changes - viewport parameter prefixed with _ to indicate intentionally unused
              }}
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
      </div>
      
      {/* Node Details Panel */}
      {layout.showNodeDetails && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-30">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Node Details
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select a node to view details
            </p>
          </div>
        </div>
      )}
      
      {/* Debug Info */}
      {showDebugInfo && (
        <div className="fixed bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded font-mono z-50">
          <div>Viewport: {viewport.x.toFixed(0)}, {viewport.y.toFixed(0)} @ {viewport.scale.toFixed(2)}x</div>
          <div>Container: {width} × {height}</div>
          <div>Nodes: {nodes.length} | Edges: {edges.length}</div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;