import React, { useEffect, useId, useRef, useState } from 'react';
import { SnIcon } from '../../lib/songnodes';
import type { LibraryTrack, SavedSet } from '../musicLibrary/data';
import { exportM3U8, exportRekordbox, exportTidal, getMissingFieldsSummary, formatMissingFieldsSummary } from './exporters';
import { CopyButton } from '../musicLibrary/components/ui';

interface ExportDialogProps {
  open: boolean;
  set: SavedSet | null;
  byId: Map<string, LibraryTrack>;
  onClose: () => void;
}

type Format = 'm3u8' | 'rekordbox' | 'tidal' | 'tracklist';

export const ExportDialog: React.FC<ExportDialogProps> = ({ open, set, byId, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const id = useId();

  const [format, setFormat] = useState<Format>('m3u8');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      try { d.showModal(); } catch { d.setAttribute('open', ''); }
      cancelRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
      if (opener.current instanceof HTMLElement) {
        opener.current.focus();
      }
    }
  }, [open]);

  if (!set) return null;

  const summary = getMissingFieldsSummary(set, byId);
  const missingLines = formatMissingFieldsSummary(summary);

  let exportContent = '';
  let filename = '';
  let mimetype = '';

  if (format === 'm3u8') {
    exportContent = exportM3U8(set, byId);
    filename = `${set.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.m3u8`;
    mimetype = 'application/x-mpegurl';
  } else if (format === 'rekordbox') {
    exportContent = exportRekordbox(set, byId);
    filename = `${set.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xml`;
    mimetype = 'application/xml';
  } else if (format === 'tidal') {
    exportContent = exportTidal(set, byId);
    filename = `${set.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_tidal.json`;
    mimetype = 'application/json';
  } else if (format === 'tracklist') {
    exportContent = set.tracks.map((track, i) => {
      const t = byId.get(track.id);
      const artist = t ? t.a : (track.a || '–');
      const title = t ? t.t : (track.t || '–');
      return `${i + 1}. ${artist} - ${title}`;
    }).join('\n');
    filename = `${set.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_tracklist.txt`;
    mimetype = 'text/plain';
  }

  const handleDownload = () => {
    const blob = new Blob([exportContent], { type: mimetype });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewLines = exportContent.split('\n').slice(0, 5).join('\n');

  return (
    <dialog
      ref={ref}
      className="sn-dialog sn-dialog--m sn-export-dialog"
      aria-modal="true"
      aria-labelledby={`${id}-t`}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <div className="sn-dialog__head">
        <span className="sn-confirm-dialog__icon"><SnIcon name="download" /></span>
        <h2 className="sn-title title-s sn-dialog__title" id={`${id}-t`}>Export "{set.name}"</h2>
      </div>
      <div className="sn-dialog__body">
        {missingLines.length > 0 && (
          <div className="sn-banner sn-banner--warning sn-mb-3" role="alert">
            <span className="sn-banner__icon"><SnIcon name="triangle-alert" /></span>
            <div className="sn-banner__content">
              <strong>Missing metadata</strong>
              <ul>
                {missingLines.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="sn-field sn-mb-3">
          <label className="sn-field__label" htmlFor={`${id}-format`}>Format</label>
          <select
            id={`${id}-format`}
            className="sn-field__input"
            value={format}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'm3u8' || val === 'rekordbox' || val === 'tidal' || val === 'tracklist') {
                setFormat(val);
              }
            }}
          >
            <option value="m3u8">M3U8 Playlist</option>
            <option value="rekordbox">Rekordbox XML</option>
            <option value="tidal">TIDAL JSON</option>
            <option value="tracklist">Text Tracklist</option>
          </select>
        </div>

        <div className="sn-field sn-mb-3">
          <label className="sn-field__label" htmlFor={`${id}-preview`}>Preview (first 5 lines)</label>
          <pre id={`${id}-preview`} className="sn-field__input sn-mono" style={{ whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
            {previewLines}
            {exportContent.split('\n').length > 5 && '\n...'}
          </pre>
        </div>
      </div>
      <div className="sn-dialog__foot">
        <div className="sn-dialog__foot-start">
          <CopyButton label="Copy" what={format} getText={() => exportContent} size="sm" />
        </div>
        <button ref={cancelRef} className="sn-btn" type="button" onClick={onClose}>Close</button>
        <button className="sn-btn sn-btn--primary" type="button" onClick={handleDownload}><SnIcon name="download" /> Download {filename}</button>
      </div>
    </dialog>
  );
};
