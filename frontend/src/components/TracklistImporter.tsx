import React, { useState } from 'react';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from './ui';

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

  const parseTrackLine = (line: string): ParsedTrack | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const numberPattern = /^(\d+[\.\):]?\s*)/;
    const trackNumberMatch = trimmed.match(numberPattern);
    const trackNumber = trackNumberMatch ? parseInt(trackNumberMatch[1]) : undefined;
    const withoutNumber = trimmed.replace(numberPattern, '').trim();

    if (!withoutNumber) return null;

    let artist = '';
    let title = '';

    if (withoutNumber.includes(' - ')) {
      const parts = withoutNumber.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else if (withoutNumber.includes(' / ')) {
      const parts = withoutNumber.split(' / ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' / ').trim();
    } else if (withoutNumber.toLowerCase().includes(' by ')) {
      const byIndex = withoutNumber.toLowerCase().indexOf(' by ');
      title = withoutNumber.substring(0, byIndex).trim();
      artist = withoutNumber.substring(byIndex + 4).trim();
    } else if (withoutNumber.includes('–') || withoutNumber.includes('—')) {
      const dash = withoutNumber.includes('–') ? '–' : '—';
      const parts = withoutNumber.split(dash);
      artist = parts[0].trim();
      title = parts.slice(1).join(dash).trim();
    } else {
      const words = withoutNumber.split(' ');
      if (words.length >= 3) {
        const midpoint = Math.floor(words.length / 2);
        artist = words.slice(0, midpoint).join(' ');
        title = words.slice(midpoint).join(' ');
      } else {
        artist = 'Unknown Artist';
        title = withoutNumber;
      }
    }

    return {
      trackNumber,
      artist: artist || 'Unknown Artist',
      title: title || 'Unknown Title',
      originalLine: line
    };
  };

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
      className="fixed inset-0 bg-[var(--color-modal-overlay)] flex items-center justify-center z-[var(--z-modal)] backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        variant="elevated"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col border-[var(--color-border-default)] bg-[var(--color-bg-elevated-1)] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
          <CardTitle className="text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            📝 Import Tracklist
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-lg px-2 py-1">
            ✕
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Instructions */}
          <Card variant="default" className="bg-[var(--color-brand-primary-muted)] border-[var(--color-brand-primary)] p-4">
            <p className="text-sm font-semibold text-[var(--color-brand-primary)] mb-2">
              ℹ️ How to use:
            </p>
            <ul className="text-xs text-[var(--color-text-secondary)] space-y-1 list-disc list-inside">
              <li>Paste your tracklist below (one track per line)</li>
              <li>Supported formats: "Artist - Title", "1. Artist - Title", "Artist / Title"</li>
              <li>Click "Parse" to preview how tracks will be imported</li>
              <li>Click "Import to Database" to add tracks</li>
            </ul>
          </Card>

          {/* Textarea Dropzone Area */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
              Tracklist (paste raw text here):
            </label>
            <textarea
              value={tracklistText}
              onChange={(e) => setTracklistText(e.target.value)}
              placeholder="Paste your tracklist here...&#10;Example:&#10;1. Axwell Λ Ingrosso - More Than You Know&#10;2. Vicetone - Walk Thru Fire (ft. Meron Ryan)&#10;3. Artist Name - Track Title"
              className="w-full min-h-[180px] p-4 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg text-[var(--color-text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--color-input-focus)] transition-all resize-y"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleParse}
              disabled={!tracklistText.trim()}
              variant="secondary"
            >
              🔍 Parse Tracklist
            </Button>
            {parsedTracks.length > 0 && (
              <Badge variant="success">
                ✓ {parsedTracks.length} tracks parsed
              </Badge>
            )}
          </div>

          {/* Parsed Preview */}
          {parsedTracks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Preview ({parsedTracks.length} tracks):
              </h3>
              <div className="max-h-[250px] overflow-y-auto space-y-2 p-3 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded-lg">
                {parsedTracks.map((track, index) => (
                  <Card key={index} variant="default" className="p-3 bg-[var(--color-bg-elevated-2)] border-[var(--color-border-subtle)]">
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1">
                      {track.trackNumber && <span className="text-[var(--color-text-tertiary)]">{track.trackNumber}. </span>}
                      <span className="text-[var(--color-brand-secondary)]">{track.artist}</span>
                      <span className="text-[var(--color-text-tertiary)]"> - </span>
                      <span className="text-[var(--color-brand-primary)]">{track.title}</span>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)] mt-1 truncate">
                      Original: {track.originalLine}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Feedback messaging */}
          {errorMessage && (
            <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-3">
              <p className="text-xs text-[var(--color-error)] font-medium">❌ {errorMessage}</p>
            </Card>
          )}

          {importStatus && (
            <Card className="border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-3 space-y-1">
              <p className="text-sm font-semibold text-[var(--color-success)]">✓ Import Complete</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {importStatus.success} tracks processed successfully
                {importStatus.failed > 0 && `, ${importStatus.failed} failed`}
              </p>
            </Card>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-6 py-4 flex justify-end gap-3 items-center">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={parsedTracks.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Importing...
              </span>
            ) : (
              '📥 Import to Database'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default TracklistImporter;
