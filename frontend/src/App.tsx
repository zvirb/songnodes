import React, { useEffect, useCallback, useState } from 'react';
import { useStore } from './store/useStore';
import { api } from './services/api';
import './styles/global.css';

// Lazy load components for performance
const GraphVisualization = React.lazy(() => import('./components/GraphVisualization'));
const TrackSearch = React.lazy(() => import('./components/TrackSearch'));
const PathBuilder = React.lazy(() => import('./components/PathBuilder').then(module => ({ default: module.PathBuilder })));
const SetlistBuilder = React.lazy(() => import('./components/SetlistBuilder'));
const FilterPanel = React.lazy(() => import('./components/FilterPanel'));
const StatsPanel = React.lazy(() => import('./components/StatsPanel'));
const DJInterface = React.lazy(() => import('./components/DJInterface').then(module => ({ default: module.DJInterface })));

// Toolbar icons (using text for now - replace with SVG icons in production)
const icons = {
  search: '🔍',
  path: '🛤️',
  setlist: '🎵',
  filter: '🔧',
  stats: '📊',
  settings: '⚙️',
  help: '❓',
};

interface ToolbarButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  active,
  onClick,
  disabled
}) => (
  <button
    className={`btn btn-icon ${active ? 'btn-primary' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
  >
    {icon}
  </button>
);

const App: React.FC = () => {
  const {
    graphData,
    viewState,
    panelState,
    isLoading,
    error,
    performanceMetrics,
    graph,
    panels,
    view,
    general,
  } = useStore();

  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [djModeEnabled, setDjModeEnabled] = useState(true); // Default to DJ mode for testing

  // Load initial graph data
  const loadGraphData = useCallback(async () => {
    general.setLoading(true);
    general.setError(null);

    try {
      const response = await api.graph.getGraphData();

      if (response.status === 'success') {
        graph.setGraphData(response.data);
      } else {
        general.setError(response.message || 'Failed to load graph data');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      general.setError(message);
      console.error('Failed to load graph data:', err);
    } finally {
      general.setLoading(false);
    }
  }, [graph, general]);

  // Initialize app
  useEffect(() => {
    loadGraphData();

    // Performance monitoring in development
    if (process.env.NODE_ENV === 'development') {
      setShowPerformanceMonitor(true);
    }

    // Keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case '1':
          view.setSelectedTool('select');
          break;
        case '2':
          view.setSelectedTool('path');
          break;
        case '3':
          view.setSelectedTool('setlist');
          break;
        case '4':
          view.setSelectedTool('filter');
          break;
        case 'Escape':
          panels.closeAllPanels();
          graph.clearSelection();
          break;
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            loadGraphData();
          }
          break;
        case 'f':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            panels.toggleLeftPanel('search');
          }
          break;
        case 'p':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            panels.toggleLeftPanel('path');
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [view, panels, graph, general, loadGraphData]);

  // Panel toggle handlers
  const handleToggleLeftPanel = (panel: typeof panelState.leftPanel) => {
    panels.toggleLeftPanel(panel);
  };

  const handleToggleRightPanel = (panel: typeof panelState.rightPanel) => {
    panels.toggleRightPanel(panel);
  };

  const handleToolChange = (tool: typeof viewState.selectedTool) => {
    view.setSelectedTool(tool);

    // Auto-open relevant panels based on tool selection
    switch (tool) {
      case 'select':
        // Close path/setlist panels when switching to select mode
        if (panelState.leftPanel === 'path') panels.toggleLeftPanel(null);
        if (panelState.leftPanel === 'setlist') panels.toggleLeftPanel(null);
        break;
      case 'path':
        panels.toggleLeftPanel('path');
        break;
      case 'setlist':
        panels.toggleLeftPanel('setlist');
        break;
      case 'filter':
        panels.toggleLeftPanel('filters');
        break;
    }
  };

  const renderLeftPanel = () => {
    if (!panelState.leftPanel) return null;

    const panelContent = () => {
      switch (panelState.leftPanel) {
        case 'search':
          return (
            <React.Suspense fallback={<div className="loading-spinner" />}>
              <TrackSearch />
            </React.Suspense>
          );
        case 'filters':
          return (
            <React.Suspense fallback={<div className="loading-spinner" />}>
              <FilterPanel />
            </React.Suspense>
          );
        case 'path':
          return (
            <React.Suspense fallback={<div className="loading-spinner" />}>
              <PathBuilder />
            </React.Suspense>
          );
        case 'setlist':
          return (
            <React.Suspense fallback={<div className="loading-spinner" />}>
              <SetlistBuilder />
            </React.Suspense>
          );
        default:
          return <div>Panel not implemented</div>;
      }
    };

    const panelTitle = () => {
      switch (panelState.leftPanel) {
        case 'search': return 'Track Search';
        case 'filters': return 'Filters';
        case 'path': return 'Path Builder';
        case 'setlist': return 'Setlist Builder';
        default: return 'Panel';
      }
    };

    return (
      <div className={`panel panel-left ${panelState.leftPanel ? 'visible' : ''}`}>
        <div className="panel-header">
          <div className="panel-title">{panelTitle()}</div>
          <button
            className="btn btn-icon-small"
            onClick={() => panels.toggleLeftPanel(null)}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
        <div className="panel-content">
          {panelContent()}
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!panelState.rightPanel) return null;

    const panelContent = () => {
      switch (panelState.rightPanel) {
        case 'stats':
          return (
            <React.Suspense fallback={<div className="loading-spinner" />}>
              <StatsPanel />
            </React.Suspense>
          );
        case 'details':
          return <div>Track details panel not implemented</div>;
        case 'history':
          return <div>History panel not implemented</div>;
        default:
          return <div>Panel not implemented</div>;
      }
    };

    const panelTitle = () => {
      switch (panelState.rightPanel) {
        case 'stats': return 'Statistics';
        case 'details': return 'Track Details';
        case 'history': return 'History';
        default: return 'Panel';
      }
    };

    return (
      <div className={`panel panel-right ${panelState.rightPanel ? 'visible' : ''}`}>
        <div className="panel-header">
          <div className="panel-title">{panelTitle()}</div>
          <button
            className="btn btn-icon-small"
            onClick={() => panels.toggleRightPanel(null)}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
        <div className="panel-content">
          {panelContent()}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="app-container">
        <div className="loading-overlay">
          <div style={{ textAlign: 'center', color: 'var(--color-accent-secondary)' }}>
            <h2>Error Loading SongNodes</h2>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadGraphData}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render DJ Interface if enabled
  if (djModeEnabled) {
    return (
      <React.Suspense fallback={
        <div className="app-container">
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <div>Loading DJ Interface...</div>
          </div>
        </div>
      }>
        <DJInterface />
      </React.Suspense>
    );
  }

  // Classic interface
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-accent-primary)' }}>
            SongNodes DJ
          </h1>
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            Interactive Mixing Assistant
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* DJ Mode Toggle */}
          <button
            className="btn btn-small btn-primary"
            onClick={() => setDjModeEnabled(true)}
            style={{ backgroundColor: '#7ED321' }}
          >
            🎤 Switch to DJ Mode
          </button>

          {/* Connection Status */}
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            {graphData.nodes.length} tracks • {graphData.edges.length} connections
          </div>

          {/* Quick Actions */}
          <button className="btn btn-small" onClick={loadGraphData} disabled={isLoading}>
            {isLoading ? '⟳' : '↻'} Refresh
          </button>

          <button
            className="btn btn-small"
            onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
          >
            {icons.settings} Debug
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div style={{ display: 'flex', gap: '4px' }}>
          <ToolbarButton
            icon="👆"
            label="Select Tool (1)"
            active={viewState.selectedTool === 'select'}
            onClick={() => handleToolChange('select')}
          />
          <ToolbarButton
            icon={icons.path}
            label="Path Builder (2)"
            active={viewState.selectedTool === 'path'}
            onClick={() => handleToolChange('path')}
          />
          <ToolbarButton
            icon={icons.setlist}
            label="Setlist Builder (3)"
            active={viewState.selectedTool === 'setlist'}
            onClick={() => handleToolChange('setlist')}
          />
          <ToolbarButton
            icon={icons.filter}
            label="Filter Tool (4)"
            active={viewState.selectedTool === 'filter'}
            onClick={() => handleToolChange('filter')}
          />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: '4px' }}>
          <ToolbarButton
            icon={icons.search}
            label="Search Tracks (Ctrl+F)"
            active={panelState.leftPanel === 'search'}
            onClick={() => handleToggleLeftPanel('search')}
          />
          <ToolbarButton
            icon={icons.stats}
            label="Statistics"
            active={panelState.rightPanel === 'stats'}
            onClick={() => handleToggleRightPanel('stats')}
          />
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--color-border-primary)', margin: '0 8px' }} />

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-icon-small"
            onClick={view.toggleLabels}
            title={`${viewState.showLabels ? 'Hide' : 'Show'} Labels`}
          >
            🏷️
          </button>
          <button
            className="btn btn-icon-small"
            onClick={view.toggleEdges}
            title={`${viewState.showEdges ? 'Hide' : 'Show'} Edges`}
          >
            🔗
          </button>
          <button
            className="btn btn-icon-small"
            onClick={view.resetView}
            title="Reset View"
          >
            🎯
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="app-main">
        {/* Graph Canvas */}
        <div className="app-content">
          <React.Suspense
            fallback={
              <div className="loading-overlay">
                <div className="loading-spinner" />
              </div>
            }
          >
            <GraphVisualization />
          </React.Suspense>

          {/* Performance Monitor */}
          {showPerformanceMonitor && (
            <div className="performance-monitor">
              <div>FPS: {Math.round(performanceMetrics.frameRate)}</div>
              <div>Render: {Math.round(performanceMetrics.renderTime)}ms</div>
              <div>Nodes: {performanceMetrics.visibleNodes}/{performanceMetrics.nodeCount}</div>
              <div>Edges: {performanceMetrics.visibleEdges}/{performanceMetrics.edgeCount}</div>
              <div>Memory: {Math.round(performanceMetrics.memoryUsage)}MB</div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="loading-overlay">
              <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" />
                <p style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>
                  Loading graph data...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side Panels */}
        {renderLeftPanel()}
        {renderRightPanel()}
      </main>

      {/* Keyboard Shortcuts Help (Hidden by default) */}
      <div style={{ display: 'none' }} aria-hidden="true">
        Keyboard shortcuts: 1-4 (tools), Escape (clear), Ctrl+R (refresh), Ctrl+F (search), Ctrl+P (path)
      </div>
    </div>
  );
};

export default App;