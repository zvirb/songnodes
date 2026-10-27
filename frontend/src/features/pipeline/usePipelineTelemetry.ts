import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
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

export const mapOutboxToStages = (outbox: OutboxStatusResponse): MedallionStageInfo[] => {
  const getBacklog = (consumerId: string) => {
    const consumer = outbox.consumers.find(c => c.consumer === consumerId);
    return consumer ? consumer.backlog : 0;
  };

  const silverBacklog = getBacklog('silver_normalization');
  const goldBacklog = getBacklog('gold_graphing');
  const servingBacklog = getBacklog('serving_index') || (outbox.projection ? (outbox.projection.pending || 0) : 0);

  return [
    {
      id: 'bronze',
      name: "Stage 1: bronze ingestion",
      description: 'Raw scraping & API queries from 1001TL, Spotify & Tidal',
      state: 'done', // Em Dash logic - no real tracking for bronze from outbox, so we assume done for now or let jobs dictate it.
      done: 0,
      total: 0,
      detail: 'See active worker pool for ingestion status',
    },
    {
      id: 'silver',
      name: "Stage 2: silver normalization",
      description: 'Artist cleaning, schema validation & key/BPM standardization',
      state: silverBacklog > 0 ? 'running' : 'waiting',
      done: 0,
      total: silverBacklog,
      detail: silverBacklog > 0 ? `Processing ${silverBacklog} queued items` : '—',
    },
    {
      id: 'gold',
      name: "Stage 3: gold graphing",
      description: 'Adjacency matrix generation, track affinity & edge weighting',
      state: goldBacklog > 0 ? 'running' : 'waiting',
      done: 0,
      total: goldBacklog,
      detail: goldBacklog > 0 ? `Computing graphs for ${goldBacklog} items` : '—',
    },
    {
      id: 'serving',
      name: "Stage 4: serving index",
      description: 'Operational cache synchronization & client delivery',
      state: servingBacklog > 0 ? 'running' : 'waiting',
      done: 0,
      total: servingBacklog,
      detail: servingBacklog > 0 ? `Indexing ${servingBacklog} changes` : '—',
    },
  ];
};

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

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [source, setSource] = useState<'live' | 'unavailable'>('unavailable');

  const timeoutRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      if (document.hidden) return; // Pause polling when tab is hidden

      const [jobsRes, outboxRes] = await Promise.all([
        api.get('/jobs?limit=200'),
        api.get('/outbox/status')
      ]);

      if (!isMounted.current) return;

      const fetchedJobs = (jobsRes.data || []) as JobResponse[];
      const outboxStatus = (outboxRes.data || { consumers: [], dead_letters: 0, projection: {} }) as OutboxStatusResponse;

      setJobs(fetchedJobs);
      setTelemetry(mapJobsToTelemetry(fetchedJobs));
      setStages(mapOutboxToStages(outboxStatus));
      setWorkers(mapJobsToWorkers(fetchedJobs));
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

  return { telemetry, stages, workers, jobs, isLoading, error, lastUpdated, source, refresh };
};
