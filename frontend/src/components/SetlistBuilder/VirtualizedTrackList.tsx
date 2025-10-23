/**
 * VirtualizedTrackList Component
 * Uses TanStack Virtual for efficient rendering of large lists
 */

import React, { useRef, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Music } from 'lucide-react';
import type { SetlistTrack, Track } from './types';
import { TrackListItem } from './TrackListItem';
import { getTransitionQuality } from './utils';

interface VirtualizedTrackListProps {
  tracks: SetlistTrack[];
  onReorder: (from: number, to: number) => void;
  onRemove: (trackId: string) => void;
  onEdit: (trackId: string) => void;
}

const VIRTUALIZATION_THRESHOLD = 50;
const ITEM_HEIGHT = 120; // Estimated height per item

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <Music size={64} className="text-gray-300 dark:text-gray-600 mb-4" />
    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
      No tracks in this setlist yet
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Search for tracks and drag them here to build your setlist
    </p>
  </div>
);

export const VirtualizedTrackList: React.FC<VirtualizedTrackListProps> = ({
  tracks,
  onReorder,
  onRemove,
  onEdit,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Only virtualize if list is large enough
  const shouldVirtualize = tracks.length > VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = tracks.findIndex(t => t.id === active.id);
    const newIndex = tracks.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  };

  const sortableIds = useMemo(() => tracks.map(t => t.id), [tracks]);

  const activeTrack = useMemo(
    () => tracks.find(t => t.id === activeId),
    [tracks, activeId]
  );

  if (tracks.length === 0) {
    return <EmptyState />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: '600px' }}
          role="list"
          aria-label="Setlist tracks"
        >
          {shouldVirtualize ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map(virtualItem => {
                const track = tracks[virtualItem.index];
                const nextTrack = tracks[virtualItem.index + 1]?.track;
                const transitionQuality = nextTrack
                  ? getTransitionQuality(track.track, nextTrack)
                  : null;

                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="pb-2">
                      <TrackListItem
                        setlistTrack={track}
                        index={virtualItem.index}
                        nextTrack={nextTrack}
                        transitionQuality={transitionQuality}
                        onRemove={onRemove}
                        onEdit={onEdit}
                        isDragging={activeId === track.id}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track, index) => {
                const nextTrack = tracks[index + 1]?.track;
                const transitionQuality = nextTrack
                  ? getTransitionQuality(track.track, nextTrack)
                  : null;

                return (
                  <TrackListItem
                    key={track.id}
                    setlistTrack={track}
                    index={index}
                    nextTrack={nextTrack}
                    transitionQuality={transitionQuality}
                    onRemove={onRemove}
                    onEdit={onEdit}
                    isDragging={activeId === track.id}
                  />
                );
              })}
            </div>
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTrack ? (
          <div className="opacity-80 shadow-lg">
            <TrackListItem
              setlistTrack={activeTrack}
              index={tracks.findIndex(t => t.id === activeId)}
              onRemove={() => {}}
              onEdit={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
