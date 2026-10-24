import React from 'react';
import { useStore } from '@/store/useStore';
import SetlistBuilder from './SetlistBuilder';
import { PathBuilder } from './PathBuilder';
import { FilterPanel } from './FilterPanel';
import TrackSearch from './TrackSearch';

export const SidePanel: React.FC = () => {
  const { activePanel, sidebarOpen } = useStore();

  if (!sidebarOpen) return null;

  return (
    <aside
      className="w-full h-full flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        borderRight: '1px solid var(--color-border-subtle)',
        transition: 'var(--transition-panel)'
      }}
    >
      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'setlist' && <SetlistBuilder />}
        {activePanel === 'path' && <PathBuilder />}
        {activePanel === 'filters' && <FilterPanel />}
        {activePanel === 'search' && <TrackSearch />}
        {activePanel === 'graph' && <GraphInfo />}
      </div>
    </aside>
  );
};

// Graph Information Panel
const GraphInfo: React.FC = () => {
  const { filteredNodes, filteredEdges, metrics } = useStore();

  return (
    <div className="p-4" style={{ color: 'var(--color-text-primary)' }}>
      <h2
        className="text-lg font-bold mb-4"
        style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--letter-spacing-tight)' }}
      >
        Graph Overview
      </h2>

      <div className="space-y-3">
        <div
          className="rounded p-3"
          style={{
            backgroundColor: 'var(--color-bg-elevated-1)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-panel)'
          }}
        >
          <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Total Tracks</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
            {filteredNodes.length}
          </div>
        </div>

        <div
          className="rounded p-3"
          style={{
            backgroundColor: 'var(--color-bg-elevated-1)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-panel)'
          }}
        >
          <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Connections</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-brand-primary)' }}>
            {filteredEdges.length}
          </div>
        </div>

        <div
          className="rounded p-3"
          style={{
            backgroundColor: 'var(--color-bg-elevated-1)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-panel)'
          }}
        >
          <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Performance</div>
          <div className="text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>
            <div>FPS: {metrics.fps?.toFixed(0) || metrics.frameRate.toFixed(0)}</div>
            <div>Render: {metrics.renderTime.toFixed(1)}ms</div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Quick Stats
          </h3>
          <div className="space-y-1 text-sm font-mono">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-disabled)' }}>Avg Connections:</span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {filteredNodes.length > 0
                  ? (filteredEdges.length * 2 / filteredNodes.length).toFixed(1)
                  : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-disabled)' }}>Filtered:</span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {((1 - filteredNodes.length / Math.max(1, metrics.nodeCount)) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Navigation Tips
          </h3>
          <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            <div>• Click node to select</div>
            <div>• Scroll to zoom</div>
            <div>• Drag to pan</div>
            <div>• Right-click for options</div>
            <div>• Press / for quick search</div>
          </div>
        </div>
      </div>
    </div>
  );
};