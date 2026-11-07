import React, { useState, useMemo } from 'react';
import { RefreshCw, Play, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { SN } from '../../lib/songnodes';
import { Button, StatusPill, DataTable, type DataTableColumn } from '../../components/ds';
import { usePipelineTelemetry, type ScrapeRun, type ScrapeRunState } from './usePipelineTelemetry';
import { ScrapeJobStages } from './ScrapeJobStages';

export interface RunsPageProps {
  onBack?: () => void;
}

const STATE_CONFIG: Record<ScrapeRunState, { label: string; raw: string }> = {
  queued: { label: 'Queued', raw: 'queued' },
  running: { label: 'Running', raw: 'running' },
  done: { label: 'Done', raw: 'succeeded' },
  failed: { label: 'Failed', raw: 'dead' },
  found_nothing: { label: 'Found nothing', raw: 'warn' },
};

export const RunsPage: React.FC<RunsPageProps> = ({ onBack }) => {
  const { scrapeRuns, isLoading, refresh } = usePipelineTelemetry();
  const [filter, setFilter] = useState<string>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const filteredRuns = useMemo(() => {
    if (filter === 'all') return scrapeRuns;
    return scrapeRuns.filter((r) => r.state === filter);
  }, [scrapeRuns, filter]);

  const selectedRun = useMemo(
    () => scrapeRuns.find((r) => r.id === selectedJobId) ?? null,
    [scrapeRuns, selectedJobId],
  );

  const columns = useMemo<DataTableColumn<ScrapeRun>[]>(
    () => [
      {
        id: 'query',
        header: 'Target / Query',
        cell: (r) => (
          <div className="sn-track-cell">
            <span className="sn-track-cell__title">
              <span className="sn-track-cell__name" style={{ fontWeight: 600 }}>
                {r.query || '–'}
              </span>
            </span>
            <span className="sn-track-cell__meta">
              <span>Job {r.id.slice(0, 8)}</span>
            </span>
          </div>
        ),
        sortValue: (r) => r.query,
      },
      {
        id: 'source',
        header: 'Source',
        cell: (r) => <span>{r.source === '1001tracklists' ? '1001Tracklists' : r.source === 'mixesdb' ? 'MixesDB' : r.source || '–'}</span>,
        sortValue: (r) => r.source,
      },
      {
        id: 'state',
        header: 'Status',
        cell: (r) => {
          const cfg = STATE_CONFIG[r.state] ?? { label: r.state, raw: r.state };
          return <StatusPill raw={cfg.raw} label={cfg.label} />;
        },
        sortValue: (r) => r.state,
      },
      {
        id: 'tracks',
        header: 'Tracks yield',
        numeric: true,
        cell: (r) => <span>{r.tracks !== null ? SN.format.count(r.tracks) : '–'}</span>,
        sortValue: (r) => r.tracks ?? -1,
      },
      {
        id: 'time',
        header: 'Created',
        cell: (r) => (
          <time dateTime={r.createdAt} title={SN.format.dateTime(r.createdAt)}>
            {SN.format.relative(r.createdAt)}
          </time>
        ),
        sortValue: (r) => new Date(r.createdAt).getTime(),
      },
      {
        id: 'duration',
        header: 'Duration',
        numeric: true,
        cell: (r) => <span>{r.seconds !== null ? `${Math.round(r.seconds)} s` : '–'}</span>,
        sortValue: (r) => r.seconds ?? -1,
      },
      {
        id: 'action',
        header: 'Stages',
        cell: (r) => (
          <button
            type="button"
            className="sn-btn sn-btn--quiet sn-btn--sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedJobId(selectedJobId === r.id ? null : r.id);
            }}
          >
            {selectedJobId === r.id ? 'Close' : 'View stages'}
          </button>
        ),
      },
    ],
    [selectedJobId],
  );

  return (
    <main className="sn-page-log sn-page__main" id="main" tabIndex={-1}>
      <div className="sn-page-log__section">
        <header className="sn-page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            {onBack ? (
              <button
                type="button"
                className="sn-btn sn-btn--quiet sn-btn--sm"
                onClick={onBack}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <ArrowLeft size={16} />
                <span>Back to health</span>
              </button>
            ) : (
              <a
                href="/pipeline"
                className="sn-btn sn-btn--quiet sn-btn--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <ArrowLeft size={16} />
                <span>Back to health</span>
              </a>
            )}
          </div>
          <div className="sn-page-header__main">
            <h1 className="sn-title title-l">
              <span className="sn-lead">Pipeline:</span> Run history
            </h1>
            <div className="sn-page-header__actions">
              <Button
                kind="quiet"
                size="sm"
                onClick={() => { void refresh(); }}
                disabled={isLoading}
              >
                <RefreshCw size={14} className={isLoading ? 'sn-spinner' : ''} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
          <p className="sn-page-header__desc">
            Complete history of scrape and pipeline runs, durations, and resolve yields.
          </p>
        </header>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', margin: 'var(--space-4) 0', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All runs (${scrapeRuns.length})` },
            { id: 'running', label: `Running (${scrapeRuns.filter((r) => r.state === 'running').length})` },
            { id: 'done', label: `Done (${scrapeRuns.filter((r) => r.state === 'done').length})` },
            { id: 'found_nothing', label: `Found nothing (${scrapeRuns.filter((r) => r.state === 'found_nothing').length})` },
            { id: 'failed', label: `Failed (${scrapeRuns.filter((r) => r.state === 'failed').length})` },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              className={`sn-chip${filter === c.id ? ' sn-chip--active' : ''}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Selected job StagedProgress inspector */}
        {selectedRun && (
          <div style={{ margin: 'var(--space-4) 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span className="body-strong">Inspect run: {selectedRun.query || selectedRun.id}</span>
              <button
                type="button"
                className="sn-btn sn-btn--quiet sn-btn--sm"
                onClick={() => setSelectedJobId(null)}
              >
                Close inspector
              </button>
            </div>
            <ScrapeJobStages
              jobId={selectedRun.id}
              query={selectedRun.query}
              source={selectedRun.source}
            />
          </div>
        )}

        {/* Runs DataTable */}
        <DataTable<ScrapeRun>
          rows={filteredRuns}
          columns={columns}
          rowId={(r) => r.id}
          caption="Pipeline and scrape run history"
          state={isLoading && scrapeRuns.length === 0 ? 'loading' : filteredRuns.length === 0 ? 'empty' : 'data'}
          emptyMessage={{
            title: 'No runs recorded',
            body: filter === 'all'
              ? 'No scrape or pipeline runs have run yet.'
              : `No runs matching status filter "${filter}".`,
          }}
          onRowOpen={(r) => setSelectedJobId(selectedJobId === r.id ? null : r.id)}
        />
      </div>
    </main>
  );
};

export default RunsPage;
