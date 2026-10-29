import React, { useId, useState } from 'react';
import { SnIcon } from '../../lib/songnodes';
import type { LibraryTrack, SavedSet } from '../musicLibrary/data';
import { exportM3U8, exportRekordbox, getMissingFieldsSummary, formatMissingFieldsSummary } from './exporters';
import { CopyButton } from '../musicLibrary/components/ui';
import { Dialog, SelectField } from '../../components/ds';

interface ExportDialogProps {
  open: boolean;
  set: SavedSet | null;
  byId: Map<string, LibraryTrack>;
  onClose: () => void;
}

type Format = 'm3u8' | 'csv' | 'json' | 'rekordbox';

function escapeCsv(val: string | number): string {
  return `"${String(val).replace(/"/g, '""')}"`;
}

function exportCsv(set: SavedSet, byId: Map<string, LibraryTrack>): string {
  const header = ['Position', 'Artist', 'Title', 'BPM', 'Key', 'Duration'];
  const rows = set.tracks.map((track, i) => {
    const t = byId.get(track.id);
    const artist = t ? t.a : (track.a || '');
    const title = t ? t.t : (track.t || '');
    const bpm = t && t.bpm !== null ? t.bpm : (track.bpm ?? '');
    const key = t && t.k ? t.k : (track.k ?? '');
    const duration = t && t.d !== null ? Math.round(t.d) : '';
    return [i + 1, artist, title, bpm, key, duration].map(escapeCsv).join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

function exportJson(set: SavedSet, byId: Map<string, LibraryTrack>): string {
  const enrichedTracks = set.tracks.map((track, i) => {
    const t = byId.get(track.id);
    return {
      position: i + 1,
      id: track.id,
      artist: t ? t.a : (track.a || ''),
      title: t ? t.t : (track.t || ''),
      bpm: t && t.bpm !== null ? t.bpm : (track.bpm ?? null),
      key: t && t.k ? t.k : (track.k ?? null),
      duration: t && t.d !== null ? t.d : null,
      tidal: t ? t.tidal : (track.tidal ?? null),
    };
  });
  return JSON.stringify({ ...set, tracks: enrichedTracks }, null, 2);
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ open, set, byId, onClose }) => {
  const id = useId();
  const [format, setFormat] = useState<Format>('m3u8');

  if (!set) return null;

  const summary = getMissingFieldsSummary(set, byId);
  const missingLines = formatMissingFieldsSummary(summary);
  const safeName = set.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'set';

  let exportContent = '';
  let filename = '';
  let mimetype = '';

  if (format === 'm3u8') {
    exportContent = exportM3U8(set, byId);
    filename = `${safeName}.m3u8`;
    mimetype = 'application/x-mpegurl';
  } else if (format === 'csv') {
    exportContent = exportCsv(set, byId);
    filename = `${safeName}.csv`;
    mimetype = 'text/csv';
  } else if (format === 'json') {
    exportContent = exportJson(set, byId);
    filename = `${safeName}.json`;
    mimetype = 'application/json';
  } else if (format === 'rekordbox') {
    exportContent = exportRekordbox(set, byId);
    filename = `${safeName}.xml`;
    mimetype = 'application/xml';
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
    <Dialog
      open={open}
      onClose={onClose}
      title={`Export "${set.name}"`}
      size="m"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <CopyButton label="Copy" what={format} getText={() => exportContent} size="sm" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="sn-btn sn-btn--quiet" type="button" onClick={onClose}>Cancel</button>
            <button className="sn-btn sn-btn--primary" type="button" onClick={handleDownload}>
              <SnIcon name="download" /> Download {filename}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {missingLines.length > 0 && (
          <div className="sn-banner" data-status="warn" role="alert">
            <span className="sn-banner__icon"><SnIcon name="triangle-alert" /></span>
            <div className="sn-banner__content">
              <strong>Missing metadata</strong>
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
                {missingLines.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <SelectField
          label="Format"
          value={format}
          onChange={(val) => {
            if (val === 'm3u8' || val === 'csv' || val === 'json' || val === 'rekordbox') {
              setFormat(val);
            }
          }}
          options={[
            { value: 'm3u8', label: 'M3U8 Playlist' },
            { value: 'csv', label: 'CSV' },
            { value: 'json', label: 'JSON' },
            { value: 'rekordbox', label: 'Rekordbox XML' },
          ]}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <span className="label">Filename preview</span>
          <code className="sn-mono body-s" style={{ padding: 'var(--space-1) var(--space-2)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-control)', border: 'var(--space-0.25) solid var(--line)', width: 'fit-content' }}>
            {filename}
          </code>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label className="label" htmlFor={`${id}-preview`}>Preview (first 5 lines)</label>
          <pre id={`${id}-preview`} className="sn-mono" style={{ border: 'var(--space-0.25) solid var(--line)', padding: 'var(--space-2)', borderRadius: 'var(--radius-control)', backgroundColor: 'var(--surface-1)', whiteSpace: 'pre-wrap', maxHeight: '15rem', overflowY: 'auto', margin: 0 }}>
            {previewLines}
            {exportContent.split('\n').length > 5 && '\n...'}
          </pre>
        </div>
      </div>
    </Dialog>
  );
};
