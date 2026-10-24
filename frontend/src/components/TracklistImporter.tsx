import React, { useState } from 'react';
import { Download, ScanText } from 'lucide-react';
import { Dialog } from './ds';
import './TracklistImporter.css';

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
      setErrorMessage('Paste a tracklist and read it first.');
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
    <Dialog
      open
      title="Import tracklist"
      sub="Paste one track per line: “Artist – Title”, “1. Artist – Title” or “Artist / Title”."
      size="l"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sn-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="sn-btn sn-btn--primary" onClick={handleImport} disabled={parsedTracks.length === 0 || isProcessing} aria-busy={isProcessing || undefined}>
            {isProcessing ? <span className="sn-spinner" aria-hidden="true" /> : <Download size={16} strokeWidth={2} aria-hidden="true" />}
            {isProcessing ? 'Importing…' : parsedTracks.length ? `Import ${parsedTracks.length} tracks` : 'Import tracks'}
          </button>
        </>
      }
    >
      <div className="sn-field">
        <label htmlFor="tli-text">Tracklist</label>
        <textarea
          id="tli-text"
          className="sn-input tli__text"
          value={tracklistText}
          onChange={(e) => setTracklistText(e.target.value)}
          placeholder={"1. Bicep – Glue\n2. Overmono – So U Kno\n3. Four Tet – Baby"}
          rows={8}
        />
        <span className="sn-field__help">Read the tracklist to check it, then import. Existing tracks are updated, new ones are added.</span>
      </div>

      <div className="tli__row">
        <button type="button" className="sn-btn sn-btn--sm" onClick={handleParse} disabled={!tracklistText.trim()}>
          <ScanText size={16} strokeWidth={2} aria-hidden="true" />
          Read tracklist
        </button>
        {parsedTracks.length > 0 && <span className="tli__count" role="status">{parsedTracks.length} tracks read</span>}
      </div>

      {parsedTracks.length > 0 && (
        <section aria-labelledby="tli-preview">
          <h3 className="tli__label" id="tli-preview">Preview</h3>
          <ol className="tli__list">
            {parsedTracks.map((track, index) => (
              <li key={index} className="tli__item">
                <span className="tli__num">{track.trackNumber ?? index + 1}</span>
                <div className="sn-track-cell">
                  <span className="sn-track-cell__title">
                    <span className="sn-track-cell__name"><span className="sn-track-cell__artist">{track.artist} –</span> {track.title}</span>
                  </span>
                  <span className="sn-track-cell__meta"><span className="tli__orig">{track.originalLine}</span></span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {errorMessage && (
        <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">{errorMessage}</p>
      )}

      {importStatus && (
        <p className="sn-inline-message sn-inline-message--boxed" data-status={importStatus.failed > 0 ? 'warn' : 'ok'} role="status">
          Imported {importStatus.success} of {importStatus.total} tracks{importStatus.failed > 0 ? `; ${importStatus.failed} failed` : ''}.
        </p>
      )}
    </Dialog>
  );
};
