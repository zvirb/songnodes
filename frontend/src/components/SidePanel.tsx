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
    <div className="w-full h-full bg-dj-dark border-r border-dj-gray flex flex-col">
      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'setlist' && <SetlistBuilder />}
        {activePanel === 'path' && <PathBuilder />}
        {activePanel === 'filters' && <FilterPanel />}
        {activePanel === 'search' && <TrackSearch />}
        {activePanel === 'graph' && <GraphInfo />}
      </div>
    </div>
  );
};

// Graph Information Panel
const GraphInfo: React.FC = () => {
  const { filteredNodes, filteredEdges, metrics } = useStore();

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-white mb-4">Graph Overview</h2>

      <div className="space-y-3">
        <div className="bg-dj-gray rounded p-3">
          <div className="text-gray-400 text-sm">Total Tracks</div>
          <div className="text-2xl font-bold text-white">{filteredNodes.length}</div>
        </div>

        <div className="bg-dj-gray rounded p-3">
          <div className="text-gray-400 text-sm">Connections</div>
          <div className="text-2xl font-bold text-white">{filteredEdges.length}</div>
        </div>

        <div className="bg-dj-gray rounded p-3">
          <div className="text-gray-400 text-sm">Performance</div>
          <div className="text-sm text-white">
            <div>FPS: {metrics.fps?.toFixed(0) || metrics.frameRate.toFixed(0)}</div>
            <div>Render: {metrics.renderTime.toFixed(1)}ms</div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Quick Stats</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Avg Connections:</span>
              <span className="text-white">
                {filteredNodes.length > 0
                  ? (filteredEdges.length * 2 / filteredNodes.length).toFixed(1)
                  : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Filtered:</span>
              <span className="text-white">
                {((1 - filteredNodes.length / Math.max(1, metrics.nodeCount)) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Navigation Tips</h3>
          <div className="space-y-1 text-xs text-gray-500">
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