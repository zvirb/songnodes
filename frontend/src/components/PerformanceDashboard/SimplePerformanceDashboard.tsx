/**
 * Simple Performance Dashboard Component
 * Stable and crash-resistant performance monitoring without external dependencies
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '../../store';

interface SimplePerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  compact?: boolean;
}

interface BasicMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

export const SimplePerformanceDashboard: React.FC<SimplePerformanceDashboardProps> = ({
  isOpen,
  onClose,
  compact = false
}) => {
  const [metrics, setMetrics] = useState<BasicMetrics>({
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    nodeCount: 0,
    edgeCount: 0,
    status: 'unknown'
  });

  // Redux state
  const performanceState = useAppSelector(state => state.performance);
  const { nodes, edges } = useAppSelector(state => state.graph);

  // Update metrics safely
  const updateMetrics = useCallback(() => {
    try {
      const currentMetrics = performanceState?.metrics;
      if (!currentMetrics) return;

      const memoryMB = currentMetrics.memoryUsage?.heap
        ? Math.round(currentMetrics.memoryUsage.heap / 1024 / 1024)
        : 0;

      const fps = currentMetrics.fps || 0;
      let status: BasicMetrics['status'] = 'unknown';

      if (fps >= 55) status = 'excellent';
      else if (fps >= 40) status = 'good';
      else if (fps >= 25) status = 'fair';
      else if (fps > 0) status = 'poor';

      setMetrics({
        fps: Math.round(fps),
        frameTime: Math.round((currentMetrics.frameTime || 16.67) * 100) / 100,
        memoryUsage: memoryMB,
        nodeCount: nodes?.length || 0,
        edgeCount: edges?.length || 0,
        status
      });
    } catch (error) {
      console.warn('Failed to update dashboard metrics:', error);
    }
  }, [performanceState, nodes, edges]);

  // Update metrics periodically
  useEffect(() => {
    if (!isOpen) return;

    updateMetrics(); // Initial update
    const interval = setInterval(updateMetrics, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [isOpen, updateMetrics]);

  if (!isOpen) return null;

  const getStatusColor = (status: BasicMetrics['status']) => {
    switch (status) {
      case 'excellent': return '#22c55e';
      case 'good': return '#84cc16';
      case 'fair': return '#eab308';
      case 'poor': return '#f97316';
      default: return '#6b7280';
    }
  };

  const getStatusEmoji = (status: BasicMetrics['status']) => {
    switch (status) {
      case 'excellent': return '🚀';
      case 'good': return '✅';
      case 'fair': return '⚠️';
      case 'poor': return '🐌';
      default: return '❓';
    }
  };

  if (compact) {
    return (
      <div style={{
        position: 'fixed',
        top: 10,
        left: 10,
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 2000,
        minWidth: '200px',
        border: `2px solid ${getStatusColor(metrics.status)}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>
            {getStatusEmoji(metrics.status)} Performance
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
          <div>FPS: <strong>{metrics.fps}</strong></div>
          <div>Frame: <strong>{metrics.frameTime}ms</strong></div>
          <div>Memory: <strong>{metrics.memoryUsage}MB</strong></div>
          <div>Status: <strong style={{ color: getStatusColor(metrics.status) }}>{metrics.status}</strong></div>
          <div>Nodes: <strong>{metrics.nodeCount}</strong></div>
          <div>Edges: <strong>{metrics.edgeCount}</strong></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20%',
      left: '20%',
      width: '60%',
      maxHeight: '60%',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
      zIndex: 3000,
      overflow: 'hidden',
      borderTop: `4px solid ${getStatusColor(metrics.status)}`
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f9fafb'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {getStatusEmoji(metrics.status)} Performance Dashboard
        </h2>
        <button
          onClick={onClose}
          style={{
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Close
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {/* Status Overview */}
        <div style={{
          background: getStatusColor(metrics.status) + '10',
          border: `1px solid ${getStatusColor(metrics.status)}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'center' as const
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: getStatusColor(metrics.status),
            marginBottom: '8px'
          }}>
            {getStatusEmoji(metrics.status)} {metrics.status.toUpperCase()}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            System is running {metrics.status}ly
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
              {metrics.fps}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>FPS</div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#9ca3af' }}>
              {metrics.fps >= 60 ? 'Excellent' : metrics.fps >= 30 ? 'Good' : 'Poor'}
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
              {metrics.frameTime}ms
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Frame Time</div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#9ca3af' }}>
              {metrics.frameTime <= 16 ? 'Optimal' : metrics.frameTime <= 33 ? 'Good' : 'Slow'}
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
              {metrics.memoryUsage}MB
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Memory Usage</div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#9ca3af' }}>
              {metrics.memoryUsage < 200 ? 'Low' : metrics.memoryUsage < 500 ? 'Moderate' : 'High'}
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
              {metrics.nodeCount}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Nodes</div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#9ca3af' }}>
              {metrics.edgeCount} edges
            </div>
          </div>
        </div>

        {/* Performance Tips */}
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#0369a1' }}>
            💡 Performance Tips
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#0369a1' }}>
            {metrics.fps < 30 && (
              <li>Reduce the number of visible nodes/edges for better FPS</li>
            )}
            {metrics.memoryUsage > 300 && (
              <li>High memory usage detected - consider clearing unused data</li>
            )}
            {metrics.nodeCount > 1000 && (
              <li>Large graph detected - enable Level-of-Detail (LOD) rendering</li>
            )}
            {metrics.status === 'excellent' && (
              <li>Performance is excellent! All systems running smoothly.</li>
            )}
            {metrics.status === 'unknown' && (
              <li>Enable performance monitoring to get detailed metrics</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SimplePerformanceDashboard;