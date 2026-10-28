/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FileDrop, fileDropError, fileSize, type FileDropFile } from './FileDrop';

afterEach(cleanup);

const file = (name: string, size: number) => {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

/** A page that owns the file list, as TracklistImporter would. */
function Harness({ parse, onAdd }: { parse: (f: File) => Promise<{ summary: string }>; onAdd?: (f: File[]) => void }) {
  const [files, setFiles] = useState<FileDropFile[]>([]);
  return (
    <FileDrop
      label="Import tracklists"
      accept={['.txt', '.csv']}
      maxMb={2}
      multiple
      hint=".txt or .csv, one track per line, up to 2 MB each"
      parse={parse}
      files={files}
      onAdd={(added) => {
        onAdd?.(added);
        setFiles((fs) => [...fs, ...added.map((f) => ({ id: f.name, name: f.name, size: f.size, state: 'reading' as const }))]);
      }}
      onRemove={(id) => setFiles((fs) => fs.filter((f) => f.id !== id))}
    />
  );
}

const input = () => document.querySelector<HTMLInputElement>('input[type="file"]');
const choose = (...files: File[]) => fireEvent.change(input(), { target: { files } });

describe('FileDrop', () => {
  it('words type, size and empty rejections as the design system does', () => {
    expect(fileDropError({ name: 'mix.m4a', size: 10 }, ['.txt', '.csv'], 2)).toBe('The selected file must be a .txt or .csv file.');
    expect(fileDropError({ name: 'year.csv', size: 3_500_000 }, ['.txt', '.csv'], 2)).toBe('The selected file must be smaller than 2 MB.');
    expect(fileDropError({ name: 'blank.txt', size: 0 }, ['.txt'], 2)).toBe('The selected file is empty.');
    expect(fileDropError({ name: 'OK.TXT', size: 10 }, ['.txt'], 2)).toBeNull();
    expect(fileSize(18432)).toBe('18 KB');
    expect(fileSize(3_500_000)).toBe('3.3 MB');
  });

  it('is reached by keyboard through the Choose button, which names the input', () => {
    render(<Harness parse={() => Promise.resolve({ summary: '' })} />);
    const el = input();
    expect(el.className).toContain('sn-sr');
    expect(el.getAttribute('accept')).toBe('.txt,.csv');
    const button = screen.getByText('Choose files');
    expect(button.tagName).toBe('LABEL');
    expect(button.getAttribute('for')).toBe(el.id);
    expect((el.getAttribute('aria-labelledby') ?? '').split(' ')).toContain(button.id);
    expect(screen.getByLabelText(/Import tracklists/)).toBe(el);
    expect(document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent).toBe('.txt or .csv, one track per line, up to 2 MB each');
  });

  it('adds valid files, parses them, and keeps rejected files as error rows', async () => {
    const onAdd = vi.fn<(f: File[]) => void>();
    const parse = vi.fn<(f: File) => Promise<{ summary: string }>>(() => Promise.resolve({ summary: '22 lines: 19 tracks, 3 not read' }));
    render(<Harness parse={parse} onAdd={onAdd} />);
    await act(async () => { choose(file('3RRR-Superfreak.txt', 2210), file('boiler-room.m4a', 48_211_000)); });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((f) => f.name)).toEqual(['3RRR-Superfreak.txt']);
    expect(parse).toHaveBeenCalledTimes(1);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Read');
    expect(rows[0].textContent).toContain('22 lines: 19 tracks, 3 not read');
    expect(rows[0].textContent).toContain('2 KB');
    expect(rows[1].hasAttribute('data-error')).toBe(true);
    expect(rows[1].textContent).toContain('The selected file must be a .txt or .csv file.');
    expect(screen.getByRole('status').textContent).toBe('3RRR-Superfreak.txt added. boiler-room.m4a: The selected file must be a .txt or .csv file.');
  });

  it('shows a parse failure as the file error', async () => {
    render(<Harness parse={() => Promise.reject(new Error('This file isn’t valid JSON. Export it again from SongNodes.'))} />);
    await act(async () => { choose(file('list.csv', 100)); });
    const row = screen.getByRole('listitem');
    expect(row.hasAttribute('data-error')).toBe(true);
    expect(row.textContent).toContain('This file isn’t valid JSON. Export it again from SongNodes.');
  });

  it('removes a file, announces it and moves focus to the next file or the input', async () => {
    render(<Harness parse={() => new Promise(() => {})} />);
    await act(async () => { choose(file('a.txt', 100), file('b.txt', 100)); });
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('Reading');
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.txt' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('a.txt removed');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove b.txt' }));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(document.activeElement).toBe(input());
  });

  it('shows the drag-over state while a file is dragged over the zone', () => {
    render(<Harness parse={() => Promise.resolve({ summary: '' })} />);
    const zone = input().closest('.sn-file-drop__zone');
    fireEvent.dragEnter(zone);
    expect(zone.hasAttribute('data-dragover')).toBe(true);
    expect(zone.textContent).toContain('Drop to add the files');
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(zone.hasAttribute('data-dragover')).toBe(false);
  });
});
