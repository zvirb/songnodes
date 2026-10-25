/**
 * Small design-system components the music library pages need that the shell does not provide yet:
 * Toast region, ConfirmDialog, CopyButton, NumberField, Switch, OverflowMenu, Banner, TrackCell.
 * Markup and classes follow design-system/components/<Comp>/README.md and preview.html.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { SN, SnIcon } from '../../../lib/songnodes';
import type { LibraryTrack } from '../data';

/* ------------------------------------------------------------------ Toast */

export interface ToastItem { id: number; text: React.ReactNode; action?: { label: string; run: () => void } }

/** One visible toast, up to 3 queued; 4 s, or 8 s with an action; pauses on hover and focus (Toast). */
export function useToaster() {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const toast = useCallback((text: React.ReactNode, action?: ToastItem['action']) => {
    seq.current += 1;
    const item = { id: seq.current, text, action };
    setQueue((q) => [...q, item].slice(-4));
  }, []);
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);
  const current = queue[0];
  const paused = useRef(false);
  useEffect(() => {
    if (!current) return;
    let left = current.action ? 8000 : 4000;
    const tick = 250;
    const t = window.setInterval(() => {
      if (paused.current) return;
      left -= tick;
      if (left <= 0) { window.clearInterval(t); dismiss(); }
    }, tick);
    return () => window.clearInterval(t);
  }, [current, dismiss]);

  const region = (
    <div
      className="sn-toast__region"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onFocus={() => { paused.current = true; }}
      onBlur={() => { paused.current = false; }}
      onKeyDown={(e) => { if (e.key === 'Escape') dismiss(); }}
    >
      {current ? (
        <div className="sn-toast" key={current.id}>
          <span className="sn-toast__icon"><SnIcon name="circle-check" /></span>
          <span className="sn-toast__text">{current.text}</span>
          {queue.length > 1 ? <span className="sn-toast__queue">+{queue.length - 1} more</span> : null}
          {current.action ? (
            <button className="sn-btn sn-btn--sm sn-toast__action" type="button" onClick={() => { current.action!.run(); dismiss(); }}>{current.action.label}</button>
          ) : null}
          <button className="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-toast__close" type="button" aria-label="Dismiss notification" onClick={dismiss}>
            <SnIcon name="x" />
          </button>
        </div>
      ) : null}
    </div>
  );
  return { toast, region };
}

/** Polite announcements for actions whose result is not otherwise spoken. */
export function useAnnouncer() {
  const [msg, setMsg] = useState('');
  const say = useCallback((m: string) => { setMsg(''); window.setTimeout(() => setMsg(m), 30); }, []);
  const node = <p className="sn-sr" role="status" aria-live="polite">{msg}</p>;
  return { say, node };
}

/* ------------------------------------------------------------------ ConfirmDialog */

interface ConfirmProps {
  open: boolean;
  title: string;
  icon?: string;
  text: React.ReactNode;
  facts?: React.ReactNode[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** APG alertdialog on native <dialog>: Cancel focused first, Esc cancels, focus returns to the opener. */
export const ConfirmDialog: React.FC<ConfirmProps> = ({ open, title, icon = 'trash-2', text, facts, confirmLabel, onConfirm, onCancel }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      try { d.showModal(); } catch { d.setAttribute('open', ''); }
      cancelRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sn-dialog sn-dialog--s sn-confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
    >
      <div className="sn-dialog__head">
        <span className="sn-confirm-dialog__icon"><SnIcon name={icon} /></span>
        <h2 className="sn-title title-s sn-dialog__title" id={`${id}-t`}>{title}</h2>
      </div>
      <div className="sn-dialog__body" id={`${id}-d`}>
        <p className="sn-confirm-dialog__text">{text}</p>
        {facts?.length ? <ul className="sn-confirm-dialog__facts">{facts.map((f, i) => <li key={i}>{f}</li>)}</ul> : null}
      </div>
      <div className="sn-dialog__foot">
        <button ref={cancelRef} className="sn-btn" type="button" onClick={onCancel}>Cancel</button>
        <button className="sn-btn sn-btn--danger" type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
};

/* ------------------------------------------------------------------ CopyButton */

/** Clipboard API, then execCommand, then a selected read-only box with instructions (CopyButton). */
export const CopyButton: React.FC<{ label: string; what: string; getText: () => string; size?: 'sm' }> = ({ label, what, getText, size }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'refused'>('idle');
  const [fallback, setFallback] = useState('');
  const [live, setLive] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state !== 'copied') return;
    const t = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(t);
  }, [state]);
  useEffect(() => { if (state === 'refused') { taRef.current?.focus(); taRef.current?.select(); } }, [state]);

  const legacy = (text: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'sn-sr';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  };
  const copy = async () => {
    const text = getText();
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch { ok = false; }
    if (!ok) ok = legacy(text);
    if (ok) { setState('copied'); setLive(`${what} copied`); } else { setFallback(text); setState('refused'); }
  };
  return (
    <>
      <button className={`sn-btn sn-copy-button${size ? ' sn-btn--sm' : ''}`} type="button" data-state={state === 'copied' ? 'copied' : undefined} onClick={copy}>
        <span className="sn-copy-button__idle"><SnIcon name="copy" /></span>
        <span className="sn-copy-button__done"><SnIcon name="check" /></span>
        <span className="sn-copy-button__text">{state === 'copied' ? 'Copied' : label}</span>
      </button>
      <span className="sn-sr" aria-live="polite">{live}</span>
      {state === 'refused' ? (
        <div className="sn-copy-button__fallback">
          <p>Copy isn’t allowed in this browser. The {what.toLowerCase()} is selected below: press Ctrl + C (⌘ + C on Mac) to copy it.</p>
          <textarea ref={taRef} className="sn-textarea sn-input--data" readOnly value={fallback} rows={6} aria-label={what} />
          <div><button className="sn-btn sn-btn--sm" type="button" onClick={() => { setState('idle'); void copy(); }}>Try copy again</button></div>
        </div>
      ) : null}
    </>
  );
};

/* ------------------------------------------------------------------ NumberField */

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  range?: string;
  error?: string | null;
  onChange: (v: number) => void;
}

/** Text input with inputmode, steppers, APG spinbutton keys; typed values are checked on blur (NumberField). */
export const NumberField: React.FC<NumberFieldProps> = ({ id, label, value, unit, min, max, step = 1, range, error, onChange }) => {
  const [text, setText] = useState(String(value));
  const [typedError, setTypedError] = useState<string | null>(null);
  useEffect(() => { setText(String(value)); }, [value]);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const set = (v: number) => { const c = clamp(v); setTypedError(null); setText(String(c)); onChange(c); };
  const pctUnit = unit === '%';
  const valueText = pctUnit ? `${value}%` : `${value} ${unit}`;
  const commit = () => {
    const v = Number(text.trim().replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(v) || v < min || v > max) {
      setTypedError(`Enter ${label.toLowerCase()} from ${min} to ${max}${pctUnit ? '%' : ` ${unit}`}.`);
      return;
    }
    set(Math.round(v));
  };
  const err = typedError || error;
  return (
    <div className="sn-field sn-number-field">
      <label htmlFor={id} id={`${id}-l`}>{label}</label>
      <div className="sn-number-field__box" data-invalid={err ? '' : undefined}>
        <button className="sn-number-field__step" type="button" tabIndex={-1} aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => set(value - step)}>−</button>
        <input
          className="sn-number-field__input"
          id={id}
          role="spinbutton"
          inputMode="numeric"
          value={text}
          style={{ ['--nf-ch' as string]: Math.max(3, String(max).length) }}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={valueText}
          aria-labelledby={`${id}-l ${id}-u`}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-e` : range ? `${id}-r` : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            const big = e.shiftKey ? 10 : 1;
            if (e.key === 'ArrowUp') { e.preventDefault(); set(value + step * big); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); set(value - step * big); }
            else if (e.key === 'PageUp') { e.preventDefault(); set(value + step * 10); }
            else if (e.key === 'PageDown') { e.preventDefault(); set(value - step * 10); }
            else if (e.key === 'Home') { e.preventDefault(); set(min); }
            else if (e.key === 'End') { e.preventDefault(); set(max); }
            else if (e.key === 'Enter') { e.preventDefault(); commit(); }
          }}
        />
        <span className="sn-number-field__unit" id={`${id}-u`} data-unit={pctUnit ? '%' : undefined}>{unit}</span>
        <button className="sn-number-field__step" type="button" tabIndex={-1} aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => set(value + step)}>+</button>
      </div>
      {range ? <span className="sn-number-field__range" id={`${id}-r`}>{range}</span> : null}
      {err ? <span className="sn-field__error" id={`${id}-e`}>{err}</span> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ Switch */

export const Switch: React.FC<{ label: string; desc?: string; saved?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, desc, saved, checked, onChange }) => {
  const id = useId();
  return (
    <ul className="sn-switch-list">
      <li className="sn-switch">
        <div className="sn-switch__text">
          <span className="sn-switch__label" id={`${id}-l`} onClick={() => onChange(!checked)}>{label}</span>
          {desc ? <span className="sn-switch__desc" id={`${id}-d`}>{desc}</span> : null}
          {saved ? <span className="sn-switch__saved" aria-hidden="true">{saved}</span> : null}
        </div>
        <button type="button" role="switch" className="sn-switch__control" aria-checked={checked} aria-labelledby={`${id}-l`} aria-describedby={desc ? `${id}-d` : undefined} onClick={() => onChange(!checked)}>
          <span className="sn-switch__state" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
          <span className="sn-switch__track" aria-hidden="true"><span className="sn-switch__thumb" /></span>
        </button>
      </li>
    </ul>
  );
};

/* ------------------------------------------------------------------ OverflowMenu */

export interface MenuItem { id: string; icon: string; label: string; danger?: boolean; reason?: string; cls?: string }

/** WAI-ARIA menu button: Enter/Space/↓ open on the first item, ↑ on the last, arrows wrap, Esc returns focus. */
export const OverflowMenu: React.FC<{ label: string; heading?: string; items: MenuItem[]; onSelect: (id: string) => void; quiet?: boolean }> = ({ label, heading, items, onSelect, quiet }) => {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const focusables = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const openAt = (last: boolean) => { setOpen(true); requestAnimationFrame(() => { const f = focusables(); (last ? f[f.length - 1] : f[0])?.focus(); }); };
  const close = (back: boolean) => { setOpen(false); if (back) btn.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);
  const safe = items.filter((i) => !i.danger), danger = items.filter((i) => i.danger);
  const item = (it: MenuItem) => (
    <button
      key={it.id}
      type="button"
      tabIndex={-1}
      role="menuitem"
      className={`sn-overflow-menu__item${it.danger ? ' sn-overflow-menu__item--danger' : ''}${it.cls ? ` ${it.cls}` : ''}`}
      aria-disabled={it.reason ? true : undefined}
      aria-describedby={it.reason ? `${id}-${it.id}-r` : undefined}
      onClick={() => { if (it.reason) return; close(true); onSelect(it.id); }}
    >
      <SnIcon name={it.icon} size={16} />
      <span className="sn-overflow-menu__label">
        <span className="sn-overflow-menu__text">{it.label}</span>
        {it.reason ? <span className="sn-overflow-menu__reason" id={`${id}-${it.id}-r`}>{it.reason}</span> : null}
      </span>
    </button>
  );
  return (
    <div className="sn-overflow-menu">
      <button
        ref={btn}
        className={`sn-btn sn-btn--icon${quiet ? ' sn-btn--quiet' : ''}`}
        type="button"
        id={`${id}-btn`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={label}
        onClick={() => (open ? close(true) : openAt(false))}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); openAt(false); } else if (e.key === 'ArrowUp') { e.preventDefault(); openAt(true); } }}
      >
        <SnIcon name="ellipsis" />
      </button>
      <div
        ref={menu}
        className="sn-overflow-menu__menu"
        role="menu"
        id={`${id}-menu`}
        aria-labelledby={`${id}-btn`}
        hidden={!open}
        onKeyDown={(e) => {
          const f = focusables(), i = f.indexOf(document.activeElement as HTMLElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); f[(i + 1) % f.length]?.focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); f[(i - 1 + f.length) % f.length]?.focus(); }
          else if (e.key === 'Home') { e.preventDefault(); f[0]?.focus(); }
          else if (e.key === 'End') { e.preventDefault(); f[f.length - 1]?.focus(); }
          else if (e.key === 'Escape') { e.preventDefault(); close(true); }
          else if (e.key === 'Tab') setOpen(false);
          else if (e.key.length === 1) {
            const k = e.key.toLowerCase();
            const n = f.slice(i + 1).concat(f.slice(0, i + 1)).find((x) => x.textContent?.trim().toLowerCase().startsWith(k));
            n?.focus();
          }
        }}
      >
        {safe.length ? (
          <div role="group" aria-labelledby={heading ? `${id}-h` : undefined}>
            {heading ? <div className="sn-overflow-menu__heading" id={`${id}-h`} role="presentation">{heading}</div> : null}
            {safe.map(item)}
          </div>
        ) : null}
        {safe.length && danger.length ? <div className="sn-overflow-menu__sep" role="separator" /> : null}
        {danger.map(item)}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ Banner */

export const Banner: React.FC<{ status: 'info' | 'warn' | 'ok'; title: string; children?: React.ReactNode; dismissLabel: string; onDismiss: () => void }> = ({ status, title, children, dismissLabel, onDismiss }) => (
  <div className="sn-banner" data-status={status}>
    <span className="sn-banner__icon"><SnIcon name={status === 'warn' ? 'triangle-alert' : status === 'ok' ? 'circle-check' : 'info'} /></span>
    <div className="sn-banner__body">
      <p className="sn-banner__content"><span className="sn-banner__title">{title}</span> {children}</p>
    </div>
    <button className="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-banner__dismiss" type="button" aria-label={`Dismiss: ${dismissLabel}`} onClick={onDismiss}>
      <SnIcon name="x" />
    </button>
  </div>
);


/* ------------------------------------------------------------------ TrackCell */


const EXT: [keyof LibraryTrack, string][] = [['tidal', 'TIDAL'], ['dz', 'Deezer'], ['bp', 'Beatport']];

/** "Artist – Title" over mix · label · duration, flags and service links (TrackCell). */
export const TrackCell: React.FC<{ t: LibraryTrack; extra?: React.ReactNode; links?: boolean; flag?: boolean }> = ({ t, extra, links = true, flag = true }) => {
  const name = `${t.a} – ${t.t}`;
  const meta: React.ReactNode[] = [];
  if (extra) meta.push(<span key="x">{extra}</span>);
  if (t.m) meta.push(<span className="sn-track-cell__mix" key="m">{t.m}</span>);
  if (t.lbl) meta.push(<span key="l">{t.lbl}</span>);
  if (t.d) meta.push(<span className="sn-track-cell__dur" key="d">{SN.format.duration(t.d)}</span>);
  const ext = links ? EXT.filter(([k]) => t[k]) : [];
  return (
    <div className="sn-track-cell">
      <span className="sn-track-cell__title">
        <span className="sn-track-cell__name" title={name}><span className="sn-track-cell__artist">{t.a} –</span> {t.t}</span>
        {t.mbid && (
          <span className="sn-tag sn-category-tag" style={{ marginLeft: "0.5rem" }} title={`MusicBrainz match: ${t.mbid} (confidence: ${t.mbconf || 'high'})
dump date: ${t.mbdump || 'N/A'}`}>
            MB Match
          </span>
        )}
      </span>
      <span className="sn-track-cell__meta">
        {meta.map((m, i) => (
          <React.Fragment key={i}>{i ? <span className="sn-track-cell__sep" aria-hidden="true">·</span> : null}{m}</React.Fragment>
        ))}
        {flag && t.rev ? <span className="sn-track-cell__flag" title="Energy methods disagree, or only one method was available">Check energy</span> : null}
        {ext.length ? (
          <span className="sn-track-cell__links">
            {ext.map(([k, label]) => (
              <a key={k} className="sn-link sn-link--ext" href={String(t[k])} target="_blank" rel="noopener noreferrer" aria-label={`${name} on ${label}, opens in a new tab`}>{label}</a>
            ))}
          </span>
        ) : null}
      </span>
    </div>
  );
};




/* ------------------------------------------------------------------ CoveragePanel */
export const CoveragePanel: React.FC<{ t: LibraryTrack }> = ({ t }) => {
  const fields = ['a', 't', 'm', 'd', 'bpm', 'k', 'e', 'p', 'rot', 'g', 'lbl'].filter(k => t[k as keyof LibraryTrack] !== null && t[k as keyof LibraryTrack] !== undefined && t[k as keyof LibraryTrack] !== '');
  const filledCount = fields.length;
  const totalCount = 11;
  const sourceCount = t.src ? t.src.length : 0;

  return (
    <div className="sn-coverage-panel sn-panel sn-panel--sm sn-u-mt-sm" style={{ padding: "0.5rem" }}>
      <div className="sn-panel__header"><h4 className="sn-panel__title" style={{ fontSize: "0.875rem" }}>Data Coverage</h4></div>
      <div className="sn-panel__body">
        <ul className="sn-stats-list" style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.75rem", color: "var(--text-2)" }}>
          <li><strong>{filledCount} / {totalCount}</strong> core fields filled</li>
          <li><strong>{sourceCount}</strong> known sources {t.src && t.src.length > 0 ? `(${t.src.join(', ')})` : ''}</li>
          {t.mbid ? <li><strong>MusicBrainz</strong> match via {t.mbconf} confidence</li> : null}
        </ul>
      </div>
    </div>
  );
};
