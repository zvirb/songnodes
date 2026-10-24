/**
 * Sources (target tracks), and module pages whose full design-system page is
 * still planned (Pathfinder, Key & mood, Pipeline), plus the not-found page.
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

const PLANNED: Record<'paths' | 'harmony' | 'pipeline', { title: string; desc: string; empty: string; body: string; link?: [string, string] }> = {
  paths: {
    title: 'Route finder',
    desc: 'Routes from a start track to a finish track through proven transitions.',
    empty: 'Pathfinder lives in the graph for now',
    body: 'Open the graph, switch to Plan and use the Pathfinder tab. This page becomes the full route finder in migration phase 4.',
    link: ['/graph?tab=pathfinder', 'Open Pathfinder in Graph'],
  },
  harmony: {
    title: 'Camelot wheel',
    desc: 'Keys, mood and energy across the library.',
    empty: 'Key & mood lives in the graph for now',
    body: 'Open the graph, switch to Plan and use the Key & mood tab. This page becomes the Camelot wheel and key coverage matrix in migration phase 4.',
    link: ['/graph?tab=keymood', 'Open Key & mood in Graph'],
  },
  pipeline: {
    title: 'Health',
    desc: 'Scrapers, jobs, validation and data quality.',
    empty: 'Pipeline health is planned',
    body: 'Scraper and service metrics are in Grafana until the Monitoring page is built.',
  },
};

export const PlannedModulePage: React.FC<{ mod: 'paths' | 'harmony' | 'pipeline' }> = ({ mod }) => {
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
    <main className="sn-page__main sn-page-retired" id="main" tabIndex={-1}>
      <section className="sn-card sn-page-retired__card" aria-labelledby="nf-t">
        <span className="sn-page-retired__icon"><SnIcon name="route" size={24} /></span>
        <h1 className="sn-title title-l" id="nf-t">There is no page here</h1>
        <p className="body-l sn-muted">Nothing lives at this address. It may have moved when SongNodes adopted the design system.</p>
        <dl className="sn-page-retired__facts">
          <dt>Address</dt><dd className="sn-mono">{pathname}</dd>
        </dl>
        <p className="sn-page-retired__dest"><Link className="sn-link" to="/">Go to Home</Link></p>
      </section>
    </main>
  );
};
