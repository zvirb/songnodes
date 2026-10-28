/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AutocompleteSearchField, type AutocompleteOption } from './AutocompleteSearchField';
import { getRecentSearches } from '../../utils/recentSearches';

const VOCAB: AutocompleteOption[] = [
  { id: 'a1', value: 'Bicep', meta: 'Artist · 41' },
  { id: 't1', value: 'Bicep – Glue', meta: 'Track · 5A' },
  { id: 'g1', value: 'Big Beat', meta: 'Tag · 23' },
  { id: 'a2', value: 'Overmono', meta: 'Artist · 18' },
];

function Harness(props: { recent?: string[]; namespace?: string; onSelect?: (v: string, o?: AutocompleteOption) => void }) {
  const [q, setQ] = useState('');
  const suggestions = q ? VOCAB.filter((v) => v.value.toLowerCase().startsWith(q.toLowerCase())) : [];
  return (
    <AutocompleteSearchField
      label="Search tracks"
      value={q}
      onChange={setQ}
      suggestions={suggestions}
      recent={props.recent}
      namespace={props.namespace}
      onSelect={props.onSelect ?? (() => {})}
    />
  );
}

const input = (): HTMLInputElement => {
  const el = screen.getByRole('combobox');
  if (!(el instanceof HTMLInputElement)) throw new Error('combobox is not an input');
  return el;
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('AutocompleteSearchField', () => {
  it('renders a labelled combobox inside a search landmark, closed', () => {
    render(<Harness />);
    expect(screen.getByRole('search')).toBeTruthy();
    expect(input().getAttribute('aria-autocomplete')).toBe('list');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText('Search tracks')).toBe(input());
  });

  it('shows recent searches on focus when the field is empty', () => {
    render(<Harness recent={['bicep glue', 'overmono']} />);
    fireEvent.focus(input());
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Recent searches')).toBeTruthy();
    expect(screen.getAllByRole('option').map((o) => o.querySelector('.sn-autocomplete__text')?.textContent)).toEqual(['bicep glue', 'overmono']);
  });

  it('suggests completions as you type and marks the typed prefix', () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'bi' } });
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(3);
    expect(opts[0].querySelector('mark')?.textContent).toBe('Bi');
    expect(screen.getByText('Suggestions')).toBeTruthy();
  });

  it('moves the active option with the arrow keys and wraps', () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'bi' } });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    const opts = screen.getAllByRole('option');
    expect(opts[1].getAttribute('aria-selected')).toBe('true');
    expect(input().getAttribute('aria-activedescendant')).toBe(opts[1].id);
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2].getAttribute('aria-selected')).toBe('true');
  });

  it('Enter chooses the active option, fills the field and closes', () => {
    const onSelect = vi.fn<(v: string, o?: AutocompleteOption) => void>();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'bi' } });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('Bicep', VOCAB[0]);
    expect(input().value).toBe('Bicep');
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('Enter with no active option searches the typed text', () => {
    const onSelect = vi.fn<(v: string, o?: AutocompleteOption) => void>();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'peak acid' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('peak acid', undefined);
  });

  it('Escape closes the popup first, then clears the text', () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'bi' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().value).toBe('bi');
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(input().value).toBe('');
  });

  it('pressing an option with the pointer chooses it', () => {
    const onSelect = vi.fn<(v: string, o?: AutocompleteOption) => void>();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'ov' } });
    fireEvent.mouseDown(screen.getByRole('option'));
    expect(onSelect).toHaveBeenCalledWith('Overmono', VOCAB[3]);
  });

  it('with a namespace, saves chosen searches and can clear them', () => {
    render(<Harness namespace="test-crate" />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'bi' } });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(getRecentSearches('test-crate')).toEqual(['Bicep']);
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.focus(input());
    expect(screen.getAllByRole('option').map((o) => o.querySelector('.sn-autocomplete__text')?.textContent)).toEqual(['Bicep']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear recent searches' }));
    expect(getRecentSearches('test-crate')).toEqual([]);
  });

  it('never opens an empty popup', () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'zzq' } });
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
