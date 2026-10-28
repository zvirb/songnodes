import React, { useState, useRef, FormEvent } from 'react';
import { RefreshCw, Activity, CheckCircle2, ServerCrash, Clock, Zap, AlertTriangle, XCircle, Play } from 'lucide-react';
import TargetTracksManager from '../components/TargetTracksManager';
import { SN } from '../lib/songnodes';
import { ConfirmDialog, showToast, StatusPill } from '../components/ds';
import { formatThroughput, JobResponse } from '../utils/dataLoaderUtils';
import { usePipelineTelemetry } from '../features/pipeline/usePipelineTelemetry';
import { api } from '../services/api';
import { usePageHeader } from '../shell/AppShell';

import { SectionHeading, TextField, SegmentedControl, Button } from '../components/ds';
import { API_BASE_URL } from '../lib/apiBase';

const ScraperProgressPage: React.FC = () => {
  usePageHeader({ lead: 'Pipeline', title: 'Telemetry', current: 'pipeline' });
  const { telemetry, stages, workers, jobs, scrapeRuns, isLoading, error, lastUpdated, source: telemetrySource, refresh } = usePipelineTelemetry();
  const [retryingJob, setRetryingJob] = useState<string | null>(null);
  const [confirmRetryId, setConfirmRetryId] = useState<string | null>(null);

  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<'mixesdb' | '1001tracklists'>('mixesdb');
  const [artistError, setArtistError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const artistRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleRetryJob = async () => {
    if (!confirmRetryId) return;
    const jobId = confirmRetryId;
    setConfirmRetryId(null);
    setRetryingJob(jobId);
    try {
      await api.post(`/jobs/${jobId}/retry`);
      await refresh();
    } catch (e) {
      console.error('Failed to retry job:', e);
      showToast('Failed to retry job');
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
        search_query: query
      });

      const response = await fetch(`${API_BASE_URL || ''}/api/v1/scrape/trigger?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKeyRef.current,
        },
      });

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

  const deadJobs = jobs.filter(j => j.status === 'dead');
  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running');
  const todayStart = new Date(lastUpdated); todayStart.setHours(0, 0, 0, 0);
  const runningScrapes = scrapeRuns.filter(r => r.state === 'running' || r.state === 'queued');
  const finishedToday = scrapeRuns.filter(r => r.finishedAt && new Date(r.finishedAt) >= todayStart);
  const tracksToday = finishedToday.reduce((n, r) => n + (r.tracks ?? 0), 0);
  const emptyToday = finishedToday.filter(r => r.state === 'found_nothing').length;
  const STAGE_PILL: Record<string, [string, string]> = { done: ['completed', 'Done'], running: ['running', 'Running'], waiting: ['idle', 'Waiting'], warning: ['warning', 'Warning'], failed: ['failed', 'Failed'], cancelled: ['cancelled', 'Cancelled'] };
  const RUN_PILL: Record<string, [string, string]> = { queued: ['queued', 'Queued'], running: ['running', 'Running'], found_nothing: ['warning', 'Found nothing'], done: ['success', 'Done'], failed: ['failed', 'Failed'] };

  if (error && telemetrySource === 'unavailable') {
    return (
      <main className="sn-page__main" id="main" tabIndex={-1}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
          <div>
            <h1 className="sn-title title-l" style={{ margin: 0 }}>Pipeline telemetry</h1>
          </div>
        </header>
        <section className="sn-page__section sn-empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", backgroundColor: "var(--surface-1)", borderRadius: "var(--radius-card)", border: "1px solid var(--line)" }}>
          <ServerCrash size={48} color="var(--status-bad)" style={{ marginBottom: 'var(--space-4)' }} />
          <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Telemetry unavailable</h2>
          <p className="body" style={{ color: 'var(--fg-2)', marginBottom: 'var(--space-4)' }}>{error}</p>
          <button className="sn-btn sn-btn--primary" onClick={refresh}>
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
    <main className="sn-page__main" id="main" tabIndex={-1}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <h1 className="sn-title title-l" style={{ margin: 0 }}>Pipeline telemetry</h1>
          <p className="body" style={{ margin: 0 }}>
            Real-time status of the 4-stage ingestion and graphing pipeline.
          </p>
        </div>
        <div>
          <button
            className="sn-btn"
            onClick={refresh}
            disabled={isLoading}
            title={`Last synced: ${new Date(lastUpdated).toLocaleTimeString()}`}
            aria-live="polite"
          >
            <RefreshCw size={16} aria-label="Sync" className={isLoading ? "sn-spinner" : ""} />
            {isLoading ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </header>

      {telemetrySource !== 'live' && (
        <div className="sn-banner" data-status="info" style={{ marginBottom: 'var(--space-6)' }}>
          <Activity size={20} />
          <div>
            <strong>Live telemetry unavailable.</strong> The REST API did not answer /api/v1/jobs or /api/v1/outbox/status, so no job or worker data is shown.
          </div>
        </div>
      )}

      {jobs.length === 0 && telemetrySource === 'live' && (
        <section className="sn-page__section sn-empty-state" style={{ border: "1px dashed var(--line)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-8)", backgroundColor: "var(--surface-1)", borderRadius: "var(--radius-card)", marginBottom: "var(--space-6)" }}>
          <Clock size={48} color="var(--fg-3)" style={{ marginBottom: 'var(--space-4)' }} />
          <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>No jobs yet</h2>
          <p className="body" style={{ color: 'var(--fg-2)', marginBottom: 'var(--space-4)' }}>The pipeline queue is currently empty.</p>
          <Button kind="quiet" onClick={() => artistRef.current?.focus()}>
            Queue scrape job
          </Button>
        </section>
      )}

      {telemetrySource === 'live' && (
        <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
          <SectionHeading title="Queue a scrape" />
          <form
            onSubmit={handleQueueJob}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              border: '1px solid var(--line)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--surface-1)',
              borderRadius: 'var(--radius-card)'
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
                  { value: '1001tracklists', label: '1001Tracklists' }
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
        </section>
      )}

      {/* Scrape runs: the jobs that fill bronze, newest first */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Scrape runs" count={`${SN.format.count(scrapeRuns.length)} recent`} />
        {scrapeRuns.length > 0 ? (
          <div className="sn-tablebox">
            <table className="sn-table" aria-label="Scrape runs">
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
                {scrapeRuns.slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td className="body-strong" >
                      {r.query || <span className="sn-none">–</span>}
                    </td>
                    <td >{r.source}</td>
                    <td>
                      <StatusPill
                        raw={RUN_PILL[r.state]?.[0] || 'idle'}
                        label={RUN_PILL[r.state]?.[1] || r.state}
                        title={r.error || undefined}
                      />
                    </td>
                    <td className="data" >
                      {SN.format.dateTime(r.createdAt)}
                    </td>
                    <td className="num data" >
                      {r.seconds !== null ? SN.format.duration(r.seconds) : '—'}
                    </td>
                    <td className="num data" >
                      {r.playlists !== null ? SN.format.count(r.playlists) : '—'}
                    </td>
                    <td className="num data" >
                      {r.tracks !== null ? SN.format.count(r.tracks) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="body" >No scrapes have been requested yet.</p>
        )}
      </section>

      {/* Overview Metric Tiles */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="System health" count="Last 15 minutes" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>

          {/* Tile 1: Active Jobs */}
          <div className="sn-card" style={{ border: '1px solid var(--line)', padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ flex: 1 }}>Active workers</span>
              <Activity size={18} color="var(--brand)" />
            </div>
            <div className="figure data" >
              {telemetry.activeWorkers}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              Processing {SN.format.count(activeJobs.length)} active jobs
            </div>
          </div>

          {/* Tile 2: Items Processed */}
          <div className="sn-card" style={{ border: '1px solid var(--line)', padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ flex: 1 }}>Tracks scraped today</span>
              <CheckCircle2 size={18} color={tracksToday > 0 ? "var(--status-ok)" : "var(--fg-3)"} />
            </div>
            <div className="figure data" >
              {SN.format.count(tracksToday)}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: "var(--space-1)" }}>
              {SN.format.count(finishedToday.length)} scrapes finished today{emptyToday > 0 ? `, ${SN.format.count(emptyToday)} found nothing` : ''}
            </div>
          </div>

          {/* Tile 3: Throughput Rate */}
          <div className="sn-card" style={{ border: '1px solid var(--line)', padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ flex: 1 }}>Throughput speed</span>
              <Zap size={18} color="var(--status-info)" />
            </div>
            <div className="figure data" >
              {formatThroughput(telemetry.throughputRate)}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              Successes per minute (last 15m)
            </div>
          </div>

          {/* Tile 4: Error Count */}
          <div className="sn-card" style={{ border: '1px solid var(--line)', padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ flex: 1 }}>Dead letters</span>
              <AlertTriangle size={18} color={telemetry.errorCount > 0 ? "var(--status-warn)" : "var(--status-ok)"} />
            </div>
            <div className="figure data" >
              {SN.format.count(telemetry.errorCount)}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              {telemetry.errorCount === 0 ? 'No dead jobs' : 'Jobs requiring manual intervention'}
            </div>
          </div>
        </div>
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

                    <span className="body-strong" >
                      {stg.name}
                    </span>
                    <StatusPill raw={STAGE_PILL[stg.state][0]} label={STAGE_PILL[stg.state][1]} />
                  </div>

                  <div className="data" >
                    {stg.done === 0 && stg.total === 0 ? '—' : `${SN.format.count(stg.done)} / ${SN.format.count(stg.total)} (${pct}%)`}
                  </div>
                </div>

                <div className="caption" >
                  {stg.description} {stg.detail ? `— ${stg.detail}` : ''}
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
                    <td className="body-strong" >
                      {w.name || <span className="sn-none">–</span>}
                    </td>
                    <td >{w.kind}</td>
                    <td>
                      <StatusPill raw={w.status === "running" ? "ok" : w.status === "error" ? "error" : "idle"} />
                    </td>
                    <td className="num data" >
                      {w.successRate > 0 ? `${w.successRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="num data" >
                      {SN.format.count(w.jobsToday)}
                    </td>
                    <td >
                      {w.activeTarget ? (
                        <span className="data" >
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
           <p className="body" >No workers are currently active.</p>
        )}
      </section>

      {/* Dead Jobs Retry Section */}
      {deadJobs.length > 0 && (
        <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
          <SectionHeading title="Dead jobs requiring retry" count={`${deadJobs.length} jobs`} />
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
                    <td className="data" >{j.job_id.substring(0, 8)}</td>
                    <td>{j.kind}</td>
                    <td className="caption data truncate" style={{ maxWidth: "300px" }} title={j.last_error || ''}>
                      {j.last_error || <span className="sn-none">–</span>}
                    </td>
                    <td>
                      <button
                        className="sn-btn sn-btn--quiet sn-btn--sm"
                        aria-label={`Retry dead job ${j.job_id}`} onClick={() => setConfirmRetryId(j.job_id)}
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
