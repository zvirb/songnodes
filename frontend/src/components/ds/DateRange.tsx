/**
 * DateRange (design system 1.3.0, Inputs).
 *
 * The calendar popover for a from–to span: two months (Monday first), presets beside them, a key
 * for the page's day marks, and the range in words with its day count. Mirrors the markup, ARIA
 * and keys of SongNodes.dateRange (design-system/source/bundle.src.js); the calendar maths and
 * the words come from SN.calendar and SN.format (date-only ISO strings, Melbourne "today").
 * Markup and behaviour: design-system/components/DateRange/README.md.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SN } from '../../lib/songnodes';

export interface DateRangeMark {
  /** ISO date "2026-11-03". */
  date: string;
  /** Short code under the number ("PH", "RUN"); omit for a plain data dot. */
  code?: string;
  /** The day's own name ("Melbourne Cup"). */
  name: string;
  /** The kind, for the key and the announced name ("Public holiday"). */
  kind: string;
}
export type DateRangePresetId = 'last-7-days' | 'last-30-days' | 'this-year' | 'last-week' | 'this-week' | 'next-week';
export interface DateRangePreset {
  id: string;
  label: string;
  /** [from, to] ISO dates, or a function giving them (evaluated when pressed). */
  range: [string, string] | (() => [string, string]);
}
export type DateRangeModifier = 'stacked' | 'one' | 'sheet' | 'static';
type Range = [string | null, string | null];

export interface DateRangeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'title'> {
  /** [from, to] ISO dates; to is null while only From is picked. */
  value: Range;
  /** Called after each pick, preset or Clear; presetId is the pressed preset, or null. */
  onChange: (value: Range, presetId: string | null) => void;
  /** The outcome button: called with the range (To defaults to From). */
  onApply: (value: [string, string]) => void;
  /** Escape or the close button; the page returns focus to the control that opened it. */
  onClose: () => void;
  /** Popover title naming what the span is for. Default "Pick the dates". */
  title?: string;
  /** Outcome button label: "Use these dates" (default), "Download CSV", "Print". */
  outcome?: string;
  /** Presets in this order; default last 7 days, last 30 days, this year. */
  presets?: (DateRangePresetId | DateRangePreset)[];
  /** Day marks; the key lists only the kinds used here. */
  marks?: DateRangeMark[];
  /** "Today" as a Melbourne ISO date; defaults to SN.calendar.today(). */
  today?: string;
  /** Show the pressed preset (for a value that came from one). */
  presetId?: string | null;
  /** Layout modifiers for a popover in a narrow column (the viewport queries apply anyway). */
  modifiers?: DateRangeModifier[];
  /** Put focus on the grid (From, else today) when it opens. Default true. */
  focusOnOpen?: boolean;
}

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true, className: 'sn-icon' } as const;
const DOW = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_PRESETS: DateRangePresetId[] = ['last-7-days', 'last-30-days', 'this-year'];

const firstOf = (iso: string) => `${iso.slice(0, 8)}01`;
const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const oneMonthShown = (mods: DateRangeModifier[]) =>
  mods.includes('one') || (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767.98px)').matches);

/** The first month to show so the range is in view (bundle.js showRange). */
function viewFor(from: string, to: string | null, one: boolean): string {
  const C = SN.calendar;
  const a = firstOf(from);
  const b = firstOf(to ?? from);
  return one || a === b || C.addMonths(a, 1) === b ? a : C.addMonths(b, -1);
}

export const DateRange = React.forwardRef<HTMLDivElement, DateRangeProps>(({
  value,
  onChange,
  onApply,
  onClose,
  title = 'Pick the dates',
  outcome = 'Use these dates',
  presets = DEFAULT_PRESETS,
  marks = [],
  today: todayProp,
  presetId = null,
  modifiers = [],
  focusOnOpen = true,
  className = '',
  ...props
}, ref) => {
  const C = SN.calendar;
  const uid = useId();
  const today = todayProp ?? C.today();
  const [from, to] = value;
  const gridRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(() => (from ? viewFor(from, to, oneMonthShown(modifiers)) : firstOf(today)));
  const [focusIso, setFocusIso] = useState(() => from ?? today);
  const [pressed, setPressed] = useState<string | null>(presetId);
  const [said, setSaid] = useState('');
  // A request to move keyboard focus to a day: on open and after each arrow key, never after a click elsewhere.
  const [focusReq, setFocusReq] = useState<{ iso: string } | null>(() => (focusOnOpen ? { iso: from ?? today } : null));
  const [prev, setPrev] = useState({ from, to, presetId, emitted: `${from}|${to}` });

  // Props changed from outside (typed dates, a reset): show the range and take the page's preset.
  if (prev.from !== from || prev.to !== to || prev.presetId !== presetId) {
    const external = `${from}|${to}` !== prev.emitted;
    setPrev({ from, to, presetId, emitted: `${from}|${to}` });
    if (external || prev.presetId !== presetId) setPressed(presetId);
    if (external && from) {
      const v = viewFor(from, to, oneMonthShown(modifiers));
      setView(v);
      setFocusIso(firstOf(from) === v ? from : (to ?? from));
    }
  }

  useEffect(() => {
    if (focusReq) gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusReq.iso}"]`)?.focus();
  }, [focusReq]);

  const byDay = new Map<string, DateRangeMark[]>();
  const key: DateRangeMark[] = [];
  const seen = new Set<string>();
  marks.forEach((mk) => {
    byDay.set(mk.date, [...(byDay.get(mk.date) ?? []), mk]);
    const k = `${mk.code ?? '·'}|${mk.kind}`;
    if (!seen.has(k)) { seen.add(k); key.push(mk); }
  });
  const presetList = presets.map((p) => (typeof p === 'string'
    ? { id: p, label: C.PRESET_LABELS[p], range: (): [string, string] => C.preset(p, today) ?? [today, today] }
    : (() => { const r = p.range; return { id: p.id, label: p.label, range: typeof r === 'function' ? r : (): [string, string] => r }; })()));

  const emit = (next: Range, id: string | null) => {
    setPrev({ from: next[0], to: next[1], presetId, emitted: `${next[0]}|${next[1]}` });
    setPressed(id);
    onChange(next, id);
  };

  const rangeOf = (iso: string): 'start' | 'end' | 'in' | 'single' | null => {
    if (!from) return null;
    const b = to ?? from;
    if (iso === from && iso === b) return 'single';
    if (iso === from) return 'start';
    if (iso === b) return 'end';
    return iso > from && iso < b ? 'in' : null;
  };
  const nameOf = (iso: string, r: ReturnType<typeof rangeOf>) => {
    let s = SN.format.dayLong(iso);
    (byDay.get(iso) ?? []).forEach((mk) => {
      s += `, ${mk.name}${mk.kind && mk.kind.toLowerCase() !== mk.name.toLowerCase() ? `, ${mk.kind.toLowerCase()}` : ''}`;
    });
    if (iso === today) s += ', today';
    if (r === 'start') s += ', start of range';
    else if (r === 'end') s += ', end of range';
    else if (r === 'in') s += ', in range';
    else if (r === 'single') s += ', start and end of range';
    return s;
  };

  const pick = (iso: string) => {
    let next: Range;
    if (!from || to) next = [iso, null];
    else if (iso < from) next = [iso, from];
    else next = [from, iso];
    setFocusIso(iso);
    emit(next, null);
    const [a, b] = next;
    setSaid(a && b ? `${SN.format.range(a, b)}, ${plural(C.days(a, b))} picked.` : `From ${SN.format.dayLong(iso)}. Now pick the end date.`);
  };

  const months = [view, C.addMonths(view, 1)];
  const shown = (iso: string) => {
    const m = firstOf(iso);
    return m === months[0] || (m === months[1] && !oneMonthShown(modifiers));
  };
  const tabStop = shown(focusIso) ? focusIso : view;

  const moveTo = (iso: string) => {
    if (!shown(iso)) {
      const first = firstOf(iso);
      setView(!oneMonthShown(modifiers) && first > view ? C.addMonths(first, -1) : first);
    }
    setFocusIso(iso);
    setFocusReq({ iso });
  };

  const onDayKey = (e: React.KeyboardEvent<HTMLButtonElement>, iso: string) => {
    const mon = C.weekStart(iso);
    let n: string | null = null;
    switch (e.key) {
      case 'ArrowLeft': n = C.addDays(iso, -1); break;
      case 'ArrowRight': n = C.addDays(iso, 1); break;
      case 'ArrowUp': n = C.addDays(iso, -7); break;
      case 'ArrowDown': n = C.addDays(iso, 7); break;
      case 'Home': n = mon; break;
      case 'End': n = C.addDays(mon, 6); break;
      case 'PageUp': n = C.addMonths(iso, e.shiftKey ? -12 : -1); break;
      case 'PageDown': n = C.addMonths(iso, e.shiftKey ? 12 : 1); break;
      case 'Enter': case ' ': e.preventDefault(); pick(iso); return;
      default: return;
    }
    e.preventDefault();
    moveTo(n);
  };

  const step = (dir: -1 | 1) => {
    const v = C.addMonths(view, dir);
    setView(v);
    setFocusIso(v);
    setSaid(`${C.MONTHS_LONG[+v.slice(5, 7) - 1]} ${v.slice(0, 4)}`);
  };

  const pressPreset = (p: (typeof presetList)[number]) => {
    const [a, b] = p.range();
    emit([a, b], p.id);
    const v = viewFor(a, b, oneMonthShown(modifiers));
    setView(v);
    setFocusIso(firstOf(a) === v ? a : b);
    setSaid(`${p.label}: ${SN.format.range(a, b)}, ${plural(C.days(a, b))}.`);
  };

  const classes = ['sn-popover', 'sn-date-range', ...modifiers.map((m) => `sn-date-range--${m}`), className].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      className={classes}
      role="dialog"
      aria-labelledby={`${uid}-t`}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
      {...props}
    >
      <div className="sn-popover__head">
        <h3 className="sn-popover__title" id={`${uid}-t`} tabIndex={-1}>{title}</h3>
        <button type="button" className="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" aria-label="Close" title="Close" onClick={onClose}><X {...ICON} /></button>
      </div>
      <div className="sn-date-range__body">
        <div className="sn-date-range__months" ref={gridRef}>
          {months.map((first, idx) => {
            const y = +first.slice(0, 4);
            const m = +first.slice(5, 7);
            const mid = `${uid}-m${idx}`;
            return (
              <div className="sn-date-range__month" key={first}>
                <div className="sn-date-range__head">
                  {idx === 0
                    ? <button type="button" className="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" aria-label="Previous month" title="Previous month" onClick={() => step(-1)}><ChevronLeft {...ICON} /></button>
                    : <span className="sn-date-range__spacer" />}
                  <h4 className="sn-date-range__title" id={mid}>{C.MONTHS_LONG[m - 1]} {y}</h4>
                  <button type="button" className={`sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet${idx === 0 ? ' sn-date-range__next' : ''}`} aria-label="Next month" title="Next month" onClick={() => step(1)}><ChevronRight {...ICON} /></button>
                </div>
                {/* APG date-picker grid: the spec's table role="grid" (design-system/components/DateRange). */}
                {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
                <table className="sn-date-range__grid" role="grid" aria-labelledby={mid}>
                  <thead>
                    <tr>{DOW.map((d) => <th key={d} scope="col" abbr={d} className="sn-date-range__dow"><span aria-hidden="true">{d.slice(0, 2)}</span><span className="sn-sr">{d}</span></th>)}</tr>
                  </thead>
                  <tbody>
                    {C.month(y, m).map((week) => (
                      <tr key={week.find(Boolean)?.iso}>
                        {week.map((c, i) => {
                          // The spec's explicit gridcell role: not every assistive stack infers it for td in a role="grid" table.
                          // oxlint-disable-next-line jsx-a11y/no-redundant-roles
                          if (!c) return <td key={`b${i}`} role="gridcell" />;
                          const r = rangeOf(c.iso);
                          const mk = byDay.get(c.iso) ?? [];
                          const code = mk.find((x) => x.code);
                          const dot = mk.find((x) => !x.code);
                          const tip = [...mk.map((x) => x.name), ...(c.iso === today ? ['Today'] : [])].join(' · ');
                          return (
                            // oxlint-disable-next-line jsx-a11y/no-redundant-roles
                            <td key={c.iso} role="gridcell" aria-selected={r ? true : undefined}>
                              <button
                                type="button"
                                className="sn-date-range__day"
                                data-iso={c.iso}
                                tabIndex={c.iso === tabStop ? 0 : -1}
                                data-range={r ?? undefined}
                                data-today={c.iso === today ? '' : undefined}
                                aria-current={c.iso === today ? 'date' : undefined}
                                data-mark={code ? '' : undefined}
                                title={tip || undefined}
                                aria-label={nameOf(c.iso, r)}
                                onClick={() => pick(c.iso)}
                                onKeyDown={(e) => onDayKey(e, c.iso)}
                              >
                                <span className="sn-date-range__n">{c.d}</span>
                                {code ? <span className="sn-date-range__mark" aria-hidden="true">{code.code}</span> : null}
                                {dot ? <span className="sn-date-range__dot" aria-hidden="true" /> : null}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
        {presetList.length ? (
          <div className="sn-date-range__presets" role="group" aria-label="Preset dates">
            {presetList.map((p) => (
              <button key={p.id} type="button" className="sn-chip" aria-pressed={pressed === p.id} data-preset={p.id} onClick={() => pressPreset(p)}>{p.label}</button>
            ))}
          </div>
        ) : null}
      </div>
      {key.length ? (
        <ul className="sn-date-range__key" aria-label="Key">
          {key.map((mk) => (
            <li key={`${mk.code ?? '·'}|${mk.kind}`}>
              {mk.code ? <span className="sn-date-range__code">{mk.code}</span> : <span className="sn-date-range__dot" aria-hidden="true" />} {mk.kind}
            </li>
          ))}
          <li><span className="sn-date-range__now-bar" aria-hidden="true" /> Today</li>
        </ul>
      ) : null}
      <div className="sn-date-range__foot">
        <p className="sn-date-range__sum">
          {from
            ? <><b>{SN.format.range(from, to ?? from)}</b>{to ? ` · ${plural(C.days(from, to))}` : ' · pick the end date'}</>
            : 'No dates picked'}
        </p>
        <button type="button" className="sn-btn sn-btn--quiet" onClick={() => { emit([null, null], null); setSaid('Dates cleared.'); }}>Clear</button>
        <button type="button" className="sn-btn" aria-disabled={!from} onClick={() => { if (from) onApply([from, to ?? from]); }}>{outcome}</button>
      </div>
      <p className="sn-sr" role="status" aria-live="polite">{said}</p>
    </div>
  );
});
DateRange.displayName = 'DateRange';
