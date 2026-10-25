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
    if (fps >= 50) return 'var(--status-ok)';
    if (fps >= 30) return 'var(--status-warn)';
    return 'var(--status-bad)';
  };

  return (
    <div
      className={clsx(className)}
      style={{
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-control)',
        padding: 'var(--space-3)',
        fontSize: '0.75rem',
        color: 'var(--fg-2)'
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--fg-3)', marginBottom: 'var(--space-1)' }}>Performance</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-3)' }}>FPS:</span>
          <span style={{ color: getFPSColor(fps), fontWeight: 600 }}>{fps}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-3)' }}>Nodes:</span>
          <span style={{ color: 'var(--fg)', fontFamily: 'var(--font-data)' }}>{metrics.nodeCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--fg-3)' }}>Edges:</span>
          <span style={{ color: 'var(--fg)', fontFamily: 'var(--font-data)' }}>{metrics.edgeCount}</span>
        </div>
        {metrics.renderTime > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--fg-3)' }}>Render:</span>
            <span style={{ color: 'var(--fg)', fontFamily: 'var(--font-data)' }}>{metrics.renderTime.toFixed(1)}ms</span>
          </div>
        )}
        {metrics.memoryUsage && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--fg-3)' }}>Memory:</span>
            <span style={{ color: 'var(--fg)', fontFamily: 'var(--font-data)' }}>{metrics.memoryUsage}%</span>
          </div>
        )}
      </div>
    </div>
  );
};