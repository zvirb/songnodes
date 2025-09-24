import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSelectedNodes } from '../../store/graphSlice';
import {
  setStartNode,
  setEndNode,
  addWaypoint,
  undoLastAction,
  setPlayedTracks,
  startPathCalculation,
} from '../../store/pathfindingSlice';
import { useAutoPathCalculation } from '../../hooks/useAutoPathCalculation';
import { useOptimizedForceLayout } from '../../hooks/useOptimizedForceLayout';
import { PixiCanvas } from './PixiCanvas';

interface WorkingD3CanvasProps {
  width: number;
  height: number;
  className?: string;
  distancePower?: number;
  relationshipPower?: number;
  nodeSize?: number;
  edgeLabelSize?: number;
  onNodeClick?: (nodeInfo: any) => void;
  onEdgeClick?: (edgeInfo: any) => void;
}

export const WorkingD3Canvas: React.FC<WorkingD3CanvasProps> = ({
  width,
  height,
  className,
  distancePower = 1,
  relationshipPower = 0,
  nodeSize = 12,
  edgeLabelSize = 12,
  onNodeClick,
  onEdgeClick
}) => {
  const dispatch = useAppDispatch();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; clickableNodes?: Array<{id: string, title: string}> } | null>(null);
  const [persistentTooltip, setPersistentTooltip] = useState<{ x: number; y: number; content: string; clickableNodes: Array<{id: string, title: string}>; nodeId: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [centeredNodeId, setCenteredNodeId] = useState<string | null>(null);
  const [edgeInfo, setEdgeInfo] = useState<{ nodeId: string; edges: any[] } | null>(null);
  const [playedSongs, setPlayedSongs] = useState<Set<string>>(new Set());

  // Get data from Redux store (with basic type handling)
  const { nodes, edges, selectedNodes } = useAppSelector(state => state.graph);
  const pathState = useAppSelector(state => state.pathfinding);

  const [layoutNodes, setLayoutNodes] = useState<any[]>([]);

  const layoutOptions = {
    forceDirected: {
      linkDistance: 100,
      linkStrength: 0.1,
      chargeStrength: -300,
      chargeTheta: 0.8,
      alpha: 1,
      alphaDecay: 0.0228,
      velocityDecay: 0.4,
      iterations: 300,
      centering: true,
      collisionRadius: 10,
    },
  };

  const { start, stop } = useOptimizedForceLayout({
    width,
    height,
    layoutOptions,
    onTick: (tickedNodes) => {
      console.log('📍 Force layout tick - layoutNodes:', tickedNodes.length);
      setLayoutNodes(tickedNodes);
    },
    enabled: true,
  });

  useEffect(() => {
    console.log('🎨 WorkingD3Canvas useEffect - nodes:', nodes.length, 'edges:', edges.length);
    if (nodes.length > 0) {
      console.log('🚀 Starting force layout with', nodes.length, 'nodes');
      start(nodes, edges);
    }

    return () => {
      stop();
    };
  }, [nodes, edges, start, stop]);

  if (!nodes.length) {
    return (
      <div
        className={className || "absolute inset-0"}
        style={{ width, height, backgroundColor: '#0F172A' }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-xl font-bold mb-2">🎵 D3.js Graph Visualization</div>
            <div className="text-sm text-gray-400">Waiting for graph data...</div>
            <div className="text-xs text-gray-500 mt-2">
              Nodes: {nodes.length} | Edges: {edges.length}
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('🖼️ WorkingD3Canvas render - layoutNodes:', layoutNodes.length, 'edges:', edges.length);

  // Use nodes directly if layoutNodes is empty (force layout hasn't run yet)
  const displayNodes = layoutNodes.length > 0 ? layoutNodes : nodes.map(node => ({
    ...node,
    x: node.x || Math.random() * width,
    y: node.y || Math.random() * height
  }));

  return (
    <div
      className={className || "absolute inset-0"}
      style={{ width, height, backgroundColor: '#0F172A' }}
    >
      <PixiCanvas width={width} height={height} nodes={displayNodes} edges={edges} />

      {/* Enhanced Interactive Tooltip with clickable connections */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y + 15,
            left: tooltip.x + 15,
            pointerEvents: tooltip.clickableNodes?.length ? 'auto' : 'none',
            maxWidth: '350px',
            zIndex: 1000
          }}
          className="bg-gray-900 bg-opacity-95 text-white text-sm px-4 py-3 rounded-lg shadow-xl border border-gray-700"
        >
          {/* Main tooltip content */}
          <div className="whitespace-pre-line mb-2">
            {tooltip.content.split('🔗 Often played with (click to center):')[0]}
          </div>

          {/* Clickable connected tracks */}
          {tooltip.clickableNodes && tooltip.clickableNodes.length > 0 && (
            <div className="border-t border-gray-700 pt-2">
              <div className="text-gray-300 text-xs mb-2">🔗 Often played with (click to center):</div>
              {tooltip.clickableNodes.map((track, index) => {
                const hoveredNodeId = selectedNodes[0] || centeredNodeId;
                const connectedEdge = edges.find(edge =>
                  (edge.source === hoveredNodeId && edge.target === track.id) ||
                  (edge.target === hoveredNodeId && edge.source === track.id)
                );
                const freq = connectedEdge?.metadata?.adjacency_frequency || 1;
                const strength = connectedEdge?.metadata?.strength_category || 'weak';
                const strengthEmoji = {
                  'very_strong': '🔥',
                  'strong': '⚡',
                  'moderate': '🌟',
                  'weak': '💫'
                }[strength] || '💫';

                return (
                  <button
                    key={track.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCenteredNodeId(track.id);
                      dispatch(setSelectedNodes([track.id]));
                      setTooltip(null);
                    }}
                    className="block w-full text-left px-2 py-1 rounded hover:bg-gray-700 hover:text-amber-300 transition-colors text-xs"
                  >
                    {strengthEmoji} {track.title} ({freq}x)
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Persistent Tooltip - Click to Explore */}
      {persistentTooltip && (
        <div
          style={{
            position: 'fixed',
            top: persistentTooltip.y,
            left: persistentTooltip.x,
            maxWidth: '350px',
            zIndex: 1500
          }}
          className="bg-gray-900 bg-opacity-98 text-white border border-amber-500 rounded-lg shadow-2xl animate-in fade-in duration-200"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-amber-400 font-semibold text-sm">🎵 Track Details</h3>
            <button
              onClick={() => setPersistentTooltip(null)}
              className="text-gray-400 hover:text-white text-lg font-bold w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Main content */}
          <div className="p-3">
            <div className="whitespace-pre-line text-sm mb-3">
              {persistentTooltip.content}
            </div>

            {/* Collection toggle and pathfinding controls */}
            <div className="border-t border-gray-700 pt-3 mb-3">
              <div className="text-amber-400 text-xs font-semibold mb-2">
                🎯 Actions:
              </div>
              <div className="space-y-2">
                {/* Collection toggle */}
                {(() => {
                  const node = nodes.find(n => n.id === persistentTooltip.nodeId);
                  const isInCollection = node?.metadata?.owned;
                  const routeNodes = pathState.currentPath?.nodes || [];
                  const currentIndex = routeNodes.indexOf(persistentTooltip.nodeId);
                  const nextNode = currentIndex >= 0 && currentIndex < routeNodes.length - 1 ?
                    nodes.find(n => n.id === routeNodes[currentIndex + 1]) : null;
                  const prevNode = currentIndex > 0 ?
                    nodes.find(n => n.id === routeNodes[currentIndex - 1]) : null;

                  return (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCollection(persistentTooltip.nodeId);
                        }}
                        className={`w-full text-left p-2 rounded border transition-all text-xs ${
                          isInCollection
                            ? 'border-green-500 bg-green-900 hover:bg-green-800 text-green-200'
                            : 'border-red-500 bg-red-900 hover:bg-red-800 text-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{isInCollection ? '✅' : '❌'}</span>
                          <span className="font-medium">
                            {isInCollection ? 'In your collection' : 'Not in collection'}
                          </span>
                          <span className="ml-auto text-xs opacity-75">Click to toggle</span>
                        </div>
                      </button>

                      {/* Pathfinding controls */}
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetStartNode(persistentTooltip.nodeId);
                          }}
                          className={`p-2 rounded border text-xs transition-all ${
                            pathState.startNode === persistentTooltip.nodeId
                              ? 'border-green-500 bg-green-900 text-green-200'
                              : 'border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          🎬 Start
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddWaypoint(persistentTooltip.nodeId);
                          }}
                          className={`p-2 rounded border text-xs transition-all ${
                            pathState.waypoints?.includes(persistentTooltip.nodeId)
                              ? 'border-yellow-500 bg-yellow-900 text-yellow-200'
                              : 'border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}

                        >
                          📍 Waypoint
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetEndNode(persistentTooltip.nodeId);
                          }}
                          className={`p-2 rounded border text-xs transition-all ${
                            pathState.endNode === persistentTooltip.nodeId
                              ? 'border-red-500 bg-red-900 text-red-200'
                              : 'border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          🏁 End
                        </button>
                      </div>

                      {/* Mark as played button */}
                      {routeNodes.includes(persistentTooltip.nodeId) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsPlayed(persistentTooltip.nodeId);
                          }}
                          className={`w-full p-2 rounded border text-xs transition-all ${
                            playedSongs.has(persistentTooltip.nodeId)
                              ? 'border-purple-500 bg-purple-900 text-purple-200'
                              : 'border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">▶️</span>
                            <span className="font-medium">
                              {playedSongs.has(persistentTooltip.nodeId) ? 'Played' : 'Mark as Played'}
                            </span>
                          </div>
                        </button>
                      )}

                      {/* Navigation to next/previous track in path */}
                      {routeNodes.includes(persistentTooltip.nodeId) && (
                        <div className="grid grid-cols-2 gap-1">
                          {prevNode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToNode(prevNode.id);
                              }}
                              className="p-2 rounded border border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs"
                            >
                              ← Prev: {prevNode.title || prevNode.label}
                            </button>
                          )}
                          {nextNode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToNode(nextNode.id);
                              }}
                              className="p-2 rounded border border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs"
                            >
                              Next: {nextNode.title || nextNode.label} →
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Connected tracks */}
            {persistentTooltip.clickableNodes && persistentTooltip.clickableNodes.length > 0 && (
              <div className="border-t border-gray-700 pt-3">
                <div className="text-amber-400 text-xs font-semibold mb-2">
                  🔗 Connections (click to navigate):
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                  {persistentTooltip.clickableNodes.map((track: any) => {
                    const strengthEmoji = {
                      'very_strong': '🔥',
                      'strong': '⚡',
                      'moderate': '🌟',
                      'weak': '💫'
                    }[track.strength] || '💫';

                    return (
                      <button
                        key={track.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToNode(track.id);
                        }}
                        className="block w-full text-left p-2 rounded hover:bg-gray-700 hover:text-amber-300 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{strengthEmoji}</span>
                          <span className="font-medium">{track.title}</span>
                          <span className="ml-auto text-xs opacity-75">({track.frequency}x)</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};