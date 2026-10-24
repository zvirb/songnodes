/**
 * TrackListItem Component
 * Standardized setlist track item matching Design System tokens and data display guidelines
 */

import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import type { SetlistTrack, Track, TransitionQuality } from './types';
import {
  formatDuration,
  getKeyToken,
  getEnergyToken,
  normalizeCamelotKey,
  getQualityColor,
  getQualityBgColor,
  getQualityGlyph,
} from './utils';

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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const { track } = setlistTrack;

  // Compute energy integer 1-10
  const rawEnergy = track.energy;
  const energyVal = rawEnergy != null && !isNaN(rawEnergy)
    ? Math.max(1, Math.min(10, Math.round(rawEnergy > 1 ? rawEnergy : rawEnergy * 10)))
    : null;

  const camelotKey = normalizeCamelotKey(track.key) || track.key;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col rounded-[var(--radius-card)] transition-all"
      {...attributes}
    >
      {/* Track Slot Card */}
      <div
        className="flex items-center gap-[var(--space-3)] p-[var(--space-3)] transition-colors rounded-[var(--radius-card)]"
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--line)',
        }}
      >
        {/* Reorder Drag Handle */}
        <button
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[var(--fg-3)] hover:text-[var(--fg)] touch-none p-[var(--space-1)] rounded-[var(--radius-chip)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
          {...listeners}
          aria-label="Drag to reorder track"
          title="Drag to reorder"
        >
          <GripVertical size={18} />
        </button>

        {/* Slot Number */}
        <div
          className="flex-shrink-0 w-8 text-right font-[family-name:var(--font-data)] text-[0.8125rem] font-semibold text-[var(--fg-2)] select-none"
        >
          {index + 1}.
        </div>

        {/* Track Main Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-0\.5)]">
          <div className="font-[family-name:var(--font-body)] font-semibold text-[0.9375rem] text-[var(--fg)] truncate">
            {track.name}
          </div>
          <div className="font-[family-name:var(--font-body)] text-[0.8125rem] text-[var(--fg-2)] truncate">
            {track.artist}
          </div>

          {/* Track Data Chips & Badges */}
          <div className="flex flex-wrap items-center gap-[var(--space-2)] mt-[var(--space-1)] text-[var(--fg-2)] text-[0.8125rem]">
            {/* Key Badge */}
            {camelotKey && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-chip)] font-[family-name:var(--font-data)] text-[0.75rem] font-medium"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  color: 'var(--fg)',
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getKeyToken(camelotKey) }}
                  aria-hidden="true"
                />
                {camelotKey}
              </span>
            )}

            {/* BPM Readout */}
            {track.bpm && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-chip)] font-[family-name:var(--font-data)] text-[0.75rem]"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  color: 'var(--fg)',
                }}
              >
                {track.bpm} BPM
              </span>
            )}

            {/* Energy Bar */}
            {energyVal != null && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-chip)] text-[0.75rem]"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                <span className="flex items-center gap-[2px]" title={`Energy ${energyVal} of 10`}>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const segNum = i + 1;
                    const isLit = segNum <= energyVal;
                    const isGapAfter = segNum === 4 || segNum === 7;
                    return (
                      <span
                        key={i}
                        className="w-[3px] h-[10px] rounded-[1px] inline-block transition-colors"
                        style={{
                          backgroundColor: isLit ? getEnergyToken(segNum) : 'var(--surface-3)',
                          marginRight: isGapAfter ? '2px' : '0px',
                        }}
                      />
                    );
                  })}
                </span>
                <span className="font-[family-name:var(--font-data)] text-[var(--fg-2)] font-semibold">
                  {energyVal}
                </span>
              </span>
            )}

            {/* Duration */}
            {track.duration && (
              <span className="font-[family-name:var(--font-data)] text-[0.75rem] text-[var(--fg-3)] ml-auto">
                {formatDuration(track.duration)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-[var(--space-1)] opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(setlistTrack.id)}
            className="p-[var(--space-1\.5)] text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-bg)] rounded-[var(--radius-control)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            aria-label="Edit track details"
            title="Edit track details"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onRemove(setlistTrack.id)}
            className="p-[var(--space-1\.5)] text-[var(--fg-2)] hover:text-[var(--status-bad)] hover:bg-[var(--status-bad-bg)] rounded-[var(--radius-control)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            aria-label="Remove from setlist"
            title="Remove from setlist"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Transition Strip / Badge between set rows */}
      {transitionQuality && nextTrack && (
        <div
          className="mt-[2px] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-control)] border text-[0.8125rem] font-[family-name:var(--font-data)] flex flex-wrap items-center justify-between gap-[var(--space-2)]"
          style={{
            backgroundColor: 'var(--sunk)',
            borderColor: 'var(--line)',
          }}
        >
          <div className="flex items-center gap-[var(--space-2)] font-semibold">
            <span
              className="px-2 py-0.5 rounded-[var(--radius-chip)] inline-flex items-center gap-1 text-[0.75rem]"
              style={{
                backgroundColor: getQualityBgColor(transitionQuality.overall),
                color: getQualityColor(transitionQuality.overall),
              }}
            >
              <span aria-hidden="true">{getQualityGlyph(transitionQuality.overall)}</span>
              {transitionQuality.overall.toUpperCase()}
            </span>
            <span className="text-[var(--fg-3)] text-[0.75rem]">Transition</span>
          </div>

          <div className="flex items-center gap-[var(--space-3)] text-[0.75rem]">
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
      )}
    </div>
  );
};

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
