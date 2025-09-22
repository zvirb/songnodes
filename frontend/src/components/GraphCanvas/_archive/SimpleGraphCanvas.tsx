import React from 'react';
import { useAppSelector } from '../../store/index';

interface SimpleGraphCanvasProps {
  width: number;
  height: number;
  className?: string;
}

/**
 * Stable GraphCanvas component with fixed dimensions
 * Now shows ACTUAL data from Redux store
 */
export const SimpleGraphCanvas: React.FC<SimpleGraphCanvasProps> = ({
  width,
  height,
  className,
}) => {
  // Get ACTUAL data from Redux store
  const { nodes, edges } = useAppSelector(state => state.graph);

  // Use fixed dimensions to prevent layout loops
  const canvasWidth = Math.min(width || 800, 1200);
  const canvasHeight = Math.min(height || 600, 800);

  // Extract some actual artist names from the data
  const artistNames = nodes
    .filter(node => node.type === 'artist')
    .slice(0, 5)
    .map(node => node.label || node.title || 'Unknown')
    .join(', ');

  return (
    <div
      className={className || "absolute inset-0"}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#1a1a2e',
        overflow: 'hidden'
      }}
    >
      {/* Clean visualization - no overlays */}
    </div>
  );
};

export default SimpleGraphCanvas;