import React, { useState } from 'react';
import { RefreshCw, Activity, CheckCircle2, ServerCrash, Clock, Zap, AlertTriangle, XCircle, Play } from 'lucide-react';
import TargetTracksManager from '../components/TargetTracksManager';
import { SN } from '../lib/songnodes';
import { ConfirmDialog, showToast } from '../components/ds';
import { formatThroughput, getStatusTokenColor, JobResponse } from '../utils/dataLoaderUtils';
import { usePipelineTelemetry } from '../features/pipeline/usePipelineTelemetry';
import { api } from '../services/api';

const SectionHeading = ({ title, count }: { title: string; count?: string | number }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
    <h2 className="heading-3">{title}</h2>
    {count !== undefined && (
      <span className="caption sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg-2)' }}>
        {count}
      </span>
    )}
  </div>
);

const ScraperProgressPage: React.FC = () => {
  const { telemetry, stages, workers, jobs, isLoading, error, lastUpdated, source, refresh } = usePipelineTelemetry();
  const [retryingJob, setRetryingJob] = useState<string | null>(null);
  const [confirmRetryId, setConfirmRetryId] = useState<string | null>(null);

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

  const handleQueueJob = async () => {
    try {
      await api.post('/scrape/trigger?source=1001tracklists');
      await refresh();
    } catch (e) {
      console.error('Failed to queue job:', e);
      showToast('Failed to queue job');
    }
  };

  const deadJobs = jobs.filter(j => j.status === 'dead');
  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running');

  if (error && source === 'unavailable') {
    return (
      <main className="sn-page sn-page--full">
        <header className="sn-page__header">
          <div className="sn-page__title-group">
            <h1 className="heading-2">Pipeline Telemetry</h1>
          </div>
        </header>
        <section className="sn-page__section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
          <ServerCrash size={48} color="var(--status-bad)" style={{ marginBottom: 'var(--space-4)' }} />
          <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Telemetry Unavailable</h2>
          <p className="body" style={{ color: 'var(--fg-2)', marginBottom: 'var(--space-4)' }}>{error}</p>
          <button className="sn-btn sn-btn--primary" onClick={refresh}>
            <RefreshCw size={16} /> Retry Connection
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
    <main className="sn-page sn-page--full">
      <header className="sn-page__header">
        <div className="sn-page__title-group">
          <h1 className="heading-2">Pipeline Telemetry</h1>
          <p className="body" style={{ color: 'var(--fg-2)' }}>
            Real-time status of the 4-stage ingestion and graphing pipeline.
          </p>
        </div>
        <div className="sn-page__actions">
          <button
            className="sn-btn sn-btn--outline"
            onClick={refresh}
            disabled={isLoading}
            title={`Last synced: ${new Date(lastUpdated).toLocaleTimeString()}`}
            aria-live="polite"
          >
            <RefreshCw size={16} className={isLoading ? 'sn-spinner' : ''} />
            {isLoading ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </header>

      {source !== 'live' && (
        <div className="sn-banner sn-banner--info" style={{ marginBottom: 'var(--space-6)' }}>
          <Activity size={20} />
          <div>
            <strong>Demonstration mode active.</strong> Live job and worker telemetry is not connected.
          </div>
        </div>
      )}

      {jobs.length === 0 && source === 'live' && (
        <section className="sn-page__section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', backgroundColor: 'var(--surface-1)', borderRadius: 'var(--radius-card)', border: '1px dashed var(--line)', marginBottom: 'var(--space-6)' }}>
          <Clock size={48} color="var(--fg-3)" style={{ marginBottom: 'var(--space-4)' }} />
          <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>No jobs yet</h2>
          <p className="body" style={{ color: 'var(--fg-2)', marginBottom: 'var(--space-4)' }}>The pipeline queue is currently empty.</p>
          <button className="sn-btn sn-btn--primary" onClick={handleQueueJob}>
            <Play size={16} /> Queue Scrape Job
          </button>
        </section>
      )}

      {/* Primary KPI Metrics Tiles */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Global Pipeline Health" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>

          {/* Tile 1: Active Workers */}
          <div className="sn-card" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Running Jobs</span>
              <Activity size={18} color="var(--brand)" />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg)' }}>
              {telemetry.activeWorkers}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              Distinct job kinds running
            </div>
          </div>

          {/* Tile 2: Items Processed */}
          <div className="sn-card" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Total Jobs Executed</span>
              <CheckCircle2 size={18} color="var(--status-ok)" />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg)' }}>
              {SN.format.count(telemetry.itemsProcessed)}
            </div>
            <div className="caption sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              {SN.format.count(telemetry.itemsRemaining)} pending jobs left
            </div>
          </div>

          {/* Tile 3: Throughput Rate */}
          <div className="sn-card" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Throughput Speed</span>
              <Zap size={18} color="var(--status-info)" />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg)' }}>
              {formatThroughput(telemetry.throughputRate)}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              Successes per minute (last 15m)
            </div>
          </div>

          {/* Tile 4: Error Count */}
          <div className="sn-card" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Dead Letters</span>
              <AlertTriangle size={18} color={telemetry.errorCount > 0 ? "var(--status-warn)" : "var(--status-ok)"} />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: telemetry.errorCount > 0 ? 'var(--status-warn)' : 'var(--fg)' }}>
              {telemetry.errorCount}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              {telemetry.errorCount === 0 ? 'No dead jobs' : 'Jobs requiring manual intervention'}
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Stage Medallion Pipeline Progress */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Medallion Pipeline Flow" count="4 Stages" />
        <div style={{ padding: 'var(--space-5)', backgroundColor: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {stages.map((stg) => {
            const pct = stg.total > 0 ? Math.round((stg.done / stg.total) * 100) : 0;
            const statusColor = getStatusTokenColor(stg.state);

            return (
              <div key={stg.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-control)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {stg.state === 'done' && <CheckCircle2 size={18} color="var(--status-ok)" />}
                    {stg.state === 'running' && <RefreshCw size={18} className="sn-spinner" color="var(--brand)" />}
                    {stg.state === 'waiting' && <Clock size={18} color="var(--fg-3)" />}
                    {stg.state === 'failed' && <XCircle size={18} color="var(--status-bad)" />}

                    <span className="body-strong" style={{ color: 'var(--fg)' }}>
                      {stg.name}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: stg.state === 'done' ? 'var(--status-ok-bg)' : 'var(--surface-3)', color: statusColor }}>
                      {stg.state.toUpperCase()}
                    </span>
                  </div>

                  <div className="sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', fontSize: '0.8125rem', color: 'var(--fg-2)' }}>
                    {stg.done === 0 && stg.total === 0 ? '—' : `${stg.done.toLocaleString()} / ${stg.total.toLocaleString()} (${pct}%)`}
                  </div>
                </div>

                <div className="caption" style={{ color: 'var(--fg-2)' }}>
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
        <SectionHeading title="Active Worker Pool" count={`${workers.length} workers`} />
        {workers.length > 0 ? (
          <div className="sn-tablebox" style={{ overflowX: 'auto' }}>
            <table className="sn-table" aria-label="Scraper Workers Health">
              <thead>
                <tr>
                  <th scope="col">Worker Name</th>
                  <th scope="col">Kind / Service</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Success Rate</th>
                  <th scope="col" className="num">Jobs Today</th>
                  <th scope="col">Active Target / Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td className="body-strong" style={{ color: 'var(--fg)' }}>
                      {w.name}
                    </td>
                    <td style={{ color: 'var(--fg-2)' }}>{w.kind}</td>
                    <td>
                      <span className="sn-pill" data-status={w.status === 'running' ? 'ok' : w.status === 'error' ? 'bad' : 'info'} style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: w.status === 'running' ? 'var(--status-ok-bg)' : 'var(--surface-3)', color: getStatusTokenColor(w.status) }}>
                        ● {w.status}
                      </span>
                    </td>
                    <td className="num sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))' }}>
                      {w.successRate > 0 ? `${w.successRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="num sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))' }}>
                      {w.jobsToday.toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--fg-2)', fontSize: '0.8125rem' }}>
                      {w.activeTarget ? (
                        <span className="sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg)' }}>
                          {w.activeTarget}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fg-3)' }}>— Idle waiting for next queue item</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
           <p className="body" style={{ color: 'var(--fg-2)' }}>No workers are currently active.</p>
        )}
      </section>

      {/* Dead Jobs Retry Section */}
      {deadJobs.length > 0 && (
        <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
          <SectionHeading title="Dead Jobs Requiring Retry" count={`${deadJobs.length} jobs`} />
          <div className="sn-tablebox" style={{ overflowX: 'auto' }}>
            <table className="sn-table" aria-label="Dead Jobs">
              <thead>
                <tr>
                  <th scope="col">Job ID</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Last Error</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {deadJobs.map((j) => (
                  <tr key={j.job_id}>
                    <td className="sn-mono" style={{ fontSize: '0.8125rem' }}>{j.job_id.substring(0, 8)}</td>
                    <td>{j.kind}</td>
                    <td style={{ color: 'var(--status-bad)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.last_error || ''}>
                      {j.last_error || 'Unknown error'}
                    </td>
                    <td>
                      <button
                        className="sn-btn sn-btn--outline sn-btn--sm"
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
        <SectionHeading title="Pending & Failed Scrape Targets Queue" />
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)' }}>
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
