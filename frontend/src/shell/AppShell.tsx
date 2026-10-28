/**
 * App shell: AppHeader + NavDrawer + page outlet (design-system AppHeader, NavDrawer).
 * Markup and classes follow design-system/components/AppHeader and NavDrawer exactly.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SN, SnIcon, MODULE_ROUTES, moduleOf, type ModuleKey } from '../lib/songnodes';
import { ToastRegion } from '../components/ds';
import { CreditsFooter } from './CreditsFooter';

interface HeaderState {
  lead: string;
  title: string;
  current: ModuleKey | 'home' | 'preferences';
  updatedAt?: Date | string;
}

const HeaderCtx = createContext<(s: HeaderState) => void>(() => {});

/** Pages call this once to set the AppHeader title and the drawer's current row. */
export function usePageHeader(s: HeaderState) {
  const set = useContext(HeaderCtx);
  const key = `${s.lead}|${s.title}|${s.current}|${s.updatedAt ? String(s.updatedAt) : ''}`;
  useEffect(() => {
    set(s);
    document.title = s.current === 'home' ? 'SongNodes' : `${s.title} · ${s.lead} · SongNodes`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, set]);
}

const GROUPS: [string, ModuleKey[]][] = [
  ['Make', ['sets', 'paths']],
  ['Explore', ['graph', 'library', 'harmony']],
  ['Collect', ['sources']],
  ['System', ['pipeline', 'services']],
];

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const NavDrawer: React.FC<{ open: boolean; onClose: () => void; current: HeaderState['current'] }> = ({ open, onClose, current }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'));
    (panel.querySelector<HTMLElement>('[aria-current="page"]') ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    panel.addEventListener('keydown', onKey);
    return () => panel.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const row = (key: ModuleKey) => {
    const m = moduleOf(key);
    return (
      <li key={key}>
        <Link className={`sn-nav-drawer__item sn-m-${key}`} to={MODULE_ROUTES[key]} aria-current={current === key ? 'page' : undefined} onClick={onClose}>
          <SnIcon name={m.icon} size={20} />
          <span className="sn-nav-drawer__label">{m.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="sn-nav-drawer" id="sn-nav" data-open={open ? '' : undefined}>
      <div className="sn-nav-drawer__scrim" onClick={onClose} />
      <div className="sn-nav-drawer__panel" role="dialog" aria-modal="true" aria-label="Site navigation" ref={panelRef}>
        <div className="sn-nav-drawer__head">
          <span className="sn-nav-drawer__wordmark">SongNodes</span>
          <button className="sn-btn sn-btn--quiet sn-btn--icon" type="button" aria-label="Close navigation" onClick={onClose}>
            <SnIcon name="x" />
          </button>
        </div>
        <nav className="sn-nav-drawer__nav" aria-label="Main">
          <ul className="sn-nav-drawer__list">
            <li>
              <Link className="sn-nav-drawer__item" to="/" aria-current={current === 'home' ? 'page' : undefined} onClick={onClose}>
                <SnIcon name="house" size={20} />
                <span className="sn-nav-drawer__label">Home</span>
              </Link>
            </li>
          </ul>
          {GROUPS.map(([heading, keys], gi) => (
            <div className="sn-nav-drawer__group" key={heading}>
              <h2 className="sn-nav-drawer__heading" id={`sn-nav-g${gi}`}>{heading}</h2>
              <ul className="sn-nav-drawer__list" aria-labelledby={`sn-nav-g${gi}`}>{keys.map(row)}</ul>
            </div>
          ))}
        </nav>
        <div className="sn-nav-drawer__foot">
          <Link className="sn-nav-drawer__item" to="/settings#display" onClick={onClose} aria-current={current === 'preferences' ? 'page' : undefined}>
            <SnIcon name="sliders-horizontal" size={20} />
            <span className="sn-nav-drawer__label">Preferences</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

const AppHeader: React.FC<{ state: HeaderState; drawerOpen: boolean; onOpenDrawer: () => void; menuRef: React.RefObject<HTMLButtonElement | null> }> = ({ state, drawerOpen, onOpenDrawer, menuRef }) => {
  const navigate = useNavigate();
  const stamp = state.updatedAt ? new Date(state.updatedAt) : null;
  return (
    <header className="sn-app-header">
      <div className="sn-app-header__bar">
        <div className="sn-app-header__start">
          <button ref={menuRef} className="sn-btn sn-btn--quiet sn-btn--icon" type="button" aria-expanded={drawerOpen} aria-controls="sn-nav" aria-label="Open navigation" onClick={onOpenDrawer}>
            <SnIcon name="menu" />
          </button>
          <span className="sn-app-header__wordmark">SongNodes</span>
        </div>
        <span className="sn-app-header__divider" aria-hidden="true" />
        <p className="sn-app-header__title"><span className="sn-lead">{state.lead}:</span> {state.title}</p>
        <div className="sn-app-header__end">
          {stamp ? (
            <span className="sn-app-header__stamp">
              <SnIcon name="clock" size={14} />
              <span className="sn-app-header__stamp-text">Updated </span>
              <time dateTime={stamp.toISOString()} title={`Updated ${SN.format.stamp(stamp)}`}>{SN.format.relative(stamp)}</time>
            </span>
          ) : null}
          <button className="sn-btn sn-btn--sm sn-app-header__search" type="button" aria-keyshortcuts="Control+K Meta+K /" onClick={() => navigate('/library?focus=search')}>
            <SnIcon name="search" size={16} />
            <span className="sn-app-header__search-label">Search</span>
            <kbd aria-hidden="true">{isApple ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
        </div>
      </div>
    </header>
  );
};

/** Shell used by every page except the OAuth return page. */
export const AppShell: React.FC = () => {
  const [state, setState] = useState<HeaderState>({ lead: 'SongNodes', title: 'Home', current: 'home' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const set = useCallback((s: HeaderState) => setState(s), []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Ctrl/⌘ K and / (outside text fields) jump to search (AppHeader contract).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable;
      if (((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        navigate('/library?focus=search');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);

  const ctx = useMemo(() => set, [set]);

  return (
    <HeaderCtx.Provider value={ctx}>
      <a className="sn-skip" href="#main">Skip to content</a>
      <div className="sn-shell" inert={drawerOpen ? true : undefined}>
        <AppHeader state={state} drawerOpen={drawerOpen} onOpenDrawer={() => setDrawerOpen(true)} menuRef={menuRef} />
        <Outlet />
        <CreditsFooter />
      </div>
      <NavDrawer open={drawerOpen} onClose={closeDrawer} current={state.current} />
      {/* One toast region for the whole app, mounted at start (design-system Toast). */}
      <ToastRegion />
    </HeaderCtx.Provider>
  );
};
