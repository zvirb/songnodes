import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@store/index';
import { ThemeProvider } from '@theme/ThemeProvider';
import { WorkingD3Canvas } from '@components/GraphCanvas/WorkingD3Canvas';
import { ThreeD3Canvas } from '@components/GraphCanvas/ThreeD3CanvasEnhanced';
import { TestThree3D } from '@components/GraphCanvas/TestThree3D';
import { TrackInfoPanel } from '@components/TrackInfoPanel/TrackInfoPanel';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { useAppSelector, useAppDispatch } from '@store/index';
import { setNodes, setEdges, setSelectedNodes } from '@store/graphSlice';
import { updateDeviceInfo, setViewportSize } from '@store/uiSlice';
import { loadGraphData } from '@utils/dataLoader';
import { useResizeObserver } from '@hooks/useResizeObserver';

import classNames from 'classnames';
import './index.css';
import './styles/mobile-fixes.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// New Imports for Refactored UI
import UnifiedHeader from '@components/UnifiedHeader/UnifiedHeader';
import { ResponsivePanel } from '@components/Panels/ResponsivePanel';

import { MobileSearch } from '@components/Search/MobileSearch';

import { BottomNavigation } from '@components/Navigation/BottomNavigation';

import { SettingsPanel } from '@components/Settings/SettingsPanel';
import HUD from '@components/HUD/HUD';

// Placeholder Components for Routing
const GraphPage: React.FC<{ is3DMode?: boolean; isTestMode?: boolean }> = ({ is3DMode = false, isTestMode = false }) => {
  const { width, height } = useAppSelector(state => state.ui.viewport);

  if (!width || !height) return null;

  if (isTestMode) {
    return <TestThree3D key="test-3d-canvas" width={width} height={height} className="absolute inset-0" />;
  }
  if (is3DMode) {
    return <ThreeD3Canvas key="3d-canvas" width={width} height={height} className="absolute inset-0" />;
  }
  return (
    <ErrorBoundary>
      <WorkingD3Canvas key="2d-canvas" width={width} height={height} className="absolute inset-0" />
    </ErrorBoundary>
  );
};

const SearchPage: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(true);
  return <MobileSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />;
};

const AnalyticsPage: React.FC = () => <div>Analytics Page</div>;
const SettingsPage: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  return <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />;
};
const RouteBuilderPage: React.FC = () => <div>Route Builder Page</div>;

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const { nodes, loading, selectedNodes } = useAppSelector(state => state.graph);
  const { theme, device: deviceInfo } = useAppSelector(state => state.ui);
  const { width, height } = useResizeObserver(containerRef);

  // State for the new responsive panels (only track info remains here as others are routed)
  const [isTrackInfoOpen, setIsTrackInfoOpen] = useState(false);

  // Load initial graph data
  useEffect(() => {
    if (nodes.length === 0 && !loading) {
      loadGraphData().then(data => {
        if (data) {
          dispatch(setNodes(data.nodes));
          dispatch(setEdges(data.edges));
        }
      });
    }
  }, [dispatch, nodes.length, loading]);

  // Update device info in Redux store
  useEffect(() => {
    const newDeviceInfo = {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      hasTouch: 'ontouchstart' in window,
      orientation: width > height ? 'landscape' as const : 'portrait' as const,
    };
    dispatch(updateDeviceInfo(newDeviceInfo));
    dispatch(setViewportSize({ width, height }));
  }, [dispatch, width, height]);

  // Open panel when a node is selected
  useEffect(() => {
    if (selectedNodes.length > 0) {
      setIsTrackInfoOpen(true);
    }
  }, [selectedNodes]);

  return (
    <div className={classNames('h-screen w-screen relative overflow-hidden', theme.isDark ? 'dark bg-gray-900' : 'bg-white')}>
      <UnifiedHeader />

      <main ref={setContainerRef as React.Ref<HTMLElement>} className="absolute top-[56px] left-0 right-0" style={{ bottom: deviceInfo.isMobile ? '5rem' : 0 }} data-testid="graph-container">
        <Routes>
          <Route path="/" element={<GraphPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/2d-graph" element={<GraphPage is3DMode={false} />} />
          <Route path="/3d-space" element={<GraphPage is3DMode={true} />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/route-builder" element={<RouteBuilderPage />} />
        </Routes>
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="text-white">Loading...</div>
          </div>
        )}
      </main>

      <ResponsivePanel
        isOpen={isTrackInfoOpen}
        onClose={() => dispatch(setSelectedNodes([]))}
        title="Track Details"
      >
        <TrackInfoPanel />
      </ResponsivePanel>

      {deviceInfo.isMobile && <BottomNavigation onSettingsClick={() => { /* Settings handled by route */ }} />}
      <HUD />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
};

export default App;