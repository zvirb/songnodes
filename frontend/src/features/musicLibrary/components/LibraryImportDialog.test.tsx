/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LibraryImportDialog } from './LibraryImportDialog';

const generateMockFile = (content: string, filename = 'library.json') => {
  const file = new File([content], filename, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
};

describe('LibraryImportDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('handles valid file upload, successful import and polling', async () => {
    const fetchMock = fetch as Mock;

    // First fetch: the POST to ingest
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: 'test-job-123', status: 'queued', created: true })
    });

    // Second fetch: the polling GET returning succeeded
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'succeeded', result: { tracks: 50 } })
    });

    const onReload = vi.fn();
    const onClose = vi.fn();

    render(<LibraryImportDialog open={true} onClose={onClose} onReload={onReload} pollMs={0} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    const mockLib = { tracks: [{ id: '1', a: 'a', t: 't' }], generated: '2023-10-24T00:00:00.000Z' };
    const file = generateMockFile(JSON.stringify(mockLib));

    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(/1 tracks, generated/);

    const importBtn = screen.getByRole('button', { name: 'Import' });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2); // POST and GET
      expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/library/ingest', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringContaining('import-sha256-')
        })
      }));
      expect(onReload).toHaveBeenCalled();
    });
  });

  it('shows error for file without tracks array', async () => {
    render(<LibraryImportDialog open={true} onClose={vi.fn()} onReload={vi.fn()} pollMs={0} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockLib = { not_tracks: [] };
    const file = generateMockFile(JSON.stringify(mockLib));

    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText('The export has no tracks array');
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
  });

  it('handles dead status and retry', async () => {
    const fetchMock = fetch as Mock;

    // First fetch: the POST to ingest
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: 'test-job-456', status: 'queued', created: true })
    });

    // Second fetch: the polling GET returning dead
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'dead', last_error: 'Something went wrong' })
    });

    // Third fetch: the retry POST
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'queued' })
    });

    render(<LibraryImportDialog open={true} onClose={vi.fn()} onReload={vi.fn()} pollMs={0} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockLib = { tracks: [] };
    const file = generateMockFile(JSON.stringify(mockLib));

    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText(/0 tracks/);

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await screen.findByText('Something went wrong');

    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/jobs/test-job-456/retry', expect.any(Object));
    });
  });

  it('starts the same import when the export is dropped on the zone', async () => {
    const fetchMock = fetch as Mock;
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: 'drop-job', status: 'queued', created: true }) });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'succeeded', result: { tracks: 1 } }) });
    const onReload = vi.fn();

    render(<LibraryImportDialog open={true} onClose={vi.fn()} onReload={onReload} pollMs={0} />);

    const zone = document.querySelector('.sn-file-drop__zone') as HTMLElement;
    const file = generateMockFile(JSON.stringify({ tracks: [{ id: '1' }], generated: '2023-10-24T00:00:00.000Z' }));
    fireEvent.dragOver(zone, { dataTransfer: { files: [file] } });
    expect(zone.hasAttribute('data-dragover')).toBe(true);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    await screen.findByText(/1 tracks, generated/);
    expect(screen.getByText('library.json')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/library/ingest', expect.objectContaining({ method: 'POST' }));
      expect(onReload).toHaveBeenCalled();
    });
  });

  it('rejects a file that is not JSON before reading it', async () => {
    render(<LibraryImportDialog open={true} onClose={vi.fn()} onReload={vi.fn()} pollMs={0} />);
    const zone = document.querySelector('.sn-file-drop__zone') as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['a - b'], 'set.txt')] } });
    await screen.findAllByText('The selected file must be a .json file.');
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
  });
});
