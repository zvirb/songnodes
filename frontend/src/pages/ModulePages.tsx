/**
 * Sources (target tracks), the planned Pathfinder page, and the not-found page.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePageHeader } from '../shell/AppShell';
import { PageHeader, EmptyState } from '../shell/PageParts';
import { SnIcon, moduleOf, type ModuleKey } from '../lib/songnodes';

const TargetTracksManager = React.lazy(() => import('../components/TargetTracksManager'));

export const SourcesPage: React.FC = () => {
  usePageHeader({ lead: 'Sources', title: 'Target tracks', current: 'sources' });
  return (
    <main className="sn-page__main" id="main" tabIndex={-1}>
      <PageHeader mod="sources" here="Target tracks" lead="Sources" title="Target tracks" desc="Tracks SongNodes is hunting for in tracklists, with their priority and search state." />
      <React.Suspense fallback={<div className="sn-card" aria-busy="true"><span className="sn-spinner" aria-hidden="true" /> Loading target tracks…</div>}>
        <TargetTracksManager />
      </React.Suspense>
    </main>
  );
};

const PLANNED: Record<'paths', { title: string; desc: string; empty: string; body: string; link?: [string, string] }> = {
  paths: {
    title: 'Route finder',
    desc: 'Routes from a start track to a finish track through proven transitions.',
    empty: 'Pathfinder lives in the graph for now',
    body: 'Open the graph, switch to Plan and use the Pathfinder tab. This page becomes the full route finder in migration phase 4.',
    link: ['/graph?tab=pathfinder', 'Open Pathfinder in Graph'],
  },
};

export const PlannedModulePage: React.FC<{ mod: 'paths' }> = ({ mod }) => {
  const m = moduleOf(mod as ModuleKey);
  const p = PLANNED[mod];
  usePageHeader({ lead: m.label, title: p.title, current: mod });
  return (
    <main className="sn-page__main" id="main" tabIndex={-1}>
      <PageHeader mod={mod} lead={m.label} title={p.title} desc={p.desc} />
      <EmptyState icon={m.icon} title={p.empty} actions={p.link ? <Link className={`sn-link sn-m-graph`} to={p.link[0]}>{p.link[1]}</Link> : undefined}>
        {p.body}
      </EmptyState>
    </main>
  );
};

/** Unknown route: plain explanation and a way home (design-system ErrorPage / RetiredPageNotice tone). */
export const NotFoundPage: React.FC = () => {
  const { pathname } = useLocation();
  usePageHeader({ lead: 'SongNodes', title: 'Page not found', current: 'home' });
  return (
    <main className="sn-page-error" id="main" tabIndex={-1}>
      <span className="sn-page-error__wordmark">SongNodes</span>
      <p className="sn-page-error__code">404 · Not found</p>
      <h1 className="sn-page-error__title">Page not found</h1>
      <p className="sn-page-error__text">There is nothing at this address. It may have been typed wrong, or the page was retired.</p>
      <ul className="sn-page-error__next">
        <li>Check the address, or <Link to="/">go to Home</Link>.</li>
        <li>Looking for a track or set? Search from Home with Ctrl K.</li>
      </ul>
      <p className="sn-page-error__text data sn-muted" style={{ marginTop: 'var(--space-4)' }}>Address: {pathname}</p>
    </main>
  );
};
