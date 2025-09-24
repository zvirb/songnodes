import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../../store/index';
import { CompassIcon, LayersIcon, ZoomInIcon, ZoomOutIcon, FitToScreenIcon } from '../Icons/SettingsIcons';

interface HUDPosition {
  x: number;
  y: number;
}

interface HUDWidget {
  id: string;
  component: React.ComponentType<any>;
  props?: any;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  customPosition?: HUDPosition;
  visible: boolean;
  draggable?: boolean;
  size?: 'small' | 'medium' | 'large';
}

interface HUDOverlayProps {
  widgets: HUDWidget[];
  onWidgetPositionChange?: (widgetId: string, position: HUDPosition) => void;
  onWidgetVisibilityChange?: (widgetId: string, visible: boolean) => void;
  className?: string;
}

const POSITION_OFFSETS = {
  'top-left': { x: 16, y: 80 },
  'top-right': { x: -16, y: 80 },
  'bottom-left': { x: 16, y: -16 },
  'bottom-right': { x: -16, y: -16 }
};

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  widgets,
  onWidgetPositionChange,
  onWidgetVisibilityChange,
  className = ''
}) => {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement> }>({});

  // Initialize refs for draggable widgets
  useEffect(() => {
    widgets.forEach(widget => {
      if (widget.draggable && !dragRefs.current[widget.id]) {
        dragRefs.current[widget.id] = React.createRef();
      }
    });
  }, [widgets]);

  // Handle drag operations
  useEffect(() => {
    if (!draggedWidget) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      };

      // Constrain to viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const widgetRef = dragRefs.current[draggedWidget];

      if (widgetRef?.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        newPosition.x = Math.max(0, Math.min(newPosition.x, viewportWidth - rect.width));
        newPosition.y = Math.max(64, Math.min(newPosition.y, viewportHeight - rect.height)); // Account for header
      }

      onWidgetPositionChange?.(draggedWidget, newPosition);
    };

    const handleMouseUp = () => {
      setDraggedWidget(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedWidget, dragOffset, onWidgetPositionChange]);

  const handleMouseDown = (e: React.MouseEvent, widgetId: string) => {
    if (!widgets.find(w => w.id === widgetId)?.draggable) return;

    const widget = widgets.find(w => w.id === widgetId);
    const widgetRef = dragRefs.current[widgetId];

    if (widget && widgetRef?.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setDraggedWidget(widgetId);
    }
  };

  const getWidgetPosition = (widget: HUDWidget): React.CSSProperties => {
    if (widget.position === 'custom' && widget.customPosition) {
      return {
        position: 'fixed',
        left: widget.customPosition.x,
        top: widget.customPosition.y,
        zIndex: 1000
      };
    }

    const offset = POSITION_OFFSETS[widget.position];
    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 1000
    };

    switch (widget.position) {
      case 'top-left':
        return { ...baseStyle, top: offset.y, left: offset.x };
      case 'top-right':
        return { ...baseStyle, top: offset.y, right: Math.abs(offset.x) };
      case 'bottom-left':
        return { ...baseStyle, bottom: Math.abs(offset.y), left: offset.x };
      case 'bottom-right':
        return { ...baseStyle, bottom: Math.abs(offset.y), right: Math.abs(offset.x) };
      default:
        return baseStyle;
    }
  };

  const getSizeClasses = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small':
        return 'text-xs';
      case 'large':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  return (
    <div className={`pointer-events-none ${className}`}>
      {widgets
        .filter(widget => widget.visible)
        .map(widget => {
          const WidgetComponent = widget.component;
          const widgetRef = dragRefs.current[widget.id];

          return (
            <div
              key={widget.id}
              ref={widgetRef}
              style={getWidgetPosition(widget)}
              className={`
                pointer-events-auto
                ${widget.draggable ? 'cursor-move' : ''}
                ${getSizeClasses(widget.size || 'medium')}
                ${draggedWidget === widget.id ? 'z-[1001]' : 'z-[1000]'}
              `}
              onMouseDown={(e) => handleMouseDown(e, widget.id)}
            >
              <WidgetComponent {...(widget.props || {})} />
            </div>
          );
        })}
    </div>
  );
};

// Performance Metrics Widget
export const PerformanceMetricsWidget: React.FC<{
  fps?: number;
  nodeCount?: number;
  edgeCount?: number;
  memoryUsage?: number;
}> = ({ fps = 0, nodeCount = 0, edgeCount = 0, memoryUsage = 0 }) => (
  <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3 shadow-lg">
    <div className="text-white font-medium text-xs mb-2">Performance</div>
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-400">FPS:</span>
        <span className={`font-medium ${fps < 30 ? 'text-red-400' : fps < 50 ? 'text-yellow-400' : 'text-green-400'}`}>
          {fps.toFixed(0)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Nodes:</span>
        <span className="text-white font-medium">{nodeCount.toLocaleString()}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Edges:</span>
        <span className="text-white font-medium">{edgeCount.toLocaleString()}</span>
      </div>
      {memoryUsage > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-400">Memory:</span>
          <span className="text-white font-medium">{(memoryUsage / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      )}
    </div>
  </div>
);

// Navigation Compass Widget
export const NavigationCompassWidget: React.FC<{
  onResetView?: () => void;
  onFitToScreen?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  currentZoom?: number;
}> = ({ onResetView, onFitToScreen, onZoomIn, onZoomOut, currentZoom = 1 }) => (
  <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-2 shadow-lg">
    <div className="flex flex-col gap-1">
      <button
        onClick={onZoomIn}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
        title="Zoom In"
      >
        <ZoomInIcon className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
        title="Zoom Out"
      >
        <ZoomOutIcon className="w-4 h-4" />
      </button>
      <button
        onClick={onFitToScreen}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
        title="Fit to Screen"
      >
        <FitToScreenIcon className="w-4 h-4" />
      </button>
      <button
        onClick={onResetView}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
        title="Reset View"
      >
        <CompassIcon className="w-4 h-4" />
      </button>
      {currentZoom !== 1 && (
        <div className="text-center text-xs text-gray-400 py-1 border-t border-gray-700">
          {(currentZoom * 100).toFixed(0)}%
        </div>
      )}
    </div>
  </div>
);

// Minimap Widget
export const MinimapWidget: React.FC<{
  width?: number;
  height?: number;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}> = ({ width = 120, height = 80, onViewportChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { nodes, edges } = useAppSelector(state => state.graph);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw simplified graph
    if (nodes.length > 0) {
      // Calculate bounds
      const minX = Math.min(...nodes.map(n => n.x || 0));
      const maxX = Math.max(...nodes.map(n => n.x || 0));
      const minY = Math.min(...nodes.map(n => n.y || 0));
      const maxY = Math.max(...nodes.map(n => n.y || 0));

      const scaleX = width / (maxX - minX || 1);
      const scaleY = height / (maxY - minY || 1);
      const scale = Math.min(scaleX, scaleY) * 0.8; // 80% to add padding

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw edges (simplified)
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)';
      ctx.lineWidth = 0.5;
      edges.slice(0, 100).forEach(edge => { // Limit for performance
        const source = nodes.find(n => n.id === (typeof edge.source === 'string' ? edge.source : edge.source.id));
        const target = nodes.find(n => n.id === (typeof edge.target === 'string' ? edge.target : edge.target.id));

        if (source && target && source.x !== undefined && source.y !== undefined && target.x !== undefined && target.y !== undefined) {
          const x1 = centerX + (source.x - (minX + maxX) / 2) * scale;
          const y1 = centerY + (source.y - (minY + maxY) / 2) * scale;
          const x2 = centerX + (target.x - (minX + maxX) / 2) * scale;
          const y2 = centerY + (target.y - (minY + maxY) / 2) * scale;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      });

      // Draw nodes (simplified)
      ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
      nodes.slice(0, 200).forEach(node => { // Limit for performance
        if (node.x !== undefined && node.y !== undefined) {
          const x = centerX + (node.x - (minX + maxX) / 2) * scale;
          const y = centerY + (node.y - (minY + maxY) / 2) * scale;

          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, [nodes, edges, width, height]);

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-2 shadow-lg">
      <div className="text-white font-medium text-xs mb-2">Overview</div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-700 rounded cursor-pointer"
        onClick={(e) => {
          // Calculate click position and trigger viewport change
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / width;
          const y = (e.clientY - rect.top) / height;
          onViewportChange?.({ x, y, zoom: 1 });
        }}
      />
    </div>
  );
};

// Filter Status Widget
export const FilterStatusWidget: React.FC<{
  activeFilters?: string[];
  searchQuery?: string;
  selectedCount?: number;
}> = ({ activeFilters = [], searchQuery = '', selectedCount = 0 }) => {
  if (activeFilters.length === 0 && !searchQuery && selectedCount === 0) {
    return null;
  }

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3 shadow-lg max-w-xs">
      <div className="text-white font-medium text-xs mb-2">Active Filters</div>
      <div className="space-y-1 text-xs">
        {searchQuery && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Search:</span>
            <span className="text-blue-400 font-medium truncate">{searchQuery}</span>
          </div>
        )}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Selected:</span>
            <span className="text-white font-medium">{selectedCount}</span>
          </div>
        )}
        {activeFilters.map((filter, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-gray-300 truncate">{filter}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Route Progress Widget
export const RouteProgressWidget: React.FC<{
  totalTracks?: number;
  currentTrack?: number;
  routeName?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onPause?: () => void;
  isPlaying?: boolean;
}> = ({
  totalTracks = 0,
  currentTrack = 0,
  routeName = '',
  onPrevious,
  onNext,
  onPause,
  isPlaying = false
}) => {
  if (totalTracks === 0) return null;

  const progress = totalTracks > 0 ? (currentTrack / totalTracks) * 100 : 0;

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3 shadow-lg">
      <div className="text-white font-medium text-xs mb-2 truncate">
        {routeName || 'Route Progress'}
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{currentTrack}</span>
          <span>{totalTracks}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={onPrevious}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
          title="Previous"
        >
          ⏮
        </button>
        <button
          onClick={onPause}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={onNext}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
          title="Next"
        >
          ⏭
        </button>
      </div>
    </div>
  );
};