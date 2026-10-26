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

  let mockOnClose: any;

  beforeEach(() => {
    mockOnClose = vi.fn();
    // HTMLDialogElement is not fully supported in jsdom, so we mock its methods
    HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function(this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly and shows missing fields summary', () => {
    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    // Check title
    expect(screen.getByText('Export "Test Set"')).toBeDefined();

    // Check summary (t1 has no TIDAL id)
    expect(screen.getByText('Missing metadata')).toBeDefined();
    expect(screen.getByText('1 tracks have no TIDAL id')).toBeDefined();
  });

  it('allows format selection', async () => {
    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    // Fallback to getByRole or directly finding the select by ID if getByLabelText fails
    const select = document.querySelector('select');
    if (!select) throw new Error('select not found');

    // Default is M3U8
    expect(select).toHaveProperty('value', 'm3u8');
    const downloadBtns = screen.getAllByRole('button');
    expect(downloadBtns.find(b => b.textContent && b.textContent.includes('Download test_set.m3u8'))).toBeDefined();

    // Switch to Rekordbox
    act(() => {
      fireEvent.change(select, { target: { value: 'rekordbox' } });
    });
    expect(select).toHaveProperty('value', 'rekordbox');
    expect(screen.getAllByRole('button').find(b => b.textContent && b.textContent.includes('Download test_set.xml'))).toBeDefined();
  });

  it('calls download handler when download is clicked', async () => {
    const URLCreateObjectURL = vi.fn(() => 'blob:test');
    const URLRevokeObjectURL = vi.fn();
    Object.defineProperty(window, 'URL', {
      value: { createObjectURL: URLCreateObjectURL, revokeObjectURL: URLRevokeObjectURL }
    });

    const mockAnchor = document.createElement('a');
    const mockClick = vi.fn() as any;
    mockAnchor.click = mockClick;

    // Capture original before spying
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockAnchor;
      return originalCreateElement(tag);
    });

    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    // In our component, we use "Download " + filename for the button content
    const downloadBtns = screen.getAllByRole('button');
    const downloadBtn = downloadBtns.find(b => b.textContent && b.textContent.includes('Download test_set.m3u8'));

    if (downloadBtn) {
      fireEvent.click(downloadBtn);
    } else {
      throw new Error('Download button not found');
    }

    expect(URLCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    render(<ExportDialog open={true} set={mockSet} byId={byId} onClose={mockOnClose} />);

    // Find the Close button using document.querySelectorAll to avoid multiple matches from icons etc if they exist
    const buttons = document.querySelectorAll('button');
    let closeBtn: HTMLButtonElement | null = null;
    buttons.forEach((b) => {
      if (b.textContent === 'Close') closeBtn = b;
    });

    if (!closeBtn) {
      throw new Error('Close button not found');
    }

    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
