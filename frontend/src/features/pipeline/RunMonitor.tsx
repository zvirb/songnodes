/**
 * Run monitor (Module M5)
 *
 * Tracks scrape and pipeline run metrics, rolling average resolve yield, and health conditions.
 * Detects yield drops where a run's yield falls to less than half the previous 4 runs' average.
 */
import { useMemo } from 'react';
import type { ScrapeRun } from './usePipelineTelemetry';

export interface YieldMetrics {
  currentYield: number;
  avgYield: number;
  isYieldAlert: boolean;
  alertRun?: ScrapeRun;
}

export interface WorstCondition {
  status: 'bad' | 'warn';
  title: string;
  message: string;
  linkText: string;
  linkHref: string;
}

/**
 * Calculates resolve yield metrics and checks whether the latest completed run's yield
 * fell to less than half of the previous 4 completed runs' average.
 */
export function calculateYieldMetrics(runs: ScrapeRun[]): YieldMetrics {
  const completed = runs.filter((r) => r.state === 'done' || r.state === 'found_nothing' || r.state === 'failed');
  if (completed.length === 0) {
    return {
      currentYield: 0,
      avgYield: 0,
      isYieldAlert: false,
    };
  }

  const latest = completed[0];
  const currentYield = latest.tracks ?? 0;
  const previous = completed.slice(1, 5);

  if (previous.length === 0) {
    return {
      currentYield,
      avgYield: currentYield,
      isYieldAlert: false,
    };
  }

  const prevTotal = previous.reduce((sum, r) => sum + (r.tracks ?? 0), 0);
  const avgYield = prevTotal / previous.length;

  const isYieldAlert = avgYield > 0 && currentYield < 0.5 * avgYield;

  return {
    currentYield,
    avgYield,
    isYieldAlert,
    alertRun: isYieldAlert ? latest : undefined,
  };
}

/**
 * Evaluates the worst current condition to feature in the top Banner of MonitoringPage.
 * Follows severity budget: at most one Banner (bad before warn).
 */
export function getWorstCondition({
  runs,
  errorCount,
  yieldMetrics,
  stalledDetail,
}: {
  runs: ScrapeRun[];
  errorCount: number;
  yieldMetrics: YieldMetrics;
  stalledDetail?: string | null;
}): WorstCondition | null {
  // 1. Critical errors: stalled pipeline stages or high dead-letter count
  if (stalledDetail) {
    return {
      status: 'bad',
      title: 'Pipeline stage stalled.',
      message: stalledDetail,
      linkText: 'See run history',
      linkHref: '/pipeline/runs',
    };
  }

  const failedRuns = runs.filter((r) => r.state === 'failed');
  if (failedRuns.length > 0 || errorCount > 0) {
    const count = failedRuns.length || errorCount;
    const firstFailed = failedRuns[0];
    const name = firstFailed?.query || firstFailed?.source || 'Scraper';
    return {
      status: 'bad',
      title: `${name} failed after errors.`,
      message: `${count} job${count > 1 ? 's' : ''} failed or dead-lettered. Manual retry may be required.`,
      linkText: 'See the errors',
      linkHref: '/pipeline/runs',
    };
  }

  // 2. Yield drop alert (warn): resolve yield fell to less than half the previous 4 runs
  if (yieldMetrics.isYieldAlert && yieldMetrics.alertRun) {
    const run = yieldMetrics.alertRun;
    const name = run.query || run.source || 'Latest run';
    return {
      status: 'warn',
      title: `Resolve yield dropped for ${name}.`,
      message: `Fell to ${yieldMetrics.currentYield} tracks, less than half of the previous 4 runs average (${Math.round(yieldMetrics.avgYield)} tracks).`,
      linkText: 'See run history',
      linkHref: '/pipeline/runs',
    };
  }

  return null;
}

/**
 * Hook providing Run Monitor telemetry and worst-condition alerts.
 */
export function useRunMonitor(
  runs: ScrapeRun[],
  errorCount = 0,
  stalledDetail?: string | null,
) {
  const yieldMetrics = useMemo(() => calculateYieldMetrics(runs), [runs]);
  const worstCondition = useMemo(
    () => getWorstCondition({ runs, errorCount, yieldMetrics, stalledDetail }),
    [runs, errorCount, yieldMetrics, stalledDetail],
  );

  const lastFinishedRun = useMemo(
    () => runs.find((r) => r.state !== 'running' && r.state !== 'queued'),
    [runs],
  );

  return {
    yieldMetrics,
    worstCondition,
    lastFinishedRun,
  };
}
