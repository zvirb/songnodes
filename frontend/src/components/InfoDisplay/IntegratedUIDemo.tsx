import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../../store/index';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { SmartTooltip, BasicTooltipContent, AdvancedTooltipContent } from './SmartTooltip';
import { InfoCard, NodeInfoCard, EdgeInfoCard } from './InfoCard';
import { BottomSheet, TrackBottomSheet } from './BottomSheet';
import {
  HUDOverlay,
  PerformanceMetricsWidget,
  NavigationCompassWidget,
  MinimapWidget,
  FilterStatusWidget,
  RouteProgressWidget
} from '../HUD/HUDOverlay';
import { HUDConfiguration } from '../HUD/HUDConfiguration';
import { SettingsIcon, InfoIcon } from '../Icons/SettingsIcons';

interface IntegratedUIDemoProps {
  className?: string;
}

// Default HUD configuration
const defaultHUDConfig = {
  widgets: {
    performance: { visible: true, position: 'top-left', size: 'small' },
    compass: { visible: true, position: 'bottom-right', size: 'medium' },
    minimap: { visible: true, position: 'top-right', size: 'medium' },
    filters: { visible: false, position: 'bottom-left', size: 'medium' },
    routeProgress: { visible: false, position: 'bottom-center', size: 'large' }
  },
  mobileLayout: {
    autoHide: true,
    collapsedMode: true,
    maxVisibleWidgets: 2
  },
  settings: {
    transparency: 90,
    autoPosition: true,
    snapToEdges: true,
    respectSafeArea: true
  }
};

export const IntegratedUIDemo: React.FC<IntegratedUIDemoProps> = ({
  className = ''
}) => {
  const { nodes, edges } = useAppSelector(state => state.graph);
  const { deviceInfo } = useAppSelector(state => state.ui);

  // Panel states
  const [showSettings, setShowSettings] = useState(false);
  const [showHUDConfig, setShowHUDConfig] = useState(false);

  // Tooltip states
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  // Info card states
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });

  // Bottom sheet states
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // HUD states
  const [hudConfig, setHudConfig] = useState(defaultHUDConfig);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 60,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    memoryUsage: 0
  });

  // Refs for positioning
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: React.RefObject<HTMLButtonElement> }>({
    settings: React.createRef(),
    hudConfig: React.createRef(),
    demo: React.createRef()
  });

  // Update performance metrics
  useEffect(() => {
    setPerformanceMetrics(prev => ({
      ...prev,
      nodeCount: nodes.length,
      edgeCount: edges.length
    }));
  }, [nodes.length, edges.length]);

  // Simulate FPS updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPerformanceMetrics(prev => ({
        ...prev,
        fps: 45 + Math.random() * 30, // Simulate varying FPS
        memoryUsage: 50 * 1024 * 1024 + Math.random() * 20 * 1024 * 1024 // Simulate memory usage
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Demo node interaction handlers
  const handleNodeHover = (node: any, event: React.MouseEvent) => {
    setHoveredNode(node);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
    setShowTooltip(true);
  };

  const handleNodeClick = (node: any, event: React.MouseEvent) => {
    setSelectedNode(node);
    setCardPosition({ x: event.clientX + 10, y: event.clientY });
    setShowTooltip(false);

    // On mobile, show bottom sheet instead of info card
    if (deviceInfo?.isMobile) {
      setShowBottomSheet(true);
    }
  };

  const handleNodeDoubleClick = (node: any) => {
    setShowBottomSheet(true);
  };

  const handleEdgeClick = (edge: any, event: React.MouseEvent) => {
    setSelectedEdge(edge);
    setCardPosition({ x: event.clientX + 10, y: event.clientY });
  };

  // Create sample nodes and edges for demo
  const sampleNodes = [
    {
      id: 'node1',
      title: 'Titanium',
      artist: 'David Guetta ft. Sia',
      metadata: {
        album: 'Nothing but the Beat',
        genre: 'Electronic Dance',
        bpm: 126,
        key: 'D minor',
        year: 2011,
        duration: 245
      },
      metrics: {
        degree: 15,
        centrality: 0.234,
        clustering: 0.567
      },
      audioFeatures: {
        danceability: 0.85,
        energy: 0.92,
        valence: 0.73
      }
    },
    {
      id: 'node2',
      title: 'One More Time',
      artist: 'Daft Punk',
      metadata: {
        album: 'Discovery',
        genre: 'French House',
        bpm: 123,
        key: 'E major',
        year: 2000
      }
    }
  ];

  const sampleEdge = {
    id: 'edge1',
    source: 'node1',
    target: 'node2',
    weight: 5,
    type: 'transition',
    label: 'Sequential play',
    metadata: {
      strength: 'strong',
      context: 'DJ Mix'
    }
  };

  // Build HUD widgets array
  const hudWidgets = [
    {
      id: 'performance',
      component: PerformanceMetricsWidget,
      props: performanceMetrics,
      position: hudConfig.widgets.performance.position as any,
      visible: hudConfig.widgets.performance.visible,
      draggable: true,
      size: hudConfig.widgets.performance.size as any
    },
    {
      id: 'compass',
      component: NavigationCompassWidget,
      props: {
        onResetView: () => console.log('Reset view'),
        onFitToScreen: () => console.log('Fit to screen'),
        onZoomIn: () => console.log('Zoom in'),
        onZoomOut: () => console.log('Zoom out'),
        currentZoom: 1.2
      },
      position: hudConfig.widgets.compass.position as any,
      visible: hudConfig.widgets.compass.visible,
      draggable: true,
      size: hudConfig.widgets.compass.size as any
    },
    {
      id: 'minimap',
      component: MinimapWidget,
      props: {
        onViewportChange: (viewport: any) => console.log('Viewport change:', viewport)
      },
      position: hudConfig.widgets.minimap.position as any,
      visible: hudConfig.widgets.minimap.visible,
      draggable: true,
      size: hudConfig.widgets.minimap.size as any
    },
    {
      id: 'filters',
      component: FilterStatusWidget,
      props: {
        activeFilters: ['Electronic', 'BPM > 120'],
        searchQuery: 'Titanium',
        selectedCount: 3
      },
      position: hudConfig.widgets.filters.position as any,
      visible: hudConfig.widgets.filters.visible,
      draggable: true,
      size: hudConfig.widgets.filters.size as any
    },
    {
      id: 'routeProgress',
      component: RouteProgressWidget,
      props: {
        totalTracks: 15,
        currentTrack: 7,
        routeName: 'Festival Set',
        isPlaying: true,
        onPrevious: () => console.log('Previous track'),
        onNext: () => console.log('Next track'),
        onPause: () => console.log('Pause/Play')
      },
      position: hudConfig.widgets.routeProgress.position as any,
      visible: hudConfig.widgets.routeProgress.visible,
      draggable: true,
      size: hudConfig.widgets.routeProgress.size as any
    }
  ];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Demo Control Panel */}
      <div className="fixed top-16 left-4 z-[999] bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 space-y-3">
        <h3 className="text-white font-medium text-sm">UI Demo Controls</h3>

        <div className="space-y-2">
          <button
            ref={buttonRefs.current.settings}
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            Settings Panel
          </button>

          <button
            ref={buttonRefs.current.hudConfig}
            onClick={() => setShowHUDConfig(true)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
          >
            <InfoIcon className="w-4 h-4" />
            HUD Configuration
          </button>

          <button
            ref={buttonRefs.current.demo}
            onClick={() => setShowBottomSheet(true)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
          >
            📱 Bottom Sheet
          </button>
        </div>

        {/* Demo Interaction Area */}
        <div className="border-t border-gray-700 pt-3">
          <div className="text-xs text-gray-400 mb-2">Demo Nodes (hover/click):</div>
          <div className="space-y-2">
            {sampleNodes.map(node => (
              <div
                key={node.id}
                className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded cursor-pointer transition-colors"
                onMouseEnter={(e) => handleNodeHover(node, e)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={(e) => handleNodeClick(node, e)}
                onDoubleClick={() => handleNodeDoubleClick(node)}
              >
                <div className="text-white text-xs font-medium">{node.title}</div>
                <div className="text-gray-400 text-xs">{node.artist}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 mb-2 mt-3">Demo Edge (click):</div>
          <div
            className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded cursor-pointer transition-colors"
            onClick={(e) => handleEdgeClick(sampleEdge, e)}
          >
            <div className="text-white text-xs font-medium">Transition Edge</div>
            <div className="text-gray-400 text-xs">{sampleEdge.source} → {sampleEdge.target}</div>
          </div>
        </div>
      </div>

      {/* HUD Overlay */}
      <HUDOverlay
        widgets={hudWidgets}
        onWidgetPositionChange={(widgetId, position) => {
          console.log(`Widget ${widgetId} moved to:`, position);
        }}
        onWidgetVisibilityChange={(widgetId, visible) => {
          console.log(`Widget ${widgetId} visibility:`, visible);
        }}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* HUD Configuration Panel */}
      <HUDConfiguration
        isOpen={showHUDConfig}
        onClose={() => setShowHUDConfig(false)}
        config={hudConfig}
        onConfigChange={setHudConfig}
      />

      {/* Smart Tooltip */}
      <SmartTooltip
        isOpen={showTooltip}
        onClose={() => setShowTooltip(false)}
        mousePosition={tooltipPosition}
        followCursor={true}
        size="medium"
        content={
          hoveredNode ? (
            <BasicTooltipContent
              title={hoveredNode.title}
              description={`by ${hoveredNode.artist}`}
              metadata={[
                { label: 'BPM', value: hoveredNode.metadata?.bpm || 'Unknown' },
                { label: 'Key', value: hoveredNode.metadata?.key || 'Unknown' },
                { label: 'Genre', value: hoveredNode.metadata?.genre || 'Unknown' }
              ]}
            />
          ) : null
        }
      >
        <div />
      </SmartTooltip>

      {/* Node Info Card */}
      <NodeInfoCard
        isOpen={!!selectedNode && !deviceInfo?.isMobile}
        onClose={() => setSelectedNode(null)}
        node={selectedNode}
        position={cardPosition}
      />

      {/* Edge Info Card */}
      <EdgeInfoCard
        isOpen={!!selectedEdge}
        onClose={() => setSelectedEdge(null)}
        edge={selectedEdge}
        position={cardPosition}
      />

      {/* Bottom Sheet (Mobile) */}
      <TrackBottomSheet
        isOpen={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        node={selectedNode || sampleNodes[0]}
      />

      {/* Usage Instructions */}
      <div className="fixed bottom-4 left-4 right-4 lg:right-auto lg:w-80 bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 z-[998]">
        <h4 className="text-white font-medium text-sm mb-2">UI Pattern Demo</h4>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• <strong>Hover</strong> demo nodes for smart tooltips</p>
          <p>• <strong>Click</strong> demo nodes for info cards</p>
          <p>• <strong>Double-click</strong> demo nodes for bottom sheet</p>
          <p>• <strong>Drag</strong> HUD widgets to reposition</p>
          <p>• Open settings panels from controls above</p>
          <p>• All UI adapts automatically to screen size</p>
        </div>
      </div>
    </div>
  );
};