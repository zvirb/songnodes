/**
 * GPU Test Page - Standalone validation of GPU optimization
 * This page bypasses complex app state to directly test GPU improvements
 */

import React, { useState } from 'react';
import { SimpleGPUCanvas } from './components/GraphCanvas/SimpleGPUCanvas';

export const GPUTestPage: React.FC = () => {
  const [nodeCount, setNodeCount] = useState(1000);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const presets = [
    { name: 'Small', nodeCount: 500, desc: 'Light GPU load' },
    { name: 'Medium', nodeCount: 1000, desc: 'Moderate GPU stress test' },
    { name: 'Large', nodeCount: 1500, desc: 'Heavy GPU utilization' },
    { name: 'Extreme', nodeCount: 2500, desc: 'Maximum GPU stress' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          SongNodes GPU Optimization Test
        </h1>
        <p className="text-gray-600">
          Validates GPU utilization improvement from 31% to &gt;50% for ML readiness
        </p>
      </div>

      {/* Controls */}
      <div className="max-w-6xl mx-auto mb-6 bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dataset Size Controls */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Dataset Size</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setNodeCount(preset.nodeCount)}
                  className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                    nodeCount === preset.nodeCount
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <div>{preset.name}</div>
                  <div className="text-xs opacity-75">{preset.desc}</div>
                </button>
              ))}
            </div>
            
            {/* Custom node count */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Custom:</label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={nodeCount}
                onChange={(e) => setNodeCount(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-16">{nodeCount}</span>
            </div>
          </div>

          {/* Canvas Size Controls */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Canvas Size</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setDimensions({ width: 600, height: 400 })}
                className={`p-2 rounded text-sm ${
                  dimensions.width === 600
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Small (600×400)
              </button>
              <button
                onClick={() => setDimensions({ width: 800, height: 600 })}
                className={`p-2 rounded text-sm ${
                  dimensions.width === 800
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Medium (800×600)
              </button>
              <button
                onClick={() => setDimensions({ width: 1200, height: 800 })}
                className={`p-2 rounded text-sm ${
                  dimensions.width === 1200
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Large (1200×800)
              </button>
              <button
                onClick={() => setDimensions({ width: 1600, height: 1000 })}
                className={`p-2 rounded text-sm ${
                  dimensions.width === 1600
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                XL (1600×1000)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GPU-Optimized Canvas */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-center">
            <SimpleGPUCanvas
              width={dimensions.width}
              height={dimensions.height}
              nodeCount={nodeCount}
            />
          </div>
        </div>
      </div>

      {/* Expected Results */}
      <div className="max-w-6xl mx-auto mt-6 bg-green-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          Expected GPU Optimization Results
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded p-4">
            <div className="font-semibold text-green-700 mb-1">GPU Utilization</div>
            <div className="text-gray-600">31% → 50-65%</div>
            <div className="text-xs text-gray-500 mt-1">Target: &gt;50% for ML readiness</div>
          </div>
          <div className="bg-white rounded p-4">
            <div className="font-semibold text-green-700 mb-1">Performance</div>
            <div className="text-gray-600">40-50% improvement</div>
            <div className="text-xs text-gray-500 mt-1">Stable 60 FPS with large datasets</div>
          </div>
          <div className="bg-white rounded p-4">
            <div className="font-semibold text-green-700 mb-1">ML Readiness</div>
            <div className="text-gray-600">Score: 30 → 80+</div>
            <div className="text-xs text-gray-500 mt-1">GPU-accelerated computation ready</div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-6xl mx-auto mt-6 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">Test Instructions</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p>1. <strong>Observe GPU Metrics:</strong> Check the performance overlay in the top-right corner</p>
          <p>2. <strong>Test Different Loads:</strong> Use the preset buttons to stress test GPU optimization</p>
          <p>3. <strong>WebGL Context:</strong> Verify WebGL2 is active for best performance</p>
          <p>4. <strong>FPS Monitoring:</strong> Should maintain 45+ FPS even with 1500+ nodes</p>
          <p>5. <strong>GPU Resources:</strong> Watch texture pool and shader cache utilization</p>
        </div>
      </div>
    </div>
  );
};