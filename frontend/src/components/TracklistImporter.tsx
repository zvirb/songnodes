import React, { useEffect, useState } from 'react';
import { ScanText, Download } from 'lucide-react';
import { Dialog, FileDrop, StagedProgress, type FileDropFile, type StagedProgressStep } from './ds';
import { SN } from '../lib/songnodes';
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


/** One press of Import: what was sent, when, and what the API answered. */
interface ImportRun {
  tracks: number;
  source: string;
  started: number;
  finished?: number;
  phase: 'sending' | 'done' | 'failed';
  result?: { created: number; updated: number; failed: number };
  error?: string;
}

/** StagedProgress stall rule (design system 1.4.0): 60 s with no progress. */
const STALL_MS = 60_000;

/** The cause of a failed import in words, from the API's answer; never raw exception text. */
async function importFailure(response: Response): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : null;
  if (typeof detail === 'string' && detail.trim()) return `SongNodes did not import the tracks: ${detail.trim()}`;
  if (response.status === 413) return 'The tracklist is too large for SongNodes to accept. Split it and import each part.';
  if (response.status === 400 || response.status === 422) return `SongNodes could not read the tracks it was sent (error ${response.status}). Check the parsed tracks and try again.`;
  if (response.status >= 500) return `SongNodes could not save the tracks (error ${response.status}). The tracklist is still here, so you can try again.`;
  return `SongNodes refused the import (error ${response.status}).`;
}

/**
 * TracklistImporter - Manual tracklist & file input component
 * Allows users to drop/choose tracklist files (.txt, .csv) or paste tracklists as text
 */
export const TracklistImporter: React.FC<TracklistImporterProps> = ({ onClose }) => {
  const [tracklistText, setTracklistText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<ParsedTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importRun, setImportRun] = useState<ImportRun | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [activeFile, setActiveFile] = useState<FileDropFile | null>(null);

  const [importStatus, setImportStatus] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Elapsed time and the stall check: one tick a second while the API has not answered.
  useEffect(() => {
    if (importRun?.phase !== 'sending') return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, 1000);
    };
    timer = setTimeout(tick, 1000);
    return () => clearTimeout(timer);
  }, [importRun]);

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
  const processText = (text: string): ParsedTrack[] => {
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
    setImportRun(null);
    setErrorMessage(null);
    return parsed;
  };

  /**
   * Handle text parsing
   */
  const handleParse = () => {
    processText(tracklistText);
  };

  /**
   * FileDrop has checked type (.txt, .csv) and size (5 MB); the dialog keeps one file.
   */
  const handleFilesAdded = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setActiveFile({ id: 'tracklist-file', name: file.name, size: file.size, state: 'reading' });
  };

  /**
   * Read the file into the text box and parse it; FileDrop shows the result on the file row.
   */
  const handleFileSelect = (file: File): Promise<{ summary: string }> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string || '';
      setTracklistText(content);
      const parsed = processText(content);
      const summary = `${SN.format.count(parsed.length)} tracks read`;
      setActiveFile({ id: 'tracklist-file', name: file.name, size: file.size, state: 'read', summary });
      resolve({ summary });
    };
    reader.onerror = () => {
      const error = 'This file could not be read.';
      setActiveFile({ id: 'tracklist-file', name: file.name, size: file.size, state: 'error', error });
      reject(new Error(error));
    };
    reader.readAsText(file);
  });

  const removeFile = () => {
    setActiveFile(null);
    setTracklistText('');
    setParsedTracks([]);
  };

  /**
   * Import parsed tracks to the backend; the stages follow what the request really does.
   */
  const handleImport = async () => {
    if (parsedTracks.length === 0) {
      setErrorMessage('Paste a tracklist or drop a file to import.');
      return;
    }

    const started = Date.now();
    const run: ImportRun = { tracks: parsedTracks.length, source: activeFile?.name ?? 'Pasted tracklist', started, phase: 'sending' };
    setIsProcessing(true);
    setImportRun(run);
    setNow(started);
    setImportStatus(null);
    setErrorMessage(null);

    try {
      let response: Response;
      try {
        response = await fetch('/api/v1/tracks/import-tracklist', {
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
      } catch (cause) {
        throw new Error('SongNodes did not answer. Check that the API is running, then try again; the tracklist is still here.', { cause });
      }

      if (!response.ok) {
        throw new Error(await importFailure(response));
      }

      const result = await response.json().catch((cause: unknown) => {
        throw new Error('SongNodes answered, but not with an import result. Check the library before importing again.', { cause });
      });
      const counts = { created: Number(result.created) || 0, updated: Number(result.updated) || 0, failed: Number(result.failed) || 0 };
      setImportRun({ ...run, phase: 'done', finished: Date.now(), result: counts });
      setImportStatus({
        success: counts.created + counts.updated,
        failed: counts.failed,
        total: parsedTracks.length
      });

      if (counts.failed === 0) {
        setTracklistText('');
        setParsedTracks([]);
        setActiveFile(null);
      }
    } catch (error) {
      console.error('Failed to import tracklist:', error);
      setImportRun({ ...run, phase: 'failed', finished: Date.now(), error: error instanceof Error ? error.message : 'The tracklist was not imported.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const importSteps = (r: ImportRun): StagedProgressStep[] => {
    const seconds = r.finished != null ? Math.round((r.finished - r.started) / 1000) : undefined;
    const stalled = r.phase === 'sending' && now - r.started >= STALL_MS;
    const res = r.result;
    return [
      { name: 'Read the tracklist', state: 'done', detail: `${SN.format.count(r.tracks)} tracks` },
      {
        name: 'Import the tracks',
        state: r.phase === 'sending' ? 'running' : r.phase,
        seconds,
        detail: r.phase === 'failed' ? r.error
          : res ? `${SN.format.count(res.created)} new, ${SN.format.count(res.updated)} updated${res.failed ? `, ${SN.format.count(res.failed)} not imported` : ''}`
            : stalled ? `No answer from SongNodes for ${STALL_MS / 1000} s. It may still finish; the tracklist stays here.`
              : `Sending ${SN.format.count(r.tracks)} tracks to SongNodes`,
      },
    ];
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
        <FileDrop
          label="Tracklist file"
          accept={['.txt', '.csv']}
          maxMb={5}
          hint=".txt or .csv, one track per line, up to 5 MB"
          parse={handleFileSelect}
          files={activeFile ? [activeFile] : []}
          onAdd={handleFilesAdded}
          onRemove={removeFile}
        />

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

        {/* Import stages */}
        {importRun && (
          <StagedProgress
            lead="Tracklist import"
            title={importRun.source}
            steps={importSteps(importRun)}
            elapsedSeconds={Math.max(0, Math.floor(((importRun.finished ?? now) - importRun.started) / 1000))}
          />
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
