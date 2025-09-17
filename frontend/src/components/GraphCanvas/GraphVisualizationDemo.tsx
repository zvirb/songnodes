/**
 * GraphVisualizationDemo - Demonstration of the enhanced GraphCanvas component
 * Shows how to use the new graph visualization with all features
 */

import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '../../store';
import { GraphCanvas } from './SimpleGPUCanvas';
import { NodeVisual, EdgeVisual } from '../../types/graph';

// Sample graph data for demonstration
const generateSampleData = (nodeCount: number = 100) => {
  const nodes: NodeVisual[] = [];
  const edges: EdgeVisual[] = [];

  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      trackId: `track-${i}`,
      title: `Track ${i}`,
      artist: `Artist ${Math.floor(i / 10)}`,
      album: `Album ${Math.floor(i / 20)}`,
      genres: ['electronic', 'house', 'techno'][i % 3],
      x: Math.random() * 800,
      y: Math.random() * 600,
      radius: 5 + Math.random() * 10,
      color: ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'][i % 5],
      opacity: 0.8,
      selected: false,
      highlighted: false,
      visible: true,
      position: { x: Math.random() * 800, y: Math.random() * 600 },
      metrics: {
        centrality: Math.random(),
        clustering: Math.random(),
        pageRank: Math.random(),
        degree: Math.floor(Math.random() * 10)
      }
    });
  }

  // Generate edges (connect nodes randomly)
  for (let i = 0; i < Math.min(nodeCount * 2, 200); i++) {
    const sourceIndex = Math.floor(Math.random() * nodes.length);
    const targetIndex = Math.floor(Math.random() * nodes.length);

    if (sourceIndex !== targetIndex) {
      const sourceNode = nodes[sourceIndex];
      const targetNode = nodes[targetIndex];

      edges.push({
        id: `edge-${i}`,
        source: sourceNode.id,
        target: targetNode.id,
        source_id: sourceNode.id,
        target_id: targetNode.id,
        sourceNode,
        targetNode,
        weight: Math.random(),
        confidence: Math.random(),
        visible: true,
        opacity: 0.6,
        width: 1 + Math.random() * 3,
        color: '#94A3B8'
      });
    }
  }

  return { nodes, edges };
};

export const GraphVisualizationDemo: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'quality' | 'performance' | 'balanced'>('balanced');
  const [enableRealTime, setEnableRealTime] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const handleNodeClick = (node: NodeVisual) => {
    console.log('Node clicked:', node);
    setSelectedNodeId(node.id);
  };

  const handleNodeHover = (node: NodeVisual | null) => {
    console.log('Node hovered:', node?.title || 'none');
  };

  return (
    <Provider store={store}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Enhanced Graph Visualization Demo
            </h1>
            <p className="text-gray-600">
              Interactive D3.js force-directed graph with WebGL rendering, real-time updates, and performance optimizations.
            </p>
          </div>

          {/* Controls */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Performance Mode */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Performance Mode</h3>
              <select
                value={performanceMode}
                onChange={(e) => setPerformanceMode(e.target.value as any)}
                className="w-full p-2 border rounded"
              >
                <option value="balanced">Balanced</option>
                <option value="performance">Performance</option>
                <option value="quality">Quality</option>
              </select>
            </div>

            {/* Real-time Updates */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Real-time Updates</h3>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={enableRealTime}
                  onChange={(e) => setEnableRealTime(e.target.checked)}
                  className="mr-2"
                />
                Enable WebSocket updates
              </label>
            </div>

            {/* Canvas Size */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Canvas Size</h3>
              <select
                value={`${dimensions.width}x${dimensions.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  setDimensions({ width, height });
                }}
                className="w-full p-2 border rounded"
              >
                <option value="600x400">Small (600×400)</option>
                <option value="800x600">Medium (800×600)</option>
                <option value="1200x800">Large (1200×800)</option>
              </select>
            </div>
          </div>

          {/* Selected Node Info */}
          {selectedNodeId && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Selected Node</h3>
              <p className="text-blue-700">Node ID: {selectedNodeId}</p>
              <p className="text-sm text-blue-600">
                Click on nodes to select them, drag to move, scroll to zoom, drag empty space to pan.
              </p>
            </div>
          )}

          {/* Graph Visualization */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-center">
              <GraphCanvas
                width={dimensions.width}
                height={dimensions.height}
                enableInteraction={true}
                enableRealTimeUpdates={enableRealTime}
                performanceMode={performanceMode}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
              />
            </div>
          </div>

          {/* Features List */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">✨ Features Implemented</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✅ D3.js force-directed graph simulation</li>
                <li>✅ WebGL rendering with PIXI.js</li>
                <li>✅ Interactive zoom, pan, and node dragging</li>
                <li>✅ Hover tooltips and click handlers</li>
                <li>✅ Redux state management integration</li>
                <li>✅ Real-time WebSocket updates</li>
                <li>✅ Performance optimizations (LOD, culling)</li>
                <li>✅ Responsive design for mobile</li>
                <li>✅ GPU optimization for 1000+ nodes</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">🎮 How to Interact</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><strong>Zoom:</strong> Mouse wheel or pinch on mobile</li>
                <li><strong>Pan:</strong> Drag empty space</li>
                <li><strong>Select Node:</strong> Click on a node</li>
                <li><strong>Multi-select:</strong> Ctrl/Cmd + click</li>
                <li><strong>Drag Node:</strong> Click and drag a node</li>
                <li><strong>Hover Info:</strong> Hover over nodes for details</li>
                <li><strong>Fit View:</strong> Use the "Fit to View" button</li>
                <li><strong>Reset:</strong> Use the "Reset" button</li>
              </ul>
            </div>
          </div>

          {/* Technical Info */}
          <div className="mt-6 bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">🔧 Technical Implementation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Performance Optimizations</h4>
                <ul className="space-y-1">
                  <li>• Level of Detail (LOD) system based on zoom</li>
                  <li>• Viewport culling for off-screen elements</li>
                  <li>• GPU-accelerated rendering with WebGL</li>
                  <li>• Batched edge rendering for better performance</li>
                  <li>• Adaptive node sizing based on zoom level</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Technology Stack</h4>
                <ul className="space-y-1">
                  <li>• React + TypeScript for component logic</li>
                  <li>• D3.js for force simulation physics</li>
                  <li>• PIXI.js for WebGL rendering</li>
                  <li>• Redux Toolkit for state management</li>
                  <li>• WebSocket for real-time updates</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Provider>
  );
};

export default GraphVisualizationDemo;