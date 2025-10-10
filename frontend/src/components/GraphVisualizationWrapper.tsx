import React, { useState, useCallback, Suspense, lazy } from 'react';
import useStore from '../store/useStore';
import { GraphModeToggle, GraphViewMode } from './GraphModeToggle';
import { Loader2 } from 'lucide-react';

/**
 * GraphVisualizationWrapper Component
 *
 * Main wrapper that handles switching between 2D and 3D visualization modes
 *
 * FEATURES:
 * - Conditional rendering based on viewMode
 * - Lazy loading of 3D components for better initial load performance
 * - Preserves node selection across mode switches
 * - Smooth transitions between modes
 * - Fallback loading states
 *
 * MODES:
 * - 2D: Traditional PIXI.js visualization (GraphVisualization.tsx)
 * - 3D: react-force-graph-3d with Camelot positioning (Graph3D.tsx)
 * - 3D Helix: Pure Three.js Camelot helix (CamelotHelix3D.tsx)
 *
 * INTEGRATION:
 * Replace your existing GraphVisualization usage with this component
 * to enable 3D mode toggling
 */

// Lazy load 3D components for better performance
const Graph3D = lazy(() => import('./Graph3D'));
const CamelotHelix3D = lazy(() => import('./CamelotHelix3D'));

// Import 2D component directly (always needed)
// NOTE: You'll need to import your existing 2D graph component here
// For now, we'll create a placeholder
const Graph2DPlaceholder: React.FC<any> = ({ width, height }) => (
  <div
    style={{ width, height }}
    className="flex items-center justify-center bg-gray-900 rounded-lg"
  >
    <div className="text-white text-center">
      <div className="text-lg font-semibold mb-2">2D Graph Visualization</div>
      <div className="text-sm text-white/60">
        Replace this with your existing GraphVisualization component
      </div>
      <div className="text-xs text-white/40 mt-4">
        Import from: ./GraphVisualization.tsx
      </div>
    </div>
  </div>
);

interface GraphVisualizationWrapperProps {
  width?: number;
  height?: number;
  className?: string;
  showModeToggle?: boolean;
  defaultMode?: GraphViewMode;
}

export const GraphVisualizationWrapper: React.FC<GraphVisualizationWrapperProps> = ({
  width = 800,
  height = 600,
  className = '',
  showModeToggle = true,
  defaultMode = '2d',
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
          <Graph2DPlaceholder
            width={width}
            height={height}
          />
        );

      case '3d':
        return (
          <Suspense
            fallback={
              <div
                style={{ width, height }}
                className="flex items-center justify-center bg-gray-900 rounded-lg"
              >
                <div className="text-white flex items-center gap-2">
                  <Loader2 className="animate-spin" size={24} />
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
                className="flex items-center justify-center bg-gray-900 rounded-lg"
              >
                <div className="text-white flex items-center gap-2">
                  <Loader2 className="animate-spin" size={24} />
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
    <div className={`relative ${className}`}>
      {/* Mode Toggle */}
      {showModeToggle && (
        <div className="absolute top-4 left-4 z-10">
          <GraphModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            size="medium"
          />
        </div>
      )}

      {/* Mode Info Badge */}
      <div className="absolute top-4 right-4 z-10 bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-medium backdrop-blur-sm border border-white/10">
        {mode === '2d' && '2D View'}
        {mode === '3d' && '3D Force Graph'}
        {mode === '3d-helix' && 'Camelot Helix'}
      </div>

      {/* Graph Component */}
      {renderGraph()}

      {/* Performance Notice for 3D */}
      {(mode === '3d' || mode === '3d-helix') && (
        <div className="absolute bottom-4 right-4 z-10 bg-yellow-900/70 text-yellow-100 px-3 py-2 rounded-lg text-xs backdrop-blur-sm border border-yellow-500/30 max-w-xs">
          <div className="font-semibold mb-1">Performance Note</div>
          <div>3D rendering is GPU-intensive. For large graphs (&gt;1000 nodes), 2D mode is recommended.</div>
        </div>
      )}
    </div>
  );
};

export default GraphVisualizationWrapper;
