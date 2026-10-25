import React, { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Track, GraphNode } from '../types';
import { API_BASE_URL } from '../lib/apiBase';
import { Dialog } from './ds';

interface EditTrackModalProps {
  node?: GraphNode;
  track?: Track;
  onClose: () => void;
  onSave?: (updatedTrack: Partial<Track>) => void;
}

export const EditTrackModal: React.FC<EditTrackModalProps> = ({
  node,
  track,
  onClose,
  onSave
}) => {
  // Extract track data from either node or track prop
  const initialTrack = track || (node ? {
    id: node.track?.id || node.id,
    name: node.track?.name || node.title || node.label || '',
    artist: node.track?.artist || node.artist || '',
    bpm: node.track?.bpm || node.bpm,
    key: node.track?.key || node.key,
    genre: node.track?.genre || node.genre,
  } as Track : null);

  // Form state
  const [formData, setFormData] = useState({
    artist: initialTrack?.artist || '',
    title: initialTrack?.name || initialTrack?.title || '',
    bpm: initialTrack?.bpm?.toString() || '',
    key: initialTrack?.key || '',
    genre: initialTrack?.genre || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validation
  const isValid = formData.artist.trim().length > 0 && formData.title.trim().length > 0;

  const handleSave = async () => {
    if (!isValid || !initialTrack?.id) {
      setError('Artist name and track title are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Call API to update track
      const response = await fetch(`${API_BASE_URL}/api/tracks/${initialTrack.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_name: formData.artist,
          track_title: formData.title,
          bpm: formData.bpm ? parseFloat(formData.bpm) : null,
          key: formData.key || null,
          genre: formData.genre || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update track' }));
        throw new Error(errorData.detail || `Failed to update track: ${response.statusText}`);
      }

      // Show success message
      setSuccess(true);

      // Call onSave callback if provided
      if (onSave) {
        onSave({
          ...initialTrack,
          artist: formData.artist,
          name: formData.title,
          title: formData.title,
          bpm: formData.bpm ? parseFloat(formData.bpm) : undefined,
          key: formData.key || undefined,
          genre: formData.genre || undefined,
        });
      }

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        // Trigger a graph refresh
        window.dispatchEvent(new CustomEvent('refreshGraph'));
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update track');
      console.error('Error updating track:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  if (!initialTrack) {
    return null;
  }

  return (
    <Dialog
      open={!!initialTrack}
      title="Edit track metadata"
      sub={`${initialTrack.artist || 'Artist'} – ${initialTrack.name || initialTrack.title || 'Track'}`}
      size="s"
      onClose={onClose}
      onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      footer={
        <>
          <button
            type="button"
            className="sn-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="sn-btn sn-btn--primary"
            disabled={!isValid || saving || success}
            aria-busy={saving || undefined}
          >
            {saving ? (
              <>
                <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : success ? (
              '✓ Saved'
            ) : (
              <>
                <Save size={16} strokeWidth={2} aria-hidden="true" />
                Save changes
              </>
            )}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && (
          <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="sn-inline-message sn-inline-message--boxed" data-status="ok" role="status">
            ✓ Track updated successfully!
          </p>
        )}

        <div className="sn-field">
          <label htmlFor="etm-artist">Artist name</label>
          <input
            id="etm-artist"
            type="text"
            className="sn-input"
            value={formData.artist}
            onChange={(e) => handleChange('artist', e.target.value)}
            placeholder="Enter artist name"
            required
            aria-required="true"
          />
        </div>

        <div className="sn-field">
          <label htmlFor="etm-title">Track title</label>
          <input
            id="etm-title"
            type="text"
            className="sn-input"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter track title"
            required
            aria-required="true"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
          <div className="sn-field">
            <label htmlFor="etm-bpm">BPM</label>
            <input
              id="etm-bpm"
              type="number"
              className="sn-input"
              value={formData.bpm}
              onChange={(e) => handleChange('bpm', e.target.value)}
              placeholder="120"
              min="20"
              max="300"
              step="0.1"
            />
          </div>

          <div className="sn-field">
            <label htmlFor="etm-key">Key</label>
            <input
              id="etm-key"
              type="text"
              className="sn-input"
              value={formData.key}
              onChange={(e) => handleChange('key', e.target.value)}
              placeholder="e.g. 8A or A Minor"
            />
          </div>
        </div>

        <div className="sn-field">
          <label htmlFor="etm-genre">Genre</label>
          <input
            id="etm-genre"
            type="text"
            className="sn-input"
            value={formData.genre}
            onChange={(e) => handleChange('genre', e.target.value)}
            placeholder="e.g. House, Techno"
          />
        </div>
      </div>
    </Dialog>
  );
};
