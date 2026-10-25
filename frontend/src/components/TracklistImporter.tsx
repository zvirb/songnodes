import React, { useState, useRef } from 'react';
import { Upload, ScanText, Download, FileText, X } from 'lucide-react';
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

interface FileItem {
  name: string;
  size: number;
}

/**
 * TracklistImporter - Manual tracklist & file input component
 * Allows users to drop/choose tracklist files (.txt, .csv) or paste tracklists as text
 */
export const TracklistImporter: React.FC<TracklistImporterProps> = ({ onClose }) => {
  const [tracklistText, setTracklistText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<ParsedTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);

  const [importStatus, setImportStatus] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Parse a single line to extract artist and title
   */
  const parseTrackLine = (line: string): ParsedTrack | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Remove track number prefix (e.g., "1.", "01.", "Track 1:")
    const numberPattern = /^(\d+[\.\):]?\s*)/;
    const trackNumberMatch = trimmed.match(numberPattern);
    const trackNumber = trackNumberMatch ? parseInt(trackNumberMatch[1], 10) : undefined;
    const withoutNumber = trimmed.replace(numberPattern, '').trim();

    if (!withoutNumber) return null;

    let artist = '';
    let title = '';

    // Pattern 1: "Artist - Title" (most common)
    if (withoutNumber.includes(' - ')) {
      const parts = withoutNumber.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
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
    // Pattern 5: No clear separator
    else {
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

  /**
   * Parse text content into structured track list
   */
  const processText = (text: string) => {
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
   * Handle text parsing
   */
  const handleParse = () => {
    processText(tracklistText);
  };

  /**
   * Handle file loading
   */
  const handleFileSelect = (file: File) => {
    if (!file) return;

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 5 MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string || '';
      setTracklistText(content);
      setActiveFile({ name: file.name, size: file.size });
      processText(content);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setActiveFile(null);
    setTracklistText('');
    setParsedTracks([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Import parsed tracks to backend with progress animation
   */
  const handleImport = async () => {
    if (parsedTracks.length === 0) {
      setErrorMessage('Paste a tracklist or drop a file to import.');
      return;
    }

    setIsProcessing(true);
    setImportProgress(10);
    setErrorMessage(null);

    const progressInterval = setInterval(() => {
      setImportProgress(prev => (prev !== null && prev < 90 ? prev + 15 : prev));
    }, 150);

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

      clearInterval(progressInterval);
      setImportProgress(100);

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
        setActiveFile(null);
      }
    } catch (error) {
      console.error('Failed to import tracklist:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import tracklist');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsProcessing(false);
        setImportProgress(null);
      }, 300);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog
      open
      title="Import tracklist"
      sub="Drop a tracklist file (.txt, .csv) or paste text: “Artist – Title” or “1. Artist – Title”."
      size="l"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sn-btn" onClick={onClose} disabled={isProcessing}>Cancel</button>
          <button type="button" className="sn-btn sn-btn--primary" onClick={handleImport} disabled={parsedTracks.length === 0 || isProcessing} aria-busy={isProcessing || undefined}>
            {isProcessing ? <span className="sn-spinner" aria-hidden="true" /> : <Download size={16} strokeWidth={2} aria-hidden="true" />}
            {isProcessing ? 'Importing…' : parsedTracks.length ? `Import ${parsedTracks.length} tracks` : 'Import tracks'}
          </button>
        </>
      }
    >
      <div className="tli__container">
        {/* Tokenized File Dropzone */}
        <div
          className={`tli__dropzone ${isDragOver ? 'tli__dropzone--active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="region"
          aria-label="Drop tracklist file here"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".txt,.csv"
            style={{ display: 'none' }}
          />
          <Upload size={24} strokeWidth={2} className="tli__dropzone-icon" aria-hidden="true" />
          <div className="tli__dropzone-text">
            <span className="tli__dropzone-title">Drop a tracklist file here, or choose a file</span>
            <span className="tli__dropzone-hint">Accepts .txt and .csv up to 5 MB</span>
          </div>
          <button type="button" className="sn-btn sn-btn--sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            Choose file
          </button>
        </div>

        {/* Selected File Info */}
        {activeFile && (
          <div className="tli__file-pill" role="status">
            <FileText size={16} strokeWidth={2} aria-hidden="true" />
            <span className="tli__file-name">{activeFile.name}</span>
            <span className="tli__file-size">({formatFileSize(activeFile.size)})</span>
            <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm" onClick={removeFile} aria-label="Remove file" title="Remove file">
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Text Area */}
        <div className="sn-field">
          <label htmlFor="tli-text">Or paste tracklist as text</label>
          <textarea
            id="tli-text"
            className="sn-input tli__text"
            value={tracklistText}
            onChange={(e) => {
              setTracklistText(e.target.value);
              if (!e.target.value) setParsedTracks([]);
            }}
            placeholder={"1. Bicep – Glue\n2. Overmono – So U Kno\n3. Four Tet – Baby"}
            rows={6}
          />
          <span className="sn-field__help">Read the tracklist to verify extracted titles and artists before importing.</span>
        </div>

        <div className="tli__row">
          <button type="button" className="sn-btn sn-btn--sm" onClick={handleParse} disabled={!tracklistText.trim()}>
            <ScanText size={16} strokeWidth={2} aria-hidden="true" />
            Read tracklist
          </button>
          {parsedTracks.length > 0 && <span className="tli__count" role="status">{parsedTracks.length} tracks parsed</span>}
        </div>

        {/* Progress Indicator */}
        {importProgress !== null && (
          <div className="tli__progress" role="progressbar" aria-valuenow={importProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Import progress">
            <div className="tli__progress-header">
              <span className="tli__progress-label">Importing tracklist…</span>
              <span className="tli__progress-value">{importProgress}%</span>
            </div>
            <div className="tli__progress-track">
              <div className="tli__progress-fill" style={{ width: `${importProgress}%` }} />
            </div>
          </div>
        )}

        {/* Parsed Preview */}
        {parsedTracks.length > 0 && (
          <section aria-labelledby="tli-preview">
            <h3 className="tli__label" id="tli-preview">Parsed tracks ({parsedTracks.length})</h3>
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

        {/* Inline Feedback Messages */}
        {errorMessage && (
          <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">{errorMessage}</p>
        )}

        {importStatus && (
          <p className="sn-inline-message sn-inline-message--boxed" data-status={importStatus.failed > 0 ? 'warn' : 'ok'} role="status">
            Imported {importStatus.success} of {importStatus.total} tracks{importStatus.failed > 0 ? `; ${importStatus.failed} failed` : ''}.
          </p>
        )}
      </div>
    </Dialog>
  );
};
