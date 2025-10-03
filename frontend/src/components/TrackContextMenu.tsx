import React, { useEffect, useRef } from 'react';
import { Track } from '../types';
import { useStore } from '../store/useStore';

interface TrackContextMenuProps {
  track: Track;
  position: { x: number; y: number };
  onClose: () => void;
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({ track, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { pathfinding, pathfindingState } = useStore();

  const isStartTrack = pathfindingState.startTrackId === track.id;
  const isEndTrack = pathfindingState.endTrackId === track.id;
  const isWaypoint = pathfindingState.selectedWaypoints.has(track.id);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Close on escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const adjustedPosition = { ...position };

      // Adjust horizontal position
      if (rect.right > window.innerWidth) {
        adjustedPosition.x = window.innerWidth - rect.width - 10;
      }

      // Adjust vertical position
      if (rect.bottom > window.innerHeight) {
        adjustedPosition.y = window.innerHeight - rect.height - 10;
      }

      menuRef.current.style.left = `${adjustedPosition.x}px`;
      menuRef.current.style.top = `${adjustedPosition.y}px`;
    }
  }, [position]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[200px]"
      style={{ left: position.x, top: position.y }}
    >
      {/* Track Info Header */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="font-semibold text-sm truncate">{track.name || (track as any).title}</div>
        <div className="text-xs text-gray-600 truncate">{track.artist}</div>
        {track.key && (
          <div className="text-xs text-gray-500 mt-1">
            {track.key} {track.bpm && `• ${track.bpm} BPM`}
          </div>
        )}
      </div>

      {/* Pathfinder Actions */}
      <div className="py-1">
        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Pathfinder</div>

        <button
          onClick={() => handleAction(() => pathfinding.setStartTrack(track.id))}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
            isStartTrack ? 'bg-green-50 text-green-700' : 'text-gray-700'
          }`}
        >
          <span className="text-base">🚀</span>
          {isStartTrack ? 'Start Track (Current)' : 'Set as Start Track'}
        </button>

        <button
          onClick={() => handleAction(() => pathfinding.setEndTrack(track.id))}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
            isEndTrack ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
          }`}
        >
          <span className="text-base">🏁</span>
          {isEndTrack ? 'End Track (Current)' : 'Set as End Track'}
        </button>

        {isWaypoint ? (
          <button
            onClick={() => handleAction(() => pathfinding.removeWaypoint(track.id))}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 bg-yellow-50 text-yellow-700"
          >
            <span className="text-base">✓</span>
            Remove from Waypoints
          </button>
        ) : (
          <button
            onClick={() => handleAction(() => pathfinding.addWaypoint(track.id))}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700"
          >
            <span className="text-base">📍</span>
            Add as Waypoint
          </button>
        )}

        {/* Clear options */}
        {(isStartTrack || isEndTrack) && (
          <>
            <div className="border-t border-gray-200 my-1"></div>
            {isStartTrack && (
              <button
                onClick={() => handleAction(() => pathfinding.setStartTrack(null as any))}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              >
                <span className="text-base">🗑️</span>
                Clear Start Track
              </button>
            )}
            {isEndTrack && (
              <button
                onClick={() => handleAction(() => pathfinding.setEndTrack(null as any))}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              >
                <span className="text-base">🗑️</span>
                Clear End Track
              </button>
            )}
          </>
        )}
      </div>

      {/* Additional Actions */}
      <div className="border-t border-gray-200 py-1">
        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Track Actions</div>

        <button
          onClick={() => handleAction(() => {
            // This could trigger showing track details
            console.log('View track details:', track.id);
          })}
          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700"
        >
          <span className="text-base">ℹ️</span>
          View Details
        </button>
      </div>
    </div>
  );
};

export default TrackContextMenu;
