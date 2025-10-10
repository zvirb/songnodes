import React, { useState, useEffect } from 'react';
import { SetlistTrack } from '../types';

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
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  if (!track) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <h3>Edit Track Cues & Transitions</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-content">
          <div className="track-info-summary" style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{track.track.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{track.track.artist}</div>
            {track.track.duration && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                Duration: {Math.floor(track.track.duration / 60)}:{String(track.track.duration % 60).padStart(2, '0')}
              </div>
            )}
          </div>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label className="input-label">Transition Notes</label>
            <textarea
              className="input"
              placeholder="Add notes about how to transition to the next track..."
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
              Tips for mixing, energy flow, or special techniques
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="input-group">
              <label className="input-label">Key Shift (semitones)</label>
              <input
                type="number"
                className="input"
                placeholder="0"
                value={keyShift}
                onChange={(e) => setKeyShift(e.target.value)}
                step="1"
                min="-12"
                max="12"
              />
              {errors.keyShift && (
                <div style={{ fontSize: '11px', color: 'var(--color-accent-secondary)', marginTop: '4px' }}>
                  {errors.keyShift}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                -12 to +12 semitones
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Tempo Change (%)</label>
              <input
                type="number"
                className="input"
                placeholder="0"
                value={tempoChange}
                onChange={(e) => setTempoChange(e.target.value)}
                step="0.1"
                min="-50"
                max="50"
              />
              {errors.tempoChange && (
                <div style={{ fontSize: '11px', color: 'var(--color-accent-secondary)', marginTop: '4px' }}>
                  {errors.tempoChange}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                -50% to +50%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Mix Cue In (seconds)</label>
              <input
                type="number"
                className="input"
                placeholder="0"
                value={mixCueIn}
                onChange={(e) => setMixCueIn(e.target.value)}
                step="0.1"
                min="0"
              />
              {errors.mixCueIn && (
                <div style={{ fontSize: '11px', color: 'var(--color-accent-secondary)', marginTop: '4px' }}>
                  {errors.mixCueIn}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                Start point for mixing
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Mix Cue Out (seconds)</label>
              <input
                type="number"
                className="input"
                placeholder={track.track.duration ? String(track.track.duration) : '0'}
                value={mixCueOut}
                onChange={(e) => setMixCueOut(e.target.value)}
                step="0.1"
                min="0"
              />
              {errors.mixCueOut && (
                <div style={{ fontSize: '11px', color: 'var(--color-accent-secondary)', marginTop: '4px' }}>
                  {errors.mixCueOut}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                End point for mixing
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: '8px' }}>
          Press <kbd>Esc</kbd> to cancel or <kbd>Ctrl+Enter</kbd> to save
        </div>
      </div>
    </div>
  );
};
