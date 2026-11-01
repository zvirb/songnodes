import { SN, type DesignStatus } from '../lib/songnodes';

/**
 * The scrape jobs of a target's latest search (GET /api/v1/target-tracks `search_jobs`): every scrape job for
 * the target created at or after `last_searched`, one per source. Null when the target was never searched.
 */
export interface TargetSearchJobs {
  queued: number;
  running: number;
  succeeded: number;
  dead: number;
  finished_at: string | null;
  last_error: string | null;
}

export interface TargetSearchFields {
  last_searched?: string | null;
  playlists_found?: number;
  search_jobs?: TargetSearchJobs | null;
}

export type TargetSearchKind = 'never' | 'unrecorded' | 'queued' | 'running' | 'done' | 'partial' | 'failed';

export interface TargetSearchStatus {
  kind: TargetSearchKind;
  status: DesignStatus;
  label: string;
  /** One line next to the pill; null when there is nothing more to say. */
  detail: string | null;
  /** The last search failed (wholly or partly): offer "Retry search". */
  retry: boolean;
}

const playlists = (n: number) => `${SN.format.count(n)} ${n === 1 ? 'playlist' : 'playlists'} found`;
const sourcesDone = (done: number, total: number) => `${SN.format.count(done)} of ${SN.format.count(total)} sources done`;

/** Maps real search data to one status. No percentage: nothing in the backend computes one. */
export function targetSearchStatus(target: TargetSearchFields): TargetSearchStatus {
  const started = target.last_searched;
  if (!started) return { kind: 'never', status: 'idle', label: 'Never searched', detail: null, retry: false };

  const jobs = target.search_jobs;
  const total = jobs ? jobs.queued + jobs.running + jobs.succeeded + jobs.dead : 0;
  if (!jobs || total === 0) {
    // last_searched is stamped when a search is queued; without a job record the outcome is not known.
    return { kind: 'unrecorded', status: 'info', label: 'Search started', detail: `${SN.format.dateTime(started)} · no scrape job on record`, retry: false };
  }

  const finished = jobs.succeeded + jobs.dead;
  if (jobs.running > 0) {
    return { kind: 'running', status: 'running', label: 'Searching…', detail: total > 1 ? sourcesDone(finished, total) : `Started ${SN.format.dateTime(started)}`, retry: false };
  }
  if (jobs.queued > 0) {
    return { kind: 'queued', status: 'idle', label: 'Queued', detail: total > 1 ? sourcesDone(finished, total) : `Since ${SN.format.dateTime(started)}`, retry: false };
  }

  const found = playlists(target.playlists_found ?? 0);
  if (jobs.dead === 0) {
    return { kind: 'done', status: 'ok', label: 'Searched', detail: `${SN.format.dateTime(jobs.finished_at ?? started)} · ${found}`, retry: false };
  }
  if (jobs.succeeded > 0) {
    return { kind: 'partial', status: 'warn', label: 'Partly done', detail: `${SN.format.count(jobs.dead)} of ${SN.format.count(total)} sources failed · ${found}`, retry: true };
  }
  return { kind: 'failed', status: 'bad', label: 'Search failed', detail: jobs.last_error || SN.format.dateTime(jobs.finished_at ?? started), retry: true };
}

/** Still waiting on a result: never searched, searching, or the last search failed (wholly or partly). */
export const isPendingSearch = (target: TargetSearchFields) => targetSearchStatus(target).kind !== 'done';
