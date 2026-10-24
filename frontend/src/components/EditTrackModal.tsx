import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Track, GraphNode } from '../types';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

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
  const initialTrack =
    track ||
    (node
      ? ({
          id: node.track?.id || node.id,
          name: node.track?.name || node.title || node.label || '',
          artist: node.track?.artist || node.artist || '',
          bpm: node.track?.bpm || node.bpm,
          key: node.track?.key || node.key,
          genre: node.track?.genre || node.genre,
        } as Track)
      : null);

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

  // Re-sync form data when initialTrack changes
  useEffect(() => {
    if (initialTrack) {
      setFormData({
        artist: initialTrack.artist || '',
        title: initialTrack.name || initialTrack.title || '',
        bpm: initialTrack.bpm?.toString() || '',
        key: initialTrack.key || '',
        genre: initialTrack.genre || '',
      });
      setError(null);
      setSuccess(false);
    }
  }, [initialTrack]);

  // Validation
  const isValid =
    formData.artist.trim().length > 0 && formData.title.trim().length > 0;

  const handleSave = async () => {
    if (!isValid || !initialTrack?.id) {
      setError('Artist name and track title are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';
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
        const errorData = await response
          .json()
          .catch(() => ({ detail: 'Failed to update track' }));
        throw new Error(
          errorData.detail || `Failed to update track: ${response.statusText}`
        );
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
    <Modal open={Boolean(initialTrack)} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Edit Track</ModalTitle>
          <ModalDescription>
            Modify core track attributes including artist, title, BPM, key, and genre.
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="space-y-4">
          <Input
            label="Artist Name"
            required
            placeholder="Enter artist name"
            value={formData.artist}
            onChange={(e) => handleChange('artist', e.target.value)}
          />

          <Input
            label="Track Title"
            required
            placeholder="Enter track title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="BPM"
              type="number"
              placeholder="120"
              min={20}
              max={300}
              step={0.1}
              value={formData.bpm}
              onChange={(e) => handleChange('bpm', e.target.value)}
            />

            <Input
              label="Key"
              placeholder="A Minor"
              value={formData.key}
              onChange={(e) => handleChange('key', e.target.value)}
            />
          </div>

          <Input
            label="Genre"
            placeholder="House, Techno, Deep House, etc."
            value={formData.genre}
            onChange={(e) => handleChange('genre', e.target.value)}
          />

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-error)] bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-error)]" role="alert">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-success)] bg-[var(--color-bg-secondary)] p-3 text-xs font-semibold text-[var(--color-success,#7ED321)]">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Track updated successfully!</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!isValid || saving || success}
          >
            {success ? 'Saved' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
