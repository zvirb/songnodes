/**
 * TrackListItem Component
 * Memoized track item for optimal re-render performance
 */

import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import type { SetlistTrack, Track, TransitionQuality } from './types';
import { formatDuration, getQualityColor, getQualityBgColor, getQualityBorderColor } from './utils';

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
      className="group relative flex flex-col bg-card-bg border border-card-border hover:border-border-strong hover:bg-card-hover rounded-card shadow-card hover:shadow-card-hover transition-all duration-fast"
      {...attributes}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle */}
        <button
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm touch-none"
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical size={20} />
        </button>

        {/* Track Position */}
        <div className="flex-shrink-0 w-8 text-center font-semibold text-text-secondary text-sm">
          {index + 1}.
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text-primary truncate text-sm">
            {track.name}
          </div>
          <div className="text-xs text-text-secondary truncate mt-0.5">
            {track.artist}
          </div>

          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            {track.bpm && (
              <span className="px-2 py-0.5 bg-info-bg text-info border border-info-border rounded-badge font-mono">
                {track.bpm} BPM
              </span>
            )}
            {track.key && (
              <span className="px-2 py-0.5 bg-brand-secondary-muted text-brand-secondary border border-border-subtle rounded-badge font-mono">
                {track.key}
              </span>
            )}
            {track.duration && (
              <span className="px-2 py-0.5 bg-bg-elevated2 text-text-secondary border border-border-subtle rounded-badge font-mono">
                {formatDuration(track.duration)}
              </span>
            )}
            {track.energy !== undefined && (
              <span className="px-2 py-0.5 bg-warning-bg text-warning border border-warning-border rounded-badge font-mono">
                Energy: {Math.round(track.energy * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-fast">
          <button
            onClick={() => onEdit(setlistTrack.id)}
            className="p-2 text-text-tertiary hover:text-info hover:bg-bg-elevated2 rounded-button transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            aria-label="Edit track cues"
            title="Edit track cues"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onRemove(setlistTrack.id)}
            className="p-2 text-text-tertiary hover:text-error hover:bg-error-bg rounded-button transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
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
          className="px-3 py-2 border-t text-xs rounded-b-card transition-colors duration-fast"
          style={{
            backgroundColor: getQualityBgColor(transitionQuality.overall),
            borderColor: getQualityBorderColor(transitionQuality.overall),
          }}
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
