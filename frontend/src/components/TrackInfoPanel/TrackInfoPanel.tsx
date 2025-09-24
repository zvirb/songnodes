import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSelectedNodes } from '../../store/graphSlice';
import {
  setStartNode,
  setEndNode,
  addWaypoint,
  removeWaypoint,
} from '../../store/pathfindingSlice';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import classNames from 'classnames';

export const TrackInfoPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isMobile } = useResponsiveLayout();
  const { nodes, edges, selectedNodes } = useAppSelector(state => state.graph);
  const pathState = useAppSelector(state => state.pathfinding);
  const [playedSongs, setPlayedSongs] = useState<Set<string>>(new Set());

  const selectedNode = selectedNodes.length > 0
    ? nodes.find(n => n.id === selectedNodes[0])
    : null;

  const getConnectedTracks = (nodeId: string) => {
    if (!nodeId) return [];
    const connections = edges
      .filter(edge => 
        (typeof edge.source === 'string' ? edge.source : edge.source.id) === nodeId ||
        (typeof edge.target === 'string' ? edge.target : edge.target.id) === nodeId
      )
      .map(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        const connectedId = sourceId === nodeId ? targetId : sourceId;
        const connectedNode = nodes.find(n => n.id === connectedId);
        return { node: connectedNode, weight: edge.weight || 1, edge };
      })
      .filter(conn => conn.node)
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, 10);
    return connections;
  };

  const connectedTracks = selectedNode ? getConnectedTracks(selectedNode.id) : [];

  if (!selectedNode) {
    return <div className="p-4 text-gray-400">Select a node to see details.</div>;
  }

  const handleNavigateToTrack = (nodeId: string) => {
    dispatch(setSelectedNodes([nodeId]));
  };

  const metadata = selectedNode.metadata || {};
  const isStart = pathState.startNode === selectedNode.id;
  const isEnd = pathState.endNode === selectedNode.id;
  const isWaypoint = pathState.waypoints?.includes(selectedNode.id);

  return (
    <div className="space-y-6 p-1">
      {/* Track Information */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-medium text-lg leading-tight break-words">
              {metadata.title || selectedNode.title || selectedNode.label || 'Unknown Track'}
            </h3>
            <p className="text-gray-400 text-sm mt-1 break-words">
              {metadata.artist || selectedNode.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Additional Metadata */}
        <div className={classNames('grid gap-2 text-xs', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
          {metadata.album && <div><span className="text-gray-500">Album:</span><p className="text-gray-300 break-words">{metadata.album}</p></div>}
          {metadata.genre && <div><span className="text-gray-500">Genre:</span><p className="text-gray-300">{metadata.genre}</p></div>}
          {metadata.bpm && <div><span className="text-gray-500">BPM:</span><p className="text-gray-300">{metadata.bpm}</p></div>}
          {metadata.key && <div><span className="text-gray-500">Key:</span><p className="text-gray-300">{metadata.key}</p></div>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <h4 className="text-white font-medium text-sm">Actions</h4>
        <div className={classNames('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
          <button onClick={() => dispatch(setStartNode(selectedNode.id))} className={`p-2 rounded border text-xs transition-all ${isStart ? 'border-green-500 bg-green-900/20 text-green-300' : 'border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {isStart ? '✓ Start Track' : 'Set as Start'}
          </button>
          <button onClick={() => dispatch(setEndNode(selectedNode.id))} className={`p-2 rounded border text-xs transition-all ${isEnd ? 'border-red-500 bg-red-900/20 text-red-300' : 'border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {isEnd ? '✓ End Track' : 'Set as End'}
          </button>
        </div>
        <button onClick={() => isWaypoint ? dispatch(removeWaypoint(selectedNode.id)) : dispatch(addWaypoint(selectedNode.id))} className={`w-full p-2 rounded border text-xs transition-all ${isWaypoint ? 'border-orange-500 bg-orange-900/20 text-orange-300' : 'border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          {isWaypoint ? '✓ Remove from Route' : 'Add to Route'}
        </button>
      </div>

      {/* Connected Tracks */}
      {connectedTracks.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-white font-medium text-sm">Connected Tracks ({connectedTracks.length})</h4>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {connectedTracks.map(({ node, weight }) => {
              if (!node) return null;
              return (
                <button key={node.id} onClick={() => handleNavigateToTrack(node.id)} className="w-full text-left p-3 rounded border bg-gray-800 hover:bg-gray-700 transition-all border-gray-600 group">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate text-gray-200">{node.metadata?.title || node.title || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">{node.metadata?.artist || node.artist || 'Unknown Artist'}</p>
                    </div>
                    <div className="text-xs opacity-60 ml-2 flex-shrink-0">{weight}x</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};