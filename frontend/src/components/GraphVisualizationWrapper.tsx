import React, { useState, useCallback, Suspense, lazy } from 'react';
import useStore from '../store/useStore';
import { GraphModeToggle, GraphViewMode } from './GraphModeToggle';
import { GraphVisualization } from './GraphVisualization';
import { Loader2 } from 'lucide-react';

/**
 * GraphVisualizationWrapper Component
 *
 * Main wrapper that handles switching between 2D and 3D visualization modes.
 * Updated to conform with design system tokens and elevations.
 *
 * FEATURES:
 * - Conditional rendering based on viewMode
 * - Real 2D PIXI.js visualization (GraphVisualization.tsx)
 * - Lazy loading of 3D components for better initial load performance
 * - Preserves node selection across mode switches
 * - Smooth transitions between modes
 * - Fallback loading states and HUD controls conforming to tokens
 *
 * MODES:
 * - 2D: Traditional PIXI.js visualization (GraphVisualization.tsx)
 * - 3D: react-force-graph-3d with Camelot positioning (Graph3D.tsx)
 * - 3D Helix: Pure Three.js Camelot helix (CamelotHelix3D.tsx)
 */

// Lazy load 3D components for better performance
const Graph3D = lazy(() => import('./Graph3D'));
const CamelotHelix3D = lazy(() => import('./CamelotHelix3D'));

import { Track } from '../types';

interface GraphVisualizationWrapperProps {
  width?: number;
  height?: number;
  className?: string;
  showModeToggle?: boolean;
  defaultMode?: GraphViewMode;
  onTrackSelect?: (track: Track) => void;
  onTrackRightClick?: (track: Track, position: { x: number; y: number }) => void;
}

export const GraphVisualizationWrapper: React.FC<GraphVisualizationWrapperProps> = ({
  width = 800,
  height = 600,
  className = '',
  showModeToggle = true,
  defaultMode = '2d',
  onTrackSelect,
  onTrackRightClick,
}) => {
  // Store state
  const viewState = useStore(state => state.viewState);
  const updateViewSettings = useStore(state => state.updateViewSettings);

  // Local state for mode (falls back to store viewMode or defaultMode)
  const [mode, setMode] = useState<GraphViewMode>(
    viewState.viewMode || defaultMode
  );

  /**
   * Handle mode change
   * Preserves node selection and updates store
   */
  const handleModeChange = useCallback((newMode: GraphViewMode) => {
    setMode(newMode);

    // Update store
    updateViewSettings({
      ...viewState,
      viewMode: newMode,
    });
  }, [viewState, updateViewSettings]);

  /**
   * Render the appropriate graph component based on mode
   */
  const renderGraph = () => {
    switch (mode) {
      case '2d':
        return (
          <GraphVisualization
            onTrackSelect={onTrackSelect}
            onTrackRightClick={onTrackRightClick}
          />
        );

      case '3d':
        return (
          <Suspense
            fallback={
              <div
                style={{ width, height }}
                className="flex items-center justify-center bg-[var(--color-bg-base,#0a0a0a)] rounded-[var(--radius-panel,0.5rem)]"
              >
                <div className="text-[var(--color-text-primary,#ffffff)] flex items-center gap-2">
                  <Loader2 className="animate-spin text-[var(--color-brand-primary,#00ff41)]" size={24} />
                  <span>Loading 3D Graph...</span>
                </div>
              </div>
            }
          >
            <Graph3D
              width={width}
              height={height}
              className={className}
            />
          </Suspense>
        );

      case '3d-helix':
        return (
          <Suspense
            fallback={
              <div
                style={{ width, height }}
                className="flex items-center justify-center bg-[var(--color-bg-base,#0a0a0a)] rounded-[var(--radius-panel,0.5rem)]"
              >
                <div className="text-[var(--color-text-primary,#ffffff)] flex items-center gap-2">
                  <Loader2 className="animate-spin text-[var(--color-brand-primary,#00ff41)]" size={24} />
                  <span>Loading Camelot Helix...</span>
                </div>
              </div>
            }
          >
            <CamelotHelix3D
              width={width}
              height={height}
              className={className}
            />
          </Suspense>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Mode Toggle Overlay */}
      {showModeToggle && (
        <div className="absolute top-4 left-4 z-[var(--z-toolbar,30)]">
          <GraphModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            size="medium"
          />
        </div>
      )}

      {/* Mode Info Badge */}
      <div className="absolute top-4 right-4 z-[var(--z-panels,20)] bg-[var(--color-panel-bg,rgba(26,26,26,0.95))] text-[var(--color-text-primary,#ffffff)] px-3 py-1.5 rounded-[var(--radius-badge,9999px)] text-xs font-medium backdrop-blur-md border border-[var(--color-panel-border,#4a4a4a)] shadow-[var(--shadow-panel)]">
        {mode === '2d' && '2D View'}
        {mode === '3d' && '3D Force Graph'}
        {mode === '3d-helix' && 'Camelot Helix'}
      </div>

      {/* Graph Component */}
      {renderGraph()}

      {/* Performance Notice for 3D */}
      {(mode === '3d' || mode === '3d-helix') && (
        <div className="absolute bottom-4 right-4 z-[var(--z-panels,20)] bg-[var(--color-warning-bg,rgba(214,137,16,0.1))] text-[var(--color-warning,#D68910)] px-3 py-2 rounded-[var(--radius-panel,0.5rem)] text-xs backdrop-blur-md border border-[var(--color-warning-border,rgba(214,137,16,0.3))] shadow-[var(--shadow-panel)] max-w-xs">
          <div className="font-semibold mb-1">Performance Note</div>
          <div>3D rendering is GPU-intensive. For large graphs (&gt;1000 nodes), 2D mode is recommended.</div>
        </div>
      )}
    </div>
  );
};

export default GraphVisualizationWrapper;
