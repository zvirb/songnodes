import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import clsx from 'clsx';

interface PerformanceMonitorProps {
  className?: string;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ className }) => {
  const { metrics, updateMetrics } = useStore();
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let animationId: number | null = null;
    let isActive = true; // Track if effect is still active

    const measureFPS = () => {
      if (!isActive) return; // Stop if unmounted

      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        setFps(Math.round(frames * 1000 / (currentTime - lastTime)));
        updateMetrics({ fps: Math.round(frames * 1000 / (currentTime - lastTime)) });
        frames = 0;
        lastTime = currentTime;
      }

      animationId = requestAnimationFrame(measureFPS); // Track each frame ID
    };

    animationId = requestAnimationFrame(measureFPS);

    return () => {
      isActive = false; // Signal to stop
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [updateMetrics]);

  const getFPSColorStyle = (fps: number) => {
    if (fps >= 50) return { color: 'var(--color-success)' };
    if (fps >= 30) return { color: 'var(--color-warning)' };
    return { color: 'var(--color-error)' };
  };

  return (
    <div
      className={clsx('backdrop-blur rounded p-3 text-xs font-mono', className)}
      style={{
        backgroundColor: 'var(--color-panel-bg)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-panel)',
        color: 'var(--color-text-primary)'
      }}
    >
      <div
        className="font-semibold mb-1 font-sans"
        style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}
      >
        Performance
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-disabled)' }}>FPS:</span>
          <span style={getFPSColorStyle(fps)} className="font-bold">{fps}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-disabled)' }}>Nodes:</span>
          <span style={{ color: 'var(--color-text-primary)' }}>{metrics.nodeCount}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-disabled)' }}>Edges:</span>
          <span style={{ color: 'var(--color-brand-primary)' }}>{metrics.edgeCount}</span>
        </div>
        {metrics.renderTime > 0 && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-disabled)' }}>Render:</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{metrics.renderTime.toFixed(1)}ms</span>
          </div>
        )}
        {metrics.memoryUsage && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-disabled)' }}>Memory:</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{metrics.memoryUsage}%</span>
          </div>
        )}
      </div>
    </div>
  );
};