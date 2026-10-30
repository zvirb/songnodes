/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TracklistImporter } from './TracklistImporter';

const tracklist = '1. Bicep - Glue\n2. Overmono - So U Kno\n';
const zone = () => document.querySelector('.sn-file-drop__zone') as HTMLElement;
const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('TracklistImporter file input', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reads a dropped tracklist and imports it as choosing it did', async () => {
    (fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ created: 2, updated: 0, failed: 0 }) });
    render(<TracklistImporter onClose={vi.fn<() => void>()} />);

    const file = new File([tracklist], 'peak-time-friday.txt', { type: 'text/plain' });
    fireEvent.dragOver(zone(), { dataTransfer: { files: [file] } });
    expect(zone().hasAttribute('data-dragover')).toBe(true);
    fireEvent.drop(zone(), { dataTransfer: { files: [file] } });

    await screen.findByText('2 tracks read');
    expect(screen.getByText('peak-time-friday.txt')).toBeTruthy();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Or paste tracklist as text').value).toBe(tracklist);

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 tracks' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (fetch as Mock).mock.calls[0];
    expect(url).toBe('/api/v1/tracks/import-tracklist');
    expect(JSON.parse(init.body).tracks).toEqual([
      { artist: 'Bicep', title: 'Glue', track_number: 1 },
      { artist: 'Overmono', title: 'So U Kno', track_number: 2 },
    ]);
  });

  it('keeps the file input for keyboard and touch, accepting .txt and .csv', async () => {
    render(<TracklistImporter onClose={vi.fn<() => void>()} />);
    expect(input().getAttribute('accept')).toBe('.txt,.csv');
    fireEvent.change(input(), { target: { files: [new File([tracklist], 'set.csv')] } });
    await screen.findByText('2 tracks read');
    expect(screen.getByRole('button', { name: 'Import 2 tracks' })).toBeTruthy();
  });

  it('rejects other types and files over 5 MB without reading them', async () => {
    render(<TracklistImporter onClose={vi.fn<() => void>()} />);
    fireEvent.drop(zone(), { dataTransfer: { files: [new File(['{}'], 'set.json')] } });
    await screen.findAllByText('The selected file must be a .txt or .csv file.');

    const big = new File(['x'], 'year.txt');
    Object.defineProperty(big, 'size', { value: 6 * 1048576 });
    fireEvent.drop(zone(), { dataTransfer: { files: [big] } });
    await screen.findAllByText('The selected file must be smaller than 5 MB.');
    expect(screen.getByRole('button', { name: 'Import tracks' }).hasAttribute('disabled')).toBe(true);
  });

  it('removes the file and clears what it read', async () => {
    render(<TracklistImporter onClose={vi.fn<() => void>()} />);
    fireEvent.drop(zone(), { dataTransfer: { files: [new File([tracklist], 'set.txt')] } });
    await screen.findByText('2 tracks read');
    fireEvent.click(screen.getByRole('button', { name: 'Remove set.txt' }));
    expect(screen.queryByText('set.txt')).toBeNull();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Or paste tracklist as text').value).toBe('');
  });
});
