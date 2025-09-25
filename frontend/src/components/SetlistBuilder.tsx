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
import {
  CSS,
} from '@dnd-kit/utilities';
import { useStore } from '../store/useStore';
import { Track, SetlistTrack } from '../types';

// Camelot Wheel mapping for key compatibility
const CAMELOT_WHEEL: Record<string, { number: number; letter: string; compatibles: string[] }> = {
  'C': { number: 8, letter: 'B', compatibles: ['G', 'F', 'Am', 'Dm'] },
  'Dm': { number: 7, letter: 'A', compatibles: ['C', 'Bb', 'Am', 'Gm'] },
  'G': { number: 9, letter: 'B', compatibles: ['C', 'D', 'Em', 'Am'] },
  'Am': { number: 8, letter: 'A', compatibles: ['C', 'Dm', 'G', 'Em'] },
  'F': { number: 7, letter: 'B', compatibles: ['C', 'Bb', 'Dm', 'Gm'] },
  'Em': { number: 9, letter: 'A', compatibles: ['G', 'Am', 'D', 'Bm'] },
  'Bb': { number: 6, letter: 'B', compatibles: ['F', 'Eb', 'Gm', 'Cm'] },
  'Gm': { number: 6, letter: 'A', compatibles: ['Bb', 'F', 'Dm', 'Cm'] },
  'D': { number: 10, letter: 'B', compatibles: ['G', 'A', 'Bm', 'Em'] },
  'Bm': { number: 10, letter: 'A', compatibles: ['D', 'G', 'Em', 'F#m'] },
  'A': { number: 11, letter: 'B', compatibles: ['D', 'E', 'F#m', 'Bm'] },
  'F#m': { number: 11, letter: 'A', compatibles: ['A', 'D', 'Bm', 'C#m'] },
  'E': { number: 12, letter: 'B', compatibles: ['A', 'B', 'C#m', 'F#m'] },
  'C#m': { number: 12, letter: 'A', compatibles: ['E', 'A', 'F#m', 'G#m'] },
  'B': { number: 1, letter: 'B', compatibles: ['E', 'F#', 'G#m', 'C#m'] },
  'G#m': { number: 1, letter: 'A', compatibles: ['B', 'E', 'C#m', 'D#m'] },
  'F#': { number: 2, letter: 'B', compatibles: ['B', 'C#', 'D#m', 'G#m'] },
  'D#m': { number: 2, letter: 'A', compatibles: ['F#', 'B', 'G#m', 'A#m'] },
  'Db': { number: 3, letter: 'B', compatibles: ['F#', 'Ab', 'Bbm', 'D#m'] },
  'Bbm': { number: 3, letter: 'A', compatibles: ['Db', 'F#', 'D#m', 'Fm'] },
  'Ab': { number: 4, letter: 'B', compatibles: ['Db', 'Eb', 'Fm', 'Bbm'] },
  'Fm': { number: 4, letter: 'A', compatibles: ['Ab', 'Db', 'Bbm', 'Cm'] },
  'Eb': { number: 5, letter: 'B', compatibles: ['Ab', 'Bb', 'Cm', 'Fm'] },
  'Cm': { number: 5, letter: 'A', compatibles: ['Eb', 'Ab', 'Fm', 'Gm'] },
};

// Helper functions
const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getKeyCompatibility = (key1?: string, key2?: string): 'perfect' | 'good' | 'poor' | 'unknown' => {
  if (!key1 || !key2) return 'unknown';

  const camelot1 = CAMELOT_WHEEL[key1];
  const camelot2 = CAMELOT_WHEEL[key2];

  if (!camelot1 || !camelot2) return 'unknown';

  if (key1 === key2) return 'perfect';
  if (camelot1.compatibles.includes(key2)) return 'good';

  // Check if adjacent on Camelot wheel
  const numberDiff = Math.abs(camelot1.number - camelot2.number);
  if ((numberDiff <= 1 || numberDiff >= 11) && camelot1.letter === camelot2.letter) return 'good';

  return 'poor';
};

const getBpmCompatibility = (bpm1?: number, bpm2?: number): 'perfect' | 'good' | 'poor' | 'unknown' => {
  if (!bpm1 || !bpm2) return 'unknown';

  const diff = Math.abs(bpm1 - bpm2);

  if (diff === 0) return 'perfect';
  if (diff <= 3) return 'good';
  if (diff <= 8) return 'good';

  // Check for harmonic mixing (double/half tempo)
  const ratio1 = bpm1 / bpm2;
  const ratio2 = bpm2 / bpm1;

  if (Math.abs(ratio1 - 2) < 0.1 || Math.abs(ratio2 - 2) < 0.1) return 'good';
  if (Math.abs(ratio1 - 1.5) < 0.1 || Math.abs(ratio2 - 1.5) < 0.1) return 'good';

  return 'poor';
};

const getTransitionQuality = (track1: Track, track2: Track): {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  key: ReturnType<typeof getKeyCompatibility>;
  bpm: ReturnType<typeof getBpmCompatibility>;
  energy?: 'good' | 'poor' | 'unknown';
} => {
  const keyComp = getKeyCompatibility(track1.key, track2.key);
  const bpmComp = getBpmCompatibility(track1.bpm, track2.bpm);

  let energyComp: 'good' | 'poor' | 'unknown' = 'unknown';
  if (track1.energy !== undefined && track2.energy !== undefined) {
    const energyDiff = Math.abs(track1.energy - track2.energy);
    energyComp = energyDiff <= 0.2 ? 'good' : 'poor';
  }

  // Calculate overall quality
  let score = 0;
  if (keyComp === 'perfect') score += 3;
  else if (keyComp === 'good') score += 2;
  else if (keyComp === 'poor') score -= 1;

  if (bpmComp === 'perfect') score += 3;
  else if (bpmComp === 'good') score += 2;
  else if (bpmComp === 'poor') score -= 1;

  if (energyComp === 'good') score += 1;
  else if (energyComp === 'poor') score -= 1;

  let overall: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 5) overall = 'excellent';
  else if (score >= 3) overall = 'good';
  else if (score >= 1) overall = 'fair';
  else overall = 'poor';

  return { overall, key: keyComp, bpm: bpmComp, energy: energyComp };
};

// Sortable track item component
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const { track } = setlistTrack;
  const transitionQuality = nextTrack ? getTransitionQuality(track, nextTrack) : null;

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'var(--color-accent-primary)';
      case 'good': return 'var(--color-accent-tertiary)';
      case 'fair': return 'var(--color-accent-warning)';
      case 'poor': return 'var(--color-accent-secondary)';
      default: return 'var(--color-text-tertiary)';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="setlist-track-item"
      {...attributes}
    >
      <div className="setlist-track-content">
        <div className="track-drag-handle" {...listeners}>
          ⋮⋮
        </div>

        <div className="track-position">
          {index + 1}.
        </div>

        <div className="track-info">
          <div className="track-title">{track.name}</div>
          <div className="track-artist">{track.artist}</div>

          <div className="track-metadata">
            {track.bpm && (
              <span className="track-bpm">
                {track.bpm} BPM
              </span>
            )}
            {track.key && (
              <span className="track-key">
                {track.key}
              </span>
            )}
            <span className="track-duration">
              {formatDuration(track.duration)}
            </span>
            {track.energy && (
              <span className="track-energy">
                Energy: {Math.round(track.energy * 100)}%
              </span>
            )}
          </div>
        </div>

        <div className="track-actions">
          <button
            className="btn btn-small btn-icon"
            onClick={() => onEdit(setlistTrack.id)}
            title="Edit track cues"
          >
            ✏️
          </button>
          <button
            className="btn btn-small btn-icon btn-danger"
            onClick={() => onRemove(setlistTrack.id)}
            title="Remove from setlist"
          >
            ✕
          </button>
        </div>
      </div>

      {transitionQuality && (
        <div className="transition-indicator">
          <div className="transition-quality" style={{ color: getQualityColor(transitionQuality.overall) }}>
            <span className="transition-label">Transition:</span>
            <span className="transition-overall">{transitionQuality.overall.toUpperCase()}</span>
            <div className="transition-details">
              <span className="key-compatibility" style={{ color: getQualityColor(transitionQuality.key) }}>
                Key: {transitionQuality.key}
              </span>
              <span className="bpm-compatibility" style={{ color: getQualityColor(transitionQuality.bpm) }}>
                BPM: {transitionQuality.bpm}
              </span>
              {transitionQuality.energy && transitionQuality.energy !== 'unknown' && (
                <span className="energy-compatibility" style={{ color: getQualityColor(transitionQuality.energy) }}>
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

// Track drag overlay component
const TrackDragOverlay: React.FC<{ track: SetlistTrack | null }> = ({ track }) => {
  if (!track) return null;

  return (
    <div className="setlist-track-item dragging-overlay">
      <div className="setlist-track-content">
        <div className="track-drag-handle">⋮⋮</div>
        <div className="track-info">
          <div className="track-title">{track.track.name}</div>
          <div className="track-artist">{track.track.artist}</div>
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

  // Initialize setlist name when currentSetlist changes
  React.useEffect(() => {
    if (currentSetlist?.name) {
      setSetlistName(currentSetlist.name);
    }
  }, [currentSetlist?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
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
    return currentSetlist.tracks.map(st => st.track.bpm).filter(Boolean) as number[];
  }, [currentSetlist?.tracks]);

  const averageBpm = useMemo(() => {
    if (bpmProgression.length === 0) return 0;
    return Math.round(bpmProgression.reduce((sum, bpm) => sum + bpm, 0) / bpmProgression.length);
  }, [bpmProgression]);

  const handleCreateSetlist = useCallback(() => {
    const name = setlistName || 'New Setlist';
    setlist.createNewSetlist(name);
    setSetlistName(name);
  }, [setlistName, setlist]);

  const handleUpdateSetlistName = useCallback(() => {
    if (!currentSetlist || !setlistName.trim()) return;

    // Update the setlist name through store
    const updatedSetlist = {
      ...currentSetlist,
      name: setlistName.trim(),
      updated_at: new Date(),
    };
    setlist.loadSetlist(updatedSetlist);
  }, [currentSetlist, setlistName, setlist]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeTrackItem = currentSetlist?.tracks.find(t => t.id === event.active.id);
    setActiveTrack(activeTrackItem || null);
  }, [currentSetlist]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTrack(null);

    if (!over || active.id === over.id) {
      return;
    }

    if (!currentSetlist) return;

    const oldIndex = currentSetlist.tracks.findIndex(t => t.id === active.id);
    const newIndex = currentSetlist.tracks.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setlist.moveTrackInSetlist(String(active.id), newIndex);
    }
  }, [currentSetlist, setlist]);

  const handleRemoveTrack = useCallback((trackId: string) => {
    setlist.removeTrackFromSetlist(trackId);
  }, [setlist]);

  const handleEditTrack = useCallback((trackId: string) => {
    // TODO: Open track editing modal/panel
    console.log('Edit track:', trackId);
  }, []);

  const handleSaveSetlist = useCallback(() => {
    if (currentSetlist) {
      setlist.saveCurrentSetlist();
    }
  }, [currentSetlist, setlist]);

  const handleClearSetlist = useCallback(() => {
    setlist.clearSetlist();
    setSetlistName('');
  }, [setlist]);

  const handleExportSetlist = useCallback(() => {
    if (!currentSetlist) return;

    const exportData = {
      name: currentSetlist.name,
      tracks: currentSetlist.tracks.map(st => ({
        track: st.track,
        position: st.position,
        transition_notes: st.transition_notes,
        key_shift: st.key_shift,
        tempo_change: st.tempo_change,
        mix_cue_in: st.mix_cue_in,
        mix_cue_out: st.mix_cue_out,
      })),
      created_at: currentSetlist.created_at,
      duration: totalDuration,
      metadata: {
        totalTracks: currentSetlist.tracks.length,
        averageBpm,
        exportedAt: new Date(),
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSetlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_setlist.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
  }, [currentSetlist, totalDuration, averageBpm]);

  const handleImportSetlist = useCallback(() => {
    if (!importData.trim()) return;

    try {
      const data = JSON.parse(importData);

      if (!data.name || !Array.isArray(data.tracks)) {
        throw new Error('Invalid setlist format');
      }

      // Create new setlist from imported data
      setlist.createNewSetlist(data.name);

      // Add tracks
      data.tracks.forEach((trackData: any, index: number) => {
        if (trackData.track) {
          setlist.addTrackToSetlist(trackData.track, index);
        }
      });

      setImportData('');
      setShowImportModal(false);
    } catch (error) {
      console.error('Import failed:', error);
      // TODO: Show error message
    }
  }, [importData, setlist]);

  const sortableTrackIds = currentSetlist?.tracks.map(t => t.id) || [];

  return (
    <div className="setlist-builder">
      <div className="setlist-header">
        <div className="input-group">
          <label className="input-label">Setlist Name</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input"
              placeholder="Enter setlist name..."
              value={setlistName}
              onChange={(e) => setSetlistName(e.target.value)}
              onBlur={handleUpdateSetlistName}
              onKeyPress={(e) => e.key === 'Enter' && handleUpdateSetlistName()}
            />
            {!currentSetlist && (
              <button
                className="btn btn-primary"
                onClick={handleCreateSetlist}
                disabled={!setlistName.trim()}
              >
                Create
              </button>
            )}
          </div>
        </div>

        {currentSetlist && (
          <div className="setlist-stats">
            <div className="stat-item">
              <span className="stat-label">Tracks:</span>
              <span className="stat-value">{currentSetlist.tracks.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Duration:</span>
              <span className="stat-value">{formatDuration(totalDuration)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg BPM:</span>
              <span className="stat-value">{averageBpm || '--'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="setlist-content">
        <div className="input-group">
          <label className="input-label">
            Tracks ({currentSetlist?.tracks.length || 0})
          </label>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="setlist-tracks-container">
              {!currentSetlist || currentSetlist.tracks.length === 0 ? (
                <div className="setlist-empty">
                  <div className="empty-message">
                    <p>No tracks in this setlist yet</p>
                    <p className="empty-hint">
                      Search for tracks and drag them here to build your setlist
                    </p>
                  </div>
                </div>
              ) : (
                <SortableContext items={sortableTrackIds} strategy={verticalListSortingStrategy}>
                  <div className="setlist-tracks">
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
        </div>

        {currentSetlist && bpmProgression.length > 1 && (
          <div className="bpm-progression">
            <label className="input-label">BPM Progression</label>
            <div className="bpm-visualization">
              {bpmProgression.map((bpm, index) => {
                const isFirst = index === 0;
                const isLast = index === bpmProgression.length - 1;
                const prevBpm = isFirst ? null : bpmProgression[index - 1];
                const change = prevBpm ? bpm - prevBpm : 0;

                return (
                  <div key={index} className="bpm-point">
                    <div className="bpm-value">{bpm}</div>
                    {!isFirst && (
                      <div className={`bpm-change ${change > 0 ? 'increase' : change < 0 ? 'decrease' : 'same'}`}>
                        {change > 0 ? `+${change}` : change < 0 ? change : '='}
                      </div>
                    )}
                    {!isLast && <div className="bpm-connector" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="setlist-actions">
        <div className="action-group">
          <button
            className="btn btn-primary"
            onClick={handleSaveSetlist}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            💾 Save Setlist
          </button>

          <button
            className="btn"
            onClick={() => setShowExportModal(true)}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            📤 Export
          </button>

          <button
            className="btn"
            onClick={() => setShowImportModal(true)}
          >
            📥 Import
          </button>
        </div>

        <div className="action-group">
          <button
            className="btn btn-danger"
            onClick={handleClearSetlist}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Setlist</h3>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>✕</button>
            </div>
            <div className="modal-content">
              <p>Export your setlist as a JSON file that can be shared or imported later.</p>
              <div className="export-stats">
                <div>Name: <strong>{currentSetlist?.name}</strong></div>
                <div>Tracks: <strong>{currentSetlist?.tracks.length}</strong></div>
                <div>Duration: <strong>{formatDuration(totalDuration)}</strong></div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExportSetlist}>Export</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Setlist</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <div className="modal-content">
              <p>Paste the JSON data from an exported setlist:</p>
              <textarea
                className="import-textarea"
                placeholder="Paste setlist JSON here..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={10}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleImportSetlist}
                disabled={!importData.trim()}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetlistBuilder;