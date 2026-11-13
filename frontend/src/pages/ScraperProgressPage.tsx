import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { RefreshCw, Activity, CheckCircle2, ServerCrash, Clock, Zap, AlertTriangle, XCircle, ListFilter } from 'lucide-react';
import TargetTracksManager from '../components/TargetTracksManager';
import { SN } from '../lib/songnodes';
import { ConfirmDialog, showToast, StatusPill } from '../components/ds';
import { formatThroughput } from '../utils/dataLoaderUtils';
import { usePipelineTelemetry, type ScrapeRun } from '../features/pipeline/usePipelineTelemetry';
import { ScrapeJobStages } from '../features/pipeline/ScrapeJobStages';
import { ScrapeWindowCard } from '../features/pipeline/ScrapeWindowCard';
import { useRunMonitor } from '../features/pipeline/RunMonitor';
import RunsPage from '../features/pipeline/RunsPage';
import { api } from '../services/api';
import { usePageHeader } from '../shell/AppShell';
import { PageHeader } from '../shell/PageParts';

import { SectionHeading, TextField, SegmentedControl, Button } from '../components/ds';
import { API_BASE_URL } from '../lib/apiBase';

const ScraperProgressPage: React.FC = () => {
  const [view, setView] = useState<'health' | 'runs'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/pipeline/runs' || window.location.hash === '#runs' || window.location.search.includes('view=runs')) {
        return 'runs';
      }
    }
    return 'health';
  });

  usePageHeader({ lead: 'Pipeline', title: view === 'runs' ? 'Run history' : 'Health', current: 'pipeline' });
  const { telemetry, stages, workers, jobs, scrapeRuns, isLoading, error, lastUpdated, source: telemetrySource, refresh } = usePipelineTelemetry();

  // Read the count contract rather than assuming a paginated list response.
  const [reviewQueueTotal, setReviewQueueTotal] = useState<number | null>(null);
  useEffect(() => {
    if (typeof api?.get === 'function') {
      api.get('/library/review-queue/count')
        .then((res) => {
          if (res?.data && Number.isInteger(res.data.count) && res.data.count >= 0) {
            setReviewQueueTotal(res.data.count);
          }
        })
        .catch(() => {
          // Fallback gracefully
        });
    }
  }, []);

  // Run monitor evaluation (M5)
  const failedStage = stages.find((s) => s.state === 'failed');
  const { yieldMetrics, worstCondition, lastFinishedRun } = useRunMonitor(
    scrapeRuns,
    telemetry.errorCount,
    failedStage?.detail ?? null,
  );

  const [retryingJob, setRetryingJob] = useState<string | null>(null);
  const [confirmRetryId, setConfirmRetryId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<'mixesdb' | '1001tracklists'>('mixesdb');
  const [artistError, setArtistError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const artistRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Scrapes seen queued or running on this visit keep their stages card until the page is left (newest first, at most 5).
  const [watched, setWatched] = useState<ScrapeRun[]>([]);
  const activeRuns = scrapeRuns.filter((r) => r.state === 'queued' || r.state === 'running').slice(0, 5);
  const nextWatched = [...activeRuns, ...watched.filter((w) => !activeRuns.some((a) => a.id === w.id))].slice(0, 5);
  if (nextWatched.map((w) => w.id).join() !== watched.map((w) => w.id).join()) setWatched(nextWatched);

  const handleRetryJob = async () => {
    if (!confirmRetryId) return;
    const jobId = confirmRetryId;
    setConfirmRetryId(null);
    setRetryingJob(jobId);
    setRetryError(null);
    try {
      await api.post(`/jobs/${jobId}/retry`);
      await refresh();
    } catch (e) {
      console.error('Failed to retry job:', e);
      setRetryError(e instanceof Error ? e.message : 'Failed to retry job');
    } finally {
      setRetryingJob(null);
    }
  };

  const handleQueueJob = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const trimmedArtist = artist.trim();
    const trimmedTitle = title.trim();
    let hasError = false;

    setArtistError('');
    setTitleError('');

    if (!trimmedArtist) {
      setArtistError('Enter the artist.');
      hasError = true;
    }
    if (!trimmedTitle) {
      setTitleError('Enter the track title.');
      hasError = true;
    }

    if (!trimmedArtist && !trimmedTitle) {
      artistRef.current?.focus();
    } else if (!trimmedArtist) {
      artistRef.current?.focus();
    } else if (!trimmedTitle) {
      titleRef.current?.focus();
    }

    if (hasError) return;

    const query = `${trimmedArtist} ${trimmedTitle}`;
    if (query.length > 255) {
      setArtistError('Combined artist and title must be at most 255 characters.');
      artistRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      const params = new URLSearchParams({
        source,
        search_query: query,
      });

      const response = await fetch(`${API_BASE_URL || ''}/api/v1/scrape/trigger?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKeyRef.current,
        },
      });

      if (!response.ok) {
        let detail: unknown;
        try {
          detail = (await response.json())?.detail;
        } catch {
          detail = undefined;
        }
        showToast(typeof detail === 'string' ? detail : `Could not queue the scrape (HTTP ${response.status})`);
        return;
      }

      const data = await response.json();

      if (response.status === 202) {
        if (data.created === false) {
          showToast(`Already queued`);
        } else {
          showToast(`Queued ${query} on ${source}`);
        }
        setArtist('');
        setTitle('');
        setArtistError('');
        setTitleError('');
        idempotencyKeyRef.current = null;
        await refresh();
      } else {
        const detail = data.detail;
        if (typeof detail === 'string') {
          showToast(detail);
        } else {
          showToast(`Could not queue the scrape (HTTP ${response.status})`);
        }
      }
    } catch (e) {
      console.error('Failed to queue job:', e);
      showToast('Could not queue the scrape');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deadJobs = jobs.filter((j) => j.status === 'dead');
  const STAGE_PILL: Record<string, [string, string]> = {
    done: ['completed', 'Done'],
    running: ['running', 'Running'],
    waiting: ['idle', 'Waiting'],
    warning: ['warning', 'Warning'],
    failed: ['failed', 'Failed'],
    cancelled: ['cancelled', 'Cancelled'],
  };
  const RUN_PILL: Record<string, [string, string]> = {
    queued: ['queued', 'Queued'],
    running: ['running', 'Running'],
    found_nothing: ['warning', 'Found nothing'],
    done: ['success', 'Done'],
    failed: ['failed', 'Failed'],
  };

  if (view === 'runs') {
    return <RunsPage onBack={() => setView('health')} />;
  }

  if (error && telemetrySource === 'unavailable') {
    return (
      <main className="sn-page__main" id="main" tabIndex={-1}>
        <PageHeader mod="pipeline" lead="Pipeline" title="Health" />
        <section
          className="sn-page__section sn-empty-state"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            backgroundColor: 'var(--surface-1)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--line)',
          }}
        >
          <ServerCrash size={48} color="var(--status-bad)" style={{ marginBottom: 'var(--space-4)' }} />
          <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>
            Pipeline telemetry unavailable
          </h2>
          <p className="body" style={{ color: 'var(--fg-2)', marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
          <button className="sn-btn sn-btn--primary" onClick={() => { void refresh(); }}>
            <RefreshCw size={16} aria-hidden="true" /> Retry connection
          </button>
        </section>

        {confirmRetryId && (
          <ConfirmDialog
            open={!!confirmRetryId}
            title="Retry Job"
            confirmLabel="Retry Job"
            onConfirm={handleRetryJob}
            onCancel={() => setConfirmRetryId(null)}
          >
            <p>Are you sure you want to retry this job? It will be moved back to the queue.</p>
          </ConfirmDialog>
        )}
      </main>
    );
  }

  return (
    <main className="sn-page-monitor sn-page__main" id="main" tabIndex={-1}>
      <div className="sn-page-monitor__section">
        <PageHeader
          mod="pipeline"
          lead="Pipeline"
          title="Health"
          desc="Is anything broken right now? Scrapers, proxies and enrichment that feed the graph and the library."
          pill={
            <span
              className="sn-connection-status"
              data-state={telemetrySource === 'live' ? 'live' : 'offline'}
              role="status"
              title={telemetrySource === 'live' ? 'Live updates connected' : 'Offline'}
            >
              {telemetrySource === 'live' ? 'Live' : 'Offline'}
            </span>
          }
          actions={
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className="sn-btn sn-btn--quiet sn-btn--sm"
                type="button"
                onClick={() => setView('runs')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <ListFilter size={14} />
                <span>Run history</span>
              </button>
              <button
                className="sn-btn sn-btn--sm"
                type="button"
                onClick={() => { void refresh(); }}
                disabled={isLoading}
                title={`Last synced ${SN.format.time(new Date(lastUpdated))}`}
                aria-live="polite"
              >
                <RefreshCw size={14} aria-hidden="true" className={isLoading ? 'sn-spinner' : ''} />
                {isLoading ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          }
        />

        {/* Problems first: one Banner displaying worst current condition */}
        {worstCondition && (
          <div
            className="sn-banner"
            data-status={worstCondition.status}
            role="alert"
            style={{ marginBottom: 'var(--space-4)' }}
          >
            <span className="sn-banner__icon">
              {worstCondition.status === 'bad' ? <ServerCrash size={18} /> : <AlertTriangle size={18} />}
            </span>
            <div className="sn-banner__body">
              <p className="sn-banner__content">
                <span className="sn-banner__title">{worstCondition.title}</span> {worstCondition.message}
              </p>
              <div className="sn-banner__actions">
                <a
                  className="sn-btn sn-btn--sm"
                  href={worstCondition.linkHref}
                  onClick={(e) => {
                    e.preventDefault();
                    setView('runs');
                  }}
                >
                  {worstCondition.linkText}
                </a>
              </div>
            </div>
          </div>
        )}

        {telemetrySource !== 'live' && !worstCondition && (
          <div className="sn-banner" data-status="info" style={{ marginBottom: 'var(--space-4)' }}>
            <Activity size={20} />
            <div>
              <strong>Live telemetry unavailable.</strong> The REST API did not answer /api/v1/jobs or /api/v1/outbox/status.
            </div>
          </div>
        )}
      </div>

      {/* MonitoringPage FigureTile row (4 tiles) */}
      <div className="sn-figure-tile-row" role="list" aria-label="Pipeline at a glance" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Tile 1: Last run */}
        <div className="sn-figure-tile" role="listitem">
          <span className="sn-figure-tile__figure">
            {lastFinishedRun?.finishedAt ? SN.format.time(lastFinishedRun.finishedAt) : '–'}
          </span>
          <span className="sn-figure-tile__label">Last run</span>
          <span className="sn-figure-tile__delta">
            {lastFinishedRun ? `${lastFinishedRun.source} · ${SN.format.count(lastFinishedRun.tracks ?? 0)} tracks` : 'No runs recorded'}
          </span>
          <div className="sn-figure-tile__foot">
            <StatusPill
              raw={lastFinishedRun?.state === 'done' ? 'succeeded' : lastFinishedRun?.state || 'idle'}
              label={lastFinishedRun?.state === 'done' ? 'Done' : lastFinishedRun?.state || '–'}
            />
          </div>
        </div>

        {/* Tile 2: Resolve yield */}
        <div className="sn-figure-tile" role="listitem">
          <span className="sn-figure-tile__figure">
            {yieldMetrics.currentYield > 0 ? SN.format.count(yieldMetrics.currentYield) : '–'}
          </span>
          <span className="sn-figure-tile__label">Resolve yield</span>
          <span className="sn-figure-tile__delta">
            {yieldMetrics.avgYield > 0 ? `Avg ${Math.round(yieldMetrics.avgYield)} across last 4 runs` : 'Baseline establishing'}
          </span>
          <div className="sn-figure-tile__foot">
            {yieldMetrics.isYieldAlert ? (
              <StatusPill raw="warn" label="Yield drop" />
            ) : (
              <StatusPill raw="ok" label="Healthy" />
            )}
          </div>
        </div>

        {/* Tile 3: Review queue */}
        <div className="sn-figure-tile" role="listitem">
          <span className="sn-figure-tile__figure">
            {reviewQueueTotal === null ? '–' : SN.format.count(reviewQueueTotal)}
          </span>
          <span className="sn-figure-tile__label">Review queue</span>
          <span className="sn-figure-tile__delta">Tracks needing curator review</span>
          <div className="sn-figure-tile__foot">
            <a className="sn-link sn-m-pipeline" href="/library/review">
              Open review queue
            </a>
          </div>
        </div>

        {/* Tile 4: Last backup */}
        <div className="sn-figure-tile" role="listitem">
          <span className="sn-figure-tile__figure">None</span>
          <span className="sn-figure-tile__label">Last backup</span>
          <span className="sn-figure-tile__delta">No backup recorded</span>
          <div className="sn-figure-tile__foot">
            <StatusPill raw="warn" label="Not configured" />
          </div>
        </div>
      </div>

      {/* Queue a scrape under a Disclosure */}
      <details className="sn-disclosure sn-disclosure--boxed" style={{ marginBottom: 'var(--space-6)' }}>
        <summary>
          <h2 className="sn-title title-s" style={{ margin: 0, display: 'inline' }}>Queue a scrape</h2>
          <span className="sn-disclosure__hint">Targeted search on MixesDB or 1001Tracklists</span>
        </summary>
        <div className="sn-disclosure__body" style={{ marginTop: 'var(--space-4)' }}>
          <form
            onSubmit={handleQueueJob}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <TextField
                label="Artist"
                value={artist}
                onChange={setArtist}
                error={artistError}
                ref={artistRef}
              />
              <TextField
                label="Title"
                value={title}
                onChange={setTitle}
                error={titleError}
                ref={titleRef}
              />
            </div>
            <div>
              <SegmentedControl
                options={[
                  { value: 'mixesdb', label: 'MixesDB' },
                  { value: '1001tracklists', label: '1001Tracklists' },
                ]}
                value={source}
                onChange={(v) => setSource(v as 'mixesdb' | '1001tracklists')}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button type="submit" kind="primary" disabled={isSubmitting} busy={isSubmitting} busyLabel="Queueing scrape…">
                Queue scrape
              </Button>
            </div>
          </form>
        </div>
      </details>

      <ScrapeWindowCard />

      {/* Active scrape stages */}
      {watched.length > 0 && (
        <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
          <SectionHeading title="Active scrape progress" count={`${watched.length} active`} />
          <div style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {watched.map((r) => <ScrapeJobStages key={r.id} jobId={r.id} query={r.query} source={r.source} />)}
          </div>
        </section>
      )}

      {/* Scrape runs preview with link to full run history */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <SectionHeading title="Recent scrape runs" count={`${SN.format.count(scrapeRuns.length)} total`} />
          <button
            type="button"
            className="sn-btn sn-btn--quiet sn-btn--sm"
            onClick={() => setView('runs')}
          >
            View all in run history
          </button>
        </div>
        {scrapeRuns.length > 0 ? (
          <div className="sn-tablebox">
            <table className="sn-table" aria-label="Recent scrape runs">
              <thead>
                <tr>
                  <th scope="col">Search</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col" className="num">Duration</th>
                  <th scope="col" className="num">Playlists</th>
                  <th scope="col" className="num">Tracks</th>
                </tr>
              </thead>
              <tbody>
                {scrapeRuns.slice(0, 10).map((r) => (
                  <tr key={r.id}>
                    <td className="body-strong">
                      {r.query || <span className="sn-none">–</span>}
                    </td>
                    <td>{r.source || <span className="sn-none">–</span>}</td>
                    <td>
                      <StatusPill
                        raw={RUN_PILL[r.state]?.[0] || 'idle'}
                        label={RUN_PILL[r.state]?.[1] || r.state}
                        title={r.error || undefined}
                      />
                    </td>
                    <td>
                      <time dateTime={r.createdAt} title={SN.format.dateTime(r.createdAt)}>
                        {SN.format.time(r.createdAt)}
                      </time>
                    </td>
                    <td className="num data">
                      {r.seconds !== null ? `${Math.round(r.seconds)} s` : <span className="sn-none">–</span>}
                    </td>
                    <td className="num data">
                      {r.playlists !== null ? SN.format.count(r.playlists) : <span className="sn-none">–</span>}
                    </td>
                    <td className="num data">
                      {r.tracks !== null ? SN.format.count(r.tracks) : <span className="sn-none">–</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="body" style={{ color: 'var(--fg-2)' }}>No scrape runs recorded yet.</p>
        )}
      </section>

      {/* Multi-Stage Medallion Pipeline Progress */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Medallion pipeline flow" count="4 stages" />
        <div style={{ border: '1px solid var(--line)', padding: 'var(--space-5)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {stages.map((stg) => {
            const pct = stg.total > 0 ? Math.round((stg.done / stg.total) * 100) : 0;

            return (
              <div key={stg.id} style={{ border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'var(--surface-2)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {stg.state === 'done' && <CheckCircle2 size={18} color="var(--status-ok)" />}
                    {stg.state === 'running' && <RefreshCw size={18} className="sn-spinner" color="var(--brand)" />}
                    {stg.state === 'waiting' && <Clock size={18} color="var(--fg-3)" />}
                    {stg.state === 'failed' && <XCircle size={18} color="var(--status-bad)" />}
                    {stg.state === 'warning' && <AlertTriangle size={18} color="var(--status-warn)" />}

                    <span className="body-strong">
                      {stg.name}
                    </span>
                    <StatusPill raw={STAGE_PILL[stg.state][0]} label={STAGE_PILL[stg.state][1]} />
                  </div>

                  <div className="data">
                    {stg.done === 0 && stg.total === 0 ? <span className="sn-none">–</span> : `${SN.format.count(stg.done)} / ${SN.format.count(stg.total)} (${pct}%)`}
                  </div>
                </div>

                <div className="caption" style={stg.state === 'warning' ? { color: 'var(--status-warn)' } : undefined}>
                  {stg.state === 'warning' ? stg.detail : <>{stg.description}{stg.detail ? `. ${stg.detail}` : ''}</>}
                </div>

                {stg.total > 0 && (
                  <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--surface-3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, backgroundColor: stg.state === 'done' ? 'var(--status-ok)' : 'var(--brand)', transition: 'width var(--duration-base) var(--ease-standard)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Scraper Worker Pool Status Table */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Workers" count={`${SN.format.count(workers.length)} ${workers.length === 1 ? 'worker' : 'workers'}`} />
        {workers.length > 0 ? (
          <div className="sn-tablebox" style={{ overflowX: 'auto' }}>
            <table className="sn-table" aria-label="Worker health">
              <thead>
                <tr>
                  <th scope="col">Worker</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Success rate</th>
                  <th scope="col" className="num">Jobs today</th>
                  <th scope="col">Working on</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td className="body-strong">
                      {w.name || <span className="sn-none">–</span>}
                    </td>
                    <td>{w.kind}</td>
                    <td>
                      <StatusPill raw={w.status === 'running' ? 'ok' : w.status === 'error' ? 'error' : 'idle'} />
                    </td>
                    <td className="num data">
                      {w.successRate > 0 ? `${w.successRate.toFixed(1)}%` : <span className="sn-none">–</span>}
                    </td>
                    <td className="num data">
                      {SN.format.count(w.jobsToday)}
                    </td>
                    <td>
                      {w.activeTarget ? (
                        <span className="data">
                          {w.activeTarget}
                        </span>
                      ) : (
                        <span className="caption">Idle</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="body">No workers are currently active.</p>
        )}
      </section>

      {/* Dead Jobs Retry Section */}
      {deadJobs.length > 0 && (
        <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
          <SectionHeading title="Dead jobs requiring retry" count={`${deadJobs.length} jobs`} />
          {retryError && (
            <div className="sn-inline-message" data-status="bad" role="status" style={{ marginBottom: 'var(--space-3)' }}>
              <span>{retryError}</span>
            </div>
          )}
          <div className="sn-tablebox" style={{ overflowX: 'auto' }}>
            <table className="sn-table" aria-label="Dead jobs">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Last error</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {deadJobs.map((j) => (
                  <tr key={j.job_id}>
                    <td className="data">{j.job_id.substring(0, 8)}</td>
                    <td>{j.kind}</td>
                    <td className="caption data truncate" style={{ maxWidth: '300px' }} title={j.last_error || ''}>
                      {j.last_error || <span className="sn-none">–</span>}
                    </td>
                    <td>
                      <button
                        className="sn-btn sn-btn--quiet sn-btn--sm"
                        aria-label={`Retry dead job ${j.job_id}`}
                        onClick={() => setConfirmRetryId(j.job_id)}
                        disabled={retryingJob === j.job_id}
                        aria-live="polite"
                      >
                        {retryingJob === j.job_id ? <RefreshCw size={14} className="sn-spinner" /> : <RefreshCw size={14} />}
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Target Tracks Queue Section */}
      <section className="sn-page__section">
        <SectionHeading title="Pending & failed scrape targets queue" />
        <div style={{ border: '1px solid var(--line)', padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)' }}>
          <TargetTracksManager embedded filterStatus="pending" />
        </div>
      </section>

      {confirmRetryId && (
        <ConfirmDialog
          open={!!confirmRetryId}
          title="Retry Job"
          confirmLabel="Retry Job"
          onConfirm={handleRetryJob}
          onCancel={() => setConfirmRetryId(null)}
        >
          <p>Are you sure you want to retry this job? It will be moved back to the queue.</p>
        </ConfirmDialog>
      )}
    </main>
  );
};

export default ScraperProgressPage;
