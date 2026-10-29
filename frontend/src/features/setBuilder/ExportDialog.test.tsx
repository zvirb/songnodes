/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportDialog } from './ExportDialog';
import type { LibraryTrack, SavedSet } from '../musicLibrary/data';

describe('ExportDialog', () => {
  const mockSet: SavedSet = {
    id: 'set-1',
    name: 'Test Set',
    shape: 'journey',
    minutes: 60,
    mix: {},
    pool: 'active',
    tidal: false,
    seed: 1,
    updated: '2026-10-26T12:00:00Z',
    created: '2026-10-26T12:00:00Z',
    tracks: [
      { id: 't1', tgt: 5 }
    ]
  };

  const byId = new Map<string, LibraryTrack>([
    ['t1', {
      id: 't1', a: 'Artist 1', t: 'Title 1', m: null, d: 180, bpm: 120, k: '8A', e: 5, p: 'House', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: true
    }]
  ]);

  let mockOnClose: () => void;

  beforeEach(() => {
    mockOnClose = vi.fn();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly and shows missing fields summary', () => {
    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    expect(screen.getByText('Export "Test Set"')).toBeDefined();
    expect(screen.getByText('Missing metadata')).toBeDefined();
    expect(screen.getByText('1 tracks have no TIDAL id')).toBeDefined();
    expect(screen.getAllByText('test_set.m3u8').length).toBeGreaterThan(0);
  });

  it('allows format selection across M3U8, CSV, JSON, and Rekordbox XML', async () => {
    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    const select = document.querySelector('select');
    if (!select) throw new Error('select not found');

    // Default M3U8
    expect(select).toHaveProperty('value', 'm3u8');
    expect(screen.getAllByText('test_set.m3u8').length).toBeGreaterThan(0);

    // CSV
    act(() => {
      fireEvent.change(select, { target: { value: 'csv' } });
    });
    expect(select).toHaveProperty('value', 'csv');
    expect(screen.getAllByText('test_set.csv').length).toBeGreaterThan(0);

    // JSON
    act(() => {
      fireEvent.change(select, { target: { value: 'json' } });
    });
    expect(select).toHaveProperty('value', 'json');
    expect(screen.getAllByText('test_set.json').length).toBeGreaterThan(0);

    // Rekordbox XML
    act(() => {
      fireEvent.change(select, { target: { value: 'rekordbox' } });
    });
    expect(select).toHaveProperty('value', 'rekordbox');
    expect(screen.getAllByText('test_set.xml').length).toBeGreaterThan(0);
  });

  it('calls download handler when download button is clicked', async () => {
    const URLCreateObjectURL = vi.fn(() => 'blob:test');
    const URLRevokeObjectURL = vi.fn();
    Object.defineProperty(window, 'URL', {
      value: { createObjectURL: URLCreateObjectURL, revokeObjectURL: URLRevokeObjectURL },
      writable: true
    });

    const mockAnchor = document.createElement('a');
    const mockClick = vi.fn();
    mockAnchor.click = mockClick;

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor;
      return originalCreateElement(tag);
    });

    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    const downloadBtns = screen.getAllByRole('button');
    const downloadBtn = downloadBtns.find(b => b.textContent && b.textContent.includes('Download test_set.m3u8'));

    if (!downloadBtn) throw new Error('Download button not found');

    fireEvent.click(downloadBtn);

    expect(URLCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('calls onClose when cancel or close button is clicked', async () => {
    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    const buttons = document.querySelectorAll('button');
    let closeBtn: HTMLButtonElement | null = null;
    buttons.forEach((b) => {
      if (b.textContent === 'Cancel' || b.getAttribute('aria-label') === 'Close') closeBtn = b;
    });

    if (!closeBtn) throw new Error('Close button not found');

    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
