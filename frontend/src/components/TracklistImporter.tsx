import React, { useState } from 'react';

interface TracklistImporterProps {
  onClose: () => void;
}

interface ParsedTrack {
  trackNumber?: number;
  artist: string;
  title: string;
  originalLine: string;
}

/**
 * TracklistImporter - Manual tracklist input component
 * Allows users to paste tracklists and import them as raw data
 *
 * Supported formats:
 * - "1. Artist - Title"
 * - "Artist - Title"
 * - "Artist / Title"
 * - "Title by Artist"
 * - Handles ft., feat., featuring
 */
export const TracklistImporter: React.FC<TracklistImporterProps> = ({ onClose }) => {
  const [tracklistText, setTracklistText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<ParsedTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Parse a single line to extract artist and title
   * Handles various common tracklist formats
   */
  const parseTrackLine = (line: string): ParsedTrack | null => {
    // Skip empty lines
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Remove track number prefix (e.g., "1.", "01.", "Track 1:")
    const numberPattern = /^(\d+[\.\):]?\s*)/;
    const trackNumberMatch = trimmed.match(numberPattern);
    const trackNumber = trackNumberMatch ? parseInt(trackNumberMatch[1]) : undefined;
    const withoutNumber = trimmed.replace(numberPattern, '').trim();

    if (!withoutNumber) return null;

    let artist = '';
    let title = '';

    // Pattern 1: "Artist - Title" (most common)
    if (withoutNumber.includes(' - ')) {
      const parts = withoutNumber.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim(); // Handle multiple dashes
    }
    // Pattern 2: "Artist / Title"
    else if (withoutNumber.includes(' / ')) {
      const parts = withoutNumber.split(' / ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' / ').trim();
    }
    // Pattern 3: "Title by Artist"
    else if (withoutNumber.toLowerCase().includes(' by ')) {
      const byIndex = withoutNumber.toLowerCase().indexOf(' by ');
      title = withoutNumber.substring(0, byIndex).trim();
      artist = withoutNumber.substring(byIndex + 4).trim();
    }
    // Pattern 4: Assume entire line is "Artist - Title" with unicode dash
    else if (withoutNumber.includes('–') || withoutNumber.includes('—')) {
      const dash = withoutNumber.includes('–') ? '–' : '—';
      const parts = withoutNumber.split(dash);
      artist = parts[0].trim();
      title = parts.slice(1).join(dash).trim();
    }
    // Pattern 5: No clear separator - return as unknown format
    else {
      // If no clear separator, try to guess based on common patterns
      // Last resort: assume format is "Artist Title"
      const words = withoutNumber.split(' ');
      if (words.length >= 3) {
        // Heuristic: First half is artist, second half is title
        const midpoint = Math.floor(words.length / 2);
        artist = words.slice(0, midpoint).join(' ');
        title = words.slice(midpoint).join(' ');
      } else {
        artist = 'Unknown Artist';
        title = withoutNumber;
      }
    }

    // Clean up featuring/ft notation (keep it with the title)
    // Common patterns: feat., ft., featuring, ft, (ft, [ft
    // We keep these with the title, as they're part of the track name

    return {
      trackNumber,
      artist: artist || 'Unknown Artist',
      title: title || 'Unknown Title',
      originalLine: line
    };
  };

  /**
   * Parse the entire tracklist textarea
   */
  const handleParse = () => {
    const lines = tracklistText.split('\n');
    const parsed: ParsedTrack[] = [];

    for (const line of lines) {
      const track = parseTrackLine(line);
      if (track) {
        parsed.push(track);
      }
    }

    setParsedTracks(parsed);
    setImportStatus(null);
    setErrorMessage(null);
  };

  /**
   * Import parsed tracks to backend
   */
  const handleImport = async () => {
    if (parsedTracks.length === 0) {
      setErrorMessage('No tracks to import. Please paste a tracklist and click Parse first.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/tracks/import-tracklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracks: parsedTracks.map(t => ({
            artist: t.artist,
            title: t.title,
            track_number: t.trackNumber
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Import failed with status ${response.status}`);
      }

      const result = await response.json();
      setImportStatus({
        success: result.created + result.updated,
        failed: result.failed,
        total: parsedTracks.length
      });

      // Clear form on success
      if (result.failed === 0) {
        setTracklistText('');
        setParsedTracks([]);
      }
    } catch (error) {
      console.error('Failed to import tracklist:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import tracklist');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1E1E1E',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            color: '#FFFFFF',
            fontSize: '20px',
            fontWeight: 600,
            margin: 0
          }}>
            📝 Import Tracklist
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8E8E93',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Instructions */}
        <div style={{
          backgroundColor: 'rgba(74,144,226,0.1)',
          border: '1px solid rgba(74,144,226,0.3)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <p style={{ color: '#4A90E2', fontSize: '13px', margin: '0 0 8px 0', fontWeight: 600 }}>
            ℹ️ How to use:
          </p>
          <ul style={{ color: '#8E8E93', fontSize: '12px', margin: 0, paddingLeft: '20px' }}>
            <li>Paste your tracklist below (one track per line)</li>
            <li>Supported formats: "Artist - Title", "1. Artist - Title", "Artist / Title"</li>
            <li>Click "Parse" to preview how tracks will be imported</li>
            <li>Click "Import to Database" to add tracks (creates new or updates existing)</li>
          </ul>
        </div>

        {/* Textarea for tracklist input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            Tracklist (paste here):
          </label>
          <textarea
            value={tracklistText}
            onChange={(e) => setTracklistText(e.target.value)}
            placeholder="Paste your tracklist here...&#10;Example:&#10;1. Axwell Λ Ingrosso - More Than You Know&#10;2. Vicetone - Walk Thru Fire (ft. Meron Ryan)&#10;3. Artist Name - Track Title"
            style={{
              width: '100%',
              minHeight: '200px',
              backgroundColor: '#2A2A2A',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#F8F8F8',
              fontSize: '13px',
              padding: '12px',
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Parse button */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
          <button
            onClick={handleParse}
            disabled={!tracklistText.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: tracklistText.trim() ? 'rgba(74,144,226,0.3)' : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(74,144,226,0.5)',
              borderRadius: '8px',
              color: tracklistText.trim() ? '#FFFFFF' : '#8E8E93',
              fontSize: '14px',
              fontWeight: 600,
              cursor: tracklistText.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            🔍 Parse Tracklist
          </button>
          {parsedTracks.length > 0 && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              color: '#7ED321',
              fontSize: '14px',
              fontWeight: 600
            }}>
              ✓ {parsedTracks.length} tracks parsed
            </span>
          )}
        </div>

        {/* Preview parsed tracks */}
        {parsedTracks.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '12px'
            }}>
              Preview ({parsedTracks.length} tracks):
            </h3>
            <div style={{
              maxHeight: '300px',
              overflow: 'auto',
              backgroundColor: '#2A2A2A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px'
            }}>
              {parsedTracks.map((track, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ color: '#FFFFFF', fontWeight: 600 }}>
                    {track.trackNumber && `${track.trackNumber}. `}
                    <span style={{ color: '#4A90E2' }}>{track.artist}</span>
                    {' - '}
                    <span style={{ color: '#7ED321' }}>{track.title}</span>
                  </div>
                  <div style={{ color: '#8E8E93', fontSize: '11px', marginTop: '2px' }}>
                    Original: {track.originalLine}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div style={{
            backgroundColor: 'rgba(231,76,60,0.1)',
            border: '1px solid rgba(231,76,60,0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ color: '#E74C3C', fontSize: '13px', margin: 0 }}>
              ❌ {errorMessage}
            </p>
          </div>
        )}

        {/* Import status */}
        {importStatus && (
          <div style={{
            backgroundColor: 'rgba(126,211,33,0.1)',
            border: '1px solid rgba(126,211,33,0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ color: '#7ED321', fontSize: '14px', margin: 0, fontWeight: 600 }}>
              ✓ Import Complete
            </p>
            <p style={{ color: '#8E8E93', fontSize: '12px', margin: '8px 0 0 0' }}>
              {importStatus.success} tracks processed successfully
              {importStatus.failed > 0 && `, ${importStatus.failed} failed`}
            </p>
          </div>
        )}

        {/* Import button */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={parsedTracks.length === 0 || isProcessing}
            style={{
              padding: '10px 20px',
              backgroundColor: parsedTracks.length > 0 && !isProcessing
                ? 'rgba(126,211,33,0.3)'
                : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(126,211,33,0.5)',
              borderRadius: '8px',
              color: parsedTracks.length > 0 && !isProcessing ? '#FFFFFF' : '#8E8E93',
              fontSize: '14px',
              fontWeight: 600,
              cursor: parsedTracks.length > 0 && !isProcessing ? 'pointer' : 'not-allowed'
            }}
          >
            {isProcessing ? '⏳ Importing...' : '📥 Import to Database'}
          </button>
        </div>
      </div>
    </div>
  );
};
