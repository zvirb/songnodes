import React from 'react';
import { Box, Layers, Boxes } from 'lucide-react';
import useStore from '../store/useStore';

/**
 * GraphModeToggle Component
 *
 * Toggle between 2D and 3D graph visualization modes
 *
 * FEATURES:
 * - Smooth mode switching
 * - Visual indication of active mode
 * - Preserves camera position across modes
 * - Maintains node selection state
 * - Keyboard shortcut support (Ctrl+Shift+3)
 *
 * MODES:
 * - 2D: Traditional PIXI.js force-directed graph (default)
 * - 3D: React-force-graph-3d with cylindrical Camelot positioning
 * - 3D Helix: Pure Three.js Camelot helix visualization
 */

export type GraphViewMode = '2d' | '3d' | '3d-helix';

interface GraphModeToggleProps {
  mode: GraphViewMode;
  onModeChange: (mode: GraphViewMode) => void;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export const GraphModeToggle: React.FC<GraphModeToggleProps> = ({
  mode,
  onModeChange,
  className = '',
  size = 'medium',
}) => {
  // Size variants
  const sizeClasses = {
    small: 'p-1.5 text-xs',
    medium: 'p-2 text-sm',
    large: 'p-3 text-base',
  };

  const iconSizes = {
    small: 16,
    medium: 20,
    large: 24,
  };

  const iconSize = iconSizes[size];
  const buttonClass = sizeClasses[size];

  return (
    <div className={`inline-flex rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 ${className}`}>
      {/* 2D Mode */}
      <button
        onClick={() => onModeChange('2d')}
        className={`
          ${buttonClass}
          flex items-center gap-2 rounded-l-lg transition-all duration-200
          ${mode === '2d'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
        title="2D Graph View (PIXI.js)"
      >
        <Layers size={iconSize} />
        <span className="font-medium">2D</span>
      </button>

      {/* 3D Mode */}
      <button
        onClick={() => onModeChange('3d')}
        className={`
          ${buttonClass}
          flex items-center gap-2 border-x border-white/10 transition-all duration-200
          ${mode === '3d'
            ? 'bg-purple-600 text-white shadow-lg'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
        title="3D Force Graph (react-force-graph-3d)"
      >
        <Box size={iconSize} />
        <span className="font-medium">3D</span>
      </button>

      {/* 3D Helix Mode */}
      <button
        onClick={() => onModeChange('3d-helix')}
        className={`
          ${buttonClass}
          flex items-center gap-2 rounded-r-lg transition-all duration-200
          ${mode === '3d-helix'
            ? 'bg-green-600 text-white shadow-lg'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
        title="3D Camelot Helix (Three.js)"
      >
        <Boxes size={iconSize} />
        <span className="font-medium">Helix</span>
      </button>
    </div>
  );
};

/**
 * Hook for managing graph view mode with keyboard shortcuts
 */
export const useGraphMode = () => {
  const viewState = useStore(state => state.viewState);
  const updateViewSettings = useStore(state => state.updateViewSettings);

  // Get current mode from store (extend ViewState to include viewMode)
  const mode: GraphViewMode = (viewState as any).viewMode || '2d';

  const setMode = React.useCallback((newMode: GraphViewMode) => {
    updateViewSettings({ ...(viewState as any), viewMode: newMode });
  }, [updateViewSettings, viewState]);

  // Keyboard shortcut: Ctrl+Shift+3 to toggle 3D
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === '3') {
        event.preventDefault();
        setMode(mode === '2d' ? '3d' : '2d');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, setMode]);

  return { mode, setMode };
};

/**
 * Compact toggle button variant (icon only)
 */
export const GraphModeToggleCompact: React.FC<{
  mode: GraphViewMode;
  onModeChange: (mode: GraphViewMode) => void;
  className?: string;
}> = ({ mode, onModeChange, className = '' }) => {
  return (
    <div className={`inline-flex rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 ${className}`}>
      <button
        onClick={() => onModeChange('2d')}
        className={`
          p-2 rounded-l-lg transition-all duration-200
          ${mode === '2d'
            ? 'bg-blue-600 text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
        title="2D View"
      >
        <Layers size={18} />
      </button>

      <button
        onClick={() => onModeChange('3d')}
        className={`
          p-2 border-x border-white/10 transition-all duration-200
          ${mode === '3d'
            ? 'bg-purple-600 text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
        title="3D View"
      >
        <Box size={18} />
      </button>

      <button
        onClick={() => onModeChange('3d-helix')}
        className={`
          p-2 rounded-r-lg transition-all duration-200
          ${mode === '3d-helix'
            ? 'bg-green-600 text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
        title="Helix View"
      >
        <Boxes size={18} />
      </button>
    </div>
  );
};

export default GraphModeToggle;
