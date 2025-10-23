/**
 * TrackListItem Component
 * Memoized track item for optimal re-render performance
 */

import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grip, Edit, Trash2 } from 'lucide-react';
import type { SetlistTrack, Track, TransitionQuality } from './types';
import { formatDuration, getQualityColor } from './utils';

interface TrackListItemProps {
  setlistTrack: SetlistTrack;
  index: number;
  nextTrack?: Track;
  transitionQuality?: TransitionQuality | null;
  onRemove: (trackId: string) => void;
  onEdit: (trackId: string) => void;
  isDragging?: boolean;
}

const TrackListItemComponent: React.FC<TrackListItemProps> = ({
  setlistTrack,
  index,
  nextTrack,
  transitionQuality,
  onRemove,
  onEdit,
  isDragging = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: setlistTrack.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const { track } = setlistTrack;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all"
      {...attributes}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle */}
        <button
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
          {...listeners}
          aria-label="Drag to reorder"
        >
          <Grip size={20} />
        </button>

        {/* Track Position */}
        <div className="flex-shrink-0 w-8 text-center font-semibold text-gray-700 dark:text-gray-300">
          {index + 1}.
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {track.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {track.artist}
          </div>

          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
            {track.bpm && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                {track.bpm} BPM
              </span>
            )}
            {track.key && (
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                {track.key}
              </span>
            )}
            {track.duration && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                {formatDuration(track.duration)}
              </span>
            )}
            {track.energy !== undefined && (
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                Energy: {Math.round(track.energy * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(setlistTrack.id)}
            className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label="Edit track cues"
            title="Edit track cues"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onRemove(setlistTrack.id)}
            className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label="Remove from setlist"
            title="Remove from setlist"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Transition Indicator */}
      {transitionQuality && nextTrack && (
        <div
          className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs"
          style={{ backgroundColor: `${getQualityColor(transitionQuality.overall)}10` }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold" style={{ color: getQualityColor(transitionQuality.overall) }}>
              Transition: {transitionQuality.overall.toUpperCase()}
            </span>
            <div className="flex gap-3">
              <span style={{ color: getQualityColor(transitionQuality.key) }}>
                Key: {transitionQuality.key}
              </span>
              <span style={{ color: getQualityColor(transitionQuality.bpm) }}>
                BPM: {transitionQuality.bpm}
              </span>
              {transitionQuality.energy && transitionQuality.energy !== 'unknown' && (
                <span style={{ color: getQualityColor(transitionQuality.energy) }}>
                  Energy: {transitionQuality.energy}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoized with custom comparison for optimal performance
export const TrackListItem = memo(
  TrackListItemComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.setlistTrack.id === nextProps.setlistTrack.id &&
      prevProps.index === nextProps.index &&
      prevProps.isDragging === nextProps.isDragging &&
      prevProps.nextTrack?.id === nextProps.nextTrack?.id &&
      JSON.stringify(prevProps.transitionQuality) === JSON.stringify(nextProps.transitionQuality)
    );
  }
);

TrackListItem.displayName = 'TrackListItem';
