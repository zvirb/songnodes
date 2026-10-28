/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CrateFilterRail } from './CrateFilterRail';
import type { LibraryTrack } from '../data';
import { DEFAULT_FILTERS } from '../setBuilder';

const mockTracks: LibraryTrack[] = [
  { id: '1', a: 'Bicep', t: 'Glue', tags: ['Electronic'], src: ['show-1'], e: 5, p: 'House', rot: 1, g: null, lbl: null, m: null, d: null, bpm: 120, k: '8A', first: null, last: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false },
  { id: '2', a: 'Artist 2', t: 'Track 2', tags: ['Techno'], src: ['show-2'], e: 8, p: 'Techno', rot: 2, g: null, lbl: null, m: null, d: null, bpm: 128, k: '9B', first: null, last: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false }
];

describe('CrateFilterRail', () => {
  it('typing prefix displays matching artists and tags', () => {
    const onQuery = vi.fn();
    render(<CrateFilterRail
      tracks={mockTracks}
      filters={DEFAULT_FILTERS}
      onChange={vi.fn()}
      query=""
      onQuery={onQuery}
      shown={2}
      searchRef={{ current: null }}
      open={true}
      setOpen={vi.fn()}
      rotationNote={null}
    />);
    const input = screen.getAllByRole('combobox')[0];
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'b' } });
    });
    expect(onQuery).toHaveBeenCalledWith('b');
  });

  it('selecting suggestion updates query', () => {
    let query = '';
    const onQuery = vi.fn((q) => { query = q; });
    const { rerender, container } = render(<CrateFilterRail
      tracks={mockTracks}
      filters={DEFAULT_FILTERS}
      onChange={vi.fn()}
      query={query}
      onQuery={onQuery}
      shown={2}
      searchRef={{ current: null }}
      open={true}
      setOpen={vi.fn()}
      rotationNote={null}
    />);

    const input = screen.getAllByRole('combobox')[0];

    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'bic' } });
    });

    rerender(<CrateFilterRail
      tracks={mockTracks}
      filters={DEFAULT_FILTERS}
      onChange={vi.fn()}
      query={'bic'}
      onQuery={onQuery}
      shown={2}
      searchRef={{ current: null }}
      open={true}
      setOpen={vi.fn()}
      rotationNote={null}
    />);

    act(() => {
      // Find the specific option in DOM, wait for useMemo rendering
      const options = Array.from(container.querySelectorAll('.sn-autocomplete__option')) as HTMLElement[];
      const bicepOption = options.find(o => o.textContent?.includes('Bicep'));
      if (bicepOption) {
        fireEvent.mouseDown(bicepOption);
      }
    });

    expect(onQuery).toHaveBeenCalledWith('Bicep');
  });

  it('clear button resets', () => {
    const onQuery = vi.fn();
    const { container } = render(<CrateFilterRail
      tracks={mockTracks}
      filters={DEFAULT_FILTERS}
      onChange={vi.fn()}
      query="bic"
      onQuery={onQuery}
      shown={2}
      searchRef={{ current: null }}
      open={true}
      setOpen={vi.fn()}
      rotationNote={null}
    />);
    const clearBtn = container.querySelector('.sn-search-field__clear');
    act(() => {
      if (clearBtn) fireEvent.click(clearBtn);
    });
    expect(onQuery).toHaveBeenCalledWith('');
  });
});
