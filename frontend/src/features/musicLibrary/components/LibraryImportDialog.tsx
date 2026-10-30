import React, { useEffect, useRef, useState } from 'react';
import { Dialog, FileDrop, showToast } from '../../../components/ds';
import { SN } from '../../../lib/songnodes';
import { type LibraryFile } from '../data';

export async function readExport(file: File): Promise<{ text: string; count: number; generated?: string }> {
  const text = await file.text();
  const data = JSON.parse(text) as LibraryFile;
  if (!data.tracks || !Array.isArray(data.tracks)) {
    throw new Error('The export has no tracks array');
  }
  return { text, count: data.tracks.length, generated: data.generated };
}

export async function importKey(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `import-sha256-${hashHex}`;
}

/** Size limit for a library export; there was none before FileDrop, so it is set well above a full export. */
const LIBRARY_MAX_MB = 50;

interface LibraryImportDialogProps {
  open: boolean;
  onClose: () => void;
  onReload: () => void;
  pollMs?: number;
}

export const LibraryImportDialog: React.FC<LibraryImportDialogProps> = ({ open, onClose, onReload, pollMs = 2000 }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileState, setFileState] = useState<'reading' | 'read' | 'error' | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  /** The file whose read is current; a slower read of a replaced file is ignored. */
  const latestRef = useRef<File | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setFileState(null);
      setFileError(null);
      setSummary(null);
      setFileContent(null);
      setFileHash(null);
      setJobId(null);
      setJobStatus(null);
      setJobError(null);
    }
  }, [open]);

  /** FileDrop has checked type and size; the page owns the one selected file. */
  const addFile = (added: File[]) => {
    const selected = added[0];
    if (!selected) return;
    latestRef.current = selected;
    setFile(selected);
    setFileState('reading');
    setFileError(null);
    setSummary(null);
    setFileContent(null);
    setFileHash(null);
  };

  /** Read and hash the export; FileDrop shows the summary or the error on the file row. */
  const readFile = async (selectedFile: File): Promise<{ summary: string }> => {
    try {
      const parsed = await readExport(selectedFile);
      const hash = await importKey(parsed.text);
      const text = `${SN.format.count(parsed.count)} tracks, generated ${parsed.generated ? SN.format.date(parsed.generated) : 'unknown date'}`;
      if (latestRef.current === selectedFile) {
        setFileContent(parsed.text);
        setFileHash(hash);
        setSummary(text);
        setFileState('read');
      }
      return { summary: text };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid JSON file';
      if (latestRef.current === selectedFile) {
        setFileState('error');
        setFileError(message);
      }
      throw new Error(message, { cause: e });
    }
  };

  const removeFile = () => {
    latestRef.current = null;
    setFile(null);
    setFileState(null);
    setFileError(null);
    setSummary(null);
    setFileContent(null);
    setFileHash(null);
  };

  const startImport = async () => {
    if (!fileContent || !fileHash) return;
    setJobStatus('queued');
    setJobError(null);

    try {
      const res = await fetch('/api/v1/library/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': fileHash,
        },
        body: fileContent,
      });
      if (!res.ok) throw new Error('Ingest failed');
      const data = await res.json();
      setJobId(data.job_id);
    } catch (e) {
      setJobStatus('failed');
      setJobError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const retryJob = async () => {
    if (!jobId) return;
    setJobStatus('queued');
    setJobError(null);
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
    } catch (e) {
      setJobStatus('failed');
      setJobError(e instanceof Error ? e.message : 'Retry failed');
    }
  };

  useEffect(() => {
    if (!jobId || jobStatus === 'succeeded' || jobStatus === 'dead' || jobStatus === 'failed') return;

    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setJobStatus(data.status);
        if (data.status === 'succeeded') {
          showToast(`Library imported: ${SN.format.count(data.result?.tracks || 0)} tracks`);
          onReload();
        } else if (data.status === 'dead') {
          setJobError(data.last_error || 'Import failed');
        }
      } catch (e) {
        // ignore network errors on polling
      }
    };

    if (pollMs === 0) {
      // test mode - run immediately without interval
      setTimeout(poll, 0);
      return;
    }

    const interval = setInterval(poll, pollMs);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [jobId, jobStatus, onReload, pollMs]);

  const steps = [
    { name: 'Upload file', state: jobStatus ? 'done' : 'waiting' },
    { name: 'Queue job', state: jobStatus === 'queued' ? 'running' : (jobStatus === 'running' || jobStatus === 'succeeded' || jobStatus === 'dead' ? 'done' : 'waiting') },
    { name: 'Import tracks', state: jobStatus === 'running' ? 'running' : (jobStatus === 'succeeded' ? 'done' : (jobStatus === 'dead' ? 'failed' : 'waiting')), detail: jobStatus === 'dead' ? jobError || 'Failed' : undefined }
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import library"
      size="m"
      footer={
        <>
          <button type="button" className="sn-btn sn-btn--quiet" onClick={onClose}>
            {jobStatus === 'succeeded' ? 'Close' : 'Cancel'}
          </button>
          {!jobStatus && fileState === 'read' ? (
            <button type="button" className="sn-btn sn-btn--primary" onClick={startImport}>Import</button>
          ) : null}
          {jobStatus === 'dead' || jobStatus === 'failed' ? (
            <button type="button" className="sn-btn sn-btn--primary" onClick={retryJob}>Try again</button>
          ) : null}
        </>
      }
    >
      {!jobStatus ? (
        <FileDrop
          label="Library export"
          accept={['.json']}
          maxMb={LIBRARY_MAX_MB}
          hint={`library.json exported from SongNodes, up to ${LIBRARY_MAX_MB} MB`}
          parse={readFile}
          files={file && fileState ? [{
            id: 'library-export',
            name: file.name,
            size: file.size,
            state: fileState,
            summary: summary ?? undefined,
            error: fileError ?? undefined,
          }] : []}
          onAdd={addFile}
          onRemove={removeFile}
        />
      ) : (
        <div className="sn-staged-progress">
          <ul className="sn-staged-progress__steps">
            {steps.map((step, i) => (
              <li key={i} className="sn-staged-progress__step" data-state={step.state}>
                <div className="sn-staged-progress__glyph" />
                <div className="sn-staged-progress__name">{step.name}</div>
                {step.state === 'running' || step.state === 'done' || step.state === 'failed' ? (
                  <div className="sn-staged-progress__state">{step.state === 'running' ? 'Running' : step.state === 'done' ? 'Done' : 'Failed'}</div>
                ) : <div className="sn-staged-progress__state" />}
                {step.detail && <div className="sn-staged-progress__detail">{step.detail}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
};
