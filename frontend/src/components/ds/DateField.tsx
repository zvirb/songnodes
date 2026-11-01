/**
 * DateField and DateRangeField (design system 1.3.0, Inputs).
 *
 * Date entry in en-AU order as three short boxes (day, month, year), shown back as "Sat 24 Oct 2026".
 * The range variant has presets and a calendar button that opens DateRange with focus on the grid.
 * Values are date-only ISO strings ("2026-10-24"): parsed and checked from their parts, never through
 * a time zone; "today" for presets is the Melbourne date (SN.calendar.today()).
 * Markup and behaviour: design-system/components/DateField/README.md and its preview.html.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { SN } from '../../lib/songnodes';
import { DateRange, type DateRangePreset, type DateRangePresetId, type DateRangeProps } from './DateRange';

export type DatePart = 'day' | 'month' | 'year';
type Range = [string | null, string | null];
type Parts = { d: string; m: string; y: string };
type Entry = { iso: string | null; bad: boolean };

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true, className: 'sn-icon' } as const;
const EMPTY: Parts = { d: '', m: '', y: '' };
const DEFAULT_PRESETS: DateRangePresetId[] = ['last-7-days', 'last-30-days', 'this-year'];

function toParts(iso: string | null): Parts {
  const p = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return p ? { d: String(+p[3]), m: String(+p[2]), y: p[1] } : EMPTY;
}

/** The boxes as a date: null while incomplete, bad when complete but not a real date. */
function readParts({ d, m, y }: Parts): Entry {
  const s = [d.trim(), m.trim(), y.trim()];
  if (s.some((x) => x === '')) return { iso: null, bad: s.some((x) => x !== '' && !/^\d+$/.test(x)) };
  if (!s.every((x) => /^\d+$/.test(x))) return { iso: null, bad: true };
  const [dd, mm, yy] = s.map(Number);
  // Days in the month from UTC parts only, so no device time zone can shift the date.
  const last = mm >= 1 && mm <= 12 ? new Date(Date.UTC(yy, mm, 0)).getUTCDate() : 0;
  if (yy <= 1900 || yy > 9999 || dd < 1 || dd > last) return { iso: null, bad: true };
  return { iso: SN.calendar.iso(yy, mm, dd), bad: false };
}

/** The readable date for a date-only value ("Sat 24 Oct 2026"); SN.format.range reads it from its parts. */
const shownOf = (iso: string | null) => (iso ? SN.format.range(iso, iso) : '');

/** The boxes' text, reset when the value changes from outside (a preset, the calendar, a reset). */
function useParts(value: string | null): [Parts, (p: Parts) => void] {
  const [parts, setParts] = useState<Parts>(() => toParts(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (readParts(parts).iso !== value) setParts(toParts(value));
  }
  return [parts, setParts];
}

interface PartsGroupProps {
  label: string;
  parts: Parts;
  onParts: (p: Parts) => void;
  help?: string;
  error?: string;
  errorId?: string;
  invalidParts?: DatePart[];
  fieldsetProps?: React.FieldsetHTMLAttributes<HTMLFieldSetElement>;
  fieldsetRef?: React.Ref<HTMLFieldSetElement>;
}

/** One date: fieldset + legend, a visible label per box, inputmode numeric, no auto-advance. */
function PartsGroup({ label, parts, onParts, help, error, errorId, invalidParts = [], fieldsetProps = {}, fieldsetRef }: PartsGroupProps) {
  const id = useId();
  const errId = errorId ?? (error ? `${id}-err` : undefined);
  const { className = '', ...rest } = fieldsetProps;
  const box = (k: keyof Parts, part: DatePart, name: string, width: number) => (
    <div className={`sn-date-field__part${k === 'y' ? ' sn-date-field__part--year' : ''}`}>
      <label htmlFor={`${id}${k}`}>{name}</label>
      <input
        className="sn-input"
        id={`${id}${k}`}
        data-k={k}
        inputMode="numeric"
        autoComplete="off"
        maxLength={width}
        value={parts[k]}
        aria-invalid={invalidParts.includes(part) ? true : undefined}
        aria-describedby={[`${id}-shown`, errId].filter(Boolean).join(' ')}
        onChange={(e) => onParts({ ...parts, [k]: e.target.value })}
      />
    </div>
  );
  return (
    <fieldset ref={fieldsetRef} className={['sn-date-field', className].filter(Boolean).join(' ')} data-date="" {...rest}>
      <legend className="sn-date-field__legend">{label}</legend>
      {help ? <p className="sn-date-field__help">{help}</p> : null}
      {error && !errorId ? <span className="sn-field__error" id={errId}>{error}</span> : null}
      <div className="sn-date-field__parts">
        {box('d', 'day', 'Day', 2)}
        {box('m', 'month', 'Month', 2)}
        {box('y', 'year', 'Year', 4)}
      </div>
      <span className="sn-date-field__shown" id={`${id}-shown`}>{shownOf(readParts(parts).iso)}</span>
    </fieldset>
  );
}

export interface DateFieldProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
  /** Legend ("Released on"). */
  label: string;
  /** ISO date "2026-10-24" or null when empty. Date-only: no time zone. */
  value: string | null;
  /** Called with a valid ISO date, or null while incomplete. */
  onChange: (value: string | null) => void;
  /** Help, for example "For example, 24 10 2026". */
  help?: string;
  /** Error message; mark only the wrong parts with invalidParts. */
  error?: string;
  /** Which boxes are wrong. */
  invalidParts?: DatePart[];
  /** Use the native date input with the readable date underneath. */
  native?: boolean;
}

export const DateField = React.forwardRef<HTMLFieldSetElement, DateFieldProps>(({
  label, value, onChange, help, error, invalidParts = [], native = false, ...props
}, ref) => {
  const id = useId();
  const [parts, setParts] = useParts(value);
  if (native) {
    // The native input shows dates in the browser's locale, so the en-AU date is always shown underneath.
    return (
      <div className="sn-field">
        <label htmlFor={`${id}-n`}>{label}</label>
        {help ? <span className="sn-field__help">{help}</span> : null}
        {error ? <span className="sn-field__error" id={`${id}-err`}>{error}</span> : null}
        <input
          type="date"
          className="sn-input sn-date-field__native"
          id={`${id}-n`}
          value={value ?? ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${id}-shown`, error ? `${id}-err` : ''].filter(Boolean).join(' ')}
          onChange={(e) => onChange(e.target.value || null)}
        />
        <span className="sn-date-field__shown" id={`${id}-shown`} aria-live="polite">{shownOf(value)}</span>
      </div>
    );
  }
  return (
    <PartsGroup
      label={label}
      parts={parts}
      help={help}
      error={error}
      invalidParts={invalidParts}
      fieldsetProps={props}
      fieldsetRef={ref}
      onParts={(p) => {
        setParts(p);
        const { iso } = readParts(p);
        if (iso !== value) onChange(iso);
      }}
    />
  );
});
DateField.displayName = 'DateField';

export interface DateRangeFieldProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
  /** Legend ("Last heard between"). */
  label: string;
  /** [from, to] ISO dates. */
  value: Range;
  /** Change handler: typed dates, a preset, or days picked on the calendar. */
  onChange: (value: Range) => void;
  /** Presets; default Last 7 days, Last 30 days, This year. */
  presets?: (DateRangePresetId | DateRangePreset)[];
  /** "Today" for presets, in Melbourne; defaults to SN.calendar.today(). */
  today?: string;
  /** Show the icon-only calendar button ("Pick the dates on the calendar") that opens DateRange. Default true. */
  calendar?: boolean;
  /** DateRange options for the calendar (title, outcome, marks, extra presets shown in the popover only). */
  calendarProps?: Partial<Pick<DateRangeProps, 'title' | 'outcome' | 'marks' | 'presets'>>;
  /** Called when the calendar opens (for analytics or lazy-loading marks). */
  onPickOnCalendar?: () => void;
}

export const DateRangeField = React.forwardRef<HTMLFieldSetElement, DateRangeFieldProps>(({
  label, value, onChange, presets = DEFAULT_PRESETS, today: todayProp, calendar = true, calendarProps = {},
  onPickOnCalendar, className = '', ...props
}, ref) => {
  const C = SN.calendar;
  const uid = useId();
  const today = todayProp ?? C.today();
  const [from, to] = value;
  const [fromBoxes, setFromBoxes] = useParts(from);
  const [toBoxes, setToBoxes] = useParts(to);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pickRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  const chips = presets.map((p) => (typeof p === 'string'
    ? { id: p, label: C.PRESET_LABELS[p], range: (): [string, string] => C.preset(p, today) ?? [today, today] }
    : { id: p.id, label: p.label, range: typeof p.range === 'function' ? p.range : ((r: [string, string]) => () => r)(p.range) }));

  const a = readParts(fromBoxes);
  const b = readParts(toBoxes);
  const msg = a.bad || b.bad
    ? 'Enter a real date, for example 24 10 2026.'
    : (a.iso && b.iso && a.iso > b.iso ? 'The From date must be on or before the To date.' : '');
  const errId = `${uid}-err`;
  const allParts: DatePart[] = ['day', 'month', 'year'];
  // A date that is not real marks its own boxes; From after To marks both.
  const wrong = (e: Entry): DatePart[] => (!msg ? [] : (a.bad || b.bad) && !e.bad ? [] : allParts);

  const close = (back: boolean) => {
    setOpen(false);
    if (back) pickRef.current?.focus();
  };

  // A click outside the popover, its button and the field's presets closes it without moving focus.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node) || popRef.current?.contains(t) || pickRef.current?.contains(t) || chipsRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  const typed = (which: 0 | 1, p: Parts) => {
    (which === 0 ? setFromBoxes : setToBoxes)(p);
    setPresetId(null);
    const next: Range = which === 0 ? [readParts(p).iso, to] : [from, readParts(p).iso];
    if (next[0] !== from || next[1] !== to) onChange(next);
  };

  const pressChip = (c: (typeof chips)[number]) => {
    const r = c.range();
    setPresetId(c.id);
    onChange([r[0], r[1]]);
  };

  const classes = ['sn-date-field', calendar ? 'sn-date-field--calendar' : '', className].filter(Boolean).join(' ');
  const popId = `${uid}-dr`;

  return (
    <fieldset ref={ref} className={classes} {...props}>
      <legend className="sn-date-field__legend">{label}</legend>
      {chips.length ? (
        // The card's markup: a div role="group" of chips (a fieldset here would nest a third legend).
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        <div className="sn-date-field__presets" role="group" aria-label="Date presets" ref={chipsRef}>
          {chips.map((c) => (
            <button key={c.id} type="button" className="sn-chip" aria-pressed={presetId === c.id} data-preset={c.id} onClick={() => pressChip(c)}>{c.label}</button>
          ))}
        </div>
      ) : null}
      <div className="sn-date-field__range">
        <PartsGroup label="From" parts={fromBoxes} onParts={(p) => typed(0, p)} errorId={msg ? errId : undefined} invalidParts={wrong(a)} />
        <span className="sn-date-field__to" aria-hidden="true">to</span>
        <PartsGroup label="To" parts={toBoxes} onParts={(p) => typed(1, p)} errorId={msg ? errId : undefined} invalidParts={wrong(b)} />
        {calendar ? (
          <button
            ref={pickRef}
            type="button"
            className="sn-btn sn-btn--icon sn-date-field__pick"
            aria-label="Pick the dates on the calendar"
            title="Pick the dates on the calendar"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={popId}
            onClick={() => {
              if (open) { close(true); return; }
              setOpen(true);
              onPickOnCalendar?.();
            }}
          >
            <Calendar {...ICON} />
          </button>
        ) : null}
      </div>
      <span className="sn-field__error" id={errId} hidden={!msg}>{msg}</span>
      {calendar && open ? (
        <DateRange
          ref={popRef}
          id={popId}
          value={value}
          today={today}
          presetId={presetId}
          title={calendarProps.title ?? label}
          outcome={calendarProps.outcome ?? 'Use these dates'}
          marks={calendarProps.marks}
          // Week and page presets passed here show in the popover only (DR-046).
          presets={[...presets, ...(calendarProps.presets ?? [])]}
          onChange={(v, id) => { setPresetId(id); onChange(v); }}
          // The boxes already hold the dates; the outcome only closes (with only From, a one-day range).
          onApply={([f, t]) => { if (to === null) onChange([f, t]); close(true); }}
          onClose={() => close(true)}
        />
      ) : null}
    </fieldset>
  );
});
DateRangeField.displayName = 'DateRangeField';
