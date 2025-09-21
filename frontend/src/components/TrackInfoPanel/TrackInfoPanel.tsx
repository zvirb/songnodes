import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSelectedNodes } from '../../store/graphSlice';
import {
  setStartNode,
  setEndNode,
  addWaypoint,
  removeWaypoint,
} from '../../store/pathfindingSlice';

interface TrackInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const TrackInfoPanel: React.FC<TrackInfoPanelProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const dispatch = useAppDispatch();
  const { nodes, edges, selectedNodes } = useAppSelector(state => state.graph);
  const pathState = useAppSelector(state => state.pathfinding);
  const [playedSongs, setPlayedSongs] = useState<Set<string>>(new Set());

  // Get the currently selected node
  const selectedNode = selectedNodes.length > 0
    ? nodes.find(n => n.id === selectedNodes[0])
    : null;

  // Get connected tracks for the selected node
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

        return {
          node: connectedNode,
          weight: edge.weight || 1,
          edge
        };
      })
      .filter(conn => conn.node)
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, 10); // Limit to top 10 connections

    return connections;
  };

  const connectedTracks = selectedNode ? getConnectedTracks(selectedNode.id) : [];

  const handleMarkAsPlayed = (nodeId: string) => {
    setPlayedSongs(prev => new Set([...prev, nodeId]));
  };

  const handleNavigateToTrack = (nodeId: string) => {
    dispatch(setSelectedNodes([nodeId]));
  };

  const handleSetStartNode = () => {
    if (selectedNode) {
      dispatch(setStartNode(selectedNode.id));
    }
  };

  const handleSetEndNode = () => {
    if (selectedNode) {
      dispatch(setEndNode(selectedNode.id));
    }
  };

  const handleAddWaypoint = () => {
    if (selectedNode) {
      dispatch(addWaypoint(selectedNode.id));
    }
  };

  const handleRemoveWaypoint = () => {
    if (selectedNode) {
      dispatch(removeWaypoint(selectedNode.id));
    }
  };

  const isInMyCollection = (nodeId: string) => {
    try {
      const collection = JSON.parse(localStorage.getItem('myCollectionTitles') || '[]');
      const node = nodes.find(n => n.id === nodeId);
      const title = node?.title || node?.metadata?.title || '';
      return collection.some((t: string) => t.toLowerCase() === title.toLowerCase());
    } catch {
      return false;
    }
  };

  const handleToggleCollection = (nodeId: string) => {
    try {
      const collection = JSON.parse(localStorage.getItem('myCollectionTitles') || '[]');
      const node = nodes.find(n => n.id === nodeId);
      const title = node?.title || node?.metadata?.title || '';

      if (isInMyCollection(nodeId)) {
        const filtered = collection.filter((t: string) => t.toLowerCase() !== title.toLowerCase());
        localStorage.setItem('myCollectionTitles', JSON.stringify(filtered));
      } else {
        collection.push(title);
        localStorage.setItem('myCollectionTitles', JSON.stringify(collection));
      }
    } catch {
      // Handle error silently
    }
  };

  // Close panel when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !selectedNode) {
    return null;
  }

  const metadata = selectedNode.metadata || {};
  const isStart = pathState.startNode === selectedNode.id;
  const isEnd = pathState.endNode === selectedNode.id;
  const isWaypoint = pathState.waypoints?.includes(selectedNode.id);
  const isPlayed = playedSongs.has(selectedNode.id);
  const inCollection = isInMyCollection(selectedNode.id);

  return (
    <>
      {/* Mobile/Tablet Full Screen Overlay */}
      <div
        className={`
          fixed inset-0 bg-black bg-opacity-50 z-[10000] transition-opacity duration-300
          lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Track Info Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full bg-gray-900 border-l border-gray-600 shadow-2xl
          transform transition-transform duration-300 ease-in-out z-[10001] overflow-y-auto
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${className}

          /* Mobile/Tablet: Full screen */
          w-full

          /* Desktop: 30% of screen width, max 500px, min 350px */
          lg:w-[30vw] lg:max-w-[500px] lg:min-w-[350px]
        `}
        style={{ paddingTop: '64px' }} // Account for top menu bar
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">Track Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl p-1 rounded hover:bg-gray-700 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
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

              {/* Status Indicators */}
              <div className="flex flex-col gap-1 ml-2 flex-shrink-0">
                {isStart && <span className="text-green-400 text-xs bg-green-900/30 px-2 py-1 rounded">START</span>}
                {isEnd && <span className="text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded">END</span>}
                {isWaypoint && <span className="text-orange-400 text-xs bg-orange-900/30 px-2 py-1 rounded">WAYPOINT</span>}
                {isPlayed && <span className="text-purple-400 text-xs bg-purple-900/30 px-2 py-1 rounded">PLAYED</span>}
              </div>
            </div>

            {/* Additional Metadata */}
            {(metadata.album || metadata.genre || metadata.bpm || metadata.key) && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {metadata.album && (
                  <div>
                    <span className="text-gray-500">Album:</span>
                    <p className="text-gray-300 break-words">{metadata.album}</p>
                  </div>
                )}
                {metadata.genre && (
                  <div>
                    <span className="text-gray-500">Genre:</span>
                    <p className="text-gray-300">{metadata.genre}</p>
                  </div>
                )}
                {metadata.bpm && (
                  <div>
                    <span className="text-gray-500">BPM:</span>
                    <p className="text-gray-300">{metadata.bpm}</p>
                  </div>
                )}
                {metadata.key && (
                  <div>
                    <span className="text-gray-500">Key:</span>
                    <p className="text-gray-300">{metadata.key}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <h4 className="text-white font-medium">Actions</h4>

            {/* Collection Toggle */}
            <button
              onClick={() => handleToggleCollection(selectedNode.id)}
              className={`w-full text-left p-3 rounded border transition-all ${
                inCollection
                  ? 'border-green-500 bg-green-900/20 text-green-300 hover:bg-green-900/30'
                  : 'border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {inCollection ? '✓ In My Collection' : '+ Add to My Collection'}
            </button>

            {/* Route Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSetStartNode}
                className={`p-2 rounded border text-xs transition-all ${
                  isStart
                    ? 'border-green-500 bg-green-900/20 text-green-300'
                    : 'border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {isStart ? '✓ Start Track' : 'Set as Start'}
              </button>

              <button
                onClick={handleSetEndNode}
                className={`p-2 rounded border text-xs transition-all ${
                  isEnd
                    ? 'border-red-500 bg-red-900/20 text-red-300'
                    : 'border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {isEnd ? '✓ End Track' : 'Set as End'}
              </button>
            </div>

            {/* Waypoint Action */}
            <button
              onClick={isWaypoint ? handleRemoveWaypoint : handleAddWaypoint}
              className={`w-full p-2 rounded border text-xs transition-all ${
                isWaypoint
                  ? 'border-orange-500 bg-orange-900/20 text-orange-300'
                  : 'border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {isWaypoint ? '✓ Remove from Route' : 'Add to Route'}
            </button>

            {/* Mark as Played */}
            {!isPlayed && (
              <button
                onClick={() => handleMarkAsPlayed(selectedNode.id)}
                className="w-full p-2 rounded border border-gray-500 bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs transition-all"
              >
                Mark as Played
              </button>
            )}
          </div>

          {/* Connected Tracks */}
          {connectedTracks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-white font-medium">Connected Tracks ({connectedTracks.length})</h4>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {connectedTracks.map(({ node, weight }) => {
                  if (!node) return null;

                  const strengthEmoji = weight >= 5 ? '🔥' : weight >= 3 ? '⚡' : '🔗';
                  const strengthColor = weight >= 5
                    ? 'border-red-500 text-red-300'
                    : weight >= 3
                    ? 'border-yellow-500 text-yellow-300'
                    : 'border-gray-500 text-gray-300';

                  return (
                    <button
                      key={node.id}
                      onClick={() => handleNavigateToTrack(node.id)}
                      className={`w-full text-left p-3 rounded border bg-gray-800 hover:bg-gray-700 transition-all ${strengthColor} group`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span>{strengthEmoji}</span>
                            <span className="font-medium text-sm truncate">
                              {node.metadata?.title || node.title || node.label || 'Unknown'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 truncate">
                            {node.metadata?.artist || node.artist || 'Unknown Artist'}
                          </div>
                        </div>
                        <div className="text-xs opacity-60 ml-2 flex-shrink-0">
                          {weight}x
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};