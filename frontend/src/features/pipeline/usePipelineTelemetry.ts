import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import { SN } from '../../lib/songnodes';
import {
  PipelineBatchTelemetry,
  MedallionStageInfo,
  ScraperWorkerHealth,
  JobResponse,
  OutboxStatusResponse,
} from '../../utils/dataLoaderUtils';

export const mapJobsToTelemetry = (jobs: JobResponse[]): PipelineBatchTelemetry => {
  let itemsProcessed = 0;
  let itemsRemaining = 0;
  let errorCount = 0;
  const activeKinds = new Set<string>();
  const recentFinishedTimes: number[] = [];
  const now = Date.now();
  const fifteenMinsAgo = now - 15 * 60 * 1000;

  jobs.forEach(job => {
    if (job.status === 'succeeded') {
      itemsProcessed++;
      if (job.finished_at) {
        const time = new Date(job.finished_at).getTime();
        if (time >= fifteenMinsAgo) {
          recentFinishedTimes.push(time);
        }
      }
    } else if (job.status === 'queued' || job.status === 'running') {
      itemsRemaining++;
      if (job.status === 'running') {
        activeKinds.add(job.kind);
      }
    } else if (job.status === 'dead') {
      errorCount++;
    }
  });

  let throughputRate: number | null = null;
  if (recentFinishedTimes.length >= 2) {
    throughputRate = recentFinishedTimes.length / 15; // items per minute over the last 15 mins
  }

  return {
    activeWorkers: activeKinds.size,
    itemsProcessed,
    itemsRemaining,
    throughputRate,
    errorCount,
    lastSyncIso: new Date().toISOString(),
  };
};

/** Job kinds the worker runs on a timer; they are housekeeping, not pipeline work. */
export const HOUSEKEEPING_KINDS = new Set(['projection_consume', 'ingest_pending']);

export type ScrapeRunState = 'queued' | 'running' | 'found_nothing' | 'done' | 'failed';

export interface ScrapeRun {
  id: string;
  source: string;
  query: string;
  state: ScrapeRunState;
  createdAt: string;
  finishedAt: string | null;
  seconds: number | null;
  playlists: number | null;
  tracks: number | null;
  error: string | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One row per scrape job, in API order (newest first). A finished scrape that saved nothing is 'found_nothing', not 'done'. */
export const mapScrapeRuns = (jobs: JobResponse[]): ScrapeRun[] => {
  const runs: ScrapeRun[] = jobs
    .filter((j) => j.kind === 'scrape')
    .map((j) => {
      const r = j.result ?? {};
      const scraper: Record<string, unknown> = r.scraper && typeof r.scraper === 'object' ? r.scraper : {};
      const playlists = num(r.bronze_playlists) ?? num(scraper.bronze_playlists_persisted);
      const tracks = num(r.bronze_tracks) ?? num(scraper.bronze_tracks_persisted);
      let state: ScrapeRunState;
      if (j.status === 'queued') state = 'queued';
      else if (j.status === 'running') state = 'running';
      else if (j.status === 'dead') state = 'failed';
      else if (r.found_nothing === true || (playlists ?? 0) === 0) state = 'found_nothing';
      else state = 'done';
      const seconds = num(scraper.duration_seconds) ?? (j.started_at && j.finished_at
        ? (new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000
        : null);
      return {
        id: j.job_id,
        source: String(j.payload?.source ?? ''),
        query: String(j.payload?.search_query ?? ''),
        state,
        createdAt: j.created_at,
        finishedAt: j.finished_at,
        seconds,
        playlists,
        tracks,
        error: j.last_error,
      };
    });
  return runs; // GET /jobs returns newest first
};

const STALL_MS = 10 * 60 * 1000;

/**
 * The four stages from real signals: scrape jobs (bronze), the projection_tracks and
 * graph_projection outbox consumers (silver, gold) and the projection drift report (serving).
 * A consumer with a backlog that has not moved for 10 minutes is shown as failed (stalled).
 */
export const mapPipelineStages = (outbox: OutboxStatusResponse, runs: ScrapeRun[], now = Date.now()): MedallionStageInfo[] => {
  const consumer = (id: string) => outbox.consumers.find((c) => c.consumer === id);
  const consumerStage = (id: string): Pick<MedallionStageInfo, 'state' | 'done' | 'total' | 'detail'> => {
    const c = consumer(id);
    if (!c) return { state: 'waiting', done: 0, total: 0, detail: `No ${id} consumer reported` };
    if (c.backlog === 0) return { state: 'done', done: 0, total: 0, detail: c.updated_at ? `Up to date, last run ${SN.format.relative(c.updated_at)}` : 'Up to date' };
    const age = c.updated_at ? now - new Date(c.updated_at).getTime() : Infinity;
    if (age > STALL_MS) {
      return { state: 'failed', done: 0, total: c.backlog, detail: `Stalled: ${SN.format.count(c.backlog)} waiting, no progress since ${c.updated_at ? SN.format.dateTime(c.updated_at) : 'it started'}` };
    }
    return { state: 'running', done: 0, total: c.backlog, detail: `${SN.format.count(c.backlog)} waiting` };
  };

  const active = runs.filter((r) => r.state === 'running' || r.state === 'queued');
  const lastFinished = runs.find((r) => r.state !== 'running' && r.state !== 'queued');
  let bronze: Pick<MedallionStageInfo, 'state' | 'done' | 'total' | 'detail'>;
  if (active.length > 0) {
    bronze = { state: 'running', done: 0, total: 0, detail: `Scraping ${active.map((r) => r.query || r.source).join(', ')}` };
  } else if (!lastFinished) {
    bronze = { state: 'waiting', done: 0, total: 0, detail: 'No scrape has run yet' };
  } else if (lastFinished.state === 'found_nothing') {
    bronze = { state: 'warning', done: 0, total: 0, detail: `Last scrape (${lastFinished.query || lastFinished.source}) found nothing` };
  } else if (lastFinished.state === 'failed') {
    bronze = { state: 'failed', done: 0, total: 0, detail: `Last scrape (${lastFinished.query || lastFinished.source}) failed` };
  } else {
    bronze = { state: 'done', done: 0, total: 0, detail: `Last scrape saved ${SN.format.count(lastFinished.playlists)} playlists, ${SN.format.count(lastFinished.tracks)} tracks` };
  }

  const p: Record<string, unknown> = outbox.projection ?? {};
  const sourceTotal = num(p.source_total) ?? 0;
  const projected = num(p.projection_total) ?? 0;
  const missing = num(p.missing) ?? 0;
  const stale = num(p.stale) ?? 0;
  const serving: Pick<MedallionStageInfo, 'state' | 'done' | 'total' | 'detail'> = sourceTotal === 0
    ? { state: 'waiting', done: 0, total: 0, detail: 'No tracks to serve yet' }
    : { state: missing + stale === 0 ? 'done' : 'warning', done: projected, total: sourceTotal,
        detail: missing + stale === 0 ? 'Graph matches the catalogue' : `${SN.format.count(missing)} missing, ${SN.format.count(stale)} out of date in the graph` };

  return [
    { id: 'bronze', name: 'Stage 1: bronze ingestion', description: 'Complete playlists scraped with positions', ...bronze },
    { id: 'silver', name: 'Stage 2: silver normalization', description: 'Canonical tracks and transitions (projection_tracks)', ...consumerStage('projection_tracks') },
    { id: 'gold', name: 'Stage 3: gold graphing', description: 'Graph projection of tracks and edges (graph_projection)', ...consumerStage('graph_projection') },
    { id: 'serving', name: 'Stage 4: serving index', description: 'Tracks visible in the graph', ...serving },
  ];
};

/** Kept for callers of the old name. */
export const mapOutboxToStages = (outbox: OutboxStatusResponse): MedallionStageInfo[] => mapPipelineStages(outbox, []);

export const mapJobsToWorkers = (jobs: JobResponse[]): ScraperWorkerHealth[] => {
  const workersMap = new Map<string, {
    kind: string;
    source: string;
    jobsToday: number;
    successesLast100: number;
    totalLast100: number;
    lastSuccessAt: string | null;
    status: 'idle' | 'running' | 'error' | 'disabled' | 'circuit_open';
    activeTarget?: string;
  }>();

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Group by (kind, source)
  jobs.forEach(job => {
    const source = job.payload?.source ?? '';
    const key = `${job.kind}-${source}`;

    if (!workersMap.has(key)) {
      workersMap.set(key, {
        kind: job.kind,
        source: source,
        jobsToday: 0,
        successesLast100: 0,
        totalLast100: 0,
        lastSuccessAt: null,
        status: 'idle',
      });
    }

    const worker = workersMap.get(key)!;

    if (job.finished_at && new Date(job.finished_at).getTime() >= todayStart.getTime()) {
      worker.jobsToday++;
    }

    if (job.status === 'running') {
      worker.status = 'running';
      worker.activeTarget = job.payload?.search_query || job.payload?.track_id || source || undefined;
    } else if (job.status === 'dead' && worker.status !== 'running') {
      worker.status = 'error';
    }

    if (job.status === 'succeeded' && job.finished_at) {
      if (!worker.lastSuccessAt || new Date(job.finished_at) > new Date(worker.lastSuccessAt)) {
        worker.lastSuccessAt = job.finished_at;
      }
    }
  });

  // Calculate success rate over last 100 for each worker
  for (const [key, worker] of workersMap.entries()) {
    const workerJobs = jobs.filter(j => j.kind === worker.kind && (j.payload?.source || 'unknown') === worker.source)
      .filter(j => j.status === 'succeeded' || j.status === 'dead')
      .sort((a, b) => {
         const tA = a.finished_at ? new Date(a.finished_at).getTime() : 0;
         const tB = b.finished_at ? new Date(b.finished_at).getTime() : 0;
         return tB - tA; // descending
      })
      .slice(0, 100);

    worker.totalLast100 = workerJobs.length;
    worker.successesLast100 = workerJobs.filter(j => j.status === 'succeeded').length;
  }

  return Array.from(workersMap.values()).map(w => ({
    id: `${w.kind}-${w.source}`,
    name: w.source ? `${w.source} worker` : "",
    kind: w.kind,
    status: w.status,
    lastSuccessAt: w.lastSuccessAt,
    successRate: w.totalLast100 > 0 ? (w.successesLast100 / w.totalLast100) * 100 : 0,
    jobsToday: w.jobsToday,
    activeTarget: w.activeTarget,
  }));
};

export const usePipelineTelemetry = () => {
  const [telemetry, setTelemetry] = useState<PipelineBatchTelemetry>({
    activeWorkers: 0,
    itemsProcessed: 0,
    itemsRemaining: 0,
    throughputRate: null,
    errorCount: 0,
    lastSyncIso: new Date().toISOString(),
  });
  const [stages, setStages] = useState<MedallionStageInfo[]>([]);
  const [workers, setWorkers] = useState<ScraperWorkerHealth[]>([]);
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [scrapeRuns, setScrapeRuns] = useState<ScrapeRun[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [source, setSource] = useState<'live' | 'unavailable'>('unavailable');

  const timeoutRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      if (document.hidden) return; // Pause polling when tab is hidden

      // Scrape jobs are fetched on their own so housekeeping ticks cannot push them out of the window.
      const [jobsRes, scrapeRes, outboxRes] = await Promise.all([
        api.get('/jobs?limit=200'),
        api.get('/jobs?kind=scrape&limit=50'),
        api.get('/outbox/status')
      ]);

      if (!isMounted.current) return;

      const fetchedJobs = (jobsRes.data || []) as JobResponse[];
      const outboxStatus = (outboxRes.data || { consumers: [], dead_letters: 0, projection: {} }) as OutboxStatusResponse;

      const scrapeJobs: JobResponse[] = scrapeRes.data || [];
      const runs = mapScrapeRuns(scrapeJobs);
      const pipelineJobs = fetchedJobs.filter((j) => !HOUSEKEEPING_KINDS.has(j.kind));

      setJobs(fetchedJobs);
      setScrapeRuns(runs);
      setTelemetry(mapJobsToTelemetry(pipelineJobs));
      setStages(mapPipelineStages(outboxStatus, runs));
      setWorkers(mapJobsToWorkers(pipelineJobs));
      setSource('live');
      setError(null);
      setLastUpdated(Date.now());
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err.message || 'Failed to fetch pipeline data');
      setSource('unavailable');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();

    const startPolling = (interval = 10000) => {
      timeoutRef.current = window.setTimeout(async () => {
        await fetchData();
        // Simple backoff on error
        startPolling(error ? 30000 : 10000);
      }, interval);
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, error]);

  return { telemetry, stages, workers, jobs, scrapeRuns, isLoading, error, lastUpdated, source, refresh };
};
