/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DateRange, type DateRangeMark, type DateRangeProps } from './DateRange';

afterEach(cleanup);

const TODAY = '2026-10-28';
const MARKS: DateRangeMark[] = [
  { date: '2026-11-03', code: 'PH', name: 'Melbourne Cup', kind: 'Public holiday' },
  { date: '2026-11-07', name: 'Plays heard', kind: 'Plays heard' },
];

type Range = [string | null, string | null];
/** A page that owns the value, as DateField's calendar button would. */
function Harness(props: Partial<DateRangeProps> & { start?: Range; spy?: (v: Range, p: string | null) => void }) {
  const { start = [null, null], spy, ...rest } = props;
  const [value, setValue] = useState<Range>(start);
  return (
    <DateRange
      value={value}
      onChange={(v, p) => { spy?.(v, p); setValue(v); }}
      onApply={() => {}}
      onClose={() => {}}
      today={TODAY}
      focusOnOpen={false}
      title="Plays to export"
      {...rest}
    />
  );
}

const day = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`);
const sum = () => document.querySelector('.sn-date-range__sum')?.textContent;
const live = () => screen.getByRole('status').textContent;

describe('DateRange', () => {
  it('renders two Monday-first months with the dialog named by its title', () => {
    render(<Harness start={['2026-11-09', '2026-11-13']} />);
    expect(screen.getByRole('dialog', { name: 'Plays to export' })).toBeTruthy();
    const grids = screen.getAllByRole('grid');
    expect(grids.map((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent)).toEqual(['November 2026', 'December 2026']);
    const heads = within(grids[0]).getAllByRole('columnheader');
    expect(heads.map((h) => h.getAttribute('abbr'))).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    // 1 November 2026 is a Sunday: six blank cells lead the first week.
    const firstWeek = within(grids[0]).getAllByRole('row')[1];
    const cells = within(firstWeek).getAllByRole('gridcell');
    expect(cells.slice(0, 6).every((c) => c.textContent === '')).toBe(true);
    expect(cells[6].textContent).toBe('1');
  });

  it('formats the range in words with its day count', () => {
    render(<Harness start={['2026-11-09', '2026-11-13']} />);
    expect(sum()).toBe('Mon 9 – Fri 13 Nov 2026 · 5 days');
    expect(day('2026-11-09').getAttribute('data-range')).toBe('start');
    expect(day('2026-11-11').getAttribute('data-range')).toBe('in');
    expect(day('2026-11-13').getAttribute('data-range')).toBe('end');
    expect(day('2026-11-11').closest('td')?.getAttribute('aria-selected')).toBe('true');
    expect(day('2026-11-09').getAttribute('aria-label')).toBe('Monday 9 November 2026, start of range');
  });

  it('sets From on the first pick and To on the second, announcing each', () => {
    const spy = vi.fn<(v: Range, p: string | null) => void>();
    render(<Harness spy={spy} start={['2026-11-02', null]} presetId={null} />);
    // A fresh pick after a complete range starts again from From; here From is already set, so this is To.
    fireEvent.click(day('2026-11-13'));
    expect(spy).toHaveBeenLastCalledWith(['2026-11-02', '2026-11-13'], null);
    expect(sum()).toBe('Mon 2 – Fri 13 Nov 2026 · 12 days');
    expect(live()).toBe('Mon 2 – Fri 13 Nov 2026, 12 days picked.');
    fireEvent.click(day('2026-11-03'));
    expect(spy).toHaveBeenLastCalledWith(['2026-11-03', null], null);
    expect(sum()).toBe('Tue 3 Nov 2026 · pick the end date');
    expect(live()).toBe('From Tuesday 3 November 2026. Now pick the end date.');
  });

  it('swaps the ends when the second pick is before From', () => {
    const spy = vi.fn<(v: Range, p: string | null) => void>();
    render(<Harness spy={spy} start={['2026-11-13', null]} />);
    fireEvent.click(day('2026-11-09'));
    expect(spy).toHaveBeenLastCalledWith(['2026-11-09', '2026-11-13'], null);
    expect(sum()).toBe('Mon 9 – Fri 13 Nov 2026 · 5 days');
  });

  it('sets the range from a preset, stays open, and unpresses on a pick', () => {
    const spy = vi.fn<(v: Range, p: string | null) => void>();
    const onClose = vi.fn<() => void>();
    render(<Harness spy={spy} onClose={onClose} presets={['last-week', 'this-week', 'next-week']} />);
    const chip = screen.getByRole('button', { name: 'Last week' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(spy).toHaveBeenLastCalledWith(['2026-10-19', '2026-10-25'], 'last-week');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(live()).toBe('Last week: Mon 19 – Sun 25 Oct 2026, 7 days.');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(day('2026-10-20'));
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('moves with the keyboard (roving tab stop) and picks with Enter', () => {
    const spy = vi.fn<(v: Range, p: string | null) => void>();
    render(<Harness spy={spy} start={['2026-11-09', '2026-11-13']} />);
    expect(day('2026-11-09').tabIndex).toBe(0);
    expect(day('2026-11-10').tabIndex).toBe(-1);
    day('2026-11-09').focus();
    fireEvent.keyDown(day('2026-11-09'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('2026-11-10'));
    expect(day('2026-11-10').tabIndex).toBe(0);
    fireEvent.keyDown(day('2026-11-10'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(day('2026-11-17'));
    fireEvent.keyDown(day('2026-11-17'), { key: 'Home' });
    expect(document.activeElement).toBe(day('2026-11-16'));
    fireEvent.keyDown(day('2026-11-16'), { key: 'End' });
    expect(document.activeElement).toBe(day('2026-11-22'));
    fireEvent.keyDown(day('2026-11-22'), { key: 'PageDown' });
    expect(document.activeElement).toBe(day('2026-12-22'));
    fireEvent.keyDown(day('2026-12-22'), { key: 'PageDown', shiftKey: true });
    expect(document.activeElement).toBe(day('2027-12-22'));
    fireEvent.keyDown(day('2027-12-22'), { key: 'PageUp', shiftKey: true });
    fireEvent.keyDown(day('2026-12-22'), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['2026-12-22', null], null);
  });

  it('calls onClose on Escape and from the Close button', () => {
    const onClose = vi.fn<() => void>();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(day(TODAY), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('marks today and the page marks in the accessible name and key', () => {
    render(<Harness marks={MARKS} />);
    const t = day(TODAY);
    expect(t.getAttribute('aria-current')).toBe('date');
    expect(t.getAttribute('aria-label')).toBe('Wednesday 28 October 2026, today');
    const cup = day('2026-11-03');
    expect(cup.getAttribute('aria-label')).toBe('Tuesday 3 November 2026, Melbourne Cup, public holiday');
    expect(cup.hasAttribute('data-mark')).toBe(true);
    expect(cup.getAttribute('title')).toBe('Melbourne Cup');
    expect(day('2026-11-07').getAttribute('aria-label')).toBe('Saturday 7 November 2026, Plays heard');
    const key = screen.getByRole('list', { name: 'Key' });
    expect(within(key).getAllByRole('listitem').map((li) => (li.textContent ?? '').trim())).toEqual(['PH Public holiday', 'Plays heard', 'Today']);
  });

  it('clears and applies with To defaulting to From', () => {
    const onApply = vi.fn<(v: [string, string]) => void>();
    render(<Harness onApply={onApply} start={['2026-11-09', null]} outcome="Download CSV" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(onApply).toHaveBeenCalledWith(['2026-11-09', '2026-11-09']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(sum()).toBe('No dates picked');
    expect(live()).toBe('Dates cleared.');
    expect(screen.getByRole('button', { name: 'Download CSV' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('applies the responsive modifiers as classes', () => {
    render(<Harness modifiers={['one', 'sheet', 'static']} />);
    expect(screen.getByRole('dialog').className).toBe('sn-popover sn-date-range sn-date-range--one sn-date-range--sheet sn-date-range--static');
  });
});
