import React from 'react';
import { Box, Layers, Boxes } from 'lucide-react';
import useStore from '../store/useStore';

/**
 * GraphModeToggle Component
 *
 * Toggle between 2D and 3D graph visualization modes.
 * Enforces Design System Segmented Button Control Specifications.
 *
 * FEATURES:
 * - Smooth mode switching with segmented button control styling
 * - Design system tokens for elevations, borders, active states, and hover
 * - Full accessibility with role="group", aria-label, and aria-pressed
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
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1.5 text-sm',
    large: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    small: 14,
    medium: 18,
    large: 22,
  };

  const iconSize = iconSizes[size];
  const buttonClass = sizeClasses[size];

  return (
    <div
      role="group"
      aria-label="Graph Visualization View Mode"
      className={`inline-flex p-1 gap-1 items-center rounded-[var(--radius-button,0.375rem)] bg-[var(--color-bg-elevated-1,#1a1a1a)] border border-[var(--color-border-subtle,#333333)] backdrop-blur-md shadow-md ${className}`}
    >
      {/* 2D Mode */}
      <button
        type="button"
        onClick={() => onModeChange('2d')}
        aria-label="Switch to 2D Graph View"
        aria-pressed={mode === '2d'}
        className={`
          ${buttonClass}
          flex items-center gap-2 rounded-[calc(var(--radius-button,0.375rem)-2px)] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]
          ${mode === '2d'
            ? 'bg-[var(--color-brand-primary,#00ff41)] text-[var(--color-text-inverse,#0a0a0a)] font-semibold shadow-sm'
            : 'text-[var(--color-text-tertiary,#b0b0b0)] hover:text-[var(--color-text-primary,#ffffff)] hover:bg-[var(--color-bg-elevated-3,#3a3a3a)]'
          }
        `}
        title="2D Graph View (PIXI.js)"
      >
        <Layers size={iconSize} />
        <span>2D</span>
      </button>

      {/* 3D Mode */}
      <button
        type="button"
        onClick={() => onModeChange('3d')}
        aria-label="Switch to 3D Force Graph View"
        aria-pressed={mode === '3d'}
        className={`
          ${buttonClass}
          flex items-center gap-2 rounded-[calc(var(--radius-button,0.375rem)-2px)] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]
          ${mode === '3d'
            ? 'bg-[var(--color-brand-primary,#00ff41)] text-[var(--color-text-inverse,#0a0a0a)] font-semibold shadow-sm'
            : 'text-[var(--color-text-tertiary,#b0b0b0)] hover:text-[var(--color-text-primary,#ffffff)] hover:bg-[var(--color-bg-elevated-3,#3a3a3a)]'
          }
        `}
        title="3D Force Graph (react-force-graph-3d)"
      >
        <Box size={iconSize} />
        <span>3D</span>
      </button>

      {/* 3D Helix Mode */}
      <button
        type="button"
        onClick={() => onModeChange('3d-helix')}
        aria-label="Switch to 3D Camelot Helix View"
        aria-pressed={mode === '3d-helix'}
        className={`
          ${buttonClass}
          flex items-center gap-2 rounded-[calc(var(--radius-button,0.375rem)-2px)] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]
          ${mode === '3d-helix'
            ? 'bg-[var(--color-brand-primary,#00ff41)] text-[var(--color-text-inverse,#0a0a0a)] font-semibold shadow-sm'
            : 'text-[var(--color-text-tertiary,#b0b0b0)] hover:text-[var(--color-text-primary,#ffffff)] hover:bg-[var(--color-bg-elevated-3,#3a3a3a)]'
          }
        `}
        title="3D Camelot Helix (Three.js)"
      >
        <Boxes size={iconSize} />
        <span>Helix</span>
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
    <div
      role="group"
      aria-label="Graph View Mode Switcher"
      className={`inline-flex p-1 gap-1 items-center rounded-[var(--radius-button,0.375rem)] bg-[var(--color-bg-elevated-1,#1a1a1a)] border border-[var(--color-border-subtle,#333333)] backdrop-blur-md shadow-md ${className}`}
    >
      <button
        type="button"
        onClick={() => onModeChange('2d')}
        aria-label="2D View"
        aria-pressed={mode === '2d'}
        className={`
          p-2 rounded-[calc(var(--radius-button,0.375rem)-2px)] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]
          ${mode === '2d'
            ? 'bg-[var(--color-brand-primary,#00ff41)] text-[var(--color-text-inverse,#0a0a0a)] font-semibold shadow-sm'
            : 'text-[var(--color-text-tertiary,#b0b0b0)] hover:text-[var(--color-text-primary,#ffffff)] hover:bg-[var(--color-bg-elevated-3,#3a3a3a)]'
          }
        `}
        title="2D View"
      >
        <Layers size={18} />
      </button>

      <button
        type="button"
        onClick={() => onModeChange('3d')}
        aria-label="3D View"
        aria-pressed={mode === '3d'}
        className={`
          p-2 rounded-[calc(var(--radius-button,0.375rem)-2px)] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]
          ${mode === '3d'
            ? 'bg-[var(--color-brand-primary,#00ff41)] text-[var(--color-text-inverse,#0a0a0a)] font-semibold shadow-sm'
            : 'text-[var(--color-text-tertiary,#b0b0b0)] hover:text-[var(--color-text-primary,#ffffff)] hover:bg-[var(--color-bg-elevated-3,#3a3a3a)]'
          }
        `}
        title="3D View"
      >
        <Box size={18} />
      </button>

      <button
        type="button"
        onClick={() => onModeChange('3d-helix')}
        aria-label="Helix View"
        aria-pressed={mode === '3d-helix'}
        className={`
          p-2 rounded-[calc(var(--radius-button,0.375rem)-2px)] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]
          ${mode === '3d-helix'
            ? 'bg-[var(--color-brand-primary,#00ff41)] text-[var(--color-text-inverse,#0a0a0a)] font-semibold shadow-sm'
            : 'text-[var(--color-text-tertiary,#b0b0b0)] hover:text-[var(--color-text-primary,#ffffff)] hover:bg-[var(--color-bg-elevated-3,#3a3a3a)]'
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
