import React, { useState, useEffect } from 'react';
import { SetlistTrack } from '../types';
import { Dialog } from './ds';
import { SN } from '../lib/songnodes';

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

  if (!track) return null;

  const durationSec = track.track.duration && track.track.duration > 0 ? track.track.duration : null;

  return (
    <Dialog
      open={!!track}
      title="Edit cues & transitions"
      sub={`${track.track.artist} – ${track.track.name}`}
      size="m"
      onClose={onClose}
      onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      footer={
        <>
          <button type="button" className="sn-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sn-btn sn-btn--primary">
            Save changes
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {durationSec ? (
          <div className="sn-track-cell" style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-control)' }}>
            <span className="sn-track-cell__title">
              <span className="sn-track-cell__name">
                <span className="sn-track-cell__artist">{track.track.artist} –</span> {track.track.name}
              </span>
            </span>
            <span className="sn-track-cell__meta">
              <span>Track length: {SN.format.duration(durationSec)}</span>
            </span>
          </div>
        ) : null}

        <div className="sn-field">
          <label htmlFor="tem-notes">Transition notes</label>
          <textarea
            id="tem-notes"
            className="sn-input"
            placeholder="Add notes about how to transition to the next track..."
            value={transitionNotes}
            onChange={(e) => setTransitionNotes(e.target.value)}
            rows={3}
            style={{ resize: 'vertical' }}
          />
          <span className="sn-field__help">Tips for mixing, energy flow, or special techniques</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
          <div className="sn-field">
            <label htmlFor="tem-keyshift">Key shift (semitones)</label>
            <input
              id="tem-keyshift"
              type="number"
              className="sn-input"
              placeholder="0"
              value={keyShift}
              onChange={(e) => setKeyShift(e.target.value)}
              step="1"
              min="-12"
              max="12"
              aria-invalid={!!errors.keyShift}
              aria-describedby={errors.keyShift ? "tem-keyshift-err" : "tem-keyshift-help"}
            />
            {errors.keyShift ? (
              <span className="sn-field__error" id="tem-keyshift-err">✕ {errors.keyShift}</span>
            ) : (
              <span className="sn-field__help" id="tem-keyshift-help">-12 to +12 semitones</span>
            )}
          </div>

          <div className="sn-field">
            <label htmlFor="tem-tempo">Tempo change (%)</label>
            <input
              id="tem-tempo"
              type="number"
              className="sn-input"
              placeholder="0"
              value={tempoChange}
              onChange={(e) => setTempoChange(e.target.value)}
              step="0.1"
              min="-50"
              max="50"
              aria-invalid={!!errors.tempoChange}
              aria-describedby={errors.tempoChange ? "tem-tempo-err" : "tem-tempo-help"}
            />
            {errors.tempoChange ? (
              <span className="sn-field__error" id="tem-tempo-err">✕ {errors.tempoChange}</span>
            ) : (
              <span className="sn-field__help" id="tem-tempo-help">-50% to +50%</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
          <div className="sn-field">
            <label htmlFor="tem-cuein">Mix cue in (seconds)</label>
            <input
              id="tem-cuein"
              type="number"
              className="sn-input"
              placeholder="0"
              value={mixCueIn}
              onChange={(e) => setMixCueIn(e.target.value)}
              step="0.1"
              min="0"
              aria-invalid={!!errors.mixCueIn}
              aria-describedby={errors.mixCueIn ? "tem-cuein-err" : "tem-cuein-help"}
            />
            {errors.mixCueIn ? (
              <span className="sn-field__error" id="tem-cuein-err">✕ {errors.mixCueIn}</span>
            ) : (
              <span className="sn-field__help" id="tem-cuein-help">Start point for mixing</span>
            )}
          </div>

          <div className="sn-field">
            <label htmlFor="tem-cueout">Mix cue out (seconds)</label>
            <input
              id="tem-cueout"
              type="number"
              className="sn-input"
              placeholder={track.track.duration ? String(track.track.duration) : '0'}
              value={mixCueOut}
              onChange={(e) => setMixCueOut(e.target.value)}
              step="0.1"
              min="0"
              aria-invalid={!!errors.mixCueOut}
              aria-describedby={errors.mixCueOut ? "tem-cueout-err" : "tem-cueout-help"}
            />
            {errors.mixCueOut ? (
              <span className="sn-field__error" id="tem-cueout-err">✕ {errors.mixCueOut}</span>
            ) : (
              <span className="sn-field__help" id="tem-cueout-help">End point for mixing</span>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
