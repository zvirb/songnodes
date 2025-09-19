import React from 'react';
import { useAppSelector } from '../../store/index';

interface DataDebugCanvasProps {
  width: number;
  height: number;
  className?: string;
}

/**
 * Debug component to verify actual Redux data
 */
export const DataDebugCanvas: React.FC<DataDebugCanvasProps> = ({
  width,
  height,
  className,
}) => {
  // Get ACTUAL data from Redux store
  const { nodes, edges } = useAppSelector(state => state.graph);

  // Group nodes by type
  const nodesByType = nodes.reduce((acc, node) => {
    const type = node.type || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(node);
    return acc;
  }, {} as Record<string, typeof nodes>);

  // Get sample edges with their connections
  const sampleEdges = edges.slice(0, 5).map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    return {
      ...edge,
      sourceName: sourceNode?.label || sourceNode?.title || edge.source,
      targetName: targetNode?.label || targetNode?.title || edge.target
    };
  });

  return (
    <div
      className={className || "absolute inset-0"}
      style={{
        width: Math.min(width || 800, 1400),
        height: Math.min(height || 600, 900),
        backgroundColor: '#0a0a0a',
        overflow: 'auto',
        padding: '20px'
      }}
    >
      <div className="text-white">
        <h1 className="text-2xl font-bold mb-4 text-center text-yellow-400">
          📊 Redux Data Debug View
        </h1>

        {/* Data Summary */}
        <div className="mb-6 p-4 bg-gray-900 rounded">
          <h2 className="text-lg font-bold mb-2 text-green-400">Data Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400">Total Nodes:</span>
              <span className="ml-2 font-bold text-xl">{nodes.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Total Edges:</span>
              <span className="ml-2 font-bold text-xl">{edges.length}</span>
            </div>
          </div>
        </div>

        {/* Nodes by Type */}
        <div className="mb-6 p-4 bg-gray-900 rounded">
          <h2 className="text-lg font-bold mb-2 text-blue-400">Nodes by Type</h2>
          <div className="space-y-2">
            {Object.entries(nodesByType).map(([type, typeNodes]) => (
              <div key={type} className="border-l-4 border-blue-500 pl-3">
                <div className="font-bold text-yellow-300">
                  {type} ({typeNodes.length})
                </div>
                <div className="text-sm text-gray-300">
                  {typeNodes.slice(0, 3).map(node => (
                    <div key={node.id} className="ml-4">
                      • {node.label || node.title || node.id}
                    </div>
                  ))}
                  {typeNodes.length > 3 && (
                    <div className="ml-4 text-gray-500">
                      ... and {typeNodes.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sample Edges */}
        <div className="mb-6 p-4 bg-gray-900 rounded">
          <h2 className="text-lg font-bold mb-2 text-purple-400">Sample Connections</h2>
          <div className="space-y-1 text-sm">
            {sampleEdges.map((edge, i) => (
              <div key={i} className="text-gray-300">
                {edge.sourceName}
                <span className="mx-2 text-purple-400">→</span>
                {edge.targetName}
                <span className="ml-2 text-gray-500">({edge.type || 'connected'})</span>
              </div>
            ))}
            {edges.length > 5 && (
              <div className="text-gray-500">... and {edges.length - 5} more edges</div>
            )}
          </div>
        </div>

        {/* Data Status */}
        <div className="p-4 bg-gray-900 rounded">
          <h2 className="text-lg font-bold mb-2 text-orange-400">Data Status</h2>
          <div className="space-y-1 text-sm">
            <div className={nodes.length > 0 ? 'text-green-400' : 'text-red-400'}>
              ✓ Nodes loaded: {nodes.length > 0 ? 'YES' : 'NO'}
            </div>
            <div className={edges.length > 0 ? 'text-green-400' : 'text-red-400'}>
              ✓ Edges loaded: {edges.length > 0 ? 'YES' : 'NO'}
            </div>
            <div className="text-gray-400 mt-2">
              Data source: /live-performance-data.json
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataDebugCanvas;