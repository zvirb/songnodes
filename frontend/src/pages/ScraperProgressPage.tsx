import React from 'react';
import { usePageHeader } from '../shell/AppShell';
import { PageHeader, SectionHeading } from '../shell/PageParts';
import { useLiveDataLoader } from '../hooks/useLiveDataLoader';
import TargetTracksManager from '../components/TargetTracksManager';
import { formatThroughput, getStatusTokenColor } from '../utils/dataLoaderUtils';
import {
  Cpu,
  Layers,
  Zap,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { SN, SnIcon } from '../lib/songnodes';

export const ScraperProgressPage: React.FC = () => {
  const {
    telemetry,
    stages,
    scrapers,
  } = useLiveDataLoader({
    autoStart: false,
    enableWebSocket: false
  });

  usePageHeader({
    lead: 'Pipeline',
    title: 'Pipeline & Scraper Ingestion Progress',
    current: 'pipeline'
  });

  const totalItems = telemetry.itemsProcessed + telemetry.itemsRemaining;
  const overallPercent = totalItems > 0 ? Math.round((telemetry.itemsProcessed / totalItems) * 100) : 0;

  return (
    <main className="sn-page__main" id="main" tabIndex={-1}>
      <PageHeader
        mod="pipeline"
        lead="Pipeline"
        title="Pipeline & Scraper Ingestion Progress"
        desc="Demonstration of the pipeline dashboard layout. Live job and worker telemetry is not connected."
      />

      <div className="sn-banner" data-status="warn">
        <span className="sn-banner__icon"><SnIcon name="triangle-alert" /></span>
        <div className="sn-banner__body">
          <p className="sn-banner__content">
            <span className="sn-banner__title">Sample data is shown.</span> Worker counts, throughput, errors and scraper activity below are illustrative, not current pipeline telemetry.
          </p>
        </div>
      </div>

      {/* Batch Telemetry Headline Metric Tiles */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Ingestion Telemetry" count={`${overallPercent}% complete`} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)'
          }}
        >
          {/* Tile 1: Active Workers */}
          <div
            className="sn-card"
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-surface-base, var(--surface-1))',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Active Workers</span>
              <Cpu size={18} color="var(--brand)" />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg)' }}>
              {telemetry.activeWorkers}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              Parallel scraping threads
            </div>
          </div>

          {/* Tile 2: Processed vs Remaining */}
          <div
            className="sn-card"
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-surface-base, var(--surface-1))',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Processed / Remaining</span>
              <Layers size={18} color="var(--status-ok)" />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg)' }}>
              {SN.format.count(telemetry.itemsProcessed)}
            </div>
            <div className="caption sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              {SN.format.count(telemetry.itemsRemaining)} pending targets left
            </div>
          </div>

          {/* Tile 3: Throughput Rate */}
          <div
            className="sn-card"
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-surface-base, var(--surface-1))',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Throughput Speed</span>
              <Zap size={18} color="var(--status-warn)" />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--fg)' }}>
              {formatThroughput(telemetry.throughputRate)}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              Illustrative throughput rate
            </div>
          </div>

          {/* Tile 4: Error Count */}
          <div
            className="sn-card"
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-surface-base, var(--surface-1))',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="label" style={{ color: 'var(--fg-3)', flex: 1 }}>Validation Errors</span>
              <AlertTriangle size={18} color={telemetry.errorCount > 0 ? "var(--color-status-warning, var(--status-warn))" : "var(--status-ok)"} />
            </div>
            <div className="figure sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', color: telemetry.errorCount > 0 ? 'var(--status-warn)' : 'var(--fg)' }}>
              {telemetry.errorCount}
            </div>
            <div className="caption" style={{ color: 'var(--fg-2)', marginTop: 'var(--space-1)' }}>
              {telemetry.errorCount === 0 ? 'No active exceptions' : 'Schema & rate limit errors'}
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Stage Medallion Pipeline Progress (StagedProgress) */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Medallion Pipeline Flow" count="4 Stages" />
        <div
          style={{
            padding: 'var(--space-5)',
            backgroundColor: 'var(--color-surface-base, var(--surface-1))',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)'
          }}
        >
          {stages.map((stg) => {
            const pct = stg.total > 0 ? Math.round((stg.done / stg.total) * 100) : 0;
            const statusColor = getStatusTokenColor(stg.state);

            return (
              <div
                key={stg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-surface-raised, var(--surface-2))',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-control)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {stg.state === 'done' && <CheckCircle2 size={18} color="var(--color-status-success, var(--status-ok))" />}
                    {stg.state === 'running' && <RefreshCw size={18} className="sn-spinner" color="var(--brand)" />}
                    {stg.state === 'waiting' && <Clock size={18} color="var(--fg-3)" />}
                    {stg.state === 'failed' && <XCircle size={18} color="var(--color-status-danger, var(--status-bad))" />}

                    <span className="body-strong" style={{ color: 'var(--fg)' }}>
                      {stg.name}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: stg.state === 'done' ? 'var(--status-ok-bg)' : 'var(--surface-3)',
                        color: statusColor
                      }}
                    >
                      {stg.state.toUpperCase()}
                    </span>
                  </div>

                  <div className="sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))', fontSize: '0.8125rem', color: 'var(--fg-2)' }}>
                    {stg.done.toLocaleString()} / {stg.total.toLocaleString()} ({pct}%)
                  </div>
                </div>

                <div className="caption" style={{ color: 'var(--fg-2)' }}>
                  {stg.description} {stg.detail ? `— ${stg.detail}` : ''}
                </div>

                {/* Stage Progress Bar */}
                <div
                  style={{
                    height: '8px',
                    width: '100%',
                    backgroundColor: 'var(--progress-track, var(--surface-3))',
                    borderRadius: 'var(--radius-pill)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: stg.state === 'done' ? 'var(--color-status-success, var(--status-ok))' : 'var(--brand)',
                      transition: 'width var(--duration-base) var(--ease-standard)'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scraper Worker Pool Status Table */}
      <section className="sn-page__section" style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeading title="Active Worker Pool" count={`${scrapers.length} workers`} />
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
              {scrapers.map((w) => (
                <tr key={w.id}>
                  <td className="body-strong" style={{ color: 'var(--fg)' }}>
                    {w.name}
                  </td>
                  <td style={{ color: 'var(--fg-2)' }}>{w.kind}</td>
                  <td>
                    <span
                      className="sn-pill"
                      data-status={w.status === 'running' ? 'ok' : w.status === 'error' ? 'bad' : 'info'}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: w.status === 'running' ? 'var(--status-ok-bg)' : 'var(--surface-3)',
                        color: getStatusTokenColor(w.status)
                      }}
                    >
                      ● {w.status}
                    </span>
                  </td>
                  <td className="num sn-mono" style={{ fontFamily: 'var(--font-mono, var(--font-data))' }}>
                    {w.successRate.toFixed(1)}%
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
      </section>

      {/* Target Tracks Queue Section */}
      <section className="sn-page__section">
        <SectionHeading title="Pending & Failed Scrape Targets Queue" />
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface-base, var(--surface-1))',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)'
          }}
        >
          <TargetTracksManager embedded filterStatus="pending" />
        </div>
      </section>
    </main>
  );
};

export default ScraperProgressPage;
