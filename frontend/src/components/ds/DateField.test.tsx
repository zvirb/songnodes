/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DateField, DateRangeField, type DateFieldProps, type DateRangeFieldProps } from './DateField';

afterEach(() => { cleanup(); vi.useRealTimers(); });

type Range = [string | null, string | null];
const TODAY = '2026-10-28';

function One(props: Partial<DateFieldProps> & { start?: string | null; spy?: (v: string | null) => void }) {
  const { start = null, spy, ...rest } = props;
  const [value, setValue] = useState<string | null>(start);
  return <DateField label="Released on" value={value} onChange={(v) => { spy?.(v); setValue(v); }} {...rest} />;
}

function Span(props: Partial<DateRangeFieldProps> & { start?: Range; spy?: (v: Range) => void }) {
  const { start = [null, null], spy, ...rest } = props;
  const [value, setValue] = useState<Range>(start);
  return (
    <>
      <DateRangeField label="Scrape between" value={value} today={TODAY} onChange={(v) => { spy?.(v); setValue(v); }} {...rest} />
      <p>Outside</p>
    </>
  );
}

const type = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });
const group = (name: string) => screen.getByRole('group', { name });
const input = (el: HTMLElement) => { if (!(el instanceof HTMLInputElement)) throw new Error('not an input'); return el; };
const boxes = (name: string) => ['Day', 'Month', 'Year'].map((l) => input(within(group(name)).getByLabelText(l)));
const values = (name: string) => boxes(name).map((b) => b.value);
const shown = (name: string) => group(name).querySelector('.sn-date-field__shown')?.textContent;
const day = (iso: string) => { const b = document.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`); if (!b) throw new Error(`no day ${iso}`); return b; };
const pickBtn = () => screen.getByRole('button', { name: 'Pick the dates on the calendar' });

describe('DateField', () => {
  it('renders day, month and year boxes in en-AU order and emits the ISO date', () => {
    const spy = vi.fn<(v: string | null) => void>();
    render(<One spy={spy} help="For example, 24 10 2026" />);
    const [d, m, y] = boxes('Released on');
    expect([d, m, y].map((b) => [b.getAttribute('inputmode'), b.maxLength])).toEqual([['numeric', 2], ['numeric', 2], ['numeric', 4]]);
    expect(group('Released on').className).toBe('sn-date-field');
    expect(screen.getByText('For example, 24 10 2026').className).toBe('sn-date-field__help');
    type(d, '24');
    type(m, '10');
    expect(spy).not.toHaveBeenCalled();
    type(y, '2026');
    expect(spy).toHaveBeenLastCalledWith('2026-10-24');
    expect(shown('Released on')).toBe('Sat 24 Oct 2026');
    expect(d.getAttribute('aria-describedby')).toBe(group('Released on').querySelector('.sn-date-field__shown')?.id);
    type(m, '');
    expect(spy).toHaveBeenLastCalledWith(null);
    expect(shown('Released on')).toBe('');
  });

  it('accepts 9 and 09 for the month and rejects an impossible date', () => {
    const spy = vi.fn<(v: string | null) => void>();
    render(<One spy={spy} />);
    const [d, m, y] = boxes('Released on');
    type(d, '1'); type(m, '9'); type(y, '2026');
    expect(spy).toHaveBeenLastCalledWith('2026-09-01');
    type(m, '09');
    expect(spy).toHaveBeenCalledTimes(1);
    type(d, '31');
    expect(spy).toHaveBeenLastCalledWith(null);
    expect(shown('Released on')).toBe('');
  });

  it('keeps Melbourne DST boundary days as typed (no time-zone drift)', () => {
    const spy = vi.fn<(v: string | null) => void>();
    render(<One spy={spy} />);
    const [d, m, y] = boxes('Released on');
    type(d, '4'); type(m, '10'); type(y, '2026');
    expect(spy).toHaveBeenLastCalledWith('2026-10-04');
    expect(shown('Released on')).toBe('Sun 4 Oct 2026');
    type(d, '5'); type(m, '4');
    expect(spy).toHaveBeenLastCalledWith('2026-04-05');
    expect(shown('Released on')).toBe('Sun 5 Apr 2026');
  });

  it('shows the error and marks only the wrong part', () => {
    render(<One start="2026-10-24" error="Released on must be a real date. September has 30 days." invalidParts={['day']} />);
    const [d, m] = boxes('Released on');
    const err = screen.getByText('Released on must be a real date. September has 30 days.');
    expect(err.className).toBe('sn-field__error');
    expect(d.getAttribute('aria-invalid')).toBe('true');
    expect(m.hasAttribute('aria-invalid')).toBe(false);
    expect(d.getAttribute('aria-describedby')?.split(' ')).toContain(err.id);
  });

  it('fills the boxes from a value set outside', () => {
    const { rerender } = render(<DateField label="Released on" value={null} onChange={() => {}} />);
    rerender(<DateField label="Released on" value="2026-10-04" onChange={() => {}} />);
    expect(values('Released on')).toEqual(['4', '10', '2026']);
  });

  it('uses the native date input with the en-AU date underneath', () => {
    const spy = vi.fn<(v: string | null) => void>();
    render(<One spy={spy} native start="2026-10-24" />);
    const field = input(screen.getByLabelText('Released on'));
    expect(field.type).toBe('date');
    expect(field.className).toBe('sn-input sn-date-field__native');
    expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Sat 24 Oct 2026');
    type(field, '2026-10-04');
    expect(spy).toHaveBeenLastCalledWith('2026-10-04');
  });
});

describe('DateRangeField', () => {
  it('renders presets, From and To groups and the calendar button', () => {
    render(<Span />);
    const field = group('Scrape between');
    expect(field.className).toBe('sn-date-field sn-date-field--calendar');
    const chips = within(screen.getByRole('group', { name: 'Date presets' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Last 7 days', 'Last 30 days', 'This year']);
    expect(values('From')).toEqual(['', '', '']);
    const b = pickBtn();
    expect(b.className).toBe('sn-btn sn-btn--icon sn-date-field__pick');
    expect([b.getAttribute('aria-haspopup'), b.getAttribute('aria-expanded'), b.title]).toEqual(['dialog', 'false', 'Pick the dates on the calendar']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fills both groups from a preset and unpresses on typing', () => {
    const spy = vi.fn<(v: Range) => void>();
    render(<Span spy={spy} />);
    const chip = screen.getByRole('button', { name: 'Last 7 days' });
    fireEvent.click(chip);
    expect(spy).toHaveBeenLastCalledWith(['2026-10-22', '2026-10-28']);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(values('From')).toEqual(['22', '10', '2026']);
    expect(shown('To')).toBe('Wed 28 Oct 2026');
    type(boxes('From')[0], '21');
    expect(spy).toHaveBeenLastCalledWith(['2026-10-21', '2026-10-28']);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('takes "today" for presets as the Melbourne date, not the UTC date', () => {
    // 01:30 on 4 Oct 2026 in Melbourne (AEST, half an hour before DST starts) is still 3 Oct in UTC.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T15:30:00Z'));
    const spy = vi.fn<(v: Range) => void>();
    render(<Span spy={spy} today={undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(spy).toHaveBeenLastCalledWith(['2026-09-28', '2026-10-04']);
  });

  it('says when a date is not real or From is after To', () => {
    render(<Span start={['2026-11-13', '2026-11-09']} />);
    const err = group('Scrape between').querySelector('.sn-field__error');
    if (!err) throw new Error('no error line');
    expect(err.textContent).toBe('The From date must be on or before the To date.');
    expect(err.hasAttribute('hidden')).toBe(false);
    expect(boxes('From')[0].getAttribute('aria-describedby')?.split(' ')).toContain(err.id);
    expect(boxes('To')[0].getAttribute('aria-invalid')).toBe('true');
    type(boxes('To')[0], '31');
    expect(err.textContent).toBe('Enter a real date, for example 24 10 2026.');
    expect(boxes('To')[0].getAttribute('aria-invalid')).toBe('true');
    expect(boxes('From')[0].hasAttribute('aria-invalid')).toBe(false);
  });

  it('opens the calendar on the grid, picks a span with the mouse and closes on the outcome', () => {
    const spy = vi.fn<(v: Range) => void>();
    const opened = vi.fn<() => void>();
    render(<Span spy={spy} onPickOnCalendar={opened} />);
    fireEvent.click(pickBtn());
    expect(opened).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole('dialog', { name: 'Scrape between' });
    expect(pickBtn().getAttribute('aria-expanded')).toBe('true');
    expect(pickBtn().getAttribute('aria-controls')).toBe(dialog.id);
    expect(document.activeElement).toBe(day(TODAY));
    fireEvent.click(day('2026-11-09'));
    fireEvent.click(day('2026-11-13'));
    expect(spy).toHaveBeenLastCalledWith(['2026-11-09', '2026-11-13']);
    expect(values('From')).toEqual(['9', '11', '2026']);
    expect(shown('To')).toBe('Fri 13 Nov 2026');
    // DR-045: the popover stays open after the second pick.
    expect(dialog.querySelector('.sn-date-range__sum')?.textContent).toBe('Mon 9 – Fri 13 Nov 2026 · 5 days');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use these dates' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(pickBtn());
    expect(pickBtn().getAttribute('aria-expanded')).toBe('false');
  });

  it('picks a span with the keyboard across the DST start and returns focus on Escape', () => {
    const spy = vi.fn<(v: Range) => void>();
    render(<Span spy={spy} start={['2026-10-03', null]} />);
    fireEvent.click(pickBtn());
    expect(document.activeElement).toBe(day('2026-10-03'));
    fireEvent.keyDown(day('2026-10-03'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('2026-10-04'));
    fireEvent.keyDown(day('2026-10-04'), { key: 'ArrowDown' });
    fireEvent.keyDown(day('2026-10-11'), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['2026-10-03', '2026-10-11']);
    expect(values('To')).toEqual(['11', '10', '2026']);
    expect(screen.getByRole('dialog').querySelector('.sn-date-range__sum')?.textContent).toBe('Sat 3 – Sun 11 Oct 2026 · 9 days');
    fireEvent.keyDown(day('2026-10-11'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(pickBtn());
  });

  it('applies a one-day range when only From is picked', () => {
    const spy = vi.fn<(v: Range) => void>();
    render(<Span spy={spy} />);
    fireEvent.click(pickBtn());
    fireEvent.click(day('2026-10-04'));
    fireEvent.click(screen.getByRole('button', { name: 'Use these dates' }));
    expect(spy).toHaveBeenLastCalledWith(['2026-10-04', '2026-10-04']);
    expect(values('To')).toEqual(['4', '10', '2026']);
  });

  it('clears both groups from the calendar', () => {
    const spy = vi.fn<(v: Range) => void>();
    render(<Span spy={spy} start={['2026-11-09', '2026-11-13']} />);
    fireEvent.click(pickBtn());
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(spy).toHaveBeenLastCalledWith([null, null]);
    expect(values('From')).toEqual(['', '', '']);
    expect(values('To')).toEqual(['', '', '']);
  });

  it('shows typed dates in the months and closes on a click outside without moving focus', () => {
    render(<Span start={['2026-11-09', '2026-11-13']} />);
    fireEvent.click(pickBtn());
    expect(day('2026-11-09').getAttribute('data-range')).toBe('start');
    type(boxes('To')[0], '20');
    expect(day('2026-11-20').getAttribute('data-range')).toBe('end');
    const outside = screen.getByText('Outside');
    fireEvent.click(outside);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).not.toBe(pickBtn());
  });

  it('keeps week presets in the popover only and presses a preset in both places', () => {
    render(<Span calendarProps={{ presets: ['last-week'], title: 'Scheduled scrapes run between' }} />);
    const row = screen.getByRole('group', { name: 'Date presets' });
    expect(within(row).queryByRole('button', { name: 'Last week' })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Last 30 days' }));
    fireEvent.click(pickBtn());
    const dialog = screen.getByRole('dialog', { name: 'Scheduled scrapes run between' });
    expect(within(dialog).getByRole('button', { name: 'Last 30 days' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Last week' }));
    expect(values('From')).toEqual(['19', '10', '2026']);
    expect(values('To')).toEqual(['25', '10', '2026']);
    expect(within(row).getByRole('button', { name: 'Last 30 days' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(within(dialog).getByRole('button', { name: 'This year' }));
    expect(within(row).getByRole('button', { name: 'This year' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('has no calendar button when calendar is false', () => {
    render(<Span calendar={false} />);
    expect(group('Scrape between').className).toBe('sn-date-field');
    expect(screen.queryByRole('button', { name: 'Pick the dates on the calendar' })).toBeNull();
  });
});
