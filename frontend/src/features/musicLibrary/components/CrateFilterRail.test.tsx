/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { CrateFilterRail } from './CrateFilterRail';
import type { LibraryTrack } from '../data';
import { DEFAULT_FILTERS, type CrateFilters } from '../setBuilder';

const base = { g: null, lbl: null, m: null, d: null, first: null, last: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false };
const mockTracks: LibraryTrack[] = [
  { ...base, id: '1', a: 'Bicep', t: 'Glue', tags: ['Electronic'], src: ['show-1'], e: 5, p: 'House', rot: 1, bpm: 120, k: '8A' },
  { ...base, id: '2', a: 'Artist 2', t: 'Track 2', tags: ['Techno'], src: ['show-2'], e: 8, p: 'Techno', rot: 2, bpm: 128, k: '9B' },
];

function renderRail(query: string) {
  const onQuery = vi.fn<(q: string) => void>();
  const onChange = vi.fn<(f: CrateFilters) => void>();
  const searchRef: React.RefObject<HTMLInputElement | null> = { current: null };
  render(
    <CrateFilterRail
      tracks={mockTracks}
      filters={DEFAULT_FILTERS}
      onChange={onChange}
      query={query}
      onQuery={onQuery}
      shown={2}
      searchRef={searchRef}
      open
      setOpen={vi.fn<(open: boolean) => void>()}
      rotationNote={null}
    />,
  );
  return { onQuery, onChange, searchRef, input: screen.getByRole('combobox', { name: 'Search tracks' }) };
}

/** Options in the field's popup (the source select has options of its own). */
function popupOptions(): HTMLElement[] {
  const list = screen.queryByRole('listbox', { name: 'Search tracks: suggestions' });
  return list ? within(list).queryAllByRole('option') : [];
}

function option(text: string): HTMLElement {
  const found = popupOptions().find((o) => o.textContent?.includes(text));
  if (!found) throw new Error(`no option containing ${text}`);
  return found;
}

describe('CrateFilterRail search', () => {
  afterEach(cleanup);

  it('reports typed text as the query', () => {
    const { onQuery, input } = renderRail('');
    fireEvent.change(input, { target: { value: 'b' } });
    expect(onQuery).toHaveBeenCalledWith('b');
  });

  it('suggests matching artists with their track count', () => {
    const { input } = renderRail('bic');
    fireEvent.focus(input);
    expect(option('Bicep').textContent).toContain('Artist · 1');
  });

  it('selecting an artist suggestion sets the query', () => {
    const { onQuery, input } = renderRail('bic');
    fireEvent.focus(input);
    fireEvent.mouseDown(option('Bicep'));
    expect(onQuery).toHaveBeenCalledWith('Bicep');
  });

  it('selecting a tag suggestion applies the tag filter', () => {
    const { onQuery, onChange, input } = renderRail('elec');
    fireEvent.focus(input);
    fireEvent.mouseDown(option('Electronic'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tags: ['Electronic'] }));
    expect(onQuery).toHaveBeenCalledWith('');
  });

  it('does not suggest built-in keys the crate query cannot match', () => {
    const { input } = renderRail('8a');
    fireEvent.focus(input);
    expect(popupOptions()).toHaveLength(0);
  });

  it('exposes the input through searchRef for page focus', () => {
    const { searchRef, input } = renderRail('');
    expect(searchRef.current).toBe(input);
  });

  it('clear button resets the query', () => {
    const { onQuery } = renderRail('bic');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onQuery).toHaveBeenCalledWith('');
  });
});
