/**
 * Small React wrappers for SongNodes design-system components used by the
 * graph route (DJInterface and its panels). Markup follows
 * design-system/components/<Comp>/README.md exactly; styling comes from the
 * global bundle.css (`sn-*` classes). No colours or sizes are set here.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, CircleCheck, X, Trash2, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EnergyBar, SN } from '../../lib/songnodes';
import { displayEnergy } from '../../utils/trackMetadata';

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

/* ------------------------------------------------------------------ */
/* SegmentedControl (WAI-ARIA radio group)                             */
/* ------------------------------------------------------------------ */

export interface SegOption<V extends string> {
  value: V;
  label: string;
  icon?: LucideIcon;
}

export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  block,
}: {
  label: string;
  options: SegOption<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
  block?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(options[next].value);
      refs.current[next]?.focus();
    }
  };
  const cls = ['sn-seg', 'sn-segmented-control', size === 'sm' && 'sn-segmented-control--sm', block && 'sn-segmented-control--block']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const checked = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {Icon ? <Icon {...ICON} size={14} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs (WAI-ARIA tabs, automatic activation)                          */
/* ------------------------------------------------------------------ */

export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idBase,
}: {
  label: string;
  tabs: { id: T; label: string; count?: number; countLabel?: string }[];
  value: T;
  onChange: (id: T) => void;
  idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Keep the selected tab in view (deep links such as ?tab=targets)
  useEffect(() => {
    const i = tabs.findIndex((t) => t.id === value);
    const el = refs.current[i];
    const strip = el?.parentElement;
    if (el && strip) strip.scrollLeft = Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2);
  }, [value, tabs]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[next]?.focus();
      refs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };
  return (
    <div className="sn-tabs__wrap">
      <div className="sn-tabs" role="tablist" aria-label={label}>
        {tabs.map((t, i) => {
          const sel = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el; }}
              className="sn-tab"
              role="tab"
              type="button"
              id={`${idBase}-tab-${t.id}`}
              aria-controls={`${idBase}-panel-${t.id}`}
              aria-selected={sel}
              tabIndex={sel ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
              {t.count ? (
                <>
                  <span className="sn-tab__badge">{t.count}</span>
                  {t.countLabel ? <span className="sn-sr"> {t.countLabel}</span> : null}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const TabPanel: React.FC<{ idBase: string; id: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ idBase, id, children, className, style }) => (
  <div
    className={['sn-tabs__panel', className].filter(Boolean).join(' ')}
    role="tabpanel"
    id={`${idBase}-panel-${id}`}
    aria-labelledby={`${idBase}-tab-${id}`}
    tabIndex={0}
    style={style}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* OverflowMenu (WAI-ARIA menu button)                                 */
/* ------------------------------------------------------------------ */

export interface OverflowItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  group?: string;
  destructive?: boolean;
  disabledReason?: string;
}

export const OverflowMenu: React.FC<{
  label?: string;
  items: OverflowItem[];
  onSelect: (id: string) => void;
  quiet?: boolean;
  small?: boolean;
}> = ({ label = 'More actions', items, onSelect, quiet, small }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');

  const itemEls = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  const focusAt = (i: number) => {
    const els = itemEls();
    if (!els.length) return;
    els[(i + els.length) % els.length].focus();
  };

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open, close]);

  const openAt = (where: 'first' | 'last') => {
    setOpen(true);
    requestAnimationFrame(() => focusAt(where === 'first' ? 0 : -1));
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = itemEls();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { close(false); }
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const start = i + 1;
      for (let n = 0; n < els.length; n++) {
        const el = els[(start + n) % els.length];
        if ((el.textContent || '').trim().toLowerCase().startsWith(k)) { el.focus(); break; }
      }
    }
  };

  const normal = items.filter((it) => !it.destructive);
  const danger = items.filter((it) => it.destructive);
  const groups: { name?: string; items: OverflowItem[] }[] = [];
  normal.forEach((it) => {
    const g = groups.find((x) => x.name === it.group);
    if (g) g.items.push(it);
    else groups.push({ name: it.group, items: [it] });
  });

  const renderItem = (it: OverflowItem) => {
    const Icon = it.icon;
    const reasonId = it.disabledReason ? `${uid}-r-${it.id}` : undefined;
    return (
      <button
        key={it.id}
        type="button"
        className={`sn-overflow-menu__item${it.destructive ? ' sn-overflow-menu__item--danger' : ''}`}
        role="menuitem"
        tabIndex={-1}
        aria-disabled={it.disabledReason ? true : undefined}
        aria-describedby={reasonId}
        onClick={() => {
          if (it.disabledReason) return;
          close();
          onSelect(it.id);
        }}
      >
        {Icon ? <Icon {...ICON} /> : null}
        <span className="sn-overflow-menu__label">
          <span className="sn-overflow-menu__text">{it.label}</span>
          {it.disabledReason ? <span className="sn-overflow-menu__reason" id={reasonId}>{it.disabledReason}</span> : null}
        </span>
      </button>
    );
  };

  return (
    <div className="sn-overflow-menu">
      <button
        ref={btnRef}
        type="button"
        className={['sn-btn', 'sn-btn--icon', quiet && 'sn-btn--quiet', small && 'sn-btn--sm'].filter(Boolean).join(' ')}
        id={`${uid}-btn`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${uid}-menu`}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : openAt('first'))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); openAt('first'); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); openAt('last'); }
        }}
      >
        <MoreHorizontal {...ICON} />
      </button>
      <div
        ref={menuRef}
        className="sn-overflow-menu__menu"
        role="menu"
        id={`${uid}-menu`}
        aria-labelledby={`${uid}-btn`}
        hidden={!open}
        onKeyDown={onMenuKey}
      >
        {groups.map((g, gi) =>
          g.name ? (
            <div role="group" key={g.name} aria-labelledby={`${uid}-h${gi}`}>
              <div className="sn-overflow-menu__heading" id={`${uid}-h${gi}`} role="presentation">{g.name}</div>
              {g.items.map(renderItem)}
            </div>
          ) : (
            <React.Fragment key={`g${gi}`}>{g.items.map(renderItem)}</React.Fragment>
          ),
        )}
        {danger.length ? (
          <>
            <div className="sn-overflow-menu__sep" role="separator" />
            {danger.map(renderItem)}
          </>
        ) : null}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* ConfirmDialog (APG alertdialog)                                     */
/* ------------------------------------------------------------------ */

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  /** Consequence, who it affects, what is kept, whether it can be undone. */
  children: React.ReactNode;
  facts?: React.ReactNode[];
  confirmLabel: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Typed variant: the exact text (case-sensitive) to type before the danger button enables. */
  typedValue?: string;
}> = ({ open, title, children, facts, confirmLabel, busy, busyLabel, onConfirm, onCancel, typedValue }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const typedRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const opener = useRef<Element | null>(null);
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      setTyped('');
      if (typedValue) typedRef.current?.focus(); else cancelRef.current?.focus();
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
      aria-labelledby={`${uid}-t`}
      aria-describedby={`${uid}-d`}
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
    >
      <div className="sn-dialog__head">
        <span className="sn-confirm-dialog__icon" aria-hidden="true"><Trash2 {...ICON} size={20} /></span>
        <h2 className="sn-title title-s sn-dialog__title" id={`${uid}-t`}>{title}</h2>
      </div>
      <div className="sn-dialog__body" id={`${uid}-d`}>
        <p className="sn-confirm-dialog__text">{children}</p>
        {facts && facts.length ? (
          <ul className="sn-confirm-dialog__facts">{facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        ) : null}
        {typedValue ? (
          <div className="sn-field sn-confirm-dialog__typed">
            <label htmlFor={`${uid}-typed`}>Type <code>{typedValue}</code> to confirm</label>
            <input id={`${uid}-typed`} ref={typedRef} className="sn-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        ) : null}
      </div>
      <div className="sn-dialog__foot">
        <button ref={cancelRef} type="button" className="sn-btn" autoFocus={!typedValue} onClick={onCancel}>Cancel</button>
        <button type="button" className="sn-btn sn-btn--danger" aria-busy={busy || undefined} disabled={busy || (!!typedValue && typed !== typedValue)} onClick={onConfirm}>
          {busy ? <span className="sn-spinner" aria-hidden="true" /> : null}
          {busy && busyLabel ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
};

/* ------------------------------------------------------------------ */
/* Toast: one region, one visible, queue of 3, 4 s (8 s with action)   */
/* ------------------------------------------------------------------ */

interface ToastMsg { id: number; text: React.ReactNode; action?: { label: string; onClick: () => void } }
const TOAST_EVENT = 'sn-toast';
let toastSeq = 0;

/** Show a short past-tense confirmation ("Queue cleared: 42 tasks"). Never for errors that need action. */
export function showToast(text: React.ReactNode, action?: ToastMsg['action']) {
  window.dispatchEvent(new CustomEvent<ToastMsg>(TOAST_EVENT, { detail: { id: ++toastSeq, text, action } }));
}

export const ToastRegion: React.FC = () => {
  const [queue, setQueue] = useState<ToastMsg[]>([]);
  const paused = useRef(false);
  const current = queue[0];

  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent<ToastMsg>).detail;
      setQueue((q) => {
        const [head, ...rest] = q;
        const waiting = [...rest, msg].slice(-3);
        return head ? [head, ...waiting] : waiting;
      });
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!current) return;
    let left = current.action ? 8000 : 4000;
    const tick = 250;
    const t = window.setInterval(() => {
      if (paused.current) return;
      left -= tick;
      if (left <= 0) setQueue((q) => q.slice(1));
    }, tick);
    return () => window.clearInterval(t);
  }, [current]);

  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <div className="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications">
      {current ? (
        <div
          className="sn-toast"
          key={current.id}
          onMouseEnter={() => { paused.current = true; }}
          onMouseLeave={() => { paused.current = false; }}
          onFocus={() => { paused.current = true; }}
          onBlur={() => { paused.current = false; }}
          onKeyDown={(e) => { if (e.key === 'Escape') dismiss(); }}
        >
          <span className="sn-toast__icon" aria-hidden="true"><CircleCheck {...ICON} /></span>
          <span className="sn-toast__text">{current.text}</span>
          {queue.length > 1 ? <span className="sn-toast__queue">+{queue.length - 1} more</span> : null}
          {current.action ? (
            <button type="button" className="sn-btn sn-btn--sm sn-toast__action" onClick={() => { current.action!.onClick(); dismiss(); }}>
              {current.action.label}
            </button>
          ) : null}
          <button type="button" className="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-toast__close" aria-label="Dismiss notification" onClick={dismiss}>
            <X {...ICON} />
          </button>
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Empty / error / loading panels                                       */
/* ------------------------------------------------------------------ */

export const EmptyPanel: React.FC<{ icon: LucideIcon; title: string; children?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode; compact?: boolean }> = ({ icon: Icon, title, children, actions, meta, compact }) => (
  <div className={`sn-empty-state${compact ? ' sn-empty-state--compact' : ''}`}>
    <div className="sn-empty-state__icon" aria-hidden="true"><Icon size={24} strokeWidth={2} /></div>
    <h3 className="sn-empty-state__title">{title}</h3>
    {children ? <p className="sn-empty-state__text">{children}</p> : null}
    {meta ? <div className="sn-empty-state__meta">{meta}</div> : null}
    {actions ? <div className="sn-empty-state__actions">{actions}</div> : null}
  </div>
);

export const ErrorPanel: React.FC<{
  icon?: LucideIcon;
  status?: 'warn' | 'bad' | 'info';
  title: string;
  children?: React.ReactNode;
  retry?: React.ReactNode;
  helps?: boolean;
  actions?: React.ReactNode;
  panel?: boolean;
}> = ({ icon: Icon = AlertTriangle, status = 'bad', title, children, retry, helps = true, actions, panel }) => {
  const uid = useId().replace(/:/g, '');
  return (
    <section className={`sn-error-state${panel ? ' sn-error-state--panel' : ''}`} data-status={status} aria-labelledby={`${uid}-e`}>
      <div className="sn-error-state__icon" aria-hidden="true"><Icon size={20} strokeWidth={2} /></div>
      <h3 className="sn-error-state__title" id={`${uid}-e`}>{title}</h3>
      {children ? <div className="sn-error-state__text">{children}</div> : null}
      {retry ? <p className="sn-error-state__retry" data-helps={helps ? undefined : 'no'}>{retry}</p> : null}
      {actions ? <div className="sn-error-state__actions">{actions}</div> : null}
    </section>
  );
};

/** Skeleton rows plus a status line; the message shows after 1 s (data-slow). */
export const LoadingPanel: React.FC<{ message: string; rows?: number }> = ({ message, rows = 6 }) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 1000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="sn-loading-state" aria-busy="true" data-slow={slow ? '' : undefined}>
      <div className="sn-loading-state__lines" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <span key={i} className="sn-skel" style={{ ['--w' as string]: `${60 + ((i * 17) % 35)}%`, ['--h' as string]: '12px' } as React.CSSProperties} />
        ))}
      </div>
      <p className="sn-loading-state__msg" role="status">{message}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* CompatibilityBadge                                                   */
/* ------------------------------------------------------------------ */

export type CompatLevelDS = 'perfect' | 'compatible' | 'possible' | 'clash' | 'unknown';

/** Glyph (● ◐ ○ ✕ ?) comes from CSS; the words carry the verdict. */
export const CompatibilityBadge: React.FC<{ level: CompatLevelDS; label?: string; outline?: boolean }> = ({ level, label, outline }) => (
  <span className={`sn-pill${outline ? ' sn-pill--outline' : ''} sn-compatibility-badge`} data-compat={level}>
    {label ?? (level === 'unknown' ? 'not known' : level)}
  </span>
);

/* ------------------------------------------------------------------ */
/* Energy: the 1–10 EnergyBar from a stored value and its scale         */
/* ------------------------------------------------------------------ */

export const TrackEnergy: React.FC<{ energy?: number | null; scale?: string | null }> = ({ energy, scale }) => {
  const e = displayEnergy(energy, scale);
  if (e.value == null) return <EnergyBar value={null} />;
  if (!e.converted) return <EnergyBar value={e.value} />;
  return (
    <span title={`Converted from ${e.raw} (old 0–1 scale)${e.needsCheck ? '. Needs an energy check' : ''}`} style={{ textDecoration: 'underline dotted', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
      <EnergyBar value={e.value} />
      {e.needsCheck ? <span className="sn-energy-bar__flag">Check</span> : null}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Key compatibility via SN.compat                                      */
/* ------------------------------------------------------------------ */

/** Verdict for a key move: SN.compat on the two Camelot codes; unknown when either is missing. */
export const KeyCompat: React.FC<{ from?: string | null; to?: string | null; outline?: boolean }> = ({ from, to, outline }) => {
  const a = from ? SN.camelot(from) : null;
  const b = to ? SN.camelot(to) : null;
  if (!a || !b) return <CompatibilityBadge level="unknown" label="key ?" outline={outline} />;
  const c = SN.compat(a, b) as unknown as { level: CompatLevelDS; label: string };
  return <CompatibilityBadge level={c.level} label={c.label} outline={outline} />;
};

/* ------------------------------------------------------------------ */
/* Dialog (modal form): native <dialog>, Esc closes, focus returns      */
/* ------------------------------------------------------------------ */

export const Dialog: React.FC<{
  open: boolean;
  title: string;
  sub?: string;
  size?: 's' | 'm' | 'l';
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wrap body and footer in a form; submit calls this. */
  onSubmit?: (e: React.FormEvent) => void;
}> = ({ open, title, sub, size = 'm', onClose, children, footer, onSubmit }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  const inner = (
    <>
      <div className="sn-dialog__body">{children}</div>
      {footer ? <div className="sn-dialog__foot">{footer}</div> : null}
    </>
  );

  return (
    <dialog
      ref={ref}
      className={`sn-dialog sn-dialog--${size}`}
      aria-labelledby={`${uid}-t`}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="sn-dialog__head">
        <div className="sn-dialog__title">
          <h2 className="sn-title title-m" id={`${uid}-t`}>{title}</h2>
          {sub ? <p className="sn-dialog__sub">{sub}</p> : null}
        </div>
        <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet" aria-label="Close" title="Close" onClick={onClose}>
          <X {...ICON} />
        </button>
      </div>
      {open ? (onSubmit ? <form onSubmit={onSubmit} style={{ display: 'contents' }}>{inner}</form> : inner) : null}
    </dialog>
  );
};
