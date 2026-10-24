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

  const getFPSColor = (fps: number) => {
    if (fps >= 50) return 'text-[var(--color-success,#00ff41)]';
    if (fps >= 30) return 'text-[var(--color-warning,#D68910)]';
    return 'text-[var(--color-error,#ff4444)]';
  };

  return (
    <div className={clsx('bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)] p-3 text-xs font-mono', className)}>
      <div className="font-semibold text-[var(--color-text-tertiary)] mb-1 uppercase tracking-wider text-[10px]">Telemetry</div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-text-tertiary)]">FPS:</span>
          <span className={clsx('font-bold', getFPSColor(fps))}>{fps}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-text-tertiary)]">Nodes:</span>
          <span className="text-[var(--color-text-primary)]">{metrics.nodeCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--color-text-tertiary)]">Edges:</span>
          <span className="text-[var(--color-text-primary)]">{metrics.edgeCount}</span>
        </div>
        {metrics.renderTime > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[var(--color-text-tertiary)]">Render:</span>
            <span className="text-[var(--color-text-secondary)]">{metrics.renderTime.toFixed(1)}ms</span>
          </div>
        )}
        {metrics.memoryUsage && (
          <div className="flex justify-between items-center">
            <span className="text-[var(--color-text-tertiary)]">Memory:</span>
            <span className="text-[var(--color-text-secondary)]">{metrics.memoryUsage}%</span>
          </div>
        )}
      </div>
    </div>
  );
};