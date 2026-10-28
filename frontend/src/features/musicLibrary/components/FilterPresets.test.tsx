/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { FilterPresets } from './FilterPresets';
import { DEFAULT_FILTERS, type CrateFilters } from '../setBuilder';
import { saveFavorite, getFavorites } from '../../../utils/favoriteQueries';

const mockFilters: CrateFilters = { ...DEFAULT_FILTERS, q: 'acid', pillar: ['Techno'] };

describe('FilterPresets', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLDialogElement.prototype.showModal = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('saving current filters creates preset', () => {
    const onApply = vi.fn<(f: CrateFilters) => void>();
    render(<FilterPresets currentFilters={mockFilters} onApply={onApply} />);

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /Save current filters/i }));

    // Type name
    const input = screen.getByLabelText('Preset name');
    fireEvent.change(input, { target: { value: 'Peak Acid Techno' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }));

    // Verify preset is displayed
    const presetChip = screen.getByRole('button', { name: 'Peak Acid Techno' });
    expect(presetChip).not.toBeNull();

    // Verify it was saved in storage
    const favs = getFavorites<CrateFilters>('library-crate-presets');
    expect(favs).toHaveLength(1);
    expect(favs[0].label).toBe('Peak Acid Techno');
    expect(favs[0].payload).toEqual(mockFilters);
  });

  it('clicking preset applies filters', () => {
    saveFavorite('library-crate-presets', { label: 'Warmup 118-122', payload: mockFilters });

    const onApply = vi.fn<(f: CrateFilters) => void>();
    render(<FilterPresets currentFilters={DEFAULT_FILTERS} onApply={onApply} />);

    const presetChip = screen.getByRole('button', { name: 'Warmup 118-122' });
    fireEvent.click(presetChip);

    expect(onApply).toHaveBeenCalledWith(mockFilters);
  });

  it('deleting removes preset', () => {
    saveFavorite('library-crate-presets', { label: 'Peak Acid Techno', payload: mockFilters });

    const onApply = vi.fn<(f: CrateFilters) => void>();
    render(<FilterPresets currentFilters={DEFAULT_FILTERS} onApply={onApply} />);

    const deleteBtn = screen.getByRole('button', { name: 'Delete preset Peak Acid Techno' });
    fireEvent.click(deleteBtn);

    // Verify it's removed from UI
    expect(screen.queryByRole('button', { name: 'Peak Acid Techno' })).toBeNull();

    // Verify it's removed from storage
    const favs = getFavorites<CrateFilters>('library-crate-presets');
    expect(favs).toHaveLength(0);
  });

  it('save is disabled while no filter is set', () => {
    render(<FilterPresets currentFilters={DEFAULT_FILTERS} onApply={vi.fn<(f: CrateFilters) => void>()} />);
    expect(screen.getByRole('button', { name: /Save current filters/i }).hasAttribute('disabled')).toBe(true);
  });

  it('Enter in the name field saves the preset', () => {
    render(<FilterPresets currentFilters={mockFilters} onApply={vi.fn<(f: CrateFilters) => void>()} />);
    fireEvent.click(screen.getByRole('button', { name: /Save current filters/i }));
    const input = screen.getByLabelText('Preset name');
    fireEvent.change(input, { target: { value: 'Warmup' } });
    fireEvent.submit(input);
    expect(getFavorites<CrateFilters>('library-crate-presets').map((f) => f.label)).toEqual(['Warmup']);
  });

  it('deleting offers Undo that restores the preset', () => {
    saveFavorite('library-crate-presets', { label: 'Warmup', payload: mockFilters });
    let undo: (() => void) | undefined;
    const onToast = (e: Event) => { if (e instanceof CustomEvent) undo = e.detail?.action?.onClick; };
    window.addEventListener('sn-toast', onToast);
    render(<FilterPresets currentFilters={DEFAULT_FILTERS} onApply={vi.fn<(f: CrateFilters) => void>()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete preset Warmup' }));
    window.removeEventListener('sn-toast', onToast);
    expect(undo).toBeTypeOf('function');
    act(() => undo?.());
    expect(screen.getByRole('button', { name: 'Warmup' })).toBeTruthy();
  });
});
