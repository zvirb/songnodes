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
import { GripVertical, Edit2, X, Save, Download, Upload, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Track, SetlistTrack } from '../types';
import { TrackEditModal } from './TrackEditModal';

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
      case 'excellent': return 'var(--color-success)';
      case 'good': return 'var(--color-info)';
      case 'fair': return 'var(--color-warning)';
      case 'poor': return 'var(--color-error)';
      default: return 'var(--color-text-tertiary)';
    }
  };

  const getQualityBgColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'var(--color-success-bg)';
      case 'good': return 'var(--color-info-bg)';
      case 'fair': return 'var(--color-warning-bg)';
      case 'poor': return 'var(--color-error-bg)';
      default: return 'transparent';
    }
  };

  const getQualityBorderColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'var(--color-success-border)';
      case 'good': return 'var(--color-info-border)';
      case 'fair': return 'var(--color-warning-border)';
      case 'poor': return 'var(--color-error-border)';
      default: return 'var(--color-border-subtle)';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col bg-card-bg border border-card-border hover:border-border-strong hover:bg-card-hover rounded-card shadow-card hover:shadow-card-hover transition-all duration-fast mb-2"
      {...attributes}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm touch-none"
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical size={20} />
        </button>

        <div className="flex-shrink-0 w-8 text-center font-semibold text-text-secondary text-sm">
          {index + 1}.
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-text-primary truncate text-sm">{track.name}</div>
          <div className="text-xs text-text-secondary truncate mt-0.5">{track.artist}</div>

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
            <span className="px-2 py-0.5 bg-bg-elevated2 text-text-secondary border border-border-subtle rounded-badge font-mono">
              {formatDuration(track.duration)}
            </span>
            {track.energy && (
              <span className="px-2 py-0.5 bg-warning-bg text-warning border border-warning-border rounded-badge font-mono">
                Energy: {Math.round(track.energy * 100)}%
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-fast">
          <button
            className="p-2 text-text-tertiary hover:text-info hover:bg-bg-elevated2 rounded-button transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={() => onEdit(setlistTrack.id)}
            title="Edit track cues"
            aria-label="Edit track cues"
          >
            <Edit2 size={16} />
          </button>
          <button
            className="p-2 text-text-tertiary hover:text-error hover:bg-error-bg rounded-button transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={() => onRemove(setlistTrack.id)}
            title="Remove from setlist"
            aria-label="Remove from setlist"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {transitionQuality && (
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

// Track drag overlay component
const TrackDragOverlay: React.FC<{ track: SetlistTrack | null }> = ({ track }) => {
  if (!track) return null;

  return (
    <div className="bg-card-bg border border-brand-primary rounded-card shadow-lg p-3 opacity-90">
      <div className="flex items-center gap-3">
        <div className="text-brand-primary">
          <GripVertical size={20} />
        </div>
        <div>
          <div className="font-medium text-text-primary text-sm">{track.track.name}</div>
          <div className="text-xs text-text-secondary">{track.track.artist}</div>
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

  // Auto-dismiss error messages after 7 seconds
  React.useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Helper function to show error messages
  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    console.error('SetlistBuilder Error:', message);
  }, []);

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
      console.error('Create setlist error:', error);
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

    if (setlistName.trim().length > 100) {
      showError('Update failed: Setlist name is too long (max 100 characters).');
      return;
    }

    try {
      // Update the setlist name through store
      const updatedSetlist = {
        ...currentSetlist,
        name: setlistName.trim(),
        updated_at: new Date(),
      };
      setlist.loadSetlist(updatedSetlist);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Update failed: Could not update setlist name. ${errorMsg}`);
      console.error('Update setlist name error:', error);
    }
  }, [currentSetlist, setlistName, setlist, showError]);

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
    try {
      setlist.removeTrackFromSetlist(trackId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Remove failed: Could not remove track from setlist. ${errorMsg}`);
      console.error('Remove track error:', error);
    }
  }, [setlist, showError]);

  const handleEditTrack = useCallback((trackId: string) => {
    if (!currentSetlist) return;
    const track = currentSetlist.tracks.find(t => t.id === trackId);
    if (track) {
      setEditingTrack(track);
    }
  }, [currentSetlist]);

  const handleSaveTrackEdits = useCallback((trackId: string, updates: Partial<SetlistTrack>) => {
    try {
      setlist.updateSetlistTrack(trackId, updates);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Update failed: Could not update track. ${errorMsg}`);
      console.error('Update track error:', error);
    }
  }, [setlist, showError]);

  const handleSaveSetlist = useCallback(() => {
    if (!currentSetlist) {
      showError('Save failed: No setlist to save. Please create a setlist first.');
      return;
    }

    if (!currentSetlist.tracks || currentSetlist.tracks.length === 0) {
      showError('Save failed: Cannot save an empty setlist. Add at least one track before saving.');
      return;
    }

    try {
      setlist.saveCurrentSetlist();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Save failed: Could not save setlist. ${errorMsg}`);
      console.error('Save error:', error);
    }
  }, [currentSetlist, setlist, showError]);

  const handleClearSetlist = useCallback(() => {
    setlist.clearSetlist();
    setSetlistName('');
  }, [setlist]);

  const handleExportSetlist = useCallback(() => {
    if (!currentSetlist) {
      showError('Export failed: No setlist to export. Please create a setlist first.');
      return;
    }

    if (!currentSetlist.tracks || currentSetlist.tracks.length === 0) {
      showError('Export failed: Setlist has no tracks. Add tracks before exporting.');
      return;
    }

    try {
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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Export failed: Could not create export file. ${errorMsg}`);
      console.error('Export error:', error);
    }
  }, [currentSetlist, totalDuration, averageBpm, showError]);

  const handleImportSetlist = useCallback(() => {
    if (!importData.trim()) {
      showError('Import failed: No data provided. Please paste your setlist JSON data.');
      return;
    }

    try {
      // Parse JSON data
      let data;
      try {
        data = JSON.parse(importData);
      } catch (parseError) {
        showError('Import failed: Invalid JSON format. Please check your data and try again.');
        return;
      }

      // Validate required fields
      if (!data || typeof data !== 'object') {
        showError('Import failed: Invalid setlist format. Data must be a valid JSON object.');
        return;
      }

      if (!data.name || typeof data.name !== 'string') {
        showError('Import failed: Missing or invalid setlist name. Please ensure the JSON includes a valid "name" field.');
        return;
      }

      if (!Array.isArray(data.tracks)) {
        showError('Import failed: Missing or invalid tracks array. Please ensure the JSON includes a "tracks" array.');
        return;
      }

      // Validate track data
      if (data.tracks.length === 0) {
        showError('Import failed: Setlist contains no tracks. Please import a setlist with at least one track.');
        return;
      }

      // Check file size (rough estimate: 1MB limit)
      const dataSize = new Blob([importData]).size;
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (dataSize > maxSize) {
        showError(`Import failed: File is too large (${(dataSize / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`);
        return;
      }

      // Validate track structure
      let validTracks = 0;
      for (let i = 0; i < data.tracks.length; i++) {
        const trackData = data.tracks[i];
        if (!trackData.track || typeof trackData.track !== 'object') {
          console.warn(`Track at position ${i + 1} has invalid structure, skipping`);
          continue;
        }

        if (!trackData.track.id || !trackData.track.name || !trackData.track.artist) {
          console.warn(`Track at position ${i + 1} missing required fields (id, name, artist), skipping`);
          continue;
        }

        validTracks++;
      }

      if (validTracks === 0) {
        showError('Import failed: No valid tracks found in the data. Each track must have id, name, and artist fields.');
        return;
      }

      // Create new setlist from imported data
      try {
        setlist.createNewSetlist(data.name);
      } catch (createError) {
        showError('Import failed: Could not create setlist. Please try again or contact support.');
        console.error('Setlist creation error:', createError);
        return;
      }

      // Add tracks
      let addedCount = 0;
      data.tracks.forEach((trackData: any, index: number) => {
        if (trackData.track && trackData.track.id && trackData.track.name && trackData.track.artist) {
          try {
            setlist.addTrackToSetlist(trackData.track, index);
            addedCount++;
          } catch (addError) {
            console.warn(`Failed to add track at position ${index + 1}:`, addError);
          }
        }
      });

      if (addedCount === 0) {
        showError('Import failed: Could not add any tracks to the setlist. Please check the data format.');
        setlist.clearSetlist();
        return;
      }

      // Success
      setImportData('');
      setShowImportModal(false);

      // Show success feedback (if some tracks were skipped)
      if (addedCount < data.tracks.length) {
        console.warn(`Import partially successful: ${addedCount} of ${data.tracks.length} tracks imported`);
      }

    } catch (error) {
      // Catch any unexpected errors
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showError(`Import failed: An unexpected error occurred. ${errorMsg}`);
      console.error('Unexpected import error:', error);
    }
  }, [importData, setlist, showError]);

  const sortableTrackIds = currentSetlist?.tracks.map(t => t.id) || [];

  return (
    <div className="setlist-builder">
      {/* Error Message Display */}
      {errorMessage && (
        <div className="p-3 bg-error-bg border border-error-border rounded-card mb-4">
          <div className="flex items-start justify-between">
            <p className="text-error text-sm flex-1">{errorMessage}</p>
            <button
              className="ml-2 text-error hover:text-brand-tertiary-hover p-1 rounded-button"
              onClick={() => setErrorMessage(null)}
              title="Dismiss error"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="p-4 bg-bg-elevated1 border-b border-border-subtle rounded-t-card mb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-text-tertiary mb-1">Setlist Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 bg-input-bg border border-input-border text-text-primary rounded-input focus-visible:outline-none focus-visible:border-input-focus focus-visible:ring-2 focus-visible:ring-border-focus text-sm transition-all duration-fast"
                placeholder="Enter setlist name..."
                value={setlistName}
                onChange={(e) => setSetlistName(e.target.value)}
                onBlur={handleUpdateSetlistName}
                onKeyPress={(e) => e.key === 'Enter' && handleUpdateSetlistName()}
              />
              {!currentSetlist && (
                <button
                  className="px-4 py-2 bg-brand-primary text-text-inverse font-medium rounded-button hover:bg-brand-primary-hover disabled:opacity-50 transition-colors duration-fast text-sm"
                  onClick={handleCreateSetlist}
                  disabled={!setlistName.trim()}
                >
                  Create
                </button>
              )}
            </div>
          </div>

          {currentSetlist && (
            <div className="flex gap-4 bg-bg-elevated2 border border-border-subtle p-2.5 rounded-card text-xs">
              <div>
                <span className="text-text-tertiary">Tracks: </span>
                <span className="font-semibold text-text-primary">{currentSetlist.tracks.length}</span>
              </div>
              <div className="border-l border-border-subtle pl-4">
                <span className="text-text-tertiary">Duration: </span>
                <span className="font-semibold text-text-primary">{formatDuration(totalDuration)}</span>
              </div>
              <div className="border-l border-border-subtle pl-4">
                <span className="text-text-tertiary">Avg BPM: </span>
                <span className="font-semibold text-text-primary">{averageBpm || '--'}</span>
              </div>
            </div>
          )}
        </div>
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

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border-subtle mt-4">
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 text-sm bg-brand-primary text-text-inverse font-medium rounded-button hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={handleSaveSetlist}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            <Save size={16} />
            Save Setlist
          </button>

          <button
            className="px-3 py-2 text-sm bg-button-bg text-text-primary border border-border-default rounded-button hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={() => setShowExportModal(true)}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            <Download size={16} />
            Export
          </button>

          <button
            className="px-3 py-2 text-sm bg-button-bg text-text-primary border border-border-default rounded-button hover:bg-button-hover flex items-center gap-2 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={() => setShowImportModal(true)}
          >
            <Upload size={16} />
            Import
          </button>
        </div>

        <div>
          <button
            className="px-3 py-2 text-sm bg-error-bg text-error border border-error-border rounded-button hover:bg-error/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={handleClearSetlist}
            disabled={!currentSetlist || currentSetlist.tracks.length === 0}
          >
            <Trash2 size={16} />
            Clear All
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-modal-overlay flex items-center justify-center z-modal" onClick={() => setShowExportModal(false)}>
          <div className="bg-modal-bg border border-border-default rounded-modal p-6 max-w-md w-full shadow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-primary">Export Setlist</h3>
              <button className="text-text-tertiary hover:text-text-primary p-1 rounded-button" onClick={() => setShowExportModal(false)} aria-label="Close export modal">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-sm text-text-secondary mb-6">
              <p>Export your setlist as a JSON file that can be shared or imported later.</p>
              <div className="bg-bg-elevated1 border border-border-subtle p-3 rounded-card space-y-1">
                <div>Name: <strong className="text-text-primary">{currentSetlist?.name}</strong></div>
                <div>Tracks: <strong className="text-text-primary">{currentSetlist?.tracks.length}</strong></div>
                <div>Duration: <strong className="text-text-primary">{formatDuration(totalDuration)}</strong></div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-button-bg text-text-primary border border-border-default rounded-button hover:bg-button-hover" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-brand-primary text-text-inverse font-medium rounded-button hover:bg-brand-primary-hover" onClick={handleExportSetlist}>
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-modal-overlay flex items-center justify-center z-modal" onClick={() => setShowImportModal(false)}>
          <div className="bg-modal-bg border border-border-default rounded-modal p-6 max-w-md w-full shadow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-primary">Import Setlist</h3>
              <button className="text-text-tertiary hover:text-text-primary p-1 rounded-button" onClick={() => setShowImportModal(false)} aria-label="Close import modal">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              <p className="text-sm text-text-secondary">Paste the JSON data from an exported setlist:</p>
              <textarea
                className="w-full p-3 bg-input-bg border border-input-border text-text-primary rounded-input focus-visible:outline-none focus-visible:border-input-focus focus-visible:ring-2 focus-visible:ring-border-focus font-mono text-xs"
                placeholder="Paste setlist JSON here..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={10}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-button-bg text-text-primary border border-border-default rounded-button hover:bg-button-hover" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-brand-primary text-text-inverse font-medium rounded-button hover:bg-brand-primary-hover disabled:opacity-50"
                onClick={handleImportSetlist}
                disabled={!importData.trim()}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track Edit Modal */}
      <TrackEditModal
        track={editingTrack}
        onClose={() => setEditingTrack(null)}
        onSave={handleSaveTrackEdits}
      />
    </div>
  );
};

export default SetlistBuilder;