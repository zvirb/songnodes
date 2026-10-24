import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Track, SetlistTrack } from '../types';
import { TrackEditModal } from './TrackEditModal';
import {
  formatDuration,
  getKeyToken,
  getEnergyToken,
  normalizeCamelotKey,
  getTransitionQuality,
  getQualityColor,
  getQualityBgColor,
  getQualityGlyph,
} from './SetlistBuilder/utils';

interface SortableTrackItemProps {
  setlistTrack: SetlistTrack;
  index: number;
  nextTrack?: Track;
  onRemove: (trackId: string) => void;
  onEdit: (trackId: string) => void;
  isDragging?: boolean;
}

const SortableTrackItem: React.FC<SortableTrackItemProps> = ({
  setlistTrack,
  index,
  nextTrack,
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
  const transitionQuality = nextTrack ? getTransitionQuality(track, nextTrack) : null;

  const rawEnergy = track.energy;
  const energyVal = rawEnergy != null && !isNaN(rawEnergy)
    ? Math.max(1, Math.min(10, Math.round(rawEnergy > 1 ? rawEnergy : rawEnergy * 10)))
    : null;

  const camelotKey = normalizeCamelotKey(track.key) || track.key;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col rounded-[var(--radius-card)] transition-all mb-2"
      {...attributes}
    >
      <div
        className="flex items-center gap-[var(--space-3)] p-[var(--space-3)] transition-colors rounded-[var(--radius-card)]"
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--line)',
        }}
      >
        <button
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[var(--fg-3)] hover:text-[var(--fg)] touch-none p-[var(--space-1)] rounded-[var(--radius-chip)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
          {...listeners}
          aria-label="Drag to reorder track"
        >
          <GripVertical size={18} />
        </button>

        <div className="flex-shrink-0 w-8 text-right font-[family-name:var(--font-data)] text-[0.8125rem] font-semibold text-[var(--fg-2)] select-none">
          {index + 1}.
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-0\.5)]">
          <div className="font-[family-name:var(--font-body)] font-semibold text-[0.9375rem] text-[var(--fg)] truncate">
            {track.name}
          </div>
          <div className="font-[family-name:var(--font-body)] text-[0.8125rem] text-[var(--fg-2)] truncate">
            {track.artist}
          </div>

          <div className="flex flex-wrap items-center gap-[var(--space-2)] mt-[var(--space-1)] text-[var(--fg-2)] text-[0.8125rem]">
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

            {energyVal != null && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-chip)] text-[0.75rem]"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                <span className="flex items-center gap-[2px]">
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

            {track.duration && (
              <span className="font-[family-name:var(--font-data)] text-[0.75rem] text-[var(--fg-3)] ml-auto">
                {formatDuration(track.duration)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-[var(--space-1)]">
          <button
            onClick={() => onEdit(setlistTrack.id)}
            className="p-[var(--space-1\.5)] text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-bg)] rounded-[var(--radius-control)] transition-colors"
            title="Edit track cues"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onRemove(setlistTrack.id)}
            className="p-[var(--space-1\.5)] text-[var(--fg-2)] hover:text-[var(--status-bad)] hover:bg-[var(--status-bad-bg)] rounded-[var(--radius-control)] transition-colors"
            title="Remove from setlist"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

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
              <span>{getQualityGlyph(transitionQuality.overall)}</span>
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

const TrackDragOverlay: React.FC<{ track: SetlistTrack | null }> = ({ track }) => {
  if (!track) return null;

  return (
    <div
      className="p-[var(--space-3)] rounded-[var(--radius-card)]"
      style={{
        backgroundColor: 'var(--brand-soft)',
        border: '2px solid var(--brand)',
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <div className="flex items-center gap-[var(--space-3)]">
        <GripVertical size={18} className="text-[var(--fg-2)]" />
        <div>
          <div className="font-semibold text-[var(--fg)]">{track.track.name}</div>
          <div className="text-[0.8125rem] text-[var(--fg-2)]">{track.track.artist}</div>
        </div>
      </div>
    </div>
  );
};

const SetlistBuilder: React.FC = () => {
  const { currentSetlist, setlist } = useStore();
  const [activeTrack, setActiveTrack] = useState<SetlistTrack | null>(null);
  const [setlistName, setSetlistName] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingTrack, setEditingTrack] = useState<SetlistTrack | null>(null);

  React.useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    console.error('SetlistBuilder Error:', message);
  }, []);

  React.useEffect(() => {
    if (currentSetlist?.name) {
      setSetlistName(currentSetlist.name);
    }
  }, [currentSetlist?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalDuration = useMemo(() => {
    if (!currentSetlist?.tracks) return 0;
    return currentSetlist.tracks.reduce((total, setlistTrack) => {
      return total + (setlistTrack.track.duration || 0);
    }, 0);
  }, [currentSetlist?.tracks]);

  const bpmProgression = useMemo(() => {
    if (!currentSetlist?.tracks) return [];
    return currentSetlist.tracks.map((st) => st.track.bpm).filter(Boolean) as number[];
  }, [currentSetlist?.tracks]);

  const averageBpm = useMemo(() => {
    if (bpmProgression.length === 0) return 0;
    return Math.round(bpmProgression.reduce((sum, bpm) => sum + bpm, 0) / bpmProgression.length);
  }, [bpmProgression]);

  const handleCreateSetlist = useCallback(() => {
    const name = setlistName.trim() || 'New Setlist';
    if (name.length > 100) {
      showError('Create failed: Setlist name is too long (max 100 characters).');
      return;
    }
    try {
      setlist.createNewSetlist(name);
      setSetlistName(name);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Create failed: Could not create setlist. ${errorMsg}`);
    }
  }, [setlistName, setlist, showError]);

  const handleUpdateSetlistName = useCallback(() => {
    if (!currentSetlist) {
      showError('Update failed: No setlist to update. Please create a setlist first.');
      return;
    }
    if (!setlistName.trim()) {
      showError('Update failed: Setlist name cannot be empty.');
      return;
    }
    try {
      const updatedSetlist = {
        ...currentSetlist,
        name: setlistName.trim(),
        updated_at: new Date(),
      };
      setlist.loadSetlist(updatedSetlist);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Update failed: Could not update setlist name. ${errorMsg}`);
    }
  }, [currentSetlist, setlistName, setlist, showError]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeTrackItem = currentSetlist?.tracks.find((t) => t.id === event.active.id);
      setActiveTrack(activeTrackItem || null);
    },
    [currentSetlist]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTrack(null);

      if (!over || active.id === over.id) return;
      if (!currentSetlist) return;

      const oldIndex = currentSetlist.tracks.findIndex((t) => t.id === active.id);
      const newIndex = currentSetlist.tracks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setlist.moveTrackInSetlist(String(active.id), newIndex);
      }
    },
    [currentSetlist, setlist]
  );

  const handleRemoveTrack = useCallback(
    (trackId: string) => {
      try {
        setlist.removeTrackFromSetlist(trackId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        showError(`Remove failed: Could not remove track from setlist. ${errorMsg}`);
      }
    },
    [setlist, showError]
  );

  const handleEditTrack = useCallback(
    (trackId: string) => {
      if (!currentSetlist) return;
      const track = currentSetlist.tracks.find((t) => t.id === trackId);
      if (track) {
        setEditingTrack(track);
      }
    },
    [currentSetlist]
  );

  const handleSaveTrackEdits = useCallback(
    (trackId: string, updates: Partial<SetlistTrack>) => {
      try {
        setlist.updateSetlistTrack(trackId, updates);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        showError(`Update failed: Could not update track. ${errorMsg}`);
      }
    },
    [setlist, showError]
  );

  const handleSaveSetlist = useCallback(() => {
    if (!currentSetlist) {
      showError('Save failed: No setlist to save.');
      return;
    }
    if (!currentSetlist.tracks || currentSetlist.tracks.length === 0) {
      showError('Save failed: Cannot save an empty setlist.');
      return;
    }
    try {
      setlist.saveCurrentSetlist();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Save failed: Could not save setlist. ${errorMsg}`);
    }
  }, [currentSetlist, setlist, showError]);

  const handleClearSetlist = useCallback(() => {
    setlist.clearSetlist();
    setSetlistName('');
  }, [setlist]);

  const handleExportSetlist = useCallback(() => {
    if (!currentSetlist || currentSetlist.tracks.length === 0) return;
    try {
      const exportData = {
        name: currentSetlist.name,
        tracks: currentSetlist.tracks,
        created_at: currentSetlist.created_at,
        duration: totalDuration,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSetlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_setlist.json`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (error) {
      showError('Export failed.');
    }
  }, [currentSetlist, totalDuration, showError]);

  const handleImportSetlist = useCallback(() => {
    if (!importData.trim()) return;
    try {
      const data = JSON.parse(importData);
      if (!data || !data.name || !Array.isArray(data.tracks)) {
        showError('Import failed: Invalid setlist JSON structure.');
        return;
      }
      setlist.createNewSetlist(data.name);
      data.tracks.forEach((t: any, idx: number) => {
        if (t.track) {
          setlist.addTrackToSetlist(t.track, idx);
        }
      });
      setImportData('');
      setShowImportModal(false);
    } catch (error) {
      showError('Import failed: Invalid JSON.');
    }
  }, [importData, setlist, showError]);

  const sortableTrackIds = currentSetlist?.tracks.map((t) => t.id) || [];

  return (
    <div
      className="p-[var(--space-4)] rounded-[var(--radius-sheet)] flex flex-col gap-[var(--space-4)]"
      style={{
        backgroundColor: 'var(--bg)',
        color: 'var(--fg)',
      }}
    >
      {errorMessage && (
        <div
          className="p-[var(--space-3)] rounded-[var(--radius-control)] border flex items-center justify-between"
          style={{
            backgroundColor: 'var(--status-bad-bg)',
            borderColor: 'var(--status-bad)',
            color: 'var(--status-bad)',
          }}
        >
          <p className="text-[0.875rem]">{errorMessage}</p>
          <button
            onClick={() => setErrorMessage(null)}
            className="font-bold ml-2 hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Band */}
      <div
        className="p-[var(--space-4)] rounded-[var(--radius-card)] flex flex-wrap items-center justify-between gap-[var(--space-4)]"
        style={{
          backgroundColor: 'var(--mod-sets-bg)',
          border: '1px solid var(--mod-sets-line)',
        }}
      >
        <div className="flex flex-col gap-[var(--space-1)]">
          <label className="font-[family-name:var(--font-body)] text-[0.75rem] font-semibold tracking-wider text-[var(--mod-sets-muted)] uppercase">
            Setlist Name
          </label>
          <div className="flex items-center gap-[var(--space-2)]">
            <input
              type="text"
              className="px-3 py-1.5 rounded-[var(--radius-control)] font-[family-name:var(--font-display)] text-[1.125rem] font-bold outline-none"
              style={{
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--line-strong)',
                color: 'var(--fg)',
              }}
              placeholder="Enter setlist name..."
              value={setlistName}
              onChange={(e) => setSetlistName(e.target.value)}
              onBlur={handleUpdateSetlistName}
              onKeyPress={(e) => e.key === 'Enter' && handleUpdateSetlistName()}
            />
            {!currentSetlist && (
              <button
                className="px-4 py-1.5 font-[family-name:var(--font-body)] text-[0.875rem] font-semibold rounded-[var(--radius-control)]"
                style={{
                  backgroundColor: 'var(--brand)',
                  color: 'var(--on-brand)',
                }}
                onClick={handleCreateSetlist}
                disabled={!setlistName.trim()}
              >
                Create
              </button>
            )}
          </div>
        </div>

        {currentSetlist && (
          <div className="flex items-center gap-[var(--space-6)] font-[family-name:var(--font-data)] text-[0.875rem] text-[var(--mod-sets-ink)]">
            <div>
              <span className="text-[var(--mod-sets-muted)] mr-1">Tracks:</span>
              <strong className="font-bold">{currentSetlist.tracks.length}</strong>
            </div>
            <div>
              <span className="text-[var(--mod-sets-muted)] mr-1">Duration:</span>
              <strong className="font-bold">{formatDuration(totalDuration)}</strong>
            </div>
            <div>
              <span className="text-[var(--mod-sets-muted)] mr-1">Avg BPM:</span>
              <strong className="font-bold">{averageBpm || '--'}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Tracks Container */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-[var(--space-2)]">
          {!currentSetlist || currentSetlist.tracks.length === 0 ? (
            <div
              className="p-[var(--space-12)] text-center rounded-[var(--radius-card)]"
              style={{
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--line)',
              }}
            >
              <p className="font-[family-name:var(--font-display)] text-[1.125rem] font-bold text-[var(--fg)] mb-1">
                No tracks in this setlist yet
              </p>
              <p className="font-[family-name:var(--font-body)] text-[0.8125rem] text-[var(--fg-2)]">
                Search for tracks and drag them here to build your setlist
              </p>
            </div>
          ) : (
            <SortableContext items={sortableTrackIds} strategy={verticalListSortingStrategy}>
              <div>
                {currentSetlist.tracks.map((setlistTrack, index) => {
                  const nextTrack = currentSetlist.tracks[index + 1]?.track;
                  return (
                    <SortableTrackItem
                      key={setlistTrack.id}
                      setlistTrack={setlistTrack}
                      index={index}
                      nextTrack={nextTrack}
                      onRemove={handleRemoveTrack}
                      onEdit={handleEditTrack}
                    />
                  );
                })}
              </div>
            </SortableContext>
          )}
        </div>

        <DragOverlay>
          <TrackDragOverlay track={activeTrack} />
        </DragOverlay>
      </DndContext>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-[var(--space-2)] pt-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <button
            className="px-4 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-semibold rounded-[var(--radius-control)] disabled:opacity-40"
            style={{ backgroundColor: 'var(--brand)', color: 'var(--on-brand)' }}
            onClick={handleSaveSetlist}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            💾 Save
          </button>
          <button
            className="px-3 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-medium rounded-[var(--radius-control)] disabled:opacity-40"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--line-strong)' }}
            onClick={() => setShowExportModal(true)}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            📤 Export
          </button>
          <button
            className="px-3 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-medium rounded-[var(--radius-control)]"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--line-strong)' }}
            onClick={() => setShowImportModal(true)}
          >
            📥 Import
          </button>
        </div>

        <button
          className="px-3 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-medium rounded-[var(--radius-control)] disabled:opacity-40"
          style={{ backgroundColor: 'var(--status-bad-bg)', color: 'var(--status-bad)', border: '1px solid var(--status-bad)' }}
          onClick={handleClearSetlist}
          disabled={!currentSetlist || currentSetlist.tracks.length === 0}
        >
          🗑️ Clear
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--overlay)', zIndex: 'var(--z-dialog)' }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="rounded-[var(--radius-sheet)] p-[var(--space-6)] max-w-md w-full flex flex-col gap-[var(--space-4)]"
            style={{
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--line-strong)',
              boxShadow: 'var(--shadow-3)',
              color: 'var(--fg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="font-[family-name:var(--font-display)] text-[1.25rem] font-bold">
                Export Setlist
              </h3>
              <button
                className="text-[var(--fg-3)] hover:text-[var(--fg)] font-bold text-lg"
                onClick={() => setShowExportModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-[0.875rem] text-[var(--fg-2)]">
              Export your setlist as a tokenized JSON file that can be shared or imported later.
            </p>
            <div className="flex flex-col gap-1 text-[0.8125rem] font-[family-name:var(--font-data)] bg-[var(--surface-2)] p-3 rounded-[var(--radius-control)]">
              <div>Name: <strong>{currentSetlist?.name}</strong></div>
              <div>Tracks: <strong>{currentSetlist?.tracks.length}</strong></div>
              <div>Duration: <strong>{formatDuration(totalDuration)}</strong></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-4 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-medium rounded-[var(--radius-control)] bg-[var(--surface-2)] border border-[var(--line-strong)] text-[var(--fg)]"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-semibold rounded-[var(--radius-control)] bg-[var(--brand)] text-[var(--on-brand)]"
                onClick={handleExportSetlist}
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--overlay)', zIndex: 'var(--z-dialog)' }}
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="rounded-[var(--radius-sheet)] p-[var(--space-6)] max-w-md w-full flex flex-col gap-[var(--space-4)]"
            style={{
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--line-strong)',
              boxShadow: 'var(--shadow-3)',
              color: 'var(--fg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <h3 className="font-[family-name:var(--font-display)] text-[1.25rem] font-bold">
                Import Setlist
              </h3>
              <button
                className="text-[var(--fg-3)] hover:text-[var(--fg)] font-bold text-lg"
                onClick={() => setShowImportModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-[0.875rem] text-[var(--fg-2)]">
              Paste the JSON data from an exported setlist:
            </p>
            <textarea
              className="w-full p-3 font-[family-name:var(--font-data)] text-[0.8125rem] rounded-[var(--radius-control)] bg-[var(--sunk)] border border-[var(--line-strong)] text-[var(--fg)] outline-none focus:border-[var(--brand)]"
              placeholder="Paste setlist JSON here..."
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              rows={8}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-4 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-medium rounded-[var(--radius-control)] bg-[var(--surface-2)] border border-[var(--line-strong)] text-[var(--fg)]"
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 font-[family-name:var(--font-body)] text-[0.875rem] font-semibold rounded-[var(--radius-control)] bg-[var(--brand)] text-[var(--on-brand)] disabled:opacity-40"
                onClick={handleImportSetlist}
                disabled={!importData.trim()}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <TrackEditModal
        track={editingTrack}
        onClose={() => setEditingTrack(null)}
        onSave={handleSaveTrackEdits}
      />
    </div>
  );
};

export default SetlistBuilder;
