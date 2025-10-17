import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
import { Track, GraphNode } from '../types';

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

      const updatedTrack = await response.json();

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

  // Close on escape key - MUST be before conditional return (Rules of Hooks)
  useEffect(() => {
    if (!initialTrack) return; // Don't attach listeners if no track

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, initialTrack]);

  // CRITICAL FIX: Return null AFTER hooks to follow Rules of Hooks
  // This prevents portal rendering when there's no track
  if (!initialTrack) {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'rgba(30, 30, 40, 0.98)',
          border: '1px solid rgba(126, 211, 33, 0.3)',
          borderRadius: '12px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          animation: 'slideIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            color: '#7ED321',
            fontSize: '20px',
            fontWeight: 600
          }}>
            Edit Track
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Artist Name */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Artist Name *
            </label>
            <input
              type="text"
              value={formData.artist}
              onChange={(e) => handleChange('artist', e.target.value)}
              placeholder="Enter artist name"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(126, 211, 33, 0.3)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(126, 211, 33, 0.6)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(126, 211, 33, 0.3)';
              }}
            />
          </div>

          {/* Track Title */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Track Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter track title"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(126, 211, 33, 0.3)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(126, 211, 33, 0.6)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(126, 211, 33, 0.3)';
              }}
            />
          </div>

          {/* BPM */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                BPM
              </label>
              <input
                type="number"
                value={formData.bpm}
                onChange={(e) => handleChange('bpm', e.target.value)}
                placeholder="120"
                min="20"
                max="300"
                step="0.1"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(126, 211, 33, 0.3)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Key */}
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                Key
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => handleChange('key', e.target.value)}
                placeholder="A Minor"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(126, 211, 33, 0.3)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Genre */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Genre
            </label>
            <input
              type="text"
              value={formData.genre}
              onChange={(e) => handleChange('genre', e.target.value)}
              placeholder="House, Techno, etc."
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(126, 211, 33, 0.3)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid rgba(231, 76, 60, 0.4)',
            borderRadius: '6px',
            color: '#E74C3C',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'rgba(126, 211, 33, 0.2)',
            border: '1px solid rgba(126, 211, 33, 0.4)',
            borderRadius: '6px',
            color: '#7ED321',
            fontSize: '13px',
            textAlign: 'center'
          }}>
            ✓ Track updated successfully!
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          marginTop: '24px',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving || success}
            style={{
              padding: '10px 20px',
              backgroundColor: (!isValid || saving || success) ? 'rgba(126, 211, 33, 0.3)' : 'rgba(126, 211, 33, 0.4)',
              border: '1px solid rgba(126, 211, 33, 0.6)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: (!isValid || saving || success) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (isValid && !saving && !success) {
                e.currentTarget.style.backgroundColor = 'rgba(126, 211, 33, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (isValid && !saving && !success) {
                e.currentTarget.style.backgroundColor = 'rgba(126, 211, 33, 0.4)';
              }
            }}
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
          </button>
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
};
