import React, { useState } from 'react';
import { Save, AlertCircle, Loader2 } from 'lucide-react';
import { Track, GraphNode } from '../types';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from './ui';

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
  onSave,
}) => {
  // Extract track data from either node or track prop
  const initialTrack = track || (node ? ({
    id: node.track?.id || node.id,
    name: node.track?.name || node.title || node.label || '',
    artist: node.track?.artist || node.artist || '',
    bpm: node.track?.bpm || node.bpm,
    key: node.track?.key || node.key,
    genre: node.track?.genre || node.genre,
  } as Track) : null);

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
      const response = await fetch(`http://localhost:8082/api/tracks/${initialTrack.id}`, {
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

      setSuccess(true);

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

      setTimeout(() => {
        onClose();
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
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  if (!initialTrack) {
    return null;
  }

  return (
    <Modal open={!!initialTrack} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent size="md" className="p-6">
        <ModalHeader className="pb-4 border-b border-[var(--color-border-subtle)]">
          <ModalTitle>Edit Track</ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-4 pt-4">
          <Input
            label="Artist Name"
            required
            value={formData.artist}
            onChange={(e) => handleChange('artist', e.target.value)}
            placeholder="Enter artist name"
          />

          <Input
            label="Track Title"
            required
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter track title"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="BPM"
              type="number"
              value={formData.bpm}
              onChange={(e) => handleChange('bpm', e.target.value)}
              placeholder="120"
              min={20}
              max={300}
              step={0.1}
            />

            <Input
              label="Key"
              value={formData.key}
              onChange={(e) => handleChange('key', e.target.value)}
              placeholder="A Minor"
            />
          </div>

          <Input
            label="Genre"
            value={formData.genre}
            onChange={(e) => handleChange('genre', e.target.value)}
            placeholder="House, Techno, etc."
          />

          {error && (
            <div className="p-3 bg-[var(--color-error-bg)] border border-[var(--color-border-error)] rounded-[var(--radius-base)] text-[var(--color-error)] flex items-center gap-2 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-border-success)] rounded-[var(--radius-base)] text-[var(--color-success)] text-xs text-center font-medium">
              ✓ Track updated successfully!
            </div>
          )}
        </ModalBody>

        <ModalFooter className="pt-4 border-t border-[var(--color-border-subtle)]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isValid || saving || success}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : success ? (
              '✓ Saved'
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
