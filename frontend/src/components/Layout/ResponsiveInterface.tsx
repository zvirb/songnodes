import React, { useState, useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSelectedNodes } from '../../store/graphSlice';
import { ResponsiveLayoutProvider, useResponsiveLayout } from './ResponsiveLayoutProvider';
import { UnifiedHeaderBar } from './UnifiedHeaderBar';
import { NavigationPanel, ControlPanel, TrackInfoPanel, SearchPanel } from './ResponsivePanelSystem';
import ViewTransitionLayer from './ViewTransitionLayer';
import { WorkingD3Canvas } from '../GraphCanvas/WorkingD3Canvas';
import { ThreeD3Canvas } from '../GraphCanvas/ThreeD3CanvasEnhanced';
import classNames from 'classnames';

interface ResponsiveInterfaceProps {
  className?: string;
}

interface GraphCanvasWrapperProps {
  is3DMode: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  width: number;
  height: number;
  settings: {
    distancePower: number;
    relationshipPower: number;
    nodeSize: number;
    edgeLabelSize: number;
  };
  onNodeClick?: (node: any) => void;
  onEdgeClick?: (edge: any) => void;
}

const GraphCanvasWrapper: React.FC<GraphCanvasWrapperProps> = ({
  is3DMode,
  containerRef,
  width,
  height,
  settings,
  onNodeClick,
  onEdgeClick
}) => {
  const { isMobile, isTablet } = useResponsiveLayout();

  // Optimize canvas dimensions for device
  const optimizedDimensions = useMemo(() => {
    let adjustedWidth = width;
    let adjustedHeight = height;

    // Reduce resolution on mobile for better performance
    if (isMobile) {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      adjustedWidth = Math.floor(width / pixelRatio);
      adjustedHeight = Math.floor(height / pixelRatio);
    }

    return { width: adjustedWidth, height: adjustedHeight };
  }, [width, height, isMobile]);

  const canvasProps = {
    ...optimizedDimensions,
    className: "absolute inset-0",
    distancePower: settings.distancePower,
    relationshipPower: settings.relationshipPower,
    nodeSize: settings.nodeSize,
    edgeLabelSize: settings.edgeLabelSize,
    onNodeClick,
    onEdgeClick
  };

  if (is3DMode) {
    return (
      <ThreeD3Canvas
        key="3d-canvas"
        {...canvasProps}
      />
    );
  }

  return (
    <WorkingD3Canvas
      key="2d-canvas"
      {...canvasProps}
    />
  );
};

const ResponsiveInterfaceContent: React.FC<ResponsiveInterfaceProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const {
    isMobile,
    isTablet,
    isDesktop,
    viewportWidth,
    viewportHeight,
    panels,
    openPanel,
    closePanel
  } = useResponsiveLayout();

  // App state
  const { nodes, edges, loading, selectedNodes } = useAppSelector(state => state.graph);
  const { theme } = useAppSelector(state => state.ui);

  // Local state
  const [is3DMode, setIs3DMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === '3d';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  // Settings (separate for 2D and 3D)
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

  const currentSettings = is3DMode ? settings3D : settings2D;

  // Track transitions
  const handleViewModeToggle = (mode: boolean) => {
    if (mode === is3DMode) return;

    setIsTransitioning(true);
    setIs3DMode(mode);

    // Update URL
    const urlParams = new URLSearchParams(window.location.search);
    if (mode) {
      urlParams.set('mode', '3d');
    } else {
      urlParams.delete('mode');
    }
    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  };

  const handleTransitionComplete = () => {
    setIsTransitioning(false);
  };

  // Canvas dimensions
  const { width, height } = useMemo(() => {
    if (!containerRef) return { width: viewportWidth, height: viewportHeight };

    const rect = containerRef.getBoundingClientRect();
    return {
      width: rect.width || viewportWidth,
      height: rect.height || viewportHeight
    };
  }, [containerRef, viewportWidth, viewportHeight]);

  // Node/Edge interaction handlers
  const handleNodeClick = (node: any) => {
    dispatch(setSelectedNodes([node.id]));
    if (!panels.trackInfo.isOpen) {
      openPanel('trackInfo');
    }
  };

  const handleEdgeClick = (edge: any) => {
    // Handle edge selection if needed
    console.log('Edge clicked:', edge);
  };

  // Auto-open track info panel when node is selected (desktop only)
  useEffect(() => {
    if (selectedNodes.length > 0 && isDesktop && !panels.trackInfo.isOpen) {
      openPanel('trackInfo');
    }
  }, [selectedNodes, isDesktop, panels.trackInfo.isOpen, openPanel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            openPanel('search');
            break;
          case 'g':
            e.preventDefault();
            openPanel('controls');
            break;
          case 'i':
            e.preventDefault();
            if (selectedNodes.length > 0) {
              openPanel('trackInfo');
            }
            break;
          case '3':
            e.preventDefault();
            handleViewModeToggle(true);
            break;
          case '2':
            e.preventDefault();
            handleViewModeToggle(false);
            break;
        }
      }

      if (e.key === 'Escape') {
        // Close all panels on escape
        Object.keys(panels).forEach(panel => {
          if (panels[panel as keyof typeof panels].isOpen) {
            closePanel(panel as keyof typeof panels);
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, panels, openPanel, closePanel]);

  // Calculate layout adjustments for open panels
  const layoutAdjustments = useMemo(() => {
    let rightOffset = 0;
    let leftOffset = 0;
    let topOffset = isMobile ? 56 : 64; // Header height
    let bottomOffset = 0;

    if (isDesktop) {
      if (panels.trackInfo.isOpen && panels.trackInfo.position === 'right') {
        rightOffset = 350; // Panel width
      }
      if (panels.navigation.isOpen && panels.navigation.position === 'left') {
        leftOffset = 320; // Panel width
      }
    }

    if (panels.controls.isOpen && panels.controls.position === 'top') {
      topOffset += isMobile ? 120 : 80; // Controls height
    }

    return { rightOffset, leftOffset, topOffset, bottomOffset };
  }, [panels, isMobile, isDesktop]);

  return (
    <div
      className={classNames(
        'h-screen w-screen relative overflow-hidden safe-area-inset',
        theme.isDark ? 'dark bg-gray-900' : 'bg-white',
        className
      )}
    >
      {/* Unified Header */}
      <UnifiedHeaderBar
        is3DMode={is3DMode}
        onViewModeToggle={handleViewModeToggle}
      />

      {/* Main Graph Viewport */}
      <div
        ref={setContainerRef}
        className={classNames(
          'fixed inset-0 transition-all duration-300 ease-in-out',
          'graph-canvas gpu-accelerated'
        )}
        style={{
          top: layoutAdjustments.topOffset,
          right: layoutAdjustments.rightOffset,
          left: layoutAdjustments.leftOffset,
          bottom: layoutAdjustments.bottomOffset
        }}
        data-testid="graph-container"
      >
        <ViewTransitionLayer
          is3DMode={is3DMode}
          isTransitioning={isTransitioning}
          onTransitionComplete={handleTransitionComplete}
        >
          {width && height && (
            <GraphCanvasWrapper
              is3DMode={is3DMode}
              containerRef={{ current: containerRef }}
              width={width}
              height={height}
              settings={currentSettings}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          )}
        </ViewTransitionLayer>

        {/* Loading Overlay */}
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

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded z-50">
            {is3DMode ? '🌌 3D Mode' : '📊 2D Mode'} | {width}×{height} | Nodes: {nodes.length}
            {isMobile && ' | Mobile'}
            {isTablet && ' | Tablet'}
            {isDesktop && ' | Desktop'}
          </div>
        )}
      </div>

      {/* Responsive Panels */}
      <NavigationPanel>
        <div className="p-4">
          <p className="text-gray-300">Navigation panel content will go here.</p>
          <p className="text-gray-400 text-sm mt-2">
            Functions, tools, and settings for graph interaction.
          </p>
        </div>
      </NavigationPanel>

      <ControlPanel>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-2">
              Distance Power: {currentSettings.distancePower}
            </label>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.1"
              value={currentSettings.distancePower}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (is3DMode) {
                  setSettings3D(prev => ({ ...prev, distancePower: value }));
                } else {
                  setSettings2D(prev => ({ ...prev, distancePower: value }));
                }
              }}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">
              Node Size: {currentSettings.nodeSize}px
            </label>
            <input
              type="range"
              min="2"
              max="24"
              step="0.5"
              value={currentSettings.nodeSize}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (is3DMode) {
                  setSettings3D(prev => ({ ...prev, nodeSize: value }));
                } else {
                  setSettings2D(prev => ({ ...prev, nodeSize: value }));
                }
              }}
              className="w-full"
            />
          </div>
        </div>
      </ControlPanel>

      <TrackInfoPanel>
        <div className="p-4">
          {selectedNodes.length > 0 ? (
            <div>
              <h3 className="text-white font-medium mb-2">Selected Track</h3>
              <p className="text-gray-300">
                Track ID: {selectedNodes[0]}
              </p>
              {/* Add more track details here */}
            </div>
          ) : (
            <div>
              <p className="text-gray-400">No track selected</p>
              <p className="text-gray-500 text-sm mt-2">
                Click on a node to view track details.
              </p>
            </div>
          )}
        </div>
      </TrackInfoPanel>

      <SearchPanel>
        <div className="p-4">
          <input
            type="text"
            placeholder="Search artists, tracks, venues..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
          />
          <p className="text-gray-400 text-sm mt-2">
            Start typing to search the graph...
          </p>
        </div>
      </SearchPanel>
    </div>
  );
};

export const ResponsiveInterface: React.FC<ResponsiveInterfaceProps> = (props) => {
  return (
    <ResponsiveLayoutProvider>
      <ResponsiveInterfaceContent {...props} />
    </ResponsiveLayoutProvider>
  );
};