/**
 * GraphControls Component
 * UI controls for viewport and simulation management
 *
 * Features:
 * - Viewport controls (zoom in/out, fit, reset)
 * - Simulation controls (play/pause, restart)
 * - Statistics display (FPS, node count, etc.)
 * - Keyboard shortcuts
 * - Compact, non-intrusive design
 * - Accessible (ARIA labels, keyboard navigation)
 *
 * Layout:
 * - Fixed position top-right
 * - Grouped by function (viewport, simulation, stats)
 * - Icon-based buttons for clarity
 */

import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Home,
  Pause,
  Play,
  RotateCcw,
  Info,
  Activity,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type {
  ViewportControls,
  SimulationControls,
  SimulationState,
  RenderStats,
} from './types';
import styles from './GraphControls.module.css';

/* ============================================
   TYPES
   ============================================ */

interface GraphControlsProps {
  /** Viewport controls API */
  viewportControls: ViewportControls;

  /** Simulation controls API */
  simControls: SimulationControls;

  /** Simulation state */
  simState: SimulationState;

  /** Render and data statistics */
  stats: {
    fps?: number;
    visibleNodes?: number;
    visibleEdges?: number;
    totalNodes?: number;
    totalEdges?: number;
    filteredNodes?: number;
    filteredEdges?: number;
    rejectedNodes?: number;
    memoryUsage?: number;
  };

  /** Enable debug mode */
  debug?: boolean;

  /** Custom CSS class */
  className?: string;
}

/* ============================================
   COMPONENT
   ============================================ */

/**
 * GraphControls Component
 * Provides UI controls for graph viewport and simulation
 */
export function GraphControls({
  viewportControls,
  simControls,
  simState,
  stats,
  debug = false,
  className,
}: GraphControlsProps) {
  const [showStats, setShowStats] = React.useState(debug);

  /* ============================================
     HANDLERS
     ============================================ */

  const handleZoomIn = () => {
    const currentZoom = viewportControls.getZoom();
    viewportControls.zoomTo(currentZoom * 1.2, 200);
  };

  const handleZoomOut = () => {
    const currentZoom = viewportControls.getZoom();
    viewportControls.zoomTo(currentZoom / 1.2, 200);
  };

  const handleToggleSimulation = () => {
    if (simState.isRunning) {
      simControls.pause();
    } else {
      simControls.resume();
    }
  };

  const handleRestart = () => {
    simControls.restart();
  };

  /* ============================================
     KEYBOARD SHORTCUTS
     ============================================ */

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case '+':
        case '=':
          event.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          event.preventDefault();
          handleZoomOut();
          break;
        case 'f':
          event.preventDefault();
          viewportControls.fitToScreen();
          break;
        case 'r':
          event.preventDefault();
          viewportControls.resetView();
          break;
        case ' ':
          event.preventDefault();
          handleToggleSimulation();
          break;
        case 'i':
          event.preventDefault();
          setShowStats((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewportControls, simControls, simState.isRunning]);

  /* ============================================
     RENDER
     ============================================ */

  return (
    <div className={`${styles.controls} ${className || ''}`} role="toolbar" aria-label="Graph controls">
      {/* Viewport Controls */}
      <div className={styles.group} role="group" aria-label="Viewport controls">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <ZoomIn size={20} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <ZoomOut size={20} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => viewportControls.fitToScreen()}
          aria-label="Fit to screen"
          title="Fit to screen (F)"
        >
          <Maximize size={20} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => viewportControls.resetView()}
          aria-label="Reset view"
          title="Reset view (R)"
        >
          <Home size={20} />
        </Button>
      </div>

      {/* Simulation Controls */}
      <div className={styles.group} role="group" aria-label="Simulation controls">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleSimulation}
          aria-label={simState.isRunning ? 'Pause simulation' : 'Resume simulation'}
          title={`${simState.isRunning ? 'Pause' : 'Resume'} simulation (Space)`}
          className={simState.isRunning ? styles.active : ''}
        >
          {simState.isRunning ? <Pause size={20} /> : <Play size={20} />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRestart}
          aria-label="Restart simulation"
          title="Restart simulation"
          disabled={simState.isRunning}
        >
          <RotateCcw size={20} />
        </Button>
      </div>

      {/* Stats Toggle */}
      <div className={styles.group} role="group" aria-label="Information">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowStats((prev) => !prev)}
          aria-label={showStats ? 'Hide statistics' : 'Show statistics'}
          title={`${showStats ? 'Hide' : 'Show'} statistics (I)`}
          className={showStats ? styles.active : ''}
        >
          <Info size={20} />
        </Button>
      </div>

      {/* Statistics Panel */}
      {showStats && (
        <div className={styles.stats} role="status" aria-live="polite">
          {/* Performance Stats */}
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>Performance</span>
            {stats.fps !== undefined && (
              <Badge
                variant={stats.fps >= 55 ? 'success' : stats.fps >= 30 ? 'warning' : 'error'}
              >
                <Activity size={12} />
                {stats.fps} FPS
              </Badge>
            )}
            {stats.memoryUsage !== undefined && (
              <Badge variant="outline">
                {stats.memoryUsage.toFixed(1)} MB
              </Badge>
            )}
          </div>

          {/* Node Stats */}
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>Nodes</span>
            {stats.visibleNodes !== undefined && stats.totalNodes !== undefined && (
              <Badge variant="outline">
                {stats.visibleNodes} / {stats.totalNodes} visible
              </Badge>
            )}
            {stats.filteredNodes !== undefined && stats.filteredNodes !== stats.totalNodes && (
              <Badge variant="secondary">
                {stats.filteredNodes} filtered
              </Badge>
            )}
            {stats.rejectedNodes !== undefined && stats.rejectedNodes > 0 && (
              <Badge variant="warning" title="Nodes rejected due to invalid artist attribution">
                {stats.rejectedNodes} rejected
              </Badge>
            )}
          </div>

          {/* Edge Stats */}
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>Edges</span>
            {stats.visibleEdges !== undefined && stats.totalEdges !== undefined && (
              <Badge variant="outline">
                {stats.visibleEdges} / {stats.totalEdges} visible
              </Badge>
            )}
            {stats.filteredEdges !== undefined && stats.filteredEdges !== stats.totalEdges && (
              <Badge variant="secondary">
                {stats.filteredEdges} filtered
              </Badge>
            )}
          </div>

          {/* Simulation Stats */}
          {simState.isRunning && (
            <div className={styles.statGroup}>
              <span className={styles.statLabel}>Simulation</span>
              <Badge variant="success">
                Running
              </Badge>
              <Badge variant="outline">
                α: {simState.alpha.toFixed(3)}
              </Badge>
              {simState.temperature !== undefined && (
                <Badge variant="outline">
                  T: {simState.temperature.toFixed(2)}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      <div className={styles.hint}>
        <kbd>+</kbd> <kbd>-</kbd> <kbd>F</kbd> <kbd>R</kbd> <kbd>Space</kbd> <kbd>I</kbd>
      </div>
    </div>
  );
}
