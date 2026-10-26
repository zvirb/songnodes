/**
 * EnergyWave inside a ChartFrame (design-system EnergyWave): one bar per slot in --energy-N,
 * the target wave dashed, the Building band shaded, problem transitions flagged above the bar,
 * one tab stop with arrow-key navigation, a tooltip, and "View as table".
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SN, EnergyBar, CompatPill } from '../../../lib/songnodes';
import type { CompatLevel } from '../../../lib/songnodes';

export interface WaveSlot {
  /** Energy of the track in the slot, null for an empty slot. */
  e: number | null;
  tgt: number;
  name: string | null;
  /** Energy verdict of the move into this slot. */
  step: { level: CompatLevel; label: string } | null;
}

/** Verdict glyphs from the bundle (SongNodes.GLYPH is not in the typed helper surface yet). */
const GLYPH = (SN as unknown as { GLYPH: Record<string, string> }).GLYPH;

export const EnergyWave: React.FC<{ title: React.ReactNode; titleId: string; sub: string; slots: WaveSlot[]; desc: string; empty?: React.ReactNode }> = ({ title, titleId, sub, slots, desc, empty }) => {
  const host = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [rem, setRem] = useState(16);
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const [live, setLive] = useState('');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      setW(Math.max(280, Math.round(el.clientWidth || 800)));
      setRem(parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [table, slots.length > 0]);

  const n = slots.length;
  const geo = useMemo(() => {
    const H = Math.round(rem * 13), ml = rem * 2, mr = rem * 4.6, mt = rem * 1.6, mb = rem * 1.9;
    const y = (v: number) => H - mb + ((mt - (H - mb)) * v) / 10;
    const step = (w - mr - ml) / Math.max(n, 1), bw = Math.max(4, Math.min(step * 0.78, 28));
    const x = (i: number) => ml + i * step + (step - bw) / 2, mid = (i: number) => ml + i * step + step / 2;
    return { H, ml, mr, mt, mb, y, step, bw, x, mid };
  }, [w, rem, n]);

  const problems = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.step && (s.step.level === 'clash' || s.step.level === 'possible'));
  const active = focus ?? hover;
  const describe = (i: number) => {
    const s = slots[i];
    return `Slot ${i + 1}${s.name ? ` · ${s.name}` : ', empty'}. ${s.e != null ? `Energy ${s.e}, ` : ''}target ${s.tgt}.${s.step ? ` ${s.step.label}.` : ''}`;
  };
  const move = (i: number) => { const c = Math.max(0, Math.min(n - 1, i)); setFocus(c); setLive(describe(c)); };

  if (!n) {
    return (
      <figure className="sn-chart-frame sn-energy-wave" aria-labelledby={titleId}>
        <div className="sn-chart-frame__head"><div className="sn-chart-frame__titles">{title}<p className="sn-chart-frame__sub">{sub}</p></div></div>
        <div className="sn-chart-frame__state">{empty}</div>
      </figure>
    );
  }

  const { H, ml, mr, mb, y, x, mid, bw } = geo;
  const labelEvery = n > 24 && w < 600 ? 2 : n > 48 ? 2 : 1;
  const tipLeft = active != null ? Math.min(Math.max(mid(active) - 74, 0), w - 200) : 0;
  const tipTop = active != null ? Math.max(0, y(Math.max(slots[active].e ?? 0, slots[active].tgt)) - rem * 5.4) : 0;

  return (
    <figure className="sn-chart-frame sn-energy-wave" aria-labelledby={titleId}>
      <div className="sn-chart-frame__head">
        <div className="sn-chart-frame__titles">{title}<p className="sn-chart-frame__sub">{sub}</p></div>
        <div className="sn-chart-frame__actions">
          <button className="sn-btn sn-btn--sm sn-btn--quiet" type="button" aria-pressed={table} onClick={() => setTable((v) => !v)}>{table ? 'View as chart' : 'View as table'}</button>
        </div>
      </div>
      <ul className="sn-chart-frame__legend" aria-label="Legend">
        <li>
          <svg className="sn-chart-frame__keysvg" width="30" height="12" aria-hidden="true">
            <rect x="0" y="4" width="8" height="8" rx="1" fill="var(--energy-3)" />
            <rect x="10" y="2" width="8" height="10" rx="1" fill="var(--energy-6)" />
            <rect x="20" y="0" width="8" height="12" rx="1" fill="var(--energy-9)" />
          </svg>
          Energy per slot
        </li>
        <li><span className="sn-chart-frame__key sn-chart-frame__key--ref" />Target wave</li>
        <li><span className="sn-energy-wave__band-key" />Building 5–7</li>
        <li><span className="sn-energy-wave__glyph sn-energy-wave__glyph--clash" aria-hidden="true">✕</span>Too steep</li>
        <li><span className="sn-energy-wave__glyph sn-energy-wave__glyph--possible" aria-hidden="true">○</span>Drop 2–3 at once instead</li>
      </ul>
      <div className="sn-chart-frame__plot" ref={host} hidden={table} onMouseLeave={() => setHover(null)}>
        <svg
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          tabIndex={0}
          role="group"
          aria-roledescription="energy wave chart"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-desc`}
          onFocus={() => { if (focus == null) move(0); }}
          onBlur={() => setFocus(null)}
          onKeyDown={(e) => {
            const cur = focus ?? 0;
            if (e.key === 'ArrowRight') { e.preventDefault(); move(cur + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); move(cur - 1); }
            else if (e.key === 'Home') { e.preventDefault(); move(0); }
            else if (e.key === 'End') { e.preventDefault(); move(n - 1); }
            else if (e.key === 'Escape') { setFocus(null); }
          }}
        >
          <desc id={`${titleId}-desc`}>{desc}</desc>
          <rect x={ml} y={y(7.5)} width={w - mr - ml} height={y(4.5) - y(7.5)} className="sn-energy-wave__band" />
          {([['High', 9], ['Building', 6], ['Low', 2.5]] as const).map(([t, v]) => (
            <text key={t} x={w - mr + 8} y={y(v) + 4} className="sn-energy-wave__band-label">{t}</text>
          ))}
          {[0, 2, 4, 6, 8, 10].map((v) => (
            <text key={v} x={ml - 8} y={y(v) + 4} className="sn-chart-frame__tick" textAnchor="end">{v}</text>
          ))}
          <line x1={ml} x2={w - mr} y1={Math.round(y(0)) + 0.5} y2={Math.round(y(0)) + 0.5} className="sn-chart-frame__base" />
          {slots.map((s, i) => {
            const X = x(i), r = Math.min(4, bw / 2);
            const top = s.e != null ? y(s.e) : y(0), hgt = y(0) - top;
            const flag = s.step && (s.step.level === 'clash' || s.step.level === 'possible') ? s.step.level : null;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={mid(i) - geo.step / 2} y={0} width={geo.step} height={H - mb} fill="transparent" />
                {s.e != null ? (
                  <path
                    d={`M${X},${top + hgt}V${top + r}Q${X},${top} ${X + r},${top}H${X + bw - r}Q${X + bw},${top} ${X + bw},${top + r}V${top + hgt}Z`}
                    className="sn-energy-wave__bar"
                    style={{ ['--c' as string]: `var(--energy-${Math.round(s.e)})` }}
                    stroke={active === i ? 'var(--fg)' : undefined}
                    strokeWidth={active === i ? 1.5 : undefined}
                  />
                ) : null}
                {i % labelEvery === 0 || i === n - 1 ? (
                  <text x={mid(i)} y={H - mb + rem * 1.1} className="sn-energy-wave__slot">{i + 1}</text>
                ) : null}
                {flag ? (
                  <text x={mid(i)} y={top - 6} className={`sn-energy-wave__flag sn-energy-wave__flag--${flag}`}>{GLYPH[flag]}</text>
                ) : null}
              </g>
            );
          })}
          <polyline points={slots.map((s, i) => `${mid(i)},${y(s.tgt)}`).join(' ')} className="sn-energy-wave__target" />
          <text x={ml - 8} y={H - mb + rem * 1.1} className="sn-chart-frame__axis-title" textAnchor="end">Slot</text>
        </svg>
        {active != null ? (
          <div className="sn-chart-frame__tip" style={{ left: tipLeft, top: tipTop }}>
            <span className="sn-chart-frame__tip-title">Slot {active + 1}{slots[active].name ? ` · ${slots[active].name}` : ''}</span>
            {slots[active].e != null ? (
              <span className="sn-chart-frame__tip-row"><span className="sn-chart-frame__tip-key sn-chart-frame__tip-key--rect" style={{ ['--c' as string]: `var(--energy-${slots[active].e})` }} /><b className="sn-mono">{slots[active].e}</b><span>Energy</span></span>
            ) : null}
            <span className="sn-chart-frame__tip-row"><span className="sn-chart-frame__tip-key sn-chart-frame__tip-key--dash" style={{ ['--c' as string]: 'var(--chart-ref)' }} /><b className="sn-mono">{slots[active].tgt}</b><span>Target</span></span>
            {slots[active].step ? <span>{slots[active].step!.label}</span> : null}
          </div>
        ) : null}
      </div>
      {table ? (
        <div className="sn-chart-frame__table">
          <div className="sn-tablebox">
            <table className="sn-table">
              <caption>Energy and target per slot</caption>
              <thead><tr><th scope="col" className="num">Slot</th><th scope="col">Track</th><th scope="col">Energy</th><th scope="col" className="num">Target</th><th scope="col">Move in</th></tr></thead>
              <tbody>
                {slots.map((s, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <th scope="row">{s.name ?? <span className="sn-none">–</span>}</th>
                    <td><EnergyBar value={s.e} /></td>
                    <td className="num">{s.tgt}</td>
                    <td>{s.step ? <CompatPill level={s.step.level} label={s.step.label} /> : <span className="sn-none">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="sn-energy-wave__summary">
        {problems.length ? (
          <>
            {problems.slice(0, 4).map(({ s, i }) => <CompatPill key={i} level={s.step!.level} label={`Slot ${i + 1}: ${s.step!.label.split(':')[0]}`} />)}
            <span className="sn-tag">{problems.length} {problems.length === 1 ? 'transition' : 'transitions'} to fix</span>
          </>
        ) : (
          <CompatPill level="perfect" label="No wave problems" />
        )}
      </div>
      <p className="sn-sr" aria-live="polite">{live}</p>
    </figure>
  );
};
