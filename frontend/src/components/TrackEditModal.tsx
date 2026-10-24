import React, { useState, useEffect } from 'react';
import { SetlistTrack } from '../types';
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

interface TrackEditModalProps {
  track: SetlistTrack | null;
  onClose: () => void;
  onSave: (trackId: string, updates: Partial<SetlistTrack>) => void;
}

export const TrackEditModal: React.FC<TrackEditModalProps> = ({ track, onClose, onSave }) => {
  const [transitionNotes, setTransitionNotes] = useState('');
  const [keyShift, setKeyShift] = useState('');
  const [tempoChange, setTempoChange] = useState('');
  const [mixCueIn, setMixCueIn] = useState('');
  const [mixCueOut, setMixCueOut] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with track data
  useEffect(() => {
    if (track) {
      setTransitionNotes(track.transition_notes || '');
      setKeyShift(track.key_shift !== undefined ? String(track.key_shift) : '');
      setTempoChange(track.tempo_change !== undefined ? String(track.tempo_change) : '');
      setMixCueIn(track.mix_cue_in !== undefined ? String(track.mix_cue_in) : '');
      setMixCueOut(track.mix_cue_out !== undefined ? String(track.mix_cue_out) : '');
      setErrors({});
    }
  }, [track]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate key shift (-12 to +12 semitones)
    if (keyShift !== '') {
      const keyShiftNum = parseFloat(keyShift);
      if (isNaN(keyShiftNum)) {
        newErrors.keyShift = 'Must be a valid number';
      } else if (keyShiftNum < -12 || keyShiftNum > 12) {
        newErrors.keyShift = 'Must be between -12 and +12 semitones';
      }
    }

    // Validate tempo change (-50% to +50%)
    if (tempoChange !== '') {
      const tempoChangeNum = parseFloat(tempoChange);
      if (isNaN(tempoChangeNum)) {
        newErrors.tempoChange = 'Must be a valid number';
      } else if (tempoChangeNum < -50 || tempoChangeNum > 50) {
        newErrors.tempoChange = 'Must be between -50% and +50%';
      }
    }

    // Validate mix cue in (0 to track duration)
    if (mixCueIn !== '') {
      const mixCueInNum = parseFloat(mixCueIn);
      if (isNaN(mixCueInNum)) {
        newErrors.mixCueIn = 'Must be a valid number';
      } else if (mixCueInNum < 0) {
        newErrors.mixCueIn = 'Must be 0 or greater';
      } else if (track?.track.duration && mixCueInNum > track.track.duration) {
        newErrors.mixCueIn = `Must be less than track duration (${track.track.duration}s)`;
      }
    }

    // Validate mix cue out (0 to track duration)
    if (mixCueOut !== '') {
      const mixCueOutNum = parseFloat(mixCueOut);
      if (isNaN(mixCueOutNum)) {
        newErrors.mixCueOut = 'Must be a valid number';
      } else if (mixCueOutNum < 0) {
        newErrors.mixCueOut = 'Must be 0 or greater';
      } else if (track?.track.duration && mixCueOutNum > track.track.duration) {
        newErrors.mixCueOut = `Must be less than track duration (${track.track.duration}s)`;
      }
    }

    // Validate cue in < cue out
    if (mixCueIn !== '' && mixCueOut !== '') {
      const mixCueInNum = parseFloat(mixCueIn);
      const mixCueOutNum = parseFloat(mixCueOut);
      if (!isNaN(mixCueInNum) && !isNaN(mixCueOutNum) && mixCueInNum >= mixCueOutNum) {
        newErrors.mixCueOut = 'Cue out must be after cue in';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!track || !validateForm()) return;

    const updates: Partial<SetlistTrack> = {
      transition_notes: transitionNotes || undefined,
      key_shift: keyShift !== '' ? parseFloat(keyShift) : undefined,
      tempo_change: tempoChange !== '' ? parseFloat(tempoChange) : undefined,
      mix_cue_in: mixCueIn !== '' ? parseFloat(mixCueIn) : undefined,
      mix_cue_out: mixCueOut !== '' ? parseFloat(mixCueOut) : undefined,
    };

    onSave(track.id, updates);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  if (!track) return null;

  return (
    <Modal open={!!track} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent size="md" className="p-6">
        <div onKeyDown={handleKeyDown}>
          <ModalHeader className="pb-4 border-b border-[var(--color-border-subtle)]">
            <ModalTitle>Edit Track Cues & Transitions</ModalTitle>
          </ModalHeader>

          <ModalBody className="space-y-4 pt-4">
            {/* Track Info Summary */}
            <div className="p-3 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)]">
              <div className="text-sm font-bold text-[var(--color-text-primary)]">{track.track.name}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">{track.track.artist}</div>
              {track.track.duration && (
                <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Duration: {Math.floor(track.track.duration / 60)}:{String(track.track.duration % 60).padStart(2, '0')}
                </div>
              )}
            </div>

            {/* Transition Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-text-primary)]">
                Transition Notes
              </label>
              <textarea
                className="w-full rounded-[var(--radius-input)] bg-[var(--color-input-bg)] border border-[var(--color-input-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                placeholder="Add notes about how to transition to the next track..."
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Tips for mixing, energy flow, or special techniques
              </p>
            </div>

            {/* Key Shift & Tempo Change */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Key Shift (semitones)"
                type="number"
                placeholder="0"
                value={keyShift}
                onChange={(e) => setKeyShift(e.target.value)}
                error={errors.keyShift}
                helperText="-12 to +12 semitones"
                min={-12}
                max={12}
                step={1}
              />

              <Input
                label="Tempo Change (%)"
                type="number"
                placeholder="0"
                value={tempoChange}
                onChange={(e) => setTempoChange(e.target.value)}
                error={errors.tempoChange}
                helperText="-50% to +50%"
                min={-50}
                max={50}
                step={0.1}
              />
            </div>

            {/* Mix Cue In & Cue Out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mix Cue In (seconds)"
                type="number"
                placeholder="0"
                value={mixCueIn}
                onChange={(e) => setMixCueIn(e.target.value)}
                error={errors.mixCueIn}
                helperText="Start point for mixing"
                min={0}
                step={0.1}
              />

              <Input
                label="Mix Cue Out (seconds)"
                placeholder={track.track.duration ? String(track.track.duration) : '0'}
                type="number"
                value={mixCueOut}
                onChange={(e) => setMixCueOut(e.target.value)}
                error={errors.mixCueOut}
                helperText="End point for mixing"
                min={0}
                step={0.1}
              />
            </div>
          </ModalBody>

          <ModalFooter className="pt-4 mt-4 border-t border-[var(--color-border-subtle)] justify-between items-center">
            <div className="text-xs text-[var(--color-text-tertiary)]">
              Press <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-elevated-3)] rounded text-[var(--color-text-secondary)] font-mono">Esc</kbd> to cancel or <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-elevated-3)] rounded text-[var(--color-text-secondary)] font-mono">Ctrl+Enter</kbd> to save
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </ModalFooter>
        </div>
      </ModalContent>
    </Modal>
  );
};
