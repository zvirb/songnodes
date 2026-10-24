import React, { useState, useRef, DragEvent } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';

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
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importStatus, setImportStatus] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
   * Parse tracklist text into ParsedTrack array
   */
  const parseTextContent = (text: string) => {
    const lines = text.split('\n');
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
   * Parse the entire tracklist textarea
   */
  const handleParse = () => {
    parseTextContent(tracklistText);
  };

  /**
   * Process dropped or selected file
   */
  const handleFile = (file: File) => {
    if (!file.type.startsWith('text/') && !file.name.endsWith('.txt') && !file.name.endsWith('.csv') && !file.name.endsWith('.m3u')) {
      setErrorMessage('Please upload a text file (.txt, .csv, or .m3u).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setTracklistText(content);
        parseTextContent(content);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  /**
   * Import parsed tracks to backend
   */
  const handleImport = async () => {
    if (parsedTracks.length === 0) {
      setErrorMessage('No tracks to import. Please paste a tracklist or upload a file first.');
      return;
    }

    setIsProcessing(true);
    setImportProgress(10);
    setErrorMessage(null);

    try {
      setImportProgress(50);
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

      setImportProgress(90);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Import failed with status ${response.status}`);
      }

      const result = await response.json();
      setImportProgress(100);
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
      setTimeout(() => setImportProgress(null), 1000);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-modal-overlay flex items-center justify-center z-modal p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="importer-dialog-title"
    >
      <div
        className="bg-bg-elevated2 border border-border-default rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar text-text-primary shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5 border-b border-border-subtle pb-3">
          <h2 id="importer-dialog-title" className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FileText size={22} className="text-brand-primary" />
            Import Tracklist
          </h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary hover:bg-bg-elevated3 p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary outline-none"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-info-bg border border-info-border rounded-lg p-3.5 mb-4 text-xs">
          <p className="text-info font-semibold mb-1 flex items-center gap-1.5">
            ℹ️ How to use:
          </p>
          <ul className="text-text-secondary space-y-1 list-disc pl-5">
            <li>Drop a file or paste your tracklist text below (one track per line)</li>
            <li>Supported formats: "Artist - Title", "1. Artist - Title", "Artist / Title"</li>
            <li>Click "Parse Tracklist" to preview extracted tracks</li>
            <li>Click "Import to Database" to save parsed tracks</li>
          </ul>
        </div>

        {/* Dropzone Container */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 mb-4 transition-all text-center ${
            isDraggingFile
              ? 'border-brand-primary bg-brand-primary-muted'
              : 'border-border-default bg-bg-elevated1 hover:border-border-strong'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".txt,.csv,.m3u"
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <Upload size={32} className={isDraggingFile ? 'text-brand-primary animate-bounce' : 'text-text-tertiary'} />
            <div className="text-sm text-text-secondary">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-brand-primary hover:underline font-semibold focus-visible:ring-2 focus-visible:ring-brand-primary rounded outline-none"
              >
                Click to upload
              </button>{' '}
              or drag & drop a file here
            </div>
            <p className="text-xs text-text-tertiary">Supports .txt, .csv, and .m3u files</p>
          </div>
        </div>

        {/* Textarea for tracklist input */}
        <div className="mb-4">
          <label className="block text-text-primary text-sm font-semibold mb-2">
            Tracklist Text:
          </label>
          <textarea
            value={tracklistText}
            onChange={(e) => setTracklistText(e.target.value)}
            placeholder="Paste your tracklist here...&#10;Example:&#10;1. Axwell Λ Ingrosso - More Than You Know&#10;2. Vicetone - Walk Thru Fire (ft. Meron Ryan)&#10;3. Artist Name - Track Title"
            className="w-full min-h-[160px] bg-bg-elevated1 border border-border-default rounded-lg text-text-primary text-xs p-3 font-mono focus-visible:ring-2 focus-visible:ring-brand-primary outline-none resize-y"
          />
        </div>

        {/* Parse button & count badge */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={handleParse}
            disabled={!tracklistText.trim()}
            className="px-4 py-2 bg-brand-secondary text-text-inverse font-semibold text-sm rounded-lg hover:bg-brand-secondary-hover focus-visible:ring-2 focus-visible:ring-brand-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔍 Parse Tracklist
          </button>
          {parsedTracks.length > 0 && (
            <span className="flex items-center gap-1.5 text-success font-semibold text-sm">
              <CheckCircle size={16} /> {parsedTracks.length} tracks parsed
            </span>
          )}
        </div>

        {/* Preview parsed tracks */}
        {parsedTracks.length > 0 && (
          <div className="mb-4">
            <h3 className="text-text-primary text-sm font-semibold mb-2">
              Preview ({parsedTracks.length} tracks):
            </h3>
            <div className="max-h-[220px] overflow-y-auto custom-scrollbar bg-bg-elevated1 border border-border-subtle rounded-lg p-3 space-y-1.5">
              {parsedTracks.map((track, index) => (
                <div
                  key={index}
                  className="p-2 bg-bg-elevated2 border border-border-subtle rounded text-xs"
                >
                  <div className="text-text-primary font-semibold">
                    {track.trackNumber && `${track.trackNumber}. `}
                    <span className="text-brand-secondary">{track.artist}</span>
                    {' - '}
                    <span className="text-success">{track.title}</span>
                  </div>
                  <div className="text-text-tertiary text-[11px] mt-0.5">
                    Original: {track.originalLine}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {importProgress !== null && (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span>Importing tracks...</span>
              <span>{importProgress}%</span>
            </div>
            <div className="w-full bg-bg-elevated1 h-2 rounded-full overflow-hidden border border-border-subtle">
              <div
                className="bg-brand-primary h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="bg-error-bg border border-error-border rounded-lg p-3 mb-4 flex items-center gap-2" role="alert">
            <AlertCircle size={18} className="text-error flex-shrink-0" />
            <p className="text-error text-xs flex-1">{errorMessage}</p>
          </div>
        )}

        {/* Import status */}
        {importStatus && (
          <div className="bg-success-bg border border-success-border rounded-lg p-3 mb-4">
            <p className="text-success text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle size={18} /> Import Complete
            </p>
            <p className="text-text-secondary text-xs mt-1">
              {importStatus.success} tracks processed successfully
              {importStatus.failed > 0 && `, ${importStatus.failed} failed`}
            </p>
          </div>
        )}

        {/* Modal actions */}
        <div className="flex gap-3 justify-end pt-3 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-elevated3 text-text-primary border border-border-default font-semibold text-sm rounded-lg hover:bg-bg-elevated4 focus-visible:ring-2 focus-visible:ring-brand-primary outline-none transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={parsedTracks.length === 0 || isProcessing}
            className="px-4 py-2 bg-brand-primary text-text-inverse font-semibold text-sm rounded-lg hover:bg-brand-primary-hover focus-visible:ring-2 focus-visible:ring-brand-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing...
              </>
            ) : (
              '📥 Import to Database'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
