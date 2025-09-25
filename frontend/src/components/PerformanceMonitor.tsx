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

    const measureFPS = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        setFps(Math.round(frames * 1000 / (currentTime - lastTime)));
        updateMetrics({ fps: Math.round(frames * 1000 / (currentTime - lastTime)) });
        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    const animationId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animationId);
  }, [updateMetrics]);

  const getFPSColor = (fps: number) => {
    if (fps >= 50) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className={clsx('bg-dj-dark/90 backdrop-blur rounded p-3 text-xs', className)}>
      <div className="font-semibold text-gray-400 mb-1">Performance</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">FPS:</span>
          <span className={getFPSColor(fps)}>{fps}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Nodes:</span>
          <span className="text-white">{metrics.nodeCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Edges:</span>
          <span className="text-white">{metrics.edgeCount}</span>
        </div>
        {metrics.renderTime > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Render:</span>
            <span className="text-white">{metrics.renderTime.toFixed(1)}ms</span>
          </div>
        )}
        {metrics.memoryUsage && (
          <div className="flex justify-between">
            <span className="text-gray-500">Memory:</span>
            <span className="text-white">{metrics.memoryUsage}%</span>
          </div>
        )}
      </div>
    </div>
  );
};