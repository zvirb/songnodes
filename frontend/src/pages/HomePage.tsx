/** Home launcher at / (design-system HomePage): one tonal LauncherCard per module, in drawer order. */
import React, { useEffect, useState } from 'react';
import { usePageHeader } from '../shell/AppShell';
import { PageHeader, LauncherCard, SectionHeading } from '../shell/PageParts';
import { SN } from '../lib/songnodes';
import { loadLibrary, readSavedSets, type LibraryFile, type SavedSet } from '../features/musicLibrary/data';
import { HOUSEKEEPING_KINDS } from '../features/pipeline/usePipelineTelemetry';
import { targetSearchStatus, isPendingSearch, type TargetSearchFields } from '../components/targetSearchStatus';
import { getAIKeyConfig } from '../services/apiKeyService';
import { useStore } from '../store/useStore';
import type { APIKey, APIKeyRequirement } from '../types';
import type { JobResponse } from '../utils/dataLoaderUtils';

interface GraphStatsPayload {
  nodes: number | null;
  edges: number | null;
  occurrences: number | null;
  playlists: number | null;
}

interface TargetTrackSummary extends TargetSearchFields {
  track_id?: string;
  is_active?: boolean;
  archived?: boolean;
}

const HIDDEN_SERVICES = new Set(['beatport']);

const isTokenValid = (cred?: { accessToken?: string; isConnected?: boolean; expiresAt?: number }) =>
  Boolean(cred?.accessToken) && cred?.isConnected === true && cred?.expiresAt != null && Date.now() < cred.expiresAt - 5 * 60 * 1000;

const isTokenExpired = (cred?: { accessToken?: string; isConnected?: boolean; expiresAt?: number }) =>
  Boolean(cred?.accessToken) && cred?.isConnected === true && (cred?.expiresAt == null || Date.now() >= cred.expiresAt - 5 * 60 * 1000);

const HomePage: React.FC = () => {
  const [lib, setLib] = useState<LibraryFile | null>(null);
  const [libError, setLibError] = useState(false);
  const [sets, setSets] = useState<SavedSet[]>(readSavedSets);
  const [graphStats, setGraphStats] = useState<GraphStatsPayload | null>(null);
  const [graphError, setGraphError] = useState(false);
  const [targets, setTargets] = useState<TargetTrackSummary[] | null>(null);
  const [jobs, setJobs] = useState<JobResponse[] | null>(null);
  const [scraperReqs, setScraperReqs] = useState<APIKeyRequirement[] | null>(null);
  const [scraperKeys, setScraperKeys] = useState<APIKey[] | null>(null);

  const musicCredentials = useStore((s) => s.musicCredentials);
  const [aiConfig] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function'
        ? getAIKeyConfig()
        : { preferredProvider: null, lastTestedAt: {} };
    } catch {
      return { preferredProvider: null, lastTestedAt: {} };
    }
  });

  useEffect(() => {
    let active = true;

    loadLibrary()
      .then((data) => { if (active) setLib(data); })
      .catch(() => { if (active) setLibError(true); });

    if (typeof fetch === 'function') {
      fetch('/api/v1/library/sets')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && Array.isArray(data) && data.length > 0) {
            setSets(
              data.map((d) => ({
                ...d,
                id: String(d.id),
                tracks: (d.tracks || []).map((t: { track_id?: string; id?: string; tgt?: number }) => ({
                  ...t,
                  id: t.track_id || t.id || '',
                  tgt: t.tgt ?? 0,
                })),
              }))
            );
          }
        })
        .catch(() => {});

      fetch('/api/graph/stats')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          const nodes = data?.graph_stats?.nodes?.total_nodes ?? data?.nodeCount ?? data?.total_nodes ?? null;
          const edges = data?.graph_stats?.edges?.total_edges ?? data?.edgeCount ?? data?.total_edges ?? null;
          const occurrences = data?.graph_stats?.edges?.total_occurrences ?? null;
          const playlists = data?.database_stats?.total_playlists ?? null;
          setGraphStats({
            nodes: typeof nodes === 'number' ? nodes : null,
            edges: typeof edges === 'number' ? edges : null,
            occurrences: typeof occurrences === 'number' ? occurrences : null,
            playlists: typeof playlists === 'number' ? playlists : null,
          });
        })
        .catch(() => { if (active) setGraphError(true); });

      fetch('/api/v1/target-tracks')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (active && Array.isArray(data)) setTargets(data); })
        .catch(() => {});

      fetch('/api/v1/jobs?limit=200')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (active && Array.isArray(data)) setJobs(data); })
        .catch(() => {});

      Promise.all([
        fetch('/api/v1/api-keys/requirements').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/v1/api-keys').then((r) => (r.ok ? r.json() : null)),
      ])
        .then(([reqs, keys]) => {
          if (!active) return;
          if (Array.isArray(reqs)) setScraperReqs(reqs);
          if (Array.isArray(keys)) setScraperKeys(keys);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, []);

  usePageHeader({ lead: 'SongNodes', title: 'Home', current: 'home', updatedAt: lib?.generated ?? undefined });

  const none = <span className="sn-none">–</span>;
  const trackCountStr = lib ? SN.format.count(lib.tracks.length) : null;
  const tracks = trackCountStr ?? none;
  const reviewCount = lib ? lib.tracks.filter((t) => t.rev).length : null;
  const review = reviewCount != null ? SN.format.count(reviewCount) : none;
  const lastRun = lib?.runs?.[lib.runs.length - 1];
  const latest = sets.reduce<(typeof sets)[number] | null>((n, s) => (!n || s.updated > n.updated ? s : n), null);
  const longestMinutes = sets.reduce((m, s) => (typeof s.minutes === 'number' && s.minutes > m ? s.minutes : m), 0);

  // Set builder figures
  const setsFigures: [string, React.ReactNode][] = [
    ['longest set', longestMinutes > 0 && SN.format.span ? SN.format.span(longestMinutes * 60) : none],
    ['tracks in the latest', latest ? SN.format.count(latest.tracks.length) : none],
  ];

  // Graph figures
  const graphNodes = graphStats?.nodes != null ? SN.format.count(graphStats.nodes) : none;
  const graphEdges = graphStats?.edges != null ? SN.format.count(graphStats.edges) : none;
  const graphTitle = graphStats?.edges != null
    ? `${SN.format.count(graphStats.edges)} connections`
    : 'Adjacency';
  const graphSummary = graphError
    ? 'Explore which tracks DJs play next to each other. The graph service did not answer.'
    : graphStats?.nodes != null && graphStats?.edges != null
      ? `${SN.format.count(graphStats.nodes)} tracks and ${SN.format.count(graphStats.edges)} adjacency edges${graphStats.playlists != null ? ` across ${SN.format.count(graphStats.playlists)} sets` : ''}.`
      : 'Explore which tracks DJs play next to each other.';

  // Pathfinder & Key & mood figures from library tracks
  const keyCounts: Record<string, number> = {};
  let keyedCount = 0;
  let unkeyedCount = 0;
  let topKey: [string, number] | null = null;
  if (lib) {
    for (const t of lib.tracks) {
      const k = t.k && typeof SN.camelot === 'function' ? SN.camelot(t.k) : t.k;
      if (k) {
        keyedCount++;
        const nextCount = (keyCounts[k] || 0) + 1;
        keyCounts[k] = nextCount;
        if (!topKey || nextCount > topKey[1]) {
          topKey = [k, nextCount];
        }
      } else {
        unkeyedCount++;
      }
    }
  }
  const keysInUse = Object.keys(keyCounts).length;

  const pathsTitle = lib ? `${SN.format.count(keyedCount)} routeable tracks` : 'Route finder';
  const pathsFigures: [string, React.ReactNode][] = [
    ['routeable tracks', lib ? SN.format.count(keyedCount) : none],
    ['edges', graphEdges],
  ];

  const harmonyTitle = lib && keysInUse > 0 ? `${SN.format.count(keysInUse)} keys in use` : 'Camelot wheel';
  const harmonyFigures: [string, React.ReactNode][] = [
    [topKey ? `tracks in ${topKey[0]}` : 'keyed tracks', lib ? SN.format.count(topKey ? topKey[1] : keyedCount) : none],
    ['missing key', lib ? SN.format.count(unkeyedCount) : none],
  ];

  // Sources figures
  const activeTargets = targets ? targets.filter((t) => !t.archived && t.is_active !== false) : null;
  const pendingTargets = activeTargets ? activeTargets.filter((t) => isPendingSearch(t)).length : null;
  const failedTargets = activeTargets ? activeTargets.filter((t) => targetSearchStatus(t).kind === 'failed').length : null;
  const sourcesTitle = activeTargets ? `${SN.format.count(activeTargets.length)} target tracks` : 'Target tracks';
  const sourcesSummary = lastRun
    ? `Weekly run ${SN.format.dateOnly(lastRun.date)} added ${SN.format.count(lastRun.added)} tracks.`
    : 'Target tracks, tracklist imports and AI setlists.';
  const sourcesFigures: [string, React.ReactNode][] = lastRun
    ? [['added', SN.format.count(lastRun.added)], ['rejected', SN.format.count(lastRun.rejected)]]
    : [['active targets', activeTargets ? SN.format.count(activeTargets.length) : none], ['pending search', pendingTargets != null ? SN.format.count(pendingTargets) : none]];
  const sourcesPill = failedTargets && failedTargets > 0
    ? <span className="sn-pill" data-status="bad">{SN.format.count(failedTargets)} search failed</span>
    : undefined;

  // Pipeline figures
  const pipelineJobs = jobs ? jobs.filter((j) => !HOUSEKEEPING_KINDS.has(j.kind)) : null;
  const activeJobs = pipelineJobs ? pipelineJobs.filter((j) => j.status === 'running' || j.status === 'queued').length : null;
  const succeededJobs = pipelineJobs ? pipelineJobs.filter((j) => j.status === 'succeeded').length : null;
  const deadJobs = pipelineJobs ? pipelineJobs.filter((j) => j.status === 'dead').length : null;
  const pipelineTitle = pipelineJobs
    ? activeJobs && activeJobs > 0
      ? `${SN.format.count(activeJobs)} active jobs`
      : `${SN.format.count(pipelineJobs.length)} recent jobs`
    : 'Scrapers and jobs';
  const pipelineFigures: [string, React.ReactNode][] = [
    ['running or queued', activeJobs != null ? SN.format.count(activeJobs) : none],
    [deadJobs && deadJobs > 0 ? 'failed' : 'completed', pipelineJobs ? SN.format.count(deadJobs && deadJobs > 0 ? deadJobs : (succeededJobs ?? 0)) : none],
  ];
  const pipelinePill = deadJobs && deadJobs > 0
    ? <span className="sn-pill" data-status="bad">{SN.format.count(deadJobs)} failed</span>
    : undefined;

  // Services figures
  const spotifyConnected = isTokenValid(musicCredentials?.spotify);
  const tidalConnected = isTokenValid(musicCredentials?.tidal);
  const spotifyExpired = isTokenExpired(musicCredentials?.spotify);
  const tidalExpired = isTokenExpired(musicCredentials?.tidal);
  const connectedStreaming = (spotifyConnected ? 1 : 0) + (tidalConnected ? 1 : 0);

  const aiKeysConfigured = [aiConfig.claudeApiKey, aiConfig.openaiApiKey, aiConfig.geminiApiKey].filter(Boolean).length;
  const visibleScraperServices = scraperReqs
    ? new Set(scraperReqs.filter((r) => !HIDDEN_SERVICES.has(r.service_name)).map((r) => r.service_name))
    : null;
  const configuredScraperServices = scraperKeys && visibleScraperServices
    ? new Set(scraperKeys.filter((k) => visibleScraperServices.has(k.service_name)).map((k) => k.service_name)).size
    : 0;
  const totalConfiguredKeys = aiKeysConfigured + configuredScraperServices;

  const servicesTitle = connectedStreaming > 0 || totalConfiguredKeys > 0
    ? `${SN.format.count(connectedStreaming)} of 2 streaming connected`
    : 'Settings';
  const servicesFigures: [string, React.ReactNode][] = [
    ['streaming connected', SN.format.count(connectedStreaming)],
    ['API keys saved', SN.format.count(totalConfiguredKeys)],
  ];
  const servicesPill = tidalExpired
    ? <span className="sn-pill" data-status="warn">TIDAL expired</span>
    : spotifyExpired
      ? <span className="sn-pill" data-status="warn">Spotify expired</span>
      : undefined;

  // Library pill when tracks need an energy check
  const libraryPill = reviewCount && reviewCount > 0
    ? <span className="sn-pill" data-status="warn">{SN.format.count(reviewCount)} need an energy check</span>
    : undefined;

  return (
    <main className="sn-page__main sn-page-home" id="main" tabIndex={-1}>
      <PageHeader
        lead="SongNodes"
        title="Home"
        desc="Jump into a module. The track graph and the Melbourne club library share one system."
        stampVerb="Library data from"
        stamp={lib?.generated ?? null}
        stampUnknown={!!lib}
      />
      <section className="sn-page__section" aria-labelledby="mod-t">
        <SectionHeading id="mod-t" title="Modules" count="8" />
        <div className="sn-launcher-card__grid">
          <LauncherCard
            mod="sets"
            title={`${SN.format.count(sets.length)} saved sets`}
            summary="Shape a set from the crate, check every transition and save it."
            figures={setsFigures}
          />
          <LauncherCard
            mod="paths"
            title={pathsTitle}
            summary="Routes from one track to another through proven transitions."
            figures={pathsFigures}
          />
          <LauncherCard
            mod="graph"
            title={graphTitle}
            summary={graphSummary}
            figures={[['nodes', graphNodes], ['edges', graphEdges]]}
          />
          <LauncherCard
            mod="library"
            title={trackCountStr ? `${trackCountStr} tracks` : 'Melbourne crate'}
            summary={libError ? 'The library file did not load. It is refreshed by the weekly run.' : 'Filter, search and sort the club library, then build a set from what is left.'}
            figures={[['tracks', tracks], ['need an energy check', review]]}
            pill={libraryPill}
          />
          <LauncherCard
            mod="harmony"
            title={harmonyTitle}
            summary="Keys, mood and energy across the library."
            figures={harmonyFigures}
          />
          <LauncherCard
            mod="sources"
            title={sourcesTitle}
            summary={sourcesSummary}
            figures={sourcesFigures}
            pill={sourcesPill}
          />
          <LauncherCard
            mod="pipeline"
            title={pipelineTitle}
            summary="Queue scrapes and watch jobs, workers and the medallion stages live."
            figures={pipelineFigures}
            pill={pipelinePill}
          />
          <LauncherCard
            mod="services"
            title={servicesTitle}
            summary="Spotify, TIDAL, API keys, theme, text size and density."
            figures={servicesFigures}
            pill={servicesPill}
          />
        </div>
      </section>
    </main>
  );
};

export default HomePage;
