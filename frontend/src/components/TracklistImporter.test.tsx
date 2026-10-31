/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TracklistImporter } from './TracklistImporter';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tracklist = '1. Bicep - Glue\n2. Overmono - So U Kno\n';
const pastedTracklist = '1. Bicep - Glue\n2. Overmono - So U Kno\n3. Four Tet - Baby';
const zone = () => document.querySelector('.sn-file-drop__zone') as HTMLElement;
const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('TracklistImporter file input', () => {
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

/** Paste the fixture tracklist, read it, and press Import. */
function startImport() {
  render(<TracklistImporter onClose={vi.fn<() => void>()} />);
  fireEvent.change(screen.getByLabelText('Or paste tracklist as text'), { target: { value: pastedTracklist } });
  fireEvent.click(screen.getByRole('button', { name: 'Read tracklist' }));
  fireEvent.click(screen.getByRole('button', { name: 'Import 3 tracks' }));
}

const steps = () => Array.from(document.querySelectorAll<HTMLElement>('.sn-staged-progress__step'));
const stateOf = (i: number) => steps()[i]?.getAttribute('data-state');
const detailOf = (i: number) => steps()[i]?.querySelector('.sn-staged-progress__detail')?.textContent;

/** A fetch that stays open until the test answers it. */
function pendingFetch() {
  let answer: (r: unknown) => void = () => {};
  let fail: (e: unknown) => void = () => {};
  (fetch as Mock).mockImplementationOnce(() => new Promise((resolve, reject) => { answer = resolve; fail = reject; }));
  return { answer: (r: unknown) => answer(r), fail: (e: unknown) => fail(e) };
}

describe('TracklistImporter import stages', () => {
  it('shows read, then importing while the API works, then done with the real counts', async () => {
    const call = pendingFetch();
    startImport();

    expect(steps().map((s) => s.querySelector('.sn-staged-progress__name')?.textContent)).toEqual(['Read the tracklist', 'Import the tracks']);
    expect(stateOf(0)).toBe('done');
    expect(detailOf(0)).toBe('3 tracks');
    expect(stateOf(1)).toBe('running');
    expect(detailOf(1)).toBe('Sending 3 tracks to SongNodes');
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();

    await act(async () => {
      call.answer({ ok: true, status: 200, json: async () => ({ created: 2, updated: 1, failed: 0, total: 3 }) });
    });

    expect(stateOf(1)).toBe('done');
    expect(detailOf(1)).toBe('2 new, 1 updated');
    expect(screen.getByText('Imported 3 of 3 tracks.')).toBeTruthy();
    expect(within(document.querySelector('.sn-staged-progress') as HTMLElement).getByRole('status').textContent).toBe('Tracklist import finished.');
  });

  it('names the cause when the API is down', async () => {
    const call = pendingFetch();
    startImport();
    await act(async () => { call.fail(new TypeError('Failed to fetch')); });

    expect(stateOf(1)).toBe('failed');
    expect(detailOf(1)).toBe('SongNodes did not answer. Check that the API is running, then try again; the tracklist is still here.');
    expect(document.body.textContent).not.toContain('Failed to fetch');
    expect(screen.getByRole('button', { name: 'Import 3 tracks' }).hasAttribute('disabled')).toBe(false);
  });

  it('names the cause from the API error answer', async () => {
    (fetch as Mock).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ detail: 'This tracklist is already being imported' }) });
    startImport();
    await act(async () => {});
    expect(stateOf(1)).toBe('failed');
    expect(detailOf(1)).toBe('SongNodes did not import the tracks: This tracklist is already being imported');

    (fetch as Mock).mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } });
    fireEvent.click(screen.getByRole('button', { name: 'Import 3 tracks' }));
    await act(async () => {});
    expect(detailOf(1)).toBe('SongNodes could not save the tracks (error 502). The tracklist is still here, so you can try again.');
    expect(document.body.textContent).not.toContain('Unexpected token');
  });

  it('says the import has had no answer for 60 s without failing it', async () => {
    vi.useFakeTimers();
    const call = pendingFetch();
    startImport();

    for (let s = 0; s < 59; s += 1) act(() => { vi.advanceTimersByTime(1000); });
    expect(detailOf(1)).toBe('Sending 3 tracks to SongNodes');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(stateOf(1)).toBe('running');
    expect(detailOf(1)).toBe('No answer from SongNodes for 60 s. It may still finish; the tracklist stays here.');
    expect(document.querySelector('.sn-staged-progress__time b')?.textContent).toBe('1:00');

    await act(async () => {
      call.answer({ ok: true, status: 200, json: async () => ({ created: 3, updated: 0, failed: 0 }) });
    });
    expect(stateOf(1)).toBe('done');
  });
});

describe('TracklistImporter parsing', () => {
  it('never guesses an artist: a line without Artist – Title is shown as not understood and left out', async () => {
    (fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ created: 2, updated: 0, failed: 0 }) });
    render(<TracklistImporter onClose={vi.fn<() => void>()} />);
    fireEvent.change(screen.getByLabelText('Or paste tracklist as text'), {
      target: { value: '1. Bicep - Glue\n2. Some Long Track Name Here\n3. Glue by Bicep\n4. Intro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read tracklist' }));

    expect(document.querySelector('.tli__count')?.textContent).toBe('2 tracks parsed; 2 lines need an artist and will be left out');
    expect(document.body.textContent).not.toMatch(/Unknown/);
    const items = Array.from(document.querySelectorAll<HTMLElement>('.tli__item'));
    expect(items).toHaveLength(4);
    expect(items[1].querySelector('.sn-track-cell__artist .sn-none')?.textContent).toBe('–');
    expect(items[1].textContent).toContain('Some Long Track Name Here');
    expect(items[1].textContent).toContain('Not understood: write it as Artist – Title. Left out of the import.');
    expect(items[0].textContent).not.toContain('Not understood');

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 tracks' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetch as Mock).mock.calls[0][1].body).tracks).toEqual([
      { artist: 'Bicep', title: 'Glue', track_number: 1 },
      { artist: 'Bicep', title: 'Glue', track_number: 3 },
    ]);

    await screen.findByText('Imported 2 of 2 tracks.');
    // The lines that were not understood stay, so they can be fixed and read again.
    expect(screen.getByLabelText<HTMLTextAreaElement>('Or paste tracklist as text').value).toBe('2. Some Long Track Name Here\n4. Intro');
    expect(screen.getByRole('button', { name: 'Import tracks' }).hasAttribute('disabled')).toBe(true);
  });
});
