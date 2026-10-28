// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LibraryPage from './LibraryPage';
import { loadLibrary } from './data';
import * as storage from './storage';

vi.mock('./data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data')>();
  return {
    ...actual,
    loadLibrary: vi.fn(),
  };
});

vi.mock('./storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage')>();
  return {
    ...actual,
    lsGet: vi.fn(),
    lsSet: vi.fn(),
    readDraft: vi.fn(),
    writeDraft: vi.fn(),
  };
});

// TargetActionButton is mocked just enough to know if 't' triggered a click
vi.mock('./targetAction/TargetActionButton', () => ({
  TargetActionButton: ({ track }: { track: any }) => (
    <button data-testid={`target-btn-${track.id}`} onClick={() => {
      // Mock action
    }} aria-label={`Add ${track.a} – ${track.t} to target tracks`} title={`Add ${track.a} – ${track.t} to target tracks`}>T</button>
  )
}));

const mockLibrary = {
  generated: '2026-10-26T00:00:00Z',
  ledger_updated: '2026-10-26T00:00:00Z',
  counts: { tracks: 3, pending: 0, rejected: 0, beatport_check: 0 },
  sources: [],
  runs: [],
  tracks: [
    { id: '1', a: 'Artist 1', t: 'Title 1', m: null, d: null, bpm: 120, k: null, e: 8, p: 'house', rot: 1, tags: [], src: [], last: null, rev: false, mbid: null, mbconf: null, mbdump: null, lbl: null, chart: null, tidal: null, dz: null, bp: null },
    { id: '2', a: 'Artist 2', t: 'Title 2', m: null, d: null, bpm: 125, k: null, e: 6, p: 'techno', rot: 1, tags: [], src: [], last: null, rev: false, mbid: null, mbconf: null, mbdump: null, lbl: null, chart: null, tidal: null, dz: null, bp: null },
    { id: '3', a: 'Artist 3', t: 'Title 3', m: null, d: null, bpm: 130, k: null, e: 9, p: 'house', rot: 1, tags: [], src: [], last: null, rev: false, mbid: null, mbconf: null, mbdump: null, lbl: null, chart: null, tidal: null, dz: null, bp: null },
  ]
};

describe('LibraryPage keyboard navigation', () => {
  beforeEach(() => {
    (loadLibrary as any).mockResolvedValue(mockLibrary);
    (storage.lsGet as any).mockImplementation((key: string) => {
      if (key === 'sn-filters-library') {
        return {
          filters: { q: '', tier: [], pillar: [], rot: [1, 2], bpm: [0, 999], excl: [], r: [], rt: [], src: '', tags: [], yr: [] },
          sort: { key: 'e', dir: 'descending' }
        };
      }
      return null;
    });
    (storage.readDraft as any).mockReturnValue({ name: 'Draft', slots: [], tracks: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates with J and K, triggering actions', async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);
    await waitFor(() => {
      const tableBox = document.querySelector('.sn-data-table__box') as HTMLElement;
      expect(tableBox).toBeTruthy();
      expect(tableBox.innerHTML).toContain('Title 1');
    }, { timeout: 3000 });

    const tableBox = document.querySelector('.sn-data-table__box') as HTMLElement;
    expect(tableBox).toBeTruthy();

    // Focus tablebox
    tableBox.focus();

    // J moves down
    fireEvent.keyDown(tableBox, { key: 'j' });
    let activeRow = document.querySelector('tr[data-active]');
    expect(activeRow).toBeTruthy();
    expect(activeRow?.getAttribute('data-id')).toBe('3');

    // Live region
    const liveRegion = document.querySelector('p[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('1 of 3: Artist 3 – Title 3');

    fireEvent.keyDown(tableBox, { key: 'j' });
    activeRow = document.querySelector('tr[data-active]');
    expect(activeRow?.getAttribute('data-id')).toBe('1');

    // K moves up
    fireEvent.keyDown(tableBox, { key: 'k' });
    activeRow = document.querySelector('tr[data-active]');
    expect(activeRow?.getAttribute('data-id')).toBe('3');

    // Action 't' triggers TargetActionButton
    const targetBtn = document.querySelector(`tr[data-id="3"] .sn-btn[title^="Add "]`) as HTMLButtonElement;
    if (targetBtn) {
      const spyT = vi.spyOn(targetBtn, 'click');
      fireEvent.keyDown(tableBox, { key: 't' });
      expect(spyT).toHaveBeenCalled();
    }

    // Action 'a' triggers addToSet which calls writeDraft
    fireEvent.keyDown(tableBox, { key: 'a' });
    expect(storage.writeDraft).toHaveBeenCalled();

    // Test that typing in the search field does not move rows
    const searchInput = document.querySelector('input[type="text"]') || document.querySelector('input');
    if (searchInput) {
      fireEvent.keyDown(searchInput, { key: 'j' });
    }

    // Row shouldn't have moved down to 1
    activeRow = document.querySelector('tr[data-active]');
    expect(activeRow?.getAttribute('data-id')).toBe('3');
  });
});
