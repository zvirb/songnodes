/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { FilterPresets } from './FilterPresets';
import { DEFAULT_FILTERS, type CrateFilters } from '../setBuilder';
import { saveFavorite, getFavorites, removeFavorite } from '../../../utils/favoriteQueries';

const mockFilters: CrateFilters = { ...DEFAULT_FILTERS, q: 'acid', pillar: ['Techno'] };

describe('FilterPresets', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('saving current filters creates preset', () => {
    const onApply = vi.fn();
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

    const onApply = vi.fn();
    render(<FilterPresets currentFilters={DEFAULT_FILTERS} onApply={onApply} />);

    const presetChip = screen.getByRole('button', { name: 'Warmup 118-122' });
    fireEvent.click(presetChip);

    expect(onApply).toHaveBeenCalledWith(mockFilters);
  });

  it('deleting removes preset', () => {
    saveFavorite('library-crate-presets', { label: 'Peak Acid Techno', payload: mockFilters });

    const onApply = vi.fn();
    render(<FilterPresets currentFilters={DEFAULT_FILTERS} onApply={onApply} />);

    const deleteBtn = screen.getByRole('button', { name: 'Delete preset Peak Acid Techno' });
    fireEvent.click(deleteBtn);

    // Verify it's removed from UI
    expect(screen.queryByRole('button', { name: 'Peak Acid Techno' })).toBeNull();

    // Verify it's removed from storage
    const favs = getFavorites<CrateFilters>('library-crate-presets');
    expect(favs).toHaveLength(0);
  });
});
